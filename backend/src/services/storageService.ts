import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let gcsBucket: any = null;

try {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (bucketName) {
    const { Storage } = require('@google-cloud/storage');
    let storageOptions: any = {};
    if (process.env.GCS_PROJECT_ID) storageOptions.projectId = process.env.GCS_PROJECT_ID;
    if (process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY) {
      storageOptions.credentials = {
        client_email: process.env.GCS_CLIENT_EMAIL,
        private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n')
      };
    }
    const storage = new Storage(storageOptions);
    gcsBucket = storage.bucket(bucketName);
    console.log(`[STORAGE] Google Cloud Storage initialized for bucket: ${bucketName}`);
  } else {
    console.log('[STORAGE] GCS_BUCKET_NAME not provided. Using local disk storage fallback.');
  }
} catch (err) {
  console.warn('[STORAGE] Failed to initialize Google Cloud Storage client:', err);
}

// Local Storage Fallback Directory
const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

// Tokenized local download map
const localDownloadTokens = new Map<string, { filePath: string; mimeType: string; expiresAt: number }>();

export class StorageService {
  /**
   * Check if GCS is actively configured and available
   */
  static isGcsConfigured(): boolean {
    return !!gcsBucket;
  }

  /**
   * Generate a signed upload URL (or local upload endpoint token)
   */
  static async getSignedUploadUrl(
    objectPath: string,
    mimeType: string,
    expiresInMinutes: number = 15
  ): Promise<{ uploadUrl: string; objectPath: string; headers?: Record<string, string> }> {
    if (gcsBucket) {
      const file = gcsBucket.file(objectPath);
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
        contentType: mimeType
      });
      return { uploadUrl: url, objectPath, headers: { 'Content-Type': mimeType } };
    } else {
      // Local storage fallback: Return direct backend upload URL
      const uploadUrl = `/api/files/upload-direct?objectPath=${encodeURIComponent(objectPath)}`;
      return { uploadUrl, objectPath };
    }
  }

  /**
   * Generate a signed download URL for viewing/downloading files
   */
  static async getSignedDownloadUrl(
    objectPath: string,
    originalFilename?: string,
    expiresInMinutes: number = 60
  ): Promise<string> {
    if (gcsBucket) {
      const file = gcsBucket.file(objectPath);
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
        responseDisposition: originalFilename ? `attachment; filename="${encodeURIComponent(originalFilename)}"` : undefined
      });
      return url;
    } else {
      // Local storage fallback: Generate a short-lived download token
      const token = crypto.randomBytes(24).toString('hex');
      const localFilePath = path.join(LOCAL_STORAGE_DIR, objectPath.replace(/\//g, '_'));
      
      localDownloadTokens.set(token, {
        filePath: localFilePath,
        mimeType: 'application/octet-stream',
        expiresAt: Date.now() + expiresInMinutes * 60 * 1000
      });

      return `/api/files/download-local/${token}/${encodeURIComponent(originalFilename || 'document')}`;
    }
  }

  /**
   * Directly upload a buffer to GCS or Local Disk
   */
  static async uploadBuffer(objectPath: string, buffer: Buffer, mimeType: string): Promise<string> {
    if (gcsBucket) {
      const file = gcsBucket.file(objectPath);
      await file.save(buffer, {
        metadata: { contentType: mimeType },
        resumable: false
      });
      return objectPath;
    } else {
      const localFilePath = path.join(LOCAL_STORAGE_DIR, objectPath.replace(/\//g, '_'));
      const dir = path.dirname(localFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(localFilePath, buffer);
      return objectPath;
    }
  }

  /**
   * Download a buffer from GCS or Local Disk
   */
  static async downloadBuffer(objectPath: string): Promise<Buffer> {
    if (gcsBucket) {
      const file = gcsBucket.file(objectPath);
      const [buffer] = await file.download();
      return buffer;
    } else {
      const localFilePath = path.join(LOCAL_STORAGE_DIR, objectPath.replace(/\//g, '_'));
      if (fs.existsSync(localFilePath)) {
        return fs.readFileSync(localFilePath);
      }
      throw new Error(`File not found at object path: ${objectPath}`);
    }
  }

  /**
   * Delete a single object from GCS or Local Disk
   */
  static async deleteObject(objectPath: string): Promise<boolean> {
    try {
      if (gcsBucket) {
        const file = gcsBucket.file(objectPath);
        await file.delete({ ignoreNotFound: true });
        return true;
      } else {
        const localFilePath = path.join(LOCAL_STORAGE_DIR, objectPath.replace(/\//g, '_'));
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
        }
        return true;
      }
    } catch (err) {
      console.warn(`[STORAGE] Deleting object failed for ${objectPath}:`, err);
      return false;
    }
  }

  /**
   * Purge all objects under a given prefix (e.g. employee prefix purge)
   */
  static async purgePrefix(prefixPath: string): Promise<number> {
    let deletedCount = 0;
    try {
      if (gcsBucket) {
        const [files] = await gcsBucket.getFiles({ prefix: prefixPath });
        for (const file of files) {
          await file.delete({ ignoreNotFound: true });
          deletedCount++;
        }
      } else {
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
      }
    } catch (err) {
      console.warn(`[STORAGE] Purge prefix failed for ${prefixPath}:`, err);
    }
    return deletedCount;
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
