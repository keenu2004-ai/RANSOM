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

      // Fetch org code for structured GCS object path
      const orgRes = await query('SELECT code FROM organizations WHERE id = $1', [organizationId]);
      const orgCode = orgRes.rows[0]?.code || 'default';

      const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const uniqueId = crypto.randomBytes(8).toString('hex');
      const folder = (entityType || 'expenses').toLowerCase();
      const objectPath = `organizations/${orgCode}/${folder}/${entityId || 'general'}/${uniqueId}_${safeFilename}`;

      const signedUpload = await StorageService.getSignedUploadUrl(objectPath, mimeType);

      return res.status(200).json({
        success: true,
        data: {
          uploadUrl: signedUpload.uploadUrl,
          objectPath,
          headers: signedUpload.headers || {},
          isGcs: StorageService.isGcsConfigured()
        }
      });
    } catch (error) {
      return next(error);
    }
  }

  static async uploadComplete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { entityType, entityId, originalFilename, objectPath, mimeType, fileSize } = req.body;

      if (!entityType || !objectPath || !originalFilename || !mimeType || !fileSize) {
        return res.status(400).json({
          success: false,
          error: 'entityType, objectPath, originalFilename, mimeType, and fileSize are required.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Verify binary object exists in storage before saving metadata
      const fileExists = await StorageService.verifyObjectExists(objectPath);
      if (!fileExists && StorageService.isGcsConfigured()) {
        return res.status(400).json({
          success: false,
          error: 'GCS binary upload was not verified or completed. Attachment metadata was not created.',
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
        uploadedBy: req.user!.userId
      });

      return res.status(201).json({
        success: true,
        data: { attachment, message: 'File metadata saved successfully.' }
      });
    } catch (error) {
      return next(error);
    }
  }

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
          error: 'You are not authorized to view or download this receipt.',
          code: 'FORBIDDEN'
        });
      }

      // Verify physical object availability
      const exists = await StorageService.verifyObjectExists(attachment.object_path);
      if (!exists && StorageService.isGcsConfigured()) {
        return res.status(404).json({
          success: false,
          error: 'Attachment unavailable or missing from storage.',
          code: 'FILE_UNAVAILABLE',
          status: 'BROKEN'
        });
      }

      const downloadUrl = await StorageService.getSignedDownloadUrl(attachment.object_path, attachment.original_filename);

      return res.status(200).json({
        success: true,
        data: {
          downloadUrl,
          attachment,
          status: 'AVAILABLE'
        }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Direct upload handler for local disk fallback mode
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
          await StorageService.uploadBuffer(objectPath, buffer, mimeType);
          return res.status(200).json({ success: true, message: 'File saved to local storage.', objectPath });
        } catch (err) {
          return next(err);
        }
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
