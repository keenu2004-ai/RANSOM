import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { FileText, Plus } from 'lucide-react';

export const Timesheets: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [myTimesheets, setMyTimesheets] = useState<any[]>([]);
  const [allTimesheets, setAllTimesheets] = useState<any[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ projectId: '', date: new Date().toISOString().split('T')[0], hours: 8, description: '' });

  const fetchTimesheets = async () => {
    try {
      const projRes = await apiFetch('/timesheets/projects');
      setProjects(projRes.projects || []);

      if (user?.employeeId) {
        const myRes = await apiFetch('/timesheets/my').catch(() => null);
        setMyTimesheets(myRes?.timesheets || []);
      }

      if (['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '')) {
        const allRes = await apiFetch('/timesheets');
        setAllTimesheets(allRes.timesheets || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTimesheets();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/timesheets', { method: 'POST', body: JSON.stringify(formData) });
      setShowModal(false);
      fetchTimesheets();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-cyan-400" />
            <span>Weekly Plan & Project Timesheets</span>
          </h1>
          <p className="text-xs text-slate-400">Log project hours and review operational workload logs</p>
        </div>

        {user?.employeeId && (
          <button
            onClick={() => {
              if (projects.length > 0) setFormData(f => ({ ...f, projectId: projects[0].id }));
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-xs rounded-xl shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Log Daily Hours</span>
          </button>
        )}
      </div>

      {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '') && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 font-semibold text-xs text-slate-300">
            Workforce Timesheet Activity
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Project</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Logged Hours</th>
                  <th className="px-6 py-3">Task Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allTimesheets.length > 0 ? (
                  allTimesheets.map(t => (
                    <tr key={t.id} className="hover:bg-slate-800/40">
                      <td className="px-6 py-3.5 font-semibold text-slate-200">{t.employee_name} ({t.employee_code})</td>
                      <td className="px-6 py-3.5 font-medium text-cyan-400">{t.project_name}</td>
                      <td className="px-6 py-3.5 font-mono">{t.date}</td>
                      <td className="px-6 py-3.5 font-mono font-bold text-emerald-400">{t.hours} hrs</td>
                      <td className="px-6 py-3.5 max-w-xs truncate">{t.description}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No timesheet entries found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Log Project Hours</h3>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Project *</label>
                <select
                  value={formData.projectId}
                  onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Hours *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={formData.hours}
                    onChange={e => setFormData({ ...formData, hours: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Task Summary *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="Describe daily tasks performed..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-cyan-500 text-white rounded-xl font-semibold">Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
