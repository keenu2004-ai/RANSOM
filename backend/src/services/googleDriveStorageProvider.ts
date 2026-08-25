import { Readable } from 'stream';

let googleDriveClient: any = null;
let googleDriveAuth: any = null;
let rootFolderId: string | null = null;
const folderCacheMap = new Map<string, string>();

/**
 * Initialize Google Drive Client using OAuth2 credentials
 */
function initGoogleDrive() {
  try {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || null;

    if (clientId && clientSecret && refreshToken && rootFolderId) {
      const { google } = require('googleapis');
      googleDriveAuth = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'https://developers.google.com/oauthplayground'
      );
      googleDriveAuth.setCredentials({ refresh_token: refreshToken });
      googleDriveClient = google.drive({ version: 'v3', auth: googleDriveAuth });
      console.log(`[STORAGE] Google Drive Storage Provider initialized (Root Folder ID: ${rootFolderId})`);
    } else {
      console.log('[STORAGE] Google Drive credentials incomplete in environment.');
    }
  } catch (err) {
    console.warn('[STORAGE] Failed to initialize Google Drive client:', err);
  }
}

initGoogleDrive();

export class GoogleDriveStorageProvider {
  /**
   * Check if Google Drive is configured
   */
  static isConfigured(): boolean {
    return !!(googleDriveClient && rootFolderId);
  }

  /**
   * Ensure a folder exists under parentId, using in-memory cache
   */
  static async ensureFolder(parentId: string, folderName: string): Promise<string> {
    if (!googleDriveClient) throw new Error('GOOGLE DRIVE STORAGE NOT CONFIGURED');
    
    const cacheKey = `${parentId}:${folderName}`;
    if (folderCacheMap.has(cacheKey)) {
      return folderCacheMap.get(cacheKey)!;
    }

    // Search for existing child folder
    const escapedName = folderName.replace(/'/g, "\\'");
    const q = `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await googleDriveClient.files.list({
      q,
      fields: 'files(id, name)',
      pageSize: 1
    });

    if (res.data.files && res.data.files.length > 0) {
      const folderId = res.data.files[0].id;
      folderCacheMap.set(cacheKey, folderId);
      return folderId;
    }

    // Create missing folder
    const createRes = await googleDriveClient.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      },
      fields: 'id'
    });

    const newFolderId = createRes.data.id;
    folderCacheMap.set(cacheKey, newFolderId);
    return newFolderId;
  }

  /**
   * Resolve nested path (e.g. organizations/THEIAKSHI/expenses/exp-123/attachments/file.pdf)
   * into a target parent folder ID and clean filename.
   */
  static async resolveFolderPath(objectPath: string): Promise<{ parentFolderId: string; filename: string }> {
    if (!rootFolderId) throw new Error('GOOGLE DRIVE STORAGE NOT CONFIGURED');

    const cleanPath = objectPath.replace(/^\/+/, '');
    const parts = cleanPath.split('/');
    const filename = parts.pop() || 'file.bin';

    let currentParentId = rootFolderId;
    for (const folderName of parts) {
      if (folderName) {
        currentParentId = await this.ensureFolder(currentParentId, folderName);
      }
    }

    return { parentFolderId: currentParentId, filename };
  }

  /**
   * Upload buffer directly to Google Drive
   */
  static async uploadBuffer(
    objectPath: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<{ storageFileId: string; storageFolderId: string; objectPath: string }> {
    if (!googleDriveClient) throw new Error('GOOGLE DRIVE STORAGE NOT CONFIGURED');

    const { parentFolderId, filename } = await this.resolveFolderPath(objectPath);

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const res = await googleDriveClient.files.create({
      requestBody: {
        name: filename,
        parents: [parentFolderId]
      },
      media: {
        mimeType,
        body: stream
      },
      fields: 'id, name, mimeType, size'
    });

    const storageFileId = res.data.id;
    return {
      storageFileId,
      storageFolderId: parentFolderId,
      objectPath
    };
  }

  /**
   * Download stream for file viewing and streaming
   */
  static async downloadStream(storageFileId: string): Promise<any> {
    if (!googleDriveClient) throw new Error('GOOGLE DRIVE STORAGE NOT CONFIGURED');

    const res = await googleDriveClient.files.get(
      { fileId: storageFileId, alt: 'media' },
      { responseType: 'stream' }
    );
    return res.data;
  }

  /**
   * Get file metadata from Google Drive
   */
  static async getFileMetadata(storageFileId: string): Promise<any> {
    if (!googleDriveClient) throw new Error('GOOGLE DRIVE STORAGE NOT CONFIGURED');

    const res = await googleDriveClient.files.get({
      fileId: storageFileId,
      fields: 'id, name, mimeType, size, createdTime, trashed'
    });
    return res.data;
  }

  /**
   * Verify if a Google Drive file exists and is not trashed
   */
  static async verifyFileExists(storageFileId: string): Promise<boolean> {
    try {
      if (!googleDriveClient) return false;
      const meta = await this.getFileMetadata(storageFileId);
      return Boolean(meta && meta.id && !meta.trashed);
    } catch (err) {
      return false;
    }
  }

  /**
   * Delete a file from Google Drive
   */
  static async deleteFile(storageFileId: string): Promise<boolean> {
    try {
      if (!googleDriveClient) return false;
      await googleDriveClient.files.delete({ fileId: storageFileId });
      return true;
    } catch (err: any) {
      console.warn(`[STORAGE] Delete Google Drive file ${storageFileId} failed:`, err.message);
      return false;
    }
  }

  /**
   * Provider Health Test (PART 14)
   * Refreshes token, creates temp folder, uploads test file, verifies, cleans up.
   */
  static async verifyConnectivityTest(): Promise<{ success: boolean; message: string }> {
    if (!googleDriveClient || !rootFolderId) {
      return { success: false, message: 'GOOGLE DRIVE STORAGE NOT CONFIGURED' };
    }

    try {
      // 1. Refresh OAuth Token
      const tokenRes = await googleDriveAuth.getAccessToken();
      if (!tokenRes || !tokenRes.token) {
        throw new Error('OAuth token refresh failed.');
      }

      // 2. Create temporary test folder inside root
      const tempFolderName = `_ransom_test_${Date.now()}`;
      const tempFolderId = await this.ensureFolder(rootFolderId, tempFolderName);

      // 3. Upload temporary test file
      const testContent = Buffer.from('RANSOM Google Drive Connectivity Verified.');
      const uploadRes = await this.uploadBuffer(
        `organizations/test/${tempFolderName}/test_connectivity.txt`,
        testContent,
        'text/plain'
      );

      // 4. Verify test file exists
      const exists = await this.verifyFileExists(uploadRes.storageFileId);
      if (!exists) throw new Error('Test file verification failed.');

      // 5. Clean up temporary test file and folder
      await this.deleteFile(uploadRes.storageFileId);
      await googleDriveClient.files.delete({ fileId: tempFolderId });

      console.log('[STORAGE] Provider: GOOGLE_DRIVE | OAuth: OK | Root folder: OK | Connectivity: OK');
      return { success: true, message: 'Google Drive backend connectivity verified.' };
    } catch (err: any) {
      console.error('[STORAGE] Google Drive connectivity test failed:', err.message);
      return { success: false, message: `Google Drive storage failure: ${err.message}` };
    }
  }
}
