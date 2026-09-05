import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/api-client';
import { History, RefreshCw, AlertCircle } from 'lucide-react';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{ auditLogs: any[] }>('/audit-logs');
      setLogs(res?.auditLogs || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load audit logs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--primary)]" />
            <span>System Audit Trail</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)]">Immutable audit log recording user actions, entity mutations, and IP addresses</p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-muted)] text-xs font-semibold text-[var(--text-primary)] rounded-xl border border-[var(--border-default)] shadow-sm transition-all cursor-pointer self-start sm:self-auto disabled:opacity-50 min-h-[38px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[var(--primary)] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-[var(--action-danger-soft)] border border-[var(--accent-attention-border)] rounded-2xl text-[var(--action-danger-bg)] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            className="px-3 py-1.5 bg-[var(--action-danger-bg)] text-white font-semibold rounded-lg hover:bg-[var(--action-danger-hover)] transition-colors shrink-0"
          >
            Try Again
          </button>
        </div>
      )}

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
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[var(--primary)]" />
                      <span>Loading audit records...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map(l => (
                  <tr key={l.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                    <td className="px-6 py-3.5 font-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-[var(--text-primary)]">
                      {l.actor_email && l.actor_email.includes('@') ? (
                        <a
                          href={`mailto:${l.actor_email}`}
                          className="hover:text-[var(--primary)] hover:underline truncate max-w-[200px] block"
                          title={`Send email to ${l.actor_email}`}
                        >
                          {l.actor_email}
                        </a>
                      ) : (
                        <span>{l.actor_email || 'System'}</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[var(--primary)]">{l.module}</td>
                    <td className="px-6 py-3.5 font-bold text-[var(--primary)]">{l.action}</td>
                    <td className="px-6 py-3.5 font-mono text-[var(--text-secondary)]">{l.entity_name}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)] italic">
                    No audit log records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
