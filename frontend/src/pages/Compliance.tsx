import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';

export const Compliance: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/compliance/statutory-rules')
      .then(res => setRules(res.statutoryRules || []))
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-amber-400" />
          <span>Statutory Compliance & Tax Governance</span>
        </h1>
        <p className="text-xs text-slate-400">Database-driven statutory rates for EPF, ESI, Professional Tax (PT), and TDS</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map(r => (
          <div key={r.id} className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100">{r.rule_name}</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">ACTIVE</span>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-slate-400">EPF Contribution Rate</span>
                <p className="text-lg font-bold text-cyan-400 mt-1">{r.epf_rate}%</p>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-slate-400">ESI Employee Rate</span>
                <p className="text-lg font-bold text-cyan-400 mt-1">{r.esi_rate}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
