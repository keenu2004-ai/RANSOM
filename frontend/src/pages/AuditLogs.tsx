import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { History } from 'lucide-react';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/audit-logs')
      .then(res => setLogs(res.auditLogs || []))
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
          <History className="w-5 h-5 text-[var(--primary)]" />
          <span>System Audit Trail</span>
        </h1>
        <p className="text-xs text-[var(--text-muted)]">Immutable audit log recording user actions, entity mutations, and IP addresses</p>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[var(--text-secondary)]">
            <thead className="bg-[var(--bg-surface-muted)] text-[var(--text-muted)] font-semibold uppercase text-[10px] tracking-wider border-b border-[var(--border-subtle)]">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Actor</th>
                <th className="px-6 py-3">Module</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {logs.length > 0 ? (
                logs.map(l => (
                  <tr key={l.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                    <td className="px-6 py-3.5 font-mono text-[11px] text-[var(--text-muted)]">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="px-6 py-3.5 font-semibold text-[var(--text-primary)]">{l.actor_email || 'System'}</td>
                    <td className="px-6 py-3.5 font-mono text-[var(--primary)]">{l.module}</td>
                    <td className="px-6 py-3.5 font-bold text-[var(--primary)]">{l.action}</td>
                    <td className="px-6 py-3.5 font-mono text-[var(--text-secondary)]">{l.entity_name}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-[var(--text-muted)]">No audit log records available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
