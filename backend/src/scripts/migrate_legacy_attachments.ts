import { query } from '../db';
import { StorageService } from '../services/storageService';
import crypto from 'crypto';

export async function migrateLegacyAttachments() {
  console.log('--- STARTING LEGACY ATTACHMENT MIGRATION TO GCS ---');

  try {
    // 1. Audit attachments table for data URLs
    const attRes = await query(`
      SELECT id, organization_id, entity_type, entity_id, original_filename, object_path, mime_type
      FROM attachments
      WHERE object_path LIKE 'data:%' OR object_path LIKE 'data:image%' OR object_path LIKE 'data:application%'
    `);

    console.log(`Found ${attRes.rows.length} legacy data URL attachment rows to migrate.`);

    let migratedCount = 0;
    let failedCount = 0;

    for (const row of attRes.rows) {
      try {
        const dataUrl = row.object_path;
        const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches || matches.length < 3) {
          console.warn(`[MIGRATION] Skipping invalid data URL for attachment ID ${row.id}`);
          failedCount++;
          continue;
        }

        const detectedMimeType = matches[1] || row.mime_type || 'application/octet-stream';
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        // Fetch org code
        const orgRes = await query('SELECT code FROM organizations WHERE id = $1', [row.organization_id]);
        const orgCode = orgRes.rows[0]?.code || 'default';

        const safeFilename = (row.original_filename || 'legacy_attachment.pdf').replace(/[^a-zA-Z0-9_.-]/g, '_');
        const uniqueId = crypto.randomBytes(8).toString('hex');
        const folder = (row.entity_type || 'expenses').toLowerCase();
        const objectPath = `organizations/${orgCode}/${folder}/${row.entity_id || 'general'}/${uniqueId}_${safeFilename}`;

        // Upload buffer to GCS / Local Storage
        await StorageService.uploadBuffer(objectPath, buffer, detectedMimeType);

        // Update database metadata
        await query(`
          UPDATE attachments
          SET object_path = $1, mime_type = $2, file_size = $3
          WHERE id = $4
        `, [objectPath, detectedMimeType, buffer.length, row.id]);

        migratedCount++;
        console.log(`✅ [MIGRATED] Attachment ${row.id} -> ${objectPath}`);
      } catch (err: any) {
        console.error(`❌ [MIGRATION ERROR] Failed to migrate attachment ${row.id}:`, err.message);
        failedCount++;
      }
    }

    console.log(`--- MIGRATION COMPLETE: ${migratedCount} Migrated, ${failedCount} Failed ---`);
    return { migratedCount, failedCount };
  } catch (error: any) {
    console.error('Migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  migrateLegacyAttachments().then(() => process.exit(0)).catch(() => process.exit(1));
}
