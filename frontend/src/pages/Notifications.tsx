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
          <h1 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            <Bell className="w-5 h-5 text-[var(--primary)]" />
            <span>Notification Center</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)]">System alerts, leave & expense status updates, and task assignments</p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
        >
          <CheckCheck className="w-4 h-4 text-[var(--badge-success-text)]" />
          <span>Mark All as Read</span>
        </button>
      </div>

      <div className="space-y-3">
        {notifications.length > 0 ? (
          notifications.map(n => (
            <div key={n.id} className={`p-4 rounded-2xl border transition-all ${n.is_read ? 'bg-[var(--bg-surface)] border-[var(--border-subtle)]' : 'bg-[var(--bg-surface-elevated)] border-[var(--border-default)] shadow-sm'}`}>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-[var(--text-primary)]">{n.title}</h4>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{n.message}</p>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-sm">
            No active notifications.
          </div>
        )}
      </div>
    </div>
  );
};
