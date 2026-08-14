import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { Megaphone, Plus } from 'lucide-react';

export const Announcements: React.FC = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '', targetAudience: 'ALL' });

  const fetchAnnouncements = async () => {
    try {
      const res = await apiFetch('/announcements');
      setAnnouncements(res.announcements || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/announcements', { method: 'POST', body: JSON.stringify(formData) });
      setShowModal(false);
      setFormData({ title: '', content: '', targetAudience: 'ALL' });
      fetchAnnouncements();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-cyan-400" />
            <span>Company Announcements</span>
          </h1>
          <p className="text-xs text-slate-400">Broadcast official news and updates to company branches and departments</p>
        </div>

        {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(user?.role || '') && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-xs rounded-xl shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Publish Announcement</span>
          </button>
        )}
      </div>

      <div className="space-y-4">
        {announcements.map(a => (
          <div key={a.id} className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                Audience: {a.target_audience}
              </span>
              <span className="text-xs font-mono text-slate-500">{new Date(a.published_at).toLocaleDateString()}</span>
            </div>
            <h3 className="font-bold text-base text-white">{a.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{a.content}</p>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Publish Company Announcement</h3>
            <form onSubmit={handlePublish} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Headline Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Announcement Content *</label>
                <textarea
                  required
                  rows={4}
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-cyan-500 text-white rounded-xl font-semibold">Publish Now</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
