import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/api-client';
import { Settings as SettingsIcon, Building2, KeyRound, RefreshCw, AlertCircle } from 'lucide-react';

export const Settings: React.FC = () => {
  const [org, setOrg] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [orgRes, deptRes, desigRes] = await Promise.all([
        apiFetch('/settings/organization').catch(() => ({ organization: null })),
        apiFetch('/settings/departments').catch(() => ({ departments: [] })),
        apiFetch('/settings/designations').catch(() => ({ designations: [] }))
      ]);
      setOrg(orgRes?.organization || null);
      setDepartments(deptRes?.departments || []);
      setDesignations(desigRes?.designations || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load organization settings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-[var(--primary)]" />
            <span>Settings & Account Security</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)]">Manage account credentials, organizational parameters, and system preferences</p>
        </div>

        <button
          type="button"
          onClick={fetchSettings}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-muted)] text-xs font-semibold text-[var(--text-primary)] rounded-xl border border-[var(--border-default)] shadow-sm transition-all cursor-pointer self-start sm:self-auto disabled:opacity-50 min-h-[38px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[var(--primary)] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Settings</span>
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
            onClick={fetchSettings}
            className="px-3 py-1.5 bg-[var(--action-danger-bg)] text-white font-semibold rounded-lg hover:bg-[var(--action-danger-hover)] transition-colors shrink-0"
          >
            Try Again
          </button>
        </div>
      )}

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

      {loading ? (
        <div className="p-12 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-sm flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--primary)]" />
          <span>Loading organization profiles and parameters...</span>
        </div>
      ) : (
        <>
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
                  <p className="font-mono font-bold text-[var(--badge-success-text)] mt-1">₹ {org.currency || 'INR'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl space-y-3 shadow-sm">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Configured Departments ({departments.length})</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {departments.length > 0 ? (
                  departments.map(d => (
                    <div key={d.id} className="p-3 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-subtle)] flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--text-primary)]">{d.name}</span>
                      <span className="font-mono text-[10px] text-[var(--primary)] font-bold">{d.code}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-[var(--text-muted)] italic">No departments configured yet.</div>
                )}
              </div>
            </div>

            <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl space-y-3 shadow-sm">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Configured Designations ({designations.length})</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {designations.length > 0 ? (
                  designations.map(d => (
                    <div key={d.id} className="p-3 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-subtle)] flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--text-primary)]">{d.name}</span>
                      <span className="font-mono text-[10px] text-[var(--text-secondary)] font-bold">{d.code}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-[var(--text-muted)] italic">No designations configured yet.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Settings;
