import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { Settings as SettingsIcon, Building2, MapPin, Layers } from 'lucide-react';

export const Settings: React.FC = () => {
  const [org, setOrg] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/settings/organization').then(res => setOrg(res.organization)).catch(console.error);
    apiFetch('/settings/departments').then(res => setDepartments(res.departments)).catch(console.error);
    apiFetch('/settings/designations').then(res => setDesignations(res.designations)).catch(console.error);
    apiFetch('/settings/branches').then(res => setBranches(res.branches)).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-cyan-400" />
          <span>Organization & System Settings</span>
        </h1>
        <p className="text-xs text-slate-400">Master entity configurations, branch locations, and organizational structures</p>
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
