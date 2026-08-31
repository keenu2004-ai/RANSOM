import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GoogleDriveStorageProvider } from './googleDriveStorageProvider';

const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
const LOCAL_STORAGE_DIR = process.env.STORAGE_ROOT || path.join(process.cwd(), 'uploads');

if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

const localDownloadTokens = new Map<
  string,
  { filePath: string; mimeType: string; expiresAt: number }
>();

function safeObjectPath(objectPath: string): string {
  const normalized = path.posix.normalize(objectPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const resolved = path.resolve(LOCAL_STORAGE_DIR, normalized);

  if (
    resolved !== LOCAL_STORAGE_DIR &&
    !resolved.startsWith(`${LOCAL_STORAGE_DIR}${path.sep}`)
  ) {
    throw new Error('Invalid storage object path');
  }

  return resolved;
}

export class StorageService {
  static isDriveConfigured(): boolean {
    return GoogleDriveStorageProvider.isConfigured();
  }

  static isLocalConfigured(): boolean {
    return STORAGE_PROVIDER === 'local';
  }

  static isGcsConfigured(): boolean {
    return false;
  }

  static async verifyConnectivityTest(): Promise<{ success: boolean; message: string }> {
    if (this.isLocalConfigured()) {
      try {
        fs.accessSync(LOCAL_STORAGE_DIR, fs.constants.R_OK | fs.constants.W_OK);
        return {
          success: true,
          message: `LOCAL STORAGE OK: ${LOCAL_STORAGE_DIR}`
        };
      } catch {
        return {
          success: false,
          message: `LOCAL STORAGE NOT ACCESSIBLE: ${LOCAL_STORAGE_DIR}`
        };
      }
    }

    if (this.isDriveConfigured()) {
      return GoogleDriveStorageProvider.verifyConnectivityTest();
    }

    return {
      success: false,
      message: 'NO STORAGE PROVIDER CONFIGURED'
    };
  }

  static async uploadBuffer(
    objectPath: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<{
    objectPath: string;
    storageFileId?: string;
    storageFolderId?: string;
  }> {
    if (STORAGE_PROVIDER === 'google_drive') {
      if (!this.isDriveConfigured()) {
        throw new Error('GOOGLE DRIVE STORAGE NOT CONFIGURED');
      }

      return GoogleDriveStorageProvider.uploadBuffer(
        objectPath,
        buffer,
        mimeType
      );
    }

    const localFilePath = safeObjectPath(objectPath);
    const dir = path.dirname(localFilePath);

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localFilePath, buffer);

    return {
      objectPath,
      storageFileId: undefined,
      storageFolderId: undefined
    };
  }

  static async downloadStream(
    storageFileId?: string | null,
    objectPath?: string | null
  ): Promise<any> {
    if (
      storageFileId &&
      STORAGE_PROVIDER === 'google_drive' &&
      this.isDriveConfigured()
    ) {
      return GoogleDriveStorageProvider.downloadStream(storageFileId);
    }

    if (objectPath) {
      const localFilePath = safeObjectPath(objectPath);

      if (fs.existsSync(localFilePath)) {
        return fs.createReadStream(localFilePath);
      }
    }

    throw new Error(
      `File binary not found in storage (File ID: ${
        storageFileId || 'none'
      }, Path: ${objectPath || 'none'})`
    );
  }

  static async verifyObjectExists(
    storageFileId?: string | null,
    objectPath?: string | null
  ): Promise<boolean> {
    if (
      storageFileId &&
      STORAGE_PROVIDER === 'google_drive' &&
      this.isDriveConfigured()
    ) {
      return GoogleDriveStorageProvider.verifyFileExists(storageFileId);
    }

    if (objectPath) {
      return fs.existsSync(safeObjectPath(objectPath));
    }

    return false;
  }

  static async deleteObject(
    storageFileId?: string | null,
    objectPath?: string | null
  ): Promise<boolean> {
    try {
      if (
        storageFileId &&
        STORAGE_PROVIDER === 'google_drive' &&
        this.isDriveConfigured()
      ) {
        return await GoogleDriveStorageProvider.deleteFile(storageFileId);
      }

      if (objectPath) {
        const localFilePath = safeObjectPath(objectPath);

        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
        }
      }

      return true;
    } catch (err) {
      console.warn('[STORAGE] Deleting object failed:', err);
      return false;
    }
  }

  static async purgePrefix(prefixPath: string): Promise<number> {
    let deletedCount = 0;

    try {
      const localPrefix = safeObjectPath(prefixPath);

      if (!fs.existsSync(localPrefix)) {
        return 0;
      }

      const removeRecursive = (directory: string) => {
        for (const entry of fs.readdirSync(directory, {
          withFileTypes: true
        })) {
          const fullPath = path.join(directory, entry.name);

          if (entry.isDirectory()) {
            removeRecursive(fullPath);
            fs.rmdirSync(fullPath);
          } else {
            fs.unlinkSync(fullPath);
            deletedCount++;
          }
        }
      };

      if (fs.statSync(localPrefix).isDirectory()) {
        removeRecursive(localPrefix);
      }

      return deletedCount;
    } catch (err) {
      console.warn(`[STORAGE] Purge prefix failed for ${prefixPath}:`, err);
      return deletedCount;
    }
  }

  static async getSignedUploadUrl(
    objectPath: string,
    mimeType: string,
    expiresInMinutes: number = 15
  ): Promise<{
    uploadUrl: string;
    objectPath: string;
    headers?: Record<string, string>;
  }> {
    const uploadUrl = `/api/files/upload-direct?objectPath=${encodeURIComponent(
      objectPath
    )}`;

    return {
      uploadUrl,
      objectPath
    };
  }

  static async getSignedDownloadUrl(
    objectPath: string,
    originalFilename?: string,
    expiresInMinutes: number = 60
  ): Promise<string> {
    const token = crypto.randomBytes(24).toString('hex');

    const localFilePath = safeObjectPath(objectPath);

    localDownloadTokens.set(token, {
      filePath: localFilePath,
      mimeType: 'application/octet-stream',
      expiresAt: Date.now() + expiresInMinutes * 60 * 1000
    });

    return `/api/files/download-local/${token}/${encodeURIComponent(
      originalFilename || 'document'
    )}`;
  }

  static getLocalStreamDetails(
    token: string
  ): { filePath: string; mimeType: string } | null {
    const details = localDownloadTokens.get(token);

    if (!details) {
      return null;
    }

    if (Date.now() > details.expiresAt) {
      localDownloadTokens.delete(token);
      return null;
    }

    return details;
  }
}
