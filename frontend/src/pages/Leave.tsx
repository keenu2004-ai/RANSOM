import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { CalendarDays, Plus, Settings, AlertCircle, ShieldCheck, Sliders } from 'lucide-react';

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
  const [policyData, setPolicyData] = useState({ clQuota: 6, elQuota: 6, slQuota: 6 });
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

  const [leaveFetchError, setLeaveFetchError] = useState<string | null>(null);

  const fetchLeaveData = useCallback(async () => {
    setLeaveFetchError(null);
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

      // Pre-populate policy data from database leave_types
      const clT = activeTypes.find((t: any) => t.code === 'CL');
      const elT = activeTypes.find((t: any) => t.code === 'EL' || t.code === 'PL');
      const slT = activeTypes.find((t: any) => t.code === 'SL');
      if (clT || elT || slT) {
        setPolicyData({
          clQuota: clT ? parseFloat(clT.annual_quota) : 6,
          elQuota: elT ? parseFloat(elT.annual_quota) : 6,
          slQuota: slT ? parseFloat(slT.annual_quota) : 6
        });
      }

      const isManager = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '');

      if (isManager) {
        try {
          const [reqRes, empRes] = await Promise.all([
            apiFetch('/leaves'),
            apiFetch('/employees').catch(() => null)
          ]);
          const reqs = reqRes?.data?.leaveRequests || reqRes?.leaveRequests || (Array.isArray(reqRes) ? reqRes : []);
          setLeaveRequests(reqs);
          const emps = empRes?.data?.employees || empRes?.employees || (Array.isArray(empRes) ? empRes : []);
          setEmployees(emps);
        } catch (err: any) {
          setLeaveFetchError(err.message || 'Unable to load leave requests.');
        }
      } else {
        try {
          const reqRes = await apiFetch('/leaves');
          const reqs = reqRes?.data?.leaveRequests || reqRes?.leaveRequests || (Array.isArray(reqRes) ? reqRes : []);
          setLeaveRequests(reqs);
        } catch (err: any) {
          setLeaveFetchError(err.message || 'Unable to load leave requests.');
        }
      }
    } catch (err: any) {
      console.error('Error in fetchLeaveData:', err);
      setLeaveFetchError(err.message || 'Unable to load leave information.');
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
      await fetchLeaveData();
    } catch (err: any) {
      if (err.code === 'REQUEST_NOT_PENDING' || err.message?.includes('already')) {
        alert('This leave request has already been processed.');
      } else if (err.code === 'LEAVE_NOT_FOUND' || err.message?.includes('not found')) {
        alert('Leave request no longer exists.');
      } else {
        alert(err.message || 'Unable to approve leave request. Please try again.');
      }
      await fetchLeaveData();
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
      await fetchLeaveData();
    } catch (err: any) {
      if (err.code === 'REQUEST_NOT_PENDING' || err.message?.includes('already')) {
        alert('This leave request has already been processed.');
      } else if (err.code === 'LEAVE_NOT_FOUND' || err.message?.includes('not found')) {
        alert('Leave request no longer exists.');
      } else {
        alert(err.message || 'Unable to reject leave request. Please try again.');
      }
      await fetchLeaveData();
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

  // Active Leave Types (excluding Optional Holiday 'OL')
  const activeBalances = balances.filter(b => b.leave_type_code !== 'OL');

  // Selected leave type for live preview calculation in adjustment modal
  const selectedAdjustmentType = leaveTypes.find(lt => lt.id === adjustmentData.leaveTypeId);
  const selectedOrgQuota = selectedAdjustmentType ? parseFloat(selectedAdjustmentType.annual_quota || '0') : 0;
  let calculatedFinalQuota = selectedOrgQuota;
  let adjustmentPreviewDisplay = `+${adjustmentData.adjustmentValue}`;
  if (adjustmentData.adjustmentType === 'INCREMENT') {
    calculatedFinalQuota = selectedOrgQuota + (adjustmentData.adjustmentValue || 0);
    adjustmentPreviewDisplay = `+${adjustmentData.adjustmentValue}`;
  } else if (adjustmentData.adjustmentType === 'DECREMENT') {
    calculatedFinalQuota = Math.max(0, selectedOrgQuota - (adjustmentData.adjustmentValue || 0));
    adjustmentPreviewDisplay = `-${adjustmentData.adjustmentValue}`;
  } else if (adjustmentData.adjustmentType === 'OVERRIDE') {
    calculatedFinalQuota = adjustmentData.adjustmentValue || 0;
    adjustmentPreviewDisplay = `Override: ${adjustmentData.adjustmentValue}`;
  }

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
          <p className="text-xs text-slate-400">Manage leave entitlements (CL, EL/PL, SL), employee adjustments, and leave revocations</p>
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
            <div className="pt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-cyan-400 font-mono">
                {monthlyUsage.clUsedThisMonth} <span className="text-xs text-slate-400 font-normal">/ {monthlyUsage.clMonthlyLimit} CL Days</span>
              </span>
              <span className="text-[11px] text-slate-400">Fixed Cap</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-snug pt-1 border-t border-slate-800">
              Casual Leave (CL) is capped at <strong>2 days per month</strong>. Additional CL requests convert to Earned Leave (EL/PL).
            </p>
          </div>
        </div>
      )}

      {/* Leave Requests Table for All Roles */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
            <span>{['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '') ? 'Workforce Leave Requests' : 'My Leave Requests'}</span>
            <span className="px-2 py-0.5 text-xs bg-slate-800 text-cyan-400 rounded-full font-mono font-semibold">
              {leaveRequests.length}
            </span>
          </h2>
        </div>

        {leaveFetchError ? (
          <div className="p-4 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{leaveFetchError}</span>
            </div>
            <button
              onClick={fetchLeaveData}
              className="px-3 py-1 bg-rose-900/60 hover:bg-rose-800 text-rose-100 rounded-lg text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
            <p className="text-xs text-slate-400 py-4">Loading workforce requests...</p>
          ) : leaveRequests.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No leave requests found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-mono">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4">Dates</th>
                    <th className="py-3 px-4">Days</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {leaveRequests.map((req: any) => (
                    <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {req.first_name} {req.last_name}
                        <span className="block text-[10px] text-slate-500 font-mono">{req.employee_code || 'EMP'}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-cyan-400">{req.leave_type_name} ({req.leave_type_code})</td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">{req.total_days}</td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-400" title={req.reason}>{req.reason}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                          req.status === 'APPROVED' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' :
                          req.status === 'REJECTED' ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60' :
                          req.status === 'CANCELLED' ? 'bg-slate-800 text-slate-400 border border-slate-700' :
                          'bg-amber-950/80 text-amber-400 border border-amber-800/60 animate-pulse'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {req.status === 'PENDING' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(req.id)}
                              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-semibold transition-all"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(req.id)}
                              className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 rounded-lg text-[11px] font-semibold transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {req.status !== 'CANCELLED' && req.status !== 'PENDING' && (
                          <button
                            onClick={() => handleCancelLeave(req.id)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded-lg text-[11px] font-medium transition-all"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {/* MODAL 1: Adjust Employee Leave Entitlement */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
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
                    <option key={lt.id} value={lt.id}>{lt.name} ({lt.code}) - Org Policy: {lt.annual_quota} Days</option>
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

              {/* Dynamic Calculation Live Breakdown Box */}
              <div className="p-3 bg-slate-950/80 border border-indigo-500/30 rounded-xl space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Organization Entitlement ({selectedAdjustmentType?.code || 'TYPE'}):</span>
                  <span className="font-bold text-slate-200">{selectedOrgQuota} days</span>
                </div>
                <div className="flex justify-between text-indigo-400">
                  <span>Employee Adjustment:</span>
                  <span className="font-bold">{adjustmentPreviewDisplay}</span>
                </div>
                <div className="flex justify-between text-emerald-400 pt-1.5 border-t border-slate-800 text-xs">
                  <span className="font-bold">Final Calculated Entitlement:</span>
                  <span className="font-extrabold text-sm">{calculatedFinalQuota} days</span>
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

      {/* MODAL 2: Leave Policy Configuration (Admin) */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Organization Leave Policy Configuration</h3>
            <p className="text-xs text-slate-400">Set organization-wide base annual leave quotas for active leave types</p>

            <form onSubmit={handlePolicySave} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Casual Leave (CL) Annual Quota</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={policyData.clQuota}
                  onChange={e => setPolicyData({ ...policyData, clQuota: parseInt(e.target.value, 10) || 6 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Earned / Privilege Leave (EL/PL) Annual Quota</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={policyData.elQuota}
                  onChange={e => setPolicyData({ ...policyData, elQuota: parseInt(e.target.value, 10) || 6 })}
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
                  onChange={e => setPolicyData({ ...policyData, slQuota: parseInt(e.target.value, 10) || 6 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                />
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Fixed Monthly CL Rule:</span>
                </div>
                <p>Casual Leave limit is strictly fixed at <strong>2 days per calendar month</strong>. Excess CL requests automatically convert to Earned Leave (EL/PL).</p>
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
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold shadow"
                >
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Apply Leave */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Submit Leave Request</h3>
            {formError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl">
                {formError}
              </div>
            )}
            <form onSubmit={handleApply} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Leave Type *</label>
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
                  <label className="block text-slate-300 mb-1 font-medium">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={e => {
                      const newStart = e.target.value;
                      const newEnd = formData.endDate && formData.endDate < newStart ? newStart : formData.endDate;
                      let days = 1;
                      if (newStart && newEnd) {
                        const diffTime = Math.abs(new Date(newEnd).getTime() - new Date(newStart).getTime());
                        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                      }
                      setFormData({ ...formData, startDate: newStart, endDate: newEnd, totalDays: days });
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">End Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={e => {
                      const newEnd = e.target.value;
                      let days = 1;
                      if (formData.startDate && newEnd) {
                        const diffTime = Math.abs(new Date(newEnd).getTime() - new Date(formData.startDate).getTime());
                        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                      }
                      setFormData({ ...formData, endDate: newEnd, totalDays: days });
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium font-mono">Total Days *</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={formData.totalDays}
                  onChange={e => setFormData({ ...formData, totalDays: parseFloat(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Reason *</label>
                <textarea
                  required
                  rows={2}
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="Reason for leave"
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
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold shadow"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
