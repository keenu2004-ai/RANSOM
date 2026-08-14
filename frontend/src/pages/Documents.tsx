import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { FolderGit2, FileText, CheckCircle } from 'lucide-react';

export const Documents: React.FC = () => {
  const [types, setTypes] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/documents/types')
      .then(res => setTypes(res.documentTypes || []))
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
          <FolderGit2 className="w-6 h-6 text-cyan-400" />
          <span>Document Management Library</span>
        </h1>
        <p className="text-xs text-slate-400">Mandatory compliance identity documents, certificates, and employment letters</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {types.map(t => (
          <div key={t.id} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 font-mono">{t.code}</span>
              <h3 className="font-bold text-sm text-slate-100 mt-2">{t.name}</h3>
              <p className="text-xs text-slate-400 mt-1">{t.description || 'Verified onboarding document.'}</p>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className={t.is_required ? 'text-amber-400 font-semibold' : 'text-slate-500'}>
                {t.is_required ? 'Mandatory Requirement' : 'Optional File'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
