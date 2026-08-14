import { query } from '../db';
import { AuthenticatedRequest } from '../types';

export async function logAudit(
  req: AuthenticatedRequest,
  action: string,
  moduleName: string,
  entityName: string,
  entityId?: string | null,
  oldValues?: any,
  newValues?: any
) {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId || null;
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'App';

    if (!organizationId) return;

    const text = `
      INSERT INTO audit_logs (
        organization_id, user_id, action, module, entity_name, entity_id, old_values, new_values, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    await query(text, [
      organizationId,
      userId,
      action,
      moduleName,
      entityName,
      entityId || null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent
    ]);
  } catch (err) {
    console.error('⚠️ Audit Logging Error (Non-blocking):', err);
  }
}
