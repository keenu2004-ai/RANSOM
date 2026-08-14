import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { Bell, CheckCheck } from 'lucide-react';

export const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch('/notifications');
      setNotifications(res.notifications || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/notifications/mark-all-read', { method: 'POST' });
      fetchNotifications();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-cyan-400" />
            <span>Notification Center</span>
          </h1>
          <p className="text-xs text-slate-400">System alerts, leave & expense status updates, and announcement notifications</p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-all"
        >
          <CheckCheck className="w-4 h-4 text-emerald-400" />
          <span>Mark All as Read</span>
        </button>
      </div>

      <div className="space-y-3">
        {notifications.length > 0 ? (
          notifications.map(n => (
            <div key={n.id} className={`p-4 rounded-2xl border ${n.is_read ? 'bg-slate-900/60 border-slate-800/60' : 'bg-slate-900 border-cyan-500/30'}`}>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-100">{n.title}</h4>
                <span className="text-[10px] text-slate-500 font-mono">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{n.message}</p>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
            No active notifications.
          </div>
        )}
      </div>
    </div>
  );
};
