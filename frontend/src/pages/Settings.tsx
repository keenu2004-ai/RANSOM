import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { Settings as SettingsIcon, Building2, KeyRound } from 'lucide-react';

export const Settings: React.FC = () => {
  const [org, setOrg] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/settings/organization').then(res => setOrg(res.organization)).catch(console.error);
    apiFetch('/settings/departments').then(res => setDepartments(res.departments)).catch(console.error);
    apiFetch('/settings/designations').then(res => setDesignations(res.designations)).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-[var(--primary)]" />
          <span>Settings & Account Security</span>
        </h1>
        <p className="text-xs text-[var(--text-muted)]">Manage account credentials, organizational parameters, and system preferences</p>
      </div>

      {/* Microsoft Entra ID Account Security Status */}
      <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl space-y-4 shadow-sm">
        <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[var(--primary)]" />
          <span>Account Security</span>
        </h3>

        <div className="p-4 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)] font-medium">Authentication Provider</span>
            <span className="px-2.5 py-1 text-[10px] font-extrabold bg-[var(--primary-soft)] text-[var(--primary)] rounded-full border border-[var(--border-subtle)] uppercase tracking-wider">
              Microsoft Entra ID Active
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Your account is secured through Microsoft Entra ID Single Sign-On (SSO). Password management, multi-factor authentication (MFA), and credential policies are managed directly by your organization's Microsoft 365 Entra ID administrator.
          </p>
        </div>
      </div>

      {org && (
        <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl space-y-4 shadow-sm">
          <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[var(--primary)]" />
            <span>Organization Profile</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)] font-medium">Company Name</span>
              <p className="font-bold text-[var(--text-primary)] mt-1">{org.name}</p>
            </div>
            <div className="p-3 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)] font-medium">Organization Code</span>
              <p className="font-mono font-bold text-[var(--primary)] mt-1">{org.code}</p>
            </div>
            <div className="p-3 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)] font-medium">Base Currency</span>
              <p className="font-mono font-bold text-emerald-700 mt-1">₹ {org.currency}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl space-y-3 shadow-sm">
          <h3 className="font-bold text-sm text-[var(--text-primary)]">Configured Departments ({departments.length})</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
            {departments.map(d => (
              <div key={d.id} className="p-3 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-subtle)] flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--text-primary)]">{d.name}</span>
                <span className="font-mono text-[10px] text-[var(--primary)] font-bold">{d.code}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl space-y-3 shadow-sm">
          <h3 className="font-bold text-sm text-[var(--text-primary)]">Configured Designations ({designations.length})</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
            {designations.map(d => (
              <div key={d.id} className="p-3 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-subtle)] flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--text-primary)]">{d.name}</span>
                <span className="font-mono text-[10px] text-[var(--text-secondary)] font-bold">{d.code}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
