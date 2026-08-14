import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { CalendarDays, Plus, Check, X, Clock } from 'lucide-react';

export const Leave: React.FC = () => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Apply Modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    totalDays: 1,
    reason: ''
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchLeaveData = async () => {
    try {
      if (user?.employeeId) {
        const balRes = await apiFetch('/leaves/me/balance').catch(() => null);
        setBalances(balRes?.balances || []);
      }

      const typesRes = await apiFetch('/leaves/types');
      setLeaveTypes(typesRes.leaveTypes || []);

      if (['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '')) {
        const reqRes = await apiFetch('/leaves');
        setLeaveRequests(reqRes.leaveRequests || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveData();
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await apiFetch('/leaves/apply', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setShowApplyModal(false);
      setFormData({ leaveTypeId: '', startDate: '', endDate: '', totalDays: 1, reason: '' });
      fetchLeaveData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await apiFetch(`/leaves/${id}/approve`, { method: 'PUT' });
      fetchLeaveData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (reason === null) return;
    try {
      await apiFetch(`/leaves/${id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ rejectionReason: reason })
      });
      fetchLeaveData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-cyan-400" />
            <span>Leave Management</span>
          </h1>
          <p className="text-xs text-slate-400">View personal leave quotas, submit leave requests, and manage workforce leave approvals</p>
        </div>

        {user?.employeeId && (
          <button
            onClick={() => {
              if (leaveTypes.length > 0) setFormData(f => ({ ...f, leaveTypeId: leaveTypes[0].id }));
              setShowApplyModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Apply Leave</span>
          </button>
        )}
      </div>

      {/* Personal Leave Balances Cards */}
      {user?.employeeId && balances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {balances.map(b => (
            <div key={b.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">{b.leave_type_code}</span>
              <p className="font-semibold text-xs text-slate-200 truncate">{b.leave_type_name}</p>
              <div className="flex items-baseline justify-between pt-2">
                <span className="text-2xl font-bold text-white">{b.available}</span>
                <span className="text-[10px] text-slate-500">of {b.quota} Days Available</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Administrative Leave Requests Table */}
      {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '') && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 font-semibold text-xs text-slate-300">
            Workforce Leave Applications
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Duration</th>
                  <th className="px-6 py-3">Days</th>
                  <th className="px-6 py-3">Reason</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leaveRequests.length > 0 ? (
                  leaveRequests.map(lr => (
                    <tr key={lr.id} className="hover:bg-slate-800/40">
                      <td className="px-6 py-3.5 font-semibold text-slate-200">{lr.employee_name} ({lr.employee_code})</td>
                      <td className="px-6 py-3.5 font-medium text-cyan-400">{lr.leave_type_name}</td>
                      <td className="px-6 py-3.5 font-mono text-[11px]">{lr.start_date} to {lr.end_date}</td>
                      <td className="px-6 py-3.5 font-bold">{lr.total_days}</td>
                      <td className="px-6 py-3.5 max-w-xs truncate">{lr.reason}</td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          lr.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          lr.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {lr.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right space-x-2">
                        {lr.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(lr.id)}
                              className="px-2.5 py-1 bg-emerald-950/50 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 rounded-lg"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(lr.id)}
                              className="px-2.5 py-1 bg-rose-950/50 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-lg"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">No leave applications found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Apply For Leave</h3>
            {formError && <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl">{formError}</div>}

            <form onSubmit={handleApply} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Leave Type *</label>
                <select
                  value={formData.leaveTypeId}
                  onChange={e => setFormData({ ...formData, leaveTypeId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  {leaveTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Total Days *</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={formData.totalDays}
                  onChange={e => setFormData({ ...formData, totalDays: parseFloat(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="State detailed reason for leave request..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-semibold shadow"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
