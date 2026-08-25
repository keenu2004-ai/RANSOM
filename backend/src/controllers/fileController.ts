import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { AuthenticatedRequest } from '../types';
import { StorageService } from '../services/storageService';
import { AttachmentRepository } from '../repositories/attachmentRepository';
import { query } from '../db';

const ALLOWED_MIME_TYPES: Record<string, number> = {
  'application/pdf': 25 * 1024 * 1024, // 25 MB
  'image/jpeg': 15 * 1024 * 1024,      // 15 MB
  'image/jpg': 15 * 1024 * 1024,       // 15 MB
  'image/png': 15 * 1024 * 1024        // 15 MB
};

const DISALLOWED_EXTENSIONS = ['.exe', '.bat', '.sh', '.js', '.html', '.htm', '.php', '.py', '.cmd', '.vbs', '.ps1'];

export class FileController {
  static async uploadInit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { entityType, entityId, filename, mimeType, fileSize } = req.body;

      if (!filename || !mimeType || !fileSize) {
        return res.status(400).json({
          success: false,
          error: 'filename, mimeType, and fileSize are required.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Check file extension safety
      const ext = path.extname(filename).toLowerCase();
      if (DISALLOWED_EXTENSIONS.includes(ext) || filename.split('.').length > 2) {
        return res.status(400).json({
          success: false,
          error: 'File type or multi-extension filename is not allowed.',
          code: 'INVALID_FILE_TYPE'
        });
      }

      // Check MIME type and size limits
      const maxAllowedSize = ALLOWED_MIME_TYPES[mimeType];
      if (!maxAllowedSize) {
        return res.status(400).json({
          success: false,
          error: `Unsupported file type: ${mimeType}. Supported types are PDF, JPG, JPEG, PNG.`,
          code: 'UNSUPPORTED_MIME_TYPE'
        });
      }

      if (fileSize > maxAllowedSize) {
        return res.status(400).json({
          success: false,
          error: `File size exceeds the limit of ${maxAllowedSize / (1024 * 1024)} MB for ${mimeType}.`,
          code: 'FILE_TOO_LARGE'
        });
      }

      // Fetch org code for structured object path
      const orgRes = await query('SELECT code FROM organizations WHERE id = $1', [organizationId]);
      const orgCode = orgRes.rows[0]?.code || 'default';

      const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const uniqueId = crypto.randomBytes(8).toString('hex');
      const folder = (entityType || 'expenses').toLowerCase();
      const objectPath = `organizations/${orgCode}/${folder}/${entityId || 'general'}/${uniqueId}_${safeFilename}`;

      const uploadUrl = `/api/files/upload-direct?objectPath=${encodeURIComponent(objectPath)}`;

      return res.status(200).json({
        success: true,
        data: {
          uploadUrl,
          objectPath,
          isDrive: StorageService.isDriveConfigured()
        }
      });
    } catch (error) {
      return next(error);
    }
  }

  static async uploadComplete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { entityType, entityId, originalFilename, objectPath, mimeType, fileSize, storageFileId, storageFolderId } = req.body;

      if (!entityType || !objectPath || !originalFilename || !mimeType || !fileSize) {
        return res.status(400).json({
          success: false,
          error: 'entityType, objectPath, originalFilename, mimeType, and fileSize are required.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Verify binary object exists in storage before saving metadata
      const fileExists = await StorageService.verifyObjectExists(storageFileId, objectPath);
      if (!fileExists && StorageService.isDriveConfigured()) {
        return res.status(400).json({
          success: false,
          error: 'Google Drive binary upload was not verified or completed. Attachment metadata was not created.',
          code: 'UPLOAD_NOT_VERIFIED'
        });
      }

      const attachment = await AttachmentRepository.create({
        organizationId,
        entityType,
        entityId: entityId || null,
        employeeId: req.user!.employeeId || null,
        originalFilename,
        objectPath,
        mimeType,
        fileSize: Number(fileSize),
        uploadedBy: req.user!.userId,
        storageProvider: 'GOOGLE_DRIVE',
        storageFileId: storageFileId || null,
        storageFolderId: storageFolderId || null,
        storageStatus: 'AVAILABLE'
      });

      return res.status(201).json({
        success: true,
        data: { attachment, message: 'File metadata saved successfully.' }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Secure View Stream: Streams file inline for PDF/Image viewer
  static async view(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;

      const attachment = await AttachmentRepository.findById(id, organizationId);
      if (!attachment) {
        return res.status(404).json({
          success: false,
          error: 'Attachment not found or access denied.',
          code: 'NOT_FOUND'
        });
      }

      // Authorization Check
      const isOwner = req.user!.employeeId && req.user!.employeeId === attachment.employee_id;
      const isUploader = req.user!.userId === attachment.uploaded_by;
      const isAuthorizedManager = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'OPERATIONAL_MANAGER'].includes(req.user!.role);

      if (!isOwner && !isUploader && !isAuthorizedManager) {
        return res.status(403).json({
          success: false,
          error: 'You are not authorized to view this receipt.',
          code: 'FORBIDDEN'
        });
      }

      // Verify physical file availability
      const exists = await StorageService.verifyObjectExists(attachment.storage_file_id, attachment.object_path);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: 'Attachment unavailable or missing from storage.',
          code: 'FILE_UNAVAILABLE',
          status: 'BROKEN'
        });
      }

      const stream = await StorageService.downloadStream(attachment.storage_file_id, attachment.object_path);

      res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.original_filename)}"`);
      if (attachment.file_size) res.setHeader('Content-Length', attachment.file_size);

      stream.pipe(res);
    } catch (error) {
      return next(error);
    }
  }

  // Secure Download Stream: Downloads file as attachment
  static async download(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;

      const attachment = await AttachmentRepository.findById(id, organizationId);
      if (!attachment) {
        return res.status(404).json({
          success: false,
          error: 'Attachment not found or access denied.',
          code: 'NOT_FOUND'
        });
      }

      // Authorization Check
      const isOwner = req.user!.employeeId && req.user!.employeeId === attachment.employee_id;
      const isUploader = req.user!.userId === attachment.uploaded_by;
      const isAuthorizedManager = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'OPERATIONAL_MANAGER'].includes(req.user!.role);

      if (!isOwner && !isUploader && !isAuthorizedManager) {
        return res.status(403).json({
          success: false,
          error: 'You are not authorized to download this receipt.',
          code: 'FORBIDDEN'
        });
      }

      // Verify physical object availability
      const exists = await StorageService.verifyObjectExists(attachment.storage_file_id, attachment.object_path);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: 'Attachment unavailable or missing from storage.',
          code: 'FILE_UNAVAILABLE',
          status: 'BROKEN'
        });
      }

      const stream = await StorageService.downloadStream(attachment.storage_file_id, attachment.object_path);

      res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.original_filename)}"`);
      if (attachment.file_size) res.setHeader('Content-Length', attachment.file_size);

      stream.pipe(res);
    } catch (error) {
      return next(error);
    }
  }

  // Direct upload handler: Uploads buffer to Google Drive
  static async uploadDirect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const objectPath = req.query.objectPath as string;
      if (!objectPath) {
        return res.status(400).json({ success: false, error: 'objectPath query parameter required.' });
      }

      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const mimeType = (req.headers['content-type'] as string) || 'application/octet-stream';
          const uploadRes = await StorageService.uploadBuffer(objectPath, buffer, mimeType);

          return res.status(200).json({
            success: true,
            message: 'File saved to Google Drive storage.',
            objectPath: uploadRes.objectPath,
            storageFileId: uploadRes.storageFileId,
            storageFolderId: uploadRes.storageFolderId
          });
        } catch (err: any) {
          return next(err);
        }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Storage Health Check API (PART 15)
  static async health(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await StorageService.verifyConnectivityTest();
      if (!result.success) {
        return res.status(500).json({
          success: false,
          provider: 'GOOGLE_DRIVE',
          status: 'UNAVAILABLE',
          error: result.message
        });
      }

      return res.status(200).json({
        success: true,
        provider: 'GOOGLE_DRIVE',
        status: 'HEALTHY',
        message: result.message
      });
    } catch (error) {
      return next(error);
    }
  }

  // Local stream download handler for local storage fallback
  static async downloadLocalStream(req: AuthenticatedRequest, res: Response) {
    const { token } = req.params;
    const details = StorageService.getLocalStreamDetails(token);
    if (!details || !fs.existsSync(details.filePath)) {
      return res.status(404).send('Download link expired or file not found.');
    }
    res.setHeader('Content-Type', details.mimeType);
    return fs.createReadStream(details.filePath).pipe(res);
  }
}
