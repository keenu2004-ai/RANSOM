import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { CalendarDays, Plus, Check, X, Clock, Settings, AlertCircle, ShieldCheck, Ban, UserCheck, Sliders } from 'lucide-react';

export const Leave: React.FC = () => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [monthlyUsage, setMonthlyUsage] = useState<any>({ clUsedThisMonth: 0, clMonthlyLimit: 2 });
  const [loading, setLoading] = useState(true);

  // Leave Policy Config State for Admin
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyData, setPolicyData] = useState({ clQuota: 12, elQuota: 18, slQuota: 12 });
  const [policySuccess, setPolicySuccess] = useState<string | null>(null);

  // Leave Entitlement Adjustment Modal State for HR / Admin
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({
    employeeId: '',
    leaveTypeId: '',
    adjustmentType: 'INCREMENT',
    adjustmentValue: 1,
    reason: ''
  });

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

  const fetchLeaveData = useCallback(async () => {
    try {
      if (user?.employeeId) {
        const [balRes, usageRes] = await Promise.all([
          apiFetch('/leaves/me/balance').catch(() => null),
          apiFetch('/leaves/monthly-usage').catch(() => null)
        ]);
        setBalances(balRes?.balances || balRes?.data?.balances || []);
        if (usageRes) {
          const usageObj = usageRes.clUsedThisMonth !== undefined ? usageRes : usageRes.data;
          if (usageObj) setMonthlyUsage(usageObj);
        }
      }

      const typesRes = await apiFetch('/leaves/types');
      const rawTypes = typesRes?.leaveTypes || typesRes?.data?.leaveTypes || (Array.isArray(typesRes) ? typesRes : []);
      const activeTypes = rawTypes.filter((t: any) => t.is_active !== false && t.code !== 'OL');
      setLeaveTypes(activeTypes);

      if (['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '')) {
        const [reqRes, empRes] = await Promise.all([
          apiFetch('/leaves').catch(() => null),
          apiFetch('/employees').catch(() => null)
        ]);
        setLeaveRequests(reqRes?.leaveRequests || []);
        setEmployees(empRes?.employees || empRes || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLeaveData();
  }, [fetchLeaveData]);

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

  const handlePolicySave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/leaves/policy', {
        method: 'PUT',
        body: JSON.stringify(policyData)
      });
      setShowPolicyModal(false);
      setPolicySuccess('Leave entitlement policy updated successfully.');
      setTimeout(() => setPolicySuccess(null), 4000);
      fetchLeaveData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAdjustmentSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/leaves/adjustments', {
        method: 'POST',
        body: JSON.stringify(adjustmentData)
      });
      setShowAdjustmentModal(false);
      setPolicySuccess('Employee leave entitlement adjusted successfully.');
      setTimeout(() => setPolicySuccess(null), 4000);
      fetchLeaveData();
    } catch (err: any) {
      alert(err.message || 'Failed to adjust leave entitlement.');
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

  const handleCancelLeave = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;
    try {
      await apiFetch(`/leaves/${id}/cancel`, { method: 'PUT' });
      fetchLeaveData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel leave request.');
    }
  };

  // 3 Canonical Active Leave Types
  const activeBalances = balances.filter(b => b.leave_type_code !== 'OL');

  return (
    <div className="space-y-6">
      {policySuccess && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-2xl flex items-center gap-2 shadow-lg">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold">{policySuccess}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-cyan-400" />
            <span>Leave Management & Policy</span>
          </h1>
          <p className="text-xs text-slate-400">Manage leave entitlements (CL, EL, SL), employee adjustments, and leave revocations</p>
        </div>

        <div className="flex items-center gap-2">
          {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(user?.role || '') && (
            <button
              onClick={() => {
                if (employees.length > 0) setAdjustmentData(a => ({ ...a, employeeId: employees[0].id }));
                if (leaveTypes.length > 0) setAdjustmentData(a => ({ ...a, leaveTypeId: leaveTypes[0].id }));
                setShowAdjustmentModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-semibold text-xs rounded-xl shadow transition-all"
            >
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Adjust Employee Leave</span>
            </button>
          )}

          {['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '') && (
            <button
              onClick={() => setShowPolicyModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl shadow transition-all"
            >
              <Settings className="w-4 h-4 text-cyan-400" />
              <span>Configure Policy</span>
            </button>
          )}

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
      </div>

      {/* Personal Leave Cards Grid */}
      {user?.employeeId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeBalances.map(b => (
            <div key={b.id} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 uppercase tracking-widest">
                  {b.leave_type_code}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Quota: {b.quota} Days</span>
              </div>
              <h3 className="font-bold text-sm text-slate-100">{b.leave_type_name}</h3>
              <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs border-t border-slate-800">
                <div className="p-2 bg-slate-950/60 rounded-xl">
                  <span className="block text-[10px] text-slate-500 font-semibold uppercase">Quota</span>
                  <span className="font-mono font-bold text-slate-200">{b.quota}</span>
                </div>
                <div className="p-2 bg-slate-950/60 rounded-xl">
                  <span className="block text-[10px] text-slate-500 font-semibold uppercase">Taken</span>
                  <span className="font-mono font-bold text-amber-400">{b.used}</span>
                </div>
                <div className="p-2 bg-slate-950/60 rounded-xl">
                  <span className="block text-[10px] text-slate-500 font-semibold uppercase">Available</span>
                  <span className="font-mono font-bold text-emerald-400">{b.available}</span>
                </div>
              </div>
            </div>
          ))}

          {/* LEAVE TAKEN THIS MONTH Card */}
          <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 border border-cyan-500/30 rounded-2xl space-y-2 relative shadow-lg">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold text-indigo-300 bg-indigo-950/80 border border-indigo-800/60 uppercase tracking-widest">
                MONTHLY STATS
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full">
                Auto Resets
              </span>
            </div>
            <h3 className="font-bold text-sm text-white">Leave Taken This Month</h3>
            <p className="text-xs text-slate-400">Current calendar month approved leave tracking</p>
            <div className="pt-2 border-t border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Casual Leave (CL)</span>
                <span className="font-mono font-extrabold text-cyan-400">
                  {monthlyUsage.clUsedThisMonth} / {monthlyUsage.clMonthlyLimit} Days
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div 
                  className="bg-cyan-500 h-full rounded-full transition-all" 
                  style={{ width: `${Math.min(100, (monthlyUsage.clUsedThisMonth / monthlyUsage.clMonthlyLimit) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 pt-1">
                * Excess CL beyond 2 days/month is automatically covered by Earned Leave (EL).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Workforce Leave Applications Table */}
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
                  leaveRequests.map(lr => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isFutureApproved = lr.status === 'APPROVED' && lr.start_date > todayStr;
                    const isCancelable = lr.status === 'PENDING' || isFutureApproved;

                    return (
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
                            lr.status === 'CANCELLED' ? 'bg-slate-500/10 text-slate-400 border-slate-500/30' :
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
                          {isCancelable && (
                            <button
                              onClick={() => handleCancelLeave(lr.id)}
                              className="px-2.5 py-1 bg-amber-950/50 hover:bg-amber-900 text-amber-300 border border-amber-800/60 rounded-lg flex items-center gap-1 inline-flex"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Revoke</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
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

      {/* Adjust Entitlements Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Adjust Employee Leave Entitlement</h3>
            <p className="text-xs text-slate-400">Override or adjust annual leave entitlement for a specific employee (e.g. mid-year joiner or performance grant)</p>

            <form onSubmit={handleAdjustmentSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Target Employee *</label>
                <select
                  value={adjustmentData.employeeId}
                  onChange={e => setAdjustmentData({ ...adjustmentData, employeeId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_code || 'EMP'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Leave Type *</label>
                <select
                  value={adjustmentData.leaveTypeId}
                  onChange={e => setAdjustmentData({ ...adjustmentData, leaveTypeId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  {leaveTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Adjustment Type *</label>
                  <select
                    value={adjustmentData.adjustmentType}
                    onChange={e => setAdjustmentData({ ...adjustmentData, adjustmentType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    <option value="INCREMENT">Add (+ Days)</option>
                    <option value="DECREMENT">Deduct (- Days)</option>
                    <option value="OVERRIDE">Set Fixed Quota</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium font-mono">Value (Days) *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={adjustmentData.adjustmentValue}
                    onChange={e => setAdjustmentData({ ...adjustmentData, adjustmentValue: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Audit Reason / Business Justification *</label>
                <textarea
                  required
                  rows={2}
                  value={adjustmentData.reason}
                  onChange={e => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="e.g. Mid-year joiner prorated entitlement adjustment"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow"
                >
                  Save Entitlement Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Policy Configuration Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Configure Organization Leave Policy</h3>
            <p className="text-xs text-slate-400">Set organization-wide annual leave quotas for active leave types</p>

            <form onSubmit={handlePolicySave} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Casual Leave (CL) Annual Quota</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={policyData.clQuota}
                  onChange={e => setPolicyData({ ...policyData, clQuota: parseInt(e.target.value, 10) || 12 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Earned Leave (EL) Annual Quota</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={policyData.elQuota}
                  onChange={e => setPolicyData({ ...policyData, elQuota: parseInt(e.target.value, 10) || 18 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Sick Leave (SL) Annual Quota</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={policyData.slQuota}
                  onChange={e => setPolicyData({ ...policyData, slQuota: parseInt(e.target.value, 10) || 12 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                />
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Fixed Monthly CL Rule:</span>
                </div>
                <p>Casual Leave limit is strictly fixed at <strong>2 days per calendar month</strong>. Excess CL requests automatically convert to Earned Leave (EL).</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPolicyModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-semibold shadow"
                >
                  Save Policy
                </button>
              </div>
            </form>
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
