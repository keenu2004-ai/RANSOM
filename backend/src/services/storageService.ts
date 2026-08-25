import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GoogleDriveStorageProvider } from './googleDriveStorageProvider';

// Local Storage Fallback Directory for development
const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

// Tokenized local download map
const localDownloadTokens = new Map<string, { filePath: string; mimeType: string; expiresAt: number }>();

export class StorageService {
  /**
   * Check if Google Drive storage is configured
   */
  static isDriveConfigured(): boolean {
    return GoogleDriveStorageProvider.isConfigured();
  }

  /**
   * Check if GCS is actively configured (legacy fallback check - returns false in production)
   */
  static isGcsConfigured(): boolean {
    return false;
  }

  /**
   * Verify Google Drive connectivity and health
   */
  static async verifyConnectivityTest(): Promise<{ success: boolean; message: string }> {
    if (this.isDriveConfigured()) {
      return GoogleDriveStorageProvider.verifyConnectivityTest();
    }
    return { success: false, message: 'GOOGLE DRIVE STORAGE NOT CONFIGURED' };
  }

  /**
   * Upload buffer directly to Google Drive (or Local Disk in dev fallback mode)
   */
  static async uploadBuffer(
    objectPath: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<{ objectPath: string; storageFileId?: string; storageFolderId?: string }> {
    if (this.isDriveConfigured()) {
      return GoogleDriveStorageProvider.uploadBuffer(objectPath, buffer, mimeType);
    }

    // In production mode, fail fast if Drive is not configured
    if (process.env.NODE_ENV === 'production') {
      throw new Error('GOOGLE DRIVE STORAGE NOT CONFIGURED');
    }

    // Local dev fallback
    const localFilePath = path.join(LOCAL_STORAGE_DIR, objectPath.replace(/\//g, '_'));
    const dir = path.dirname(localFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localFilePath, buffer);
    return { objectPath };
  }

  /**
   * Get readable download stream from Google Drive or Local Disk
   */
  static async downloadStream(storageFileId?: string | null, objectPath?: string | null): Promise<any> {
    if (storageFileId && this.isDriveConfigured()) {
      return GoogleDriveStorageProvider.downloadStream(storageFileId);
    }

    if (objectPath) {
      const localFilePath = path.join(LOCAL_STORAGE_DIR, objectPath.replace(/\//g, '_'));
      if (fs.existsSync(localFilePath)) {
        return fs.createReadStream(localFilePath);
      }
    }

    throw new Error(`File binary not found in storage (File ID: ${storageFileId || 'none'}, Path: ${objectPath || 'none'})`);
  }

  /**
   * Verify if an object exists in Google Drive or Local Disk
   */
  static async verifyObjectExists(storageFileId?: string | null, objectPath?: string | null): Promise<boolean> {
    if (storageFileId && this.isDriveConfigured()) {
      return GoogleDriveStorageProvider.verifyFileExists(storageFileId);
    }

    if (objectPath) {
      const localFilePath = path.join(LOCAL_STORAGE_DIR, objectPath.replace(/\//g, '_'));
      return fs.existsSync(localFilePath);
    }

    return false;
  }

  /**
   * Delete a single object from Google Drive or Local Disk
   */
  static async deleteObject(storageFileId?: string | null, objectPath?: string | null): Promise<boolean> {
    try {
      if (storageFileId && this.isDriveConfigured()) {
        return await GoogleDriveStorageProvider.deleteFile(storageFileId);
      }

      if (objectPath) {
        const localFilePath = path.join(LOCAL_STORAGE_DIR, objectPath.replace(/\//g, '_'));
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
        }
        return true;
      }
      return true;
    } catch (err) {
      console.warn(`[STORAGE] Deleting object failed:`, err);
      return false;
    }
  }

  /**
   * Purge all objects under a given prefix
   */
  static async purgePrefix(prefixPath: string): Promise<number> {
    let deletedCount = 0;
    try {
      const localPrefix = prefixPath.replace(/\//g, '_');
      if (fs.existsSync(LOCAL_STORAGE_DIR)) {
        const files = fs.readdirSync(LOCAL_STORAGE_DIR);
        for (const file of files) {
          if (file.startsWith(localPrefix)) {
            fs.unlinkSync(path.join(LOCAL_STORAGE_DIR, file));
            deletedCount++;
          }
        }
      }
    } catch (err) {
      console.warn(`[STORAGE] Purge prefix failed for ${prefixPath}:`, err);
    }
    return deletedCount;
  }

  /**
   * Legacy upload URL generator for direct uploads
   */
  static async getSignedUploadUrl(
    objectPath: string,
    mimeType: string,
    expiresInMinutes: number = 15
  ): Promise<{ uploadUrl: string; objectPath: string; headers?: Record<string, string> }> {
    const uploadUrl = `/api/files/upload-direct?objectPath=${encodeURIComponent(objectPath)}`;
    return { uploadUrl, objectPath };
  }

  /**
   * Legacy download URL generator
   */
  static async getSignedDownloadUrl(
    objectPath: string,
    originalFilename?: string,
    expiresInMinutes: number = 60
  ): Promise<string> {
    const token = crypto.randomBytes(24).toString('hex');
    const localFilePath = path.join(LOCAL_STORAGE_DIR, objectPath.replace(/\//g, '_'));
    
    localDownloadTokens.set(token, {
      filePath: localFilePath,
      mimeType: 'application/octet-stream',
      expiresAt: Date.now() + expiresInMinutes * 60 * 1000
    });

    return `/api/files/download-local/${token}/${encodeURIComponent(originalFilename || 'document')}`;
  }

  /**
   * Verify token for local stream download fallback
   */
  static getLocalStreamDetails(token: string): { filePath: string; mimeType: string } | null {
    const details = localDownloadTokens.get(token);
    if (!details) return null;
    if (Date.now() > details.expiresAt) {
      localDownloadTokens.delete(token);
      return null;
    }
    return details;
  }
}
