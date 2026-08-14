import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { History, ShieldCheck } from 'lucide-react';

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
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
          <History className="w-6 h-6 text-rose-400" />
          <span>System Audit Trail</span>
        </h1>
        <p className="text-xs text-slate-400">Immutable audit log recording user actions, entity mutations, and IP addresses</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Actor</th>
                <th className="px-6 py-3">Module</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {logs.length > 0 ? (
                logs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-800/40">
                    <td className="px-6 py-3.5 font-mono text-[11px] text-slate-400">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="px-6 py-3.5 font-semibold text-slate-200">{l.actor_email || 'System'}</td>
                    <td className="px-6 py-3.5 font-mono text-cyan-400">{l.module}</td>
                    <td className="px-6 py-3.5 font-bold text-amber-400">{l.action}</td>
                    <td className="px-6 py-3.5 font-mono">{l.entity_name}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No audit log records available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
