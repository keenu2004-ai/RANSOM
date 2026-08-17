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

      {/* Employee Self-Service Change Password */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
        <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-cyan-400" />
          <span>Security — Change Account Password</span>
        </h3>

        {passSuccess && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">{passSuccess}</span>
          </div>
        )}

        {passError && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{passError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-medium">Current Password *</label>
            <input
              type="password"
              required
              value={passData.currentPassword}
              onChange={e => setPassData({ ...passData, currentPassword: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
              placeholder="Enter current password"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">New Password *</label>
              <input
                type="password"
                required
                value={passData.newPassword}
                onChange={e => setPassData({ ...passData, newPassword: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Confirm New Password *</label>
              <input
                type="password"
                required
                value={passData.confirmPassword}
                onChange={e => setPassData({ ...passData, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                placeholder="Re-type new password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={passLoading}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
          >
            {passLoading ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>
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
