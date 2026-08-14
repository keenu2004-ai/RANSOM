import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { CalendarCheck, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Holidays: React.FC = () => {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ title: '', date: '', holidayType: 'COMPANY', description: '' });

  const fetchHolidays = async () => {
    try {
      const res = await apiFetch('/holidays');
      setHolidays(res.holidays);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/holidays', { method: 'POST', body: JSON.stringify(formData) });
      setShowAddModal(false);
      setFormData({ title: '', date: '', holidayType: 'COMPANY', description: '' });
      fetchHolidays();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this holiday entry?')) return;
    try {
      await apiFetch(`/holidays/${id}`, { method: 'DELETE' });
      fetchHolidays();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-indigo-400" />
            <span>Holiday Calendar</span>
          </h1>
          <p className="text-xs text-slate-400">Official company and national holidays for current calendar year</p>
        </div>

        {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(user?.role || '') && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-cyan-600 text-white font-semibold text-xs rounded-xl shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Holiday</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {holidays.map(h => (
          <div key={h.id} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  {h.holiday_type}
                </span>
                {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(user?.role || '') && (
                  <button onClick={() => handleDelete(h.id)} className="text-slate-500 hover:text-rose-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <h3 className="font-bold text-sm text-slate-100 mt-2">{h.title}</h3>
              <p className="text-xs text-slate-400 mt-1">{h.description || 'Company official holiday.'}</p>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-cyan-400 font-semibold">
              <span>{h.date}</span>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Add New Holiday</h3>
            <form onSubmit={handleAdd} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

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
                <label className="block text-slate-400 mb-1">Type</label>
                <select
                  value={formData.holidayType}
                  onChange={e => setFormData({ ...formData, holidayType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  <option value="NATIONAL">National Holiday</option>
                  <option value="COMPANY">Company Holiday</option>
                  <option value="OPTIONAL">Optional Holiday</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-500 text-white rounded-xl font-semibold">Save Holiday</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
