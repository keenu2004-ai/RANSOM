import { query } from '../db';
import { StorageService } from '../services/storageService';
import { AttachmentRepository } from '../repositories/attachmentRepository';
import crypto from 'crypto';

export async function processDataUrlToDrive(
  organizationId: string,
  entityType: string,
  entityId: string | null,
  employeeId: string | null,
  originalFilename: string,
  dataUrl: string,
  uploadedBy?: string | null
): Promise<{ attachmentId: string; viewUrl: string }> {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches || matches.length < 3) {
    throw new Error('Invalid base64 data URL format.');
  }

  const mimeType = matches[1] || 'application/octet-stream';
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  // Fetch organization code
  const orgRes = await query('SELECT code FROM organizations WHERE id = $1', [organizationId]);
  const orgCode = orgRes.rows[0]?.code || 'default';

  const ext = mimeType.split('/')[1] || 'bin';
  const safeFilename = (originalFilename || `receipt_${Date.now()}.${ext}`).replace(/[^a-zA-Z0-9_.-]/g, '_');
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const folder = entityType.toLowerCase();
  const objectPath = `organizations/${orgCode}/${folder}/${entityId || 'general'}/${uniqueId}_${safeFilename}`;

  // Upload binary to Google Drive
  const uploadRes = await StorageService.uploadBuffer(objectPath, buffer, mimeType);

  // Save metadata to attachments table
  const attachment = await AttachmentRepository.create({
    organizationId,
    entityType,
    entityId: entityId || null,
    employeeId: employeeId || null,
    originalFilename: safeFilename,
    objectPath,
    mimeType,
    fileSize: buffer.length,
    uploadedBy: uploadedBy || null,
    storageProvider: 'GOOGLE_DRIVE',
    storageFileId: uploadRes.storageFileId || null,
    storageFolderId: uploadRes.storageFolderId || null,
    storageStatus: 'AVAILABLE'
  });

  const viewUrl = `/api/files/${attachment.id}/view`;
  return { attachmentId: attachment.id, viewUrl };
}

export async function migrateLegacyAttachments() {
  console.log('--- STARTING LEGACY BASE64 ATTACHMENT MIGRATION TO GOOGLE DRIVE ---');

  let totalMigrated = 0;
  let totalFailed = 0;

  try {
    // 1. Audit attachments table for data URLs
    const attRes = await query(`
      SELECT id, organization_id, entity_type, entity_id, employee_id, original_filename, object_path, mime_type, uploaded_by
      FROM attachments
      WHERE object_path LIKE 'data:%' OR object_path LIKE 'data:image%' OR object_path LIKE 'data:application%'
    `);

    for (const row of attRes.rows) {
      try {
        const res = await processDataUrlToDrive(
          row.organization_id,
          row.entity_type || 'EXPENSE',
          row.entity_id,
          row.employee_id,
          row.original_filename,
          row.object_path,
          row.uploaded_by
        );

        await query(`
          UPDATE attachments
          SET object_path = $1, mime_type = $2, file_size = $3, storage_provider = 'GOOGLE_DRIVE', storage_file_id = $4
          WHERE id = $5
        `, [res.viewUrl, row.mime_type, 0, res.attachmentId, row.id]);

        totalMigrated++;
        console.log(`✅ [MIGRATED] attachments table ID ${row.id} -> Google Drive`);
      } catch (err: any) {
        totalFailed++;
        console.warn(`⚠️ [MIGRATION WARNING] attachments table ID ${row.id}:`, err.message);
      }
    }

    // 2. Audit expenses table for receipt_url LIKE 'data:%'
    const expRes = await query(`
      SELECT id, organization_id, employee_id, attachment_name, receipt_url
      FROM expenses
      WHERE receipt_url LIKE 'data:%' OR receipt_url LIKE 'data:image%' OR receipt_url LIKE 'data:application%'
    `);

    for (const row of expRes.rows) {
      try {
        const res = await processDataUrlToDrive(
          row.organization_id,
          'EXPENSE',
          row.id,
          row.employee_id,
          row.attachment_name || 'receipt.jpg',
          row.receipt_url
        );

        await query(`
          UPDATE expenses
          SET receipt_url = $1
          WHERE id = $2
        `, [res.viewUrl, row.id]);

        totalMigrated++;
        console.log(`✅ [MIGRATED] expenses table ID ${row.id} -> ${res.viewUrl}`);
      } catch (err: any) {
        totalFailed++;
        console.warn(`⚠️ [MIGRATION WARNING] expenses table ID ${row.id}:`, err.message);
      }
    }

    // 3. Audit trip_travel_expenses for receipt_url LIKE 'data:%'
    const travelRes = await query(`
      SELECT id, organization_id, employee_id, attachment_name, receipt_url
      FROM trip_travel_expenses
      WHERE receipt_url LIKE 'data:%' OR receipt_url LIKE 'data:image%' OR receipt_url LIKE 'data:application%'
    `);

    for (const row of travelRes.rows) {
      try {
        const res = await processDataUrlToDrive(
          row.organization_id,
          'TRIP_TRAVEL_EXPENSE',
          row.id,
          row.employee_id,
          row.attachment_name || 'travel_receipt.jpg',
          row.receipt_url
        );

        await query(`
          UPDATE trip_travel_expenses
          SET receipt_url = $1
          WHERE id = $2
        `, [res.viewUrl, row.id]);

        totalMigrated++;
        console.log(`✅ [MIGRATED] trip_travel_expenses table ID ${row.id} -> ${res.viewUrl}`);
      } catch (err: any) {
        totalFailed++;
        console.warn(`⚠️ [MIGRATION WARNING] trip_travel_expenses table ID ${row.id}:`, err.message);
      }
    }

    // 4. Audit trip_accommodation_expenses for receipt_url LIKE 'data:%'
    const accomRes = await query(`
      SELECT id, organization_id, employee_id, attachment_name, receipt_url
      FROM trip_accommodation_expenses
      WHERE receipt_url LIKE 'data:%' OR receipt_url LIKE 'data:image%' OR receipt_url LIKE 'data:application%'
    `);

    for (const row of accomRes.rows) {
      try {
        const res = await processDataUrlToDrive(
          row.organization_id,
          'TRIP_ACCOMMODATION_EXPENSE',
          row.id,
          row.employee_id,
          row.attachment_name || 'hotel_receipt.jpg',
          row.receipt_url
        );

        await query(`
          UPDATE trip_accommodation_expenses
          SET receipt_url = $1
          WHERE id = $2
        `, [res.viewUrl, row.id]);

        totalMigrated++;
        console.log(`✅ [MIGRATED] trip_accommodation_expenses table ID ${row.id} -> ${res.viewUrl}`);
      } catch (err: any) {
        totalFailed++;
        console.warn(`⚠️ [MIGRATION WARNING] trip_accommodation_expenses table ID ${row.id}:`, err.message);
      }
    }

    // 5. Audit trip_other_expenses for receipt_url LIKE 'data:%'
    const otherRes = await query(`
      SELECT id, organization_id, employee_id, attachment_name, receipt_url
      FROM trip_other_expenses
      WHERE receipt_url LIKE 'data:%' OR receipt_url LIKE 'data:image%' OR receipt_url LIKE 'data:application%'
    `);

    for (const row of otherRes.rows) {
      try {
        const res = await processDataUrlToDrive(
          row.organization_id,
          'TRIP_OTHER_EXPENSE',
          row.id,
          row.employee_id,
          row.attachment_name || 'other_receipt.jpg',
          row.receipt_url
        );

        await query(`
          UPDATE trip_other_expenses
          SET receipt_url = $1
          WHERE id = $2
        `, [res.viewUrl, row.id]);

        totalMigrated++;
        console.log(`✅ [MIGRATED] trip_other_expenses table ID ${row.id} -> ${res.viewUrl}`);
      } catch (err: any) {
        totalFailed++;
        console.warn(`⚠️ [MIGRATION WARNING] trip_other_expenses table ID ${row.id}:`, err.message);
      }
    }

    // 6. Purge any invalid blob: URLs from PostgreSQL tables
    await query(`UPDATE expenses SET receipt_url = NULL WHERE receipt_url LIKE 'blob:%' OR receipt_url LIKE '%/blob:%'`);
    await query(`UPDATE trip_travel_expenses SET receipt_url = NULL WHERE receipt_url LIKE 'blob:%' OR receipt_url LIKE '%/blob:%'`);
    await query(`UPDATE trip_accommodation_expenses SET receipt_url = NULL WHERE receipt_url LIKE 'blob:%' OR receipt_url LIKE '%/blob:%'`);
    await query(`UPDATE trip_other_expenses SET receipt_url = NULL WHERE receipt_url LIKE 'blob:%' OR receipt_url LIKE '%/blob:%'`);
    await query(`UPDATE attachments SET object_path = 'INVALID_BLOB_PURGED', storage_status = 'BROKEN' WHERE object_path LIKE 'blob:%' OR object_path LIKE '%/blob:%'`);

    // 7. Audit and reconcile report_archives table
    try {
      const reportArchRes = await query(`
        SELECT id, organization_id, report_type, period_year, period_month, object_path, storage_file_id, storage_status
        FROM report_archives
      `);

      for (const arch of reportArchRes.rows) {
        if (arch.storage_file_id) {
          const exists = await StorageService.verifyObjectExists(arch.storage_file_id, arch.object_path);
          const status = exists ? 'AVAILABLE' : 'BROKEN';
          await query('UPDATE report_archives SET storage_status = $1 WHERE id = $2', [status, arch.id]);
        } else {
          await query("UPDATE report_archives SET storage_status = 'BROKEN' WHERE id = $1", [arch.id]);
        }
      }
    } catch (archErr: any) {
      console.warn('[MIGRATION] report_archives audit notice:', archErr.message);
    }

    console.log(`--- MIGRATION COMPLETE: ${totalMigrated} Migrated, ${totalFailed} Failed ---`);
    return { migratedCount: totalMigrated, failedCount: totalFailed };
  } catch (error: any) {
    console.error('Migration execution warning:', error.message);
    return { migratedCount: totalMigrated, failedCount: totalFailed };
  }
}

if (require.main === module) {
  migrateLegacyAttachments().then(() => process.exit(0)).catch(() => process.exit(1));
}
