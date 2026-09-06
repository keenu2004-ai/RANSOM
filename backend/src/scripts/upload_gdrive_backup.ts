import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

async function run() {
  // Load credentials first, BEFORE any dynamic imports
  dotenv.config({ path: '/app/secrets/google_drive_backup.env' });

  // Now dynamically import the provider so it initializes with the loaded env vars
  const { GoogleDriveStorageProvider } = await import('../services/googleDriveStorageProvider');

  const dbDumpPath = process.argv[2];
  const uploadsArchivePath = process.argv[3];
  const manifestPath = process.argv[4];

  if (!dbDumpPath || !uploadsArchivePath || !manifestPath) {
    console.error('Usage: ts-node upload_gdrive_backup.ts <db_dump> <uploads_archive> <manifest>');
    process.exit(1);
  }

  // Parse exact timestamp from manifest filename (e.g. hrms-backup-20260906-214448.manifest)
  const manifestName = path.basename(manifestPath);
  const match = manifestName.match(/hrms-backup-(\d{4})(\d{2})\d{2}-/);
  if (!match) {
    console.error(`Failed to parse YYYY and MM from manifest filename: ${manifestName}`);
    process.exit(1);
  }
  const year = match[1];
  const month = match[2];
  const timestamp = manifestName.replace('hrms-backup-', '').replace('.manifest', '');

  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) {
    console.error('GOOGLE_DRIVE_ROOT_FOLDER_ID is missing.');
    process.exit(1);
  }

  try {
    const appBackupFolderId = await GoogleDriveStorageProvider.ensureFolder(rootFolderId, 'THEIAKSHI HRMS BACKUPS');
    const yearFolderId = await GoogleDriveStorageProvider.ensureFolder(appBackupFolderId, year);
    const monthFolderId = await GoogleDriveStorageProvider.ensureFolder(yearFolderId, month);
    const backupSetFolderId = await GoogleDriveStorageProvider.ensureFolder(monthFolderId, timestamp);

    console.log(`[GDRIVE] Created/Verified Google Drive path: THEIAKSHI HRMS BACKUPS/${year}/${month}/${timestamp}`);

    const filesToUpload = [
      { path: dbDumpPath, mimeType: 'application/octet-stream' },
      { path: uploadsArchivePath, mimeType: 'application/gzip' }
    ];

    for (const fileObj of filesToUpload) {
      if (!fs.existsSync(fileObj.path)) {
         throw new Error(`File not found: ${fileObj.path}`);
      }
      const file = path.basename(fileObj.path);
      const stat = fs.statSync(fileObj.path);
      
      console.log(`[GDRIVE] Uploading ${file} via resumable stream (${stat.size} bytes)...`);
      
      const fileId = await GoogleDriveStorageProvider.uploadFileResumable(file, fileObj.mimeType, fileObj.path, backupSetFolderId, stat.size);
      
      const exists = await GoogleDriveStorageProvider.verifyFileExists(fileId);
      if (!exists) {
        throw new Error(`Verification failed: uploaded file ${file} does not exist on Drive (ID: ${fileId})`);
      }

      const remoteSize = await GoogleDriveStorageProvider.getFileSize(fileId);
      if (remoteSize !== stat.size) {
        throw new Error(`Size mismatch for ${file}: local=${stat.size}, remote=${remoteSize}`);
      }

      console.log(`[GDRIVE] Verified ${file} uploaded successfully (ID: ${fileId}, Exact Size Match)`);
    }

    // Both heavy files succeeded. Now finalize the manifest state locally.
    console.log(`[GDRIVE] Heavy uploads succeeded. Finalizing local manifest to SUCCESS...`);
    let manifestContent = fs.readFileSync(manifestPath, 'utf8');
    manifestContent = manifestContent.replace('google_drive_backup_status=PENDING', 'google_drive_backup_status=SUCCESS');
    fs.writeFileSync(manifestPath, manifestContent);

    // Upload the final manifest
    const manifestStat = fs.statSync(manifestPath);
    console.log(`[GDRIVE] Uploading final manifest ${manifestName} (${manifestStat.size} bytes)...`);
    const manifestId = await GoogleDriveStorageProvider.uploadFileResumable(manifestName, 'text/plain', manifestPath, backupSetFolderId, manifestStat.size);
    
    const manifestExists = await GoogleDriveStorageProvider.verifyFileExists(manifestId);
    if (!manifestExists) throw new Error(`Manifest verification failed`);
    const manifestRemoteSize = await GoogleDriveStorageProvider.getFileSize(manifestId);
    if (manifestRemoteSize !== manifestStat.size) throw new Error(`Manifest size mismatch`);

    console.log('[GDRIVE] All backup files uploaded and explicitly verified.');
    process.exit(0);
  } catch (err: any) {
    console.error(`[GDRIVE] Backup upload failed: ${err.message}`);
    process.exit(1);
  }
}

run();
