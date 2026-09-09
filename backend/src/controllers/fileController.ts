import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { AuthenticatedRequest } from '../types';
import { StorageService } from '../services/storageService';
import { AttachmentRepository } from '../repositories/attachmentRepository';
import { query } from '../db';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { StreamingFileValidator } from '../utils/streamingFileValidator';

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

      if (!filename || !mimeType || !fileSize || !entityType) {
        return res.status(400).json({
          success: false,
          error: 'filename, mimeType, fileSize, and entityType are required.',
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

      const uploadId = crypto.randomUUID();

      const uploadTokenPayload = {
        typ: 'upload',
        uploadId,
        userId: req.user!.userId,
        organizationId,
        entityType,
        entityId: entityId || null,
        objectPath,
        mimeType,
        maxSize: maxAllowedSize,
        originalFilename: filename
      };

      const token = jwt.sign(uploadTokenPayload, config.jwtSecret, { expiresIn: '15m' });
      const uploadUrl = `/api/files/upload-direct?token=${encodeURIComponent(token)}`;

      return res.status(200).json({
        success: true,
        data: {
          uploadUrl,
          token,
          objectPath,
          uploadId,
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
      const { token, storageFileId, storageFolderId, actualSize } = req.body;

      if (!token) {
        return res.status(400).json({ success: false, error: 'upload token required.', code: 'MISSING_TOKEN' });
      }

      let payload: any;
      try {
        payload = jwt.verify(token, config.jwtSecret);
      } catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid or expired upload token.', code: 'INVALID_TOKEN' });
      }

      if (payload.typ !== 'upload') {
        return res.status(403).json({ success: false, error: 'Invalid token type.', code: 'INVALID_TOKEN_TYPE' });
      }

      if (payload.userId !== req.user!.userId || payload.organizationId !== organizationId) {
        return res.status(403).json({ success: false, error: 'Upload context mismatch. Not authorized.', code: 'CONTEXT_MISMATCH' });
      }

      const { objectPath, entityType, entityId, mimeType, originalFilename } = payload;

      // Idempotency: Check if already finalized
      const existingRes = await query('SELECT id FROM attachments WHERE object_path = $1 AND organization_id = $2', [objectPath, organizationId]);
      if (existingRes.rows.length > 0) {
        // Return existing attachment silently for safe retry
        const attachment = await AttachmentRepository.findById(existingRes.rows[0].id, organizationId);
        return res.status(200).json({ success: true, data: { attachment, message: 'Attachment already finalized.' } });
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

      // Create the Attachment DB Record
      const attachment = await AttachmentRepository.create({
        organizationId,
        entityType,
        entityId: entityId || null,
        employeeId: req.user!.employeeId || null,
        originalFilename,
        objectPath,
        mimeType,
        fileSize: Number(actualSize) || 0,
        uploadedBy: req.user!.userId,
        storageProvider: StorageService.isDriveConfigured() ? 'GOOGLE_DRIVE' : 'LOCAL',
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

  // Secure Direct Upload Handler: Streams upload through a magic-number validator directly into storage
  static async uploadDirect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const token = (req.query.token as string) || (req.body && req.body.token);
      if (!token) {
        return res.status(400).json({ success: false, error: 'upload token required.', code: 'MISSING_TOKEN' });
      }

      let payload: any;
      try {
        payload = jwt.verify(token, config.jwtSecret);
      } catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid or expired upload token.', code: 'INVALID_TOKEN' });
      }

      if (payload.typ !== 'upload') {
        return res.status(403).json({ success: false, error: 'Invalid token type.', code: 'INVALID_TOKEN_TYPE' });
      }

      // Authorization verification
      if (payload.userId !== req.user!.userId || payload.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ success: false, error: 'Upload context mismatch. Not authorized.', code: 'CONTEXT_MISMATCH' });
      }

      const { objectPath, mimeType, maxSize } = payload;
      
      const validator = new StreamingFileValidator(mimeType, maxSize);
      
      req.pipe(validator);

      try {
        const uploadRes = await StorageService.uploadStream(objectPath, validator, mimeType);

        return res.status(200).json({
          success: true,
          message: 'File streamed to storage.',
          objectPath: uploadRes.objectPath,
          storageFileId: uploadRes.storageFileId,
          storageFolderId: uploadRes.storageFolderId,
          actualSize: validator.totalBytesProcessed
        });
      } catch (err: any) {
        if (err.code === 'FILE_TOO_LARGE') {
          return res.status(413).json({ success: false, error: err.message, code: 'FILE_TOO_LARGE' });
        }
        if (err.code === 'INVALID_FILE_CONTENT' || err.code === 'EMPTY_FILE') {
          return res.status(400).json({ success: false, error: err.message, code: err.code });
        }
        throw err;
      }
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
          provider: 'LOCAL',
          status: 'UNAVAILABLE',
          error: result.message
        });
      }

      return res.status(200).json({
        success: true,
        provider: 'LOCAL',
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
