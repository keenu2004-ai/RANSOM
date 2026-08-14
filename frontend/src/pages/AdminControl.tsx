import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { ShieldCheck, Users, KeyRound, Shield } from 'lucide-react';

export const AdminControl: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'permissions'>('users');

  useEffect(() => {
    apiFetch('/admin/users').then(res => setUsers(res.users || [])).catch(console.error);
    apiFetch('/admin/roles').then(res => setRoles(res.roles || [])).catch(console.error);
    apiFetch('/admin/permissions').then(res => setPermissions(res.permissions || [])).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <span>Dedicated Admin Control Panel</span>
          </h1>
          <p className="text-xs text-slate-400">System governance, login user accounts, role definitions, and permission matrices</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'users' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            User Accounts
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'roles' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            System Roles
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'permissions' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Permission Matrix
          </button>
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Login Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Linked Employee Profile</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="px-6 py-3.5 font-bold text-slate-200">{u.email}</td>
                    <td className="px-6 py-3.5 font-mono text-cyan-400 font-bold">{u.role_name}</td>
                    <td className="px-6 py-3.5">
                      {u.employee_name ? (
                        <span className="text-slate-200 font-semibold">{u.employee_name} ({u.employee_code})</span>
                      ) : (
                        <span className="text-amber-500 font-mono italic">Pure Admin (No Profile)</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {roles.map(r => (
            <div key={r.id} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
                {r.name}
              </span>
              <p className="text-xs text-slate-300 pt-2">{r.description}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Permission Key</th>
                  <th className="px-6 py-3">Module</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {permissions.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="px-6 py-3.5 font-mono font-bold text-cyan-400">{p.key}</td>
                    <td className="px-6 py-3.5 font-semibold text-slate-200">{p.module}</td>
                    <td className="px-6 py-3.5 uppercase text-slate-400 font-mono text-[10px]">{p.action}</td>
                    <td className="px-6 py-3.5">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
