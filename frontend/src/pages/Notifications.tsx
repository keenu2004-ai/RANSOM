import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/api-client';
import { Bell, CheckCheck, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{ notifications: any[] }>('/notifications');
      setNotifications(res?.notifications || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      setMarkingRead(true);
      await apiFetch('/notifications/mark-all-read', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setFeedback('All notifications marked as read.');
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to mark notifications as read.');
    } finally {
      setMarkingRead(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            <Bell className="w-5 h-5 text-[var(--primary)]" />
            <span>Notification Center</span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border border-[var(--accent-attention-border)]">
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="text-xs text-[var(--text-muted)]">System alerts, leave & expense status updates, and task assignments</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchNotifications}
            disabled={loading}
            className="p-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 min-h-[38px] min-w-[38px] flex items-center justify-center"
            title="Refresh notifications"
          >
            <RefreshCw className={`w-4 h-4 text-[var(--primary)] ${loading ? 'animate-spin' : ''}`} />
          </button>

          {notifications.length > 0 && unreadCount > 0 && (
            <button
              type="button"
              disabled={markingRead}
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-3.5 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 min-h-[38px]"
            >
              <CheckCheck className="w-4 h-4 text-[var(--badge-success-text)]" />
              <span>{markingRead ? 'Updating...' : 'Mark All as Read'}</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] text-[var(--badge-success-text)] rounded-xl flex items-center gap-2 text-xs font-medium animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-[var(--action-danger-soft)] border border-[var(--accent-attention-border)] rounded-2xl text-[var(--action-danger-bg)] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchNotifications}
            className="px-3 py-1.5 bg-[var(--action-danger-bg)] text-white font-semibold rounded-lg hover:bg-[var(--action-danger-hover)] transition-colors shrink-0"
          >
            Try Again
          </button>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-sm flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-[var(--primary)]" />
            <span>Loading notifications...</span>
          </div>
        ) : notifications.length > 0 ? (
          notifications.map(n => (
            <div
              key={n.id}
              className={`p-4 rounded-2xl border transition-all ${
                n.is_read
                  ? 'bg-[var(--bg-surface)] border-[var(--border-subtle)] opacity-85'
                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border-default)] shadow-sm ring-1 ring-[var(--primary)]/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-[var(--primary)] shrink-0" />
                    )}
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">{n.title}</h4>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">{n.message}</p>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0 whitespace-nowrap">
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-sm space-y-2">
            <Bell className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-40" />
            <div className="font-medium text-[var(--text-primary)]">No notifications yet</div>
            <p className="text-[11px] text-[var(--text-muted)]">You're all caught up! New alerts and approval updates will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
