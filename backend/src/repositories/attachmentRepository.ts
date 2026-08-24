import { query } from '../db';

export interface AttachmentRecord {
  id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string | null;
  employee_id: string | null;
  original_filename: string;
  object_path: string;
  mime_type: string;
  file_size: number;
  checksum: string | null;
  uploaded_by: string | null;
  created_at: Date;
  deleted_at: Date | null;
}

export class AttachmentRepository {
  static async create(data: {
    organizationId: string;
    entityType: string;
    entityId?: string | null;
    employeeId?: string | null;
    originalFilename: string;
    objectPath: string;
    mimeType: string;
    fileSize: number;
    checksum?: string | null;
    uploadedBy?: string | null;
  }): Promise<AttachmentRecord> {
    const text = `
      INSERT INTO attachments (
        organization_id, entity_type, entity_id, employee_id,
        original_filename, object_path, mime_type, file_size, checksum, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const res = await query<AttachmentRecord>(text, [
      data.organizationId,
      data.entityType,
      data.entityId || null,
      data.employeeId || null,
      data.originalFilename,
      data.objectPath,
      data.mimeType,
      data.fileSize,
      data.checksum || null,
      data.uploadedBy || null
    ]);
    return res.rows[0];
  }

  static async findById(id: string, organizationId: string): Promise<AttachmentRecord | null> {
    const text = `
      SELECT * FROM attachments
      WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
    `;
    const res = await query<AttachmentRecord>(text, [id, organizationId]);
    return res.rows[0] || null;
  }

  static async findByEntity(organizationId: string, entityType: string, entityId: string): Promise<AttachmentRecord[]> {
    const text = `
      SELECT * FROM attachments
      WHERE organization_id = $1 AND entity_type = $2 AND entity_id = $3 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    const res = await query<AttachmentRecord>(text, [organizationId, entityType, entityId]);
    return res.rows;
  }

  static async softDelete(id: string, organizationId: string): Promise<boolean> {
    const text = `
      UPDATE attachments
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
    `;
    const res = await query(text, [id, organizationId]);
    return (res.rowCount || 0) > 0;
  }

  static async findByEmployee(organizationId: string, employeeId: string): Promise<AttachmentRecord[]> {
    const text = `
      SELECT * FROM attachments
      WHERE organization_id = $1 AND employee_id = $2 AND deleted_at IS NULL
    `;
    const res = await query<AttachmentRecord>(text, [organizationId, employeeId]);
    return res.rows;
  }
}
