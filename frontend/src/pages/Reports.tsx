import React, { useEffect, useState } from 'react';
import { apiFetch, getApiUrl } from '../services/api-client';
import { BarChart3, Download } from 'lucide-react';

export const Reports: React.FC = () => {
  const [report, setReport] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/reports/workforce')
      .then(res => setReport(res.report || []))
      .catch(console.error);
  }, []);

  const handleExport = () => {
    const token = localStorage.getItem('theiakshi_auth_token');
    const url = `${getApiUrl('/reports/export-csv')}`;
    
    // Download via fetch blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = 'employees_report.csv';
        a.click();
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            <span>Reports & Workforce Analytics</span>
          </h1>
          <p className="text-xs text-slate-400">Department distribution, employment type ratios, and CSV report export</p>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow shadow-emerald-600/20"
        >
          <Download className="w-4 h-4" />
          <span>Export Employees CSV</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 font-semibold text-xs text-slate-300">
          Departmental Workforce Headcount
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Department</th>
                <th className="px-6 py-3">Total Active Headcount</th>
                <th className="px-6 py-3">Full Time</th>
                <th className="px-6 py-3">Contract / Intern</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {report.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="px-6 py-3.5 font-bold text-slate-200">{r.department || 'General Admin'}</td>
                  <td className="px-6 py-3.5 font-mono text-cyan-400 font-bold">{r.total_employees}</td>
                  <td className="px-6 py-3.5 font-mono">{r.full_time}</td>
                  <td className="px-6 py-3.5 font-mono">{r.contract}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
