import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { Settings as SettingsIcon, Building2, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

export const Settings: React.FC = () => {
  const [org, setOrg] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  // Password Change State
  const [passData, setPassData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [passLoading, setPassLoading] = useState(false);

  useEffect(() => {
    apiFetch('/settings/organization').then(res => setOrg(res.organization)).catch(console.error);
    apiFetch('/settings/departments').then(res => setDepartments(res.departments)).catch(console.error);
    apiFetch('/settings/designations').then(res => setDesignations(res.designations)).catch(console.error);
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (passData.newPassword !== passData.confirmPassword) {
      setPassError('New passwords do not match.');
      return;
    }

    if (passData.newPassword.length < 6) {
      setPassError('Password must be at least 6 characters long.');
      return;
    }

    setPassLoading(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(passData)
      });
      setPassSuccess('Password updated successfully.');
      setPassData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPassError(err.message || 'Failed to update password.');
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-cyan-400" />
          <span>Settings & Account Security</span>
        </h1>
        <p className="text-xs text-slate-400">Manage account credentials, organizational parameters, and system preferences</p>
      </div>

      {/* Microsoft Entra ID Account Security Status */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
        <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-cyan-400" />
          <span>Account Security</span>
        </h3>

        <div className="p-4 bg-slate-950/80 border border-cyan-500/30 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-medium">Authentication Provider</span>
            <span className="px-2.5 py-1 text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/40 uppercase tracking-wider">
              Microsoft Entra ID Active
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your account is secured through Microsoft Entra ID Single Sign-On (SSO). Password management, multi-factor authentication (MFA), and credential policies are managed directly by your organization's Microsoft 365 Entra ID administrator.
          </p>
        </div>
      </div>

      {org && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-400" />
            <span>Organization Profile</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500">Company Name</span>
              <p className="font-bold text-slate-200 mt-1">{org.name}</p>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500">Organization Code</span>
              <p className="font-mono font-bold text-cyan-400 mt-1">{org.code}</p>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500">Base Currency</span>
              <p className="font-mono font-bold text-emerald-400 mt-1">₹ {org.currency}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <h3 className="font-bold text-sm text-slate-100">Configured Departments ({departments.length})</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {departments.map(d => (
              <div key={d.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">{d.name}</span>
                <span className="font-mono text-[10px] text-cyan-400 font-bold">{d.code}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <h3 className="font-bold text-sm text-slate-100">Configured Designations ({designations.length})</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {designations.map(d => (
              <div key={d.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">{d.name}</span>
                <span className="font-mono text-[10px] text-indigo-400 font-bold">{d.code}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
