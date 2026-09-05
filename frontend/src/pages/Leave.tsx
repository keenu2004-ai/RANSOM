import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { 
  CalendarDays, Plus, Settings, AlertCircle, ShieldCheck, Sliders, 
  Users, Clock, CheckCircle2, Search, Filter, Download, Eye, X, Info
} from 'lucide-react';

export const Leave: React.FC = () => {
  const { user } = useAuth();
  const isManagement = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'HR'].includes(user?.role || '');

  // Data states
  const [summaryData, setSummaryData] = useState<{
    totalEmployees: number;
    activeEmployees: number;
    inactiveEmployees: number;
    pendingRequests: number;
    approvedThisYear: number;
    avgLeaveUsage: number;
  }>({
    totalEmployees: 0,
    activeEmployees: 0,
    inactiveEmployees: 0,
    pendingRequests: 0,
    approvedThisYear: 0,
    avgLeaveUsage: 0
  });

  const [allBalancesData, setAllBalancesData] = useState<any[]>([]);
  const [myBalances, setMyBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [monthlyUsage, setMonthlyUsage] = useState<any>({ clUsedThisMonth: 0, clMonthlyLimit: 2 });
  const [loading, setLoading] = useState(true);

  // Filters state
  const [empSearch, setEmpSearch] = useState('');
  const [empDeptFilter, setEmpDeptFilter] = useState('ALL');
  const [empStatusFilter, setEmpStatusFilter] = useState('ALL');
  const [empPage, setEmpPage] = useState(1);
  const [empLimit, setEmpLimit] = useState(5);

  const [reqTab, setReqTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'ALL'>('PENDING');
  const [reqSearch, setReqSearch] = useState('');
  const [reqDeptFilter, setReqDeptFilter] = useState('ALL');
  const [reqTypeFilter, setReqTypeFilter] = useState('ALL');

  // Side Drawer / Detail Modal
  const [selectedEmpDetail, setSelectedEmpDetail] = useState<any | null>(null);
  const [drawerTab, setDrawerTab] = useState<'BALANCE' | 'HISTORY'>('BALANCE');

  // Action Modals
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyData, setPolicyData] = useState({ clQuota: 6, elQuota: 6, slQuota: 6 });
  const [policySuccess, setPolicySuccess] = useState<string | null>(null);

  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({
    employeeId: '',
    leaveTypeId: '',
    adjustmentType: 'INCREMENT',
    adjustmentValue: 1,
    reason: ''
  });

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
        setMyBalances(balRes?.balances || balRes?.data?.balances || []);
        if (usageRes) {
          const usageObj = usageRes.clUsedThisMonth !== undefined ? usageRes : usageRes.data;
          if (usageObj) setMonthlyUsage(usageObj);
        }
      }

      const typesRes = await apiFetch('/leaves/types');
      const rawTypes = typesRes?.leaveTypes || typesRes?.data?.leaveTypes || (Array.isArray(typesRes) ? typesRes : []);
      const activeTypes = rawTypes.filter((t: any) => t.is_active !== false && t.code !== 'OL');
      setLeaveTypes(activeTypes);

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

      if (isManagement) {
        try {
          const [allBalRes, reqRes, empRes] = await Promise.all([
            apiFetch('/leaves/all-balances').catch(() => null),
            apiFetch('/leaves'),
            apiFetch('/employees').catch(() => null)
          ]);

          if (allBalRes) {
            const empList = allBalRes.employees || allBalRes.data?.employees || [];
            const summary = allBalRes.summary || allBalRes.data?.summary || {
              totalEmployees: empList.length, activeEmployees: empList.filter((e: any) => e.status === 'ACTIVE').length, inactiveEmployees: empList.filter((e: any) => e.status !== 'ACTIVE').length,
              pendingRequests: 0, approvedThisYear: 0, avgLeaveUsage: 0
            };

            setAllBalancesData(empList);
            setSummaryData(summary);

            if (empList.length > 0 && !selectedEmpDetail) {
              setSelectedEmpDetail(empList[0]);
            }
          }

          const reqs = reqRes?.leaveRequests || reqRes?.data?.leaveRequests || (Array.isArray(reqRes) ? reqRes : []);
          setLeaveRequests(reqs);

          const emps = empRes?.employees || empRes?.data?.employees || (Array.isArray(empRes) ? empRes : []);
          setEmployees(emps);
        } catch (err: any) {
          setLeaveFetchError(err.message || 'Unable to load leave data.');
        }
      } else {
        try {
          const reqRes = await apiFetch('/leaves');
          const reqs = reqRes?.leaveRequests || reqRes?.data?.leaveRequests || (Array.isArray(reqRes) ? reqRes : []);
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
  }, [user, isManagement]);

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
      alert(err.message || 'Unable to approve leave request.');
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
      alert(err.message || 'Unable to reject leave request.');
      await fetchLeaveData();
    }
  };

  const handleCancelLeave = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;
    try {
      await apiFetch(`/leaves/${id}/cancel`, { method: 'PUT' });
      fetchLeaveData();
    } catch (err: any) {
      alert(err.message || 'Unable to cancel leave request.');
    }
  };

  // Filtered Balances
  const filteredEmpBalances = allBalancesData.filter(emp => {
    const matchesSearch = !empSearch || 
      emp.employee_name.toLowerCase().includes(empSearch.toLowerCase()) || 
      emp.employee_code.toLowerCase().includes(empSearch.toLowerCase());
    const matchesDept = empDeptFilter === 'ALL' || emp.department === empDeptFilter;
    const matchesStatus = empStatusFilter === 'ALL' || emp.status.toUpperCase() === empStatusFilter.toUpperCase();
    return matchesSearch && matchesDept && matchesStatus;
  });

  const paginatedEmpBalances = filteredEmpBalances.slice((empPage - 1) * empLimit, empPage * empLimit);

  // Filtered Requests
  const filteredRequests = leaveRequests.filter(req => {
    const matchesTab = reqTab === 'ALL' || req.status === reqTab;
    const matchesSearch = !reqSearch || 
      `${req.first_name} ${req.last_name}`.toLowerCase().includes(reqSearch.toLowerCase()) ||
      req.employee_code.toLowerCase().includes(reqSearch.toLowerCase());
    const matchesDept = reqDeptFilter === 'ALL' || req.department_name === reqDeptFilter;
    const matchesType = reqTypeFilter === 'ALL' || req.leave_type_code === reqTypeFilter || req.requested_leave_type_name === reqTypeFilter;
    return matchesTab && matchesSearch && matchesDept && matchesType;
  });

  // Unique departments list
  const departments = Array.from(new Set(allBalancesData.map(e => e.department).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 text-[var(--text-primary)] max-w-[1600px] mx-auto min-w-0 w-full overflow-x-hidden">
      {/* SECTION A — HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-surface)] p-4 sm:p-6 rounded-2xl border border-[var(--border-default)] shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--text-heading)] flex items-center gap-2">
            <CalendarDays className="h-6 w-6 sm:h-7 sm:w-7 text-[var(--primary)] shrink-0" />
            <span>Leave Management & Policy</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Manage employee leave balances, entitlements, requests, and leave policies.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowApplyModal(true)}
            className="w-full sm:w-auto justify-center px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl font-semibold text-sm transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Apply Leave
          </button>

          {isManagement && (
            <>
              <button
                onClick={() => setShowAdjustmentModal(true)}
                className="w-full sm:w-auto justify-center px-4 py-2.5 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded-xl font-medium text-sm border border-[var(--border-default)] transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Sliders className="h-4 w-4 text-[var(--primary)]" /> Adjust Employee Leave
              </button>

              <button
                onClick={() => setShowPolicyModal(true)}
                className="w-full sm:w-auto justify-center px-4 py-2.5 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded-xl font-medium text-sm border border-[var(--border-default)] transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Settings className="h-4 w-4 text-[var(--primary)]" /> Configure Policy
              </button>
            </>
          )}
        </div>
      </div>

      {policySuccess && (
        <div className="p-4 bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] text-[var(--badge-success-text)] rounded-xl text-sm flex items-center gap-2 shadow-xs">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <span className="font-semibold">{policySuccess}</span>
        </div>
      )}

      {/* SECTION B — SUMMARY CARDS */}
      {isManagement && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] flex items-center gap-4 shadow-xs">
            <div className="p-3 bg-[var(--secondary)]/15 text-[var(--secondary)] rounded-xl">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-[var(--text-heading)] font-mono">{summaryData.totalEmployees}</div>
              <div className="text-xs text-[var(--text-secondary)]">
                Total Employees <span className="text-[var(--primary)] font-semibold">({summaryData.activeEmployees} Active)</span>
              </div>
            </div>
          </div>

          <div className="p-5 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] flex items-center gap-4 shadow-xs">
            <div className="p-3 bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] rounded-xl">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-[var(--text-heading)] font-mono">{summaryData.pendingRequests}</div>
              <div className="text-xs text-[var(--text-secondary)]">Pending Requests</div>
            </div>
          </div>

          <div className="p-5 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] flex items-center gap-4 shadow-xs">
            <div className="p-3 bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] rounded-xl">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-[var(--text-heading)] font-mono">{summaryData.approvedThisYear}</div>
              <div className="text-xs text-[var(--text-secondary)]">Approved This Year</div>
            </div>
          </div>

          <div className="p-5 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] flex items-center gap-4 shadow-xs">
            <div className="p-3 bg-[var(--badge-info-bg)] text-[var(--badge-info-text)] rounded-xl">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-[var(--text-heading)] font-mono">{summaryData.avgLeaveUsage}</div>
              <div className="text-xs text-[var(--text-secondary)]">Avg. Leave Usage / Employee</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SECTION C — PRIMARY VIEW: EMPLOYEE LEAVE BALANCES */}
        <div className={`${selectedEmpDetail ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-6 transition-all duration-300`}>
          {isManagement ? (
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-heading)]">Employee Leave Balances</h2>
                  <p className="text-xs text-[var(--text-secondary)]">View and track leave quota & remaining balances for all employees</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-3 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder="Search employee..."
                      value={empSearch}
                      onChange={e => setEmpSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--input-text)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--primary)] w-48 sm:w-64"
                    />
                  </div>

                  <select
                    value={empDeptFilter}
                    onChange={e => setEmpDeptFilter(e.target.value)}
                    className="py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--input-text)] focus:outline-hidden focus:border-[var(--primary)] cursor-pointer"
                  >
                    <option value="ALL">All Departments</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>

                  <select
                    value={empStatusFilter}
                    onChange={e => setEmpStatusFilter(e.target.value)}
                    className="py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--input-text)] focus:outline-hidden focus:border-[var(--primary)] cursor-pointer"
                  >
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              {/* EMPLOYEE LEAVE BALANCES TABLE */}
              <div className="overflow-x-auto rounded-xl border border-[var(--border-default)]">
                <table className="w-full text-left text-sm text-[var(--text-primary)]">
                  <thead className="bg-[var(--bg-surface-muted)] text-xs uppercase text-[var(--text-secondary)] font-semibold border-b border-[var(--border-default)]">
                    <tr>
                      <th className="py-3.5 px-4">Employee</th>
                      <th className="py-3.5 px-4">Code</th>
                      <th className="py-3.5 px-4">Department</th>
                      <th className="py-3.5 px-4 min-w-[130px]">Casual Leave (CL)</th>
                      <th className="py-3.5 px-4 min-w-[140px]">Privilege (EL/PL)</th>
                      <th className="py-3.5 px-4 min-w-[130px]">Sick Leave (SL)</th>
                      <th className="py-3.5 px-4">Total</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-surface)]">
                    {paginatedEmpBalances.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-[var(--text-muted)]">
                          No employee balances match your search/filter criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedEmpBalances.map(emp => (
                        <tr
                          key={emp.employee_id}
                          className={`hover:bg-[var(--bg-surface-hover)] transition cursor-pointer ${
                            selectedEmpDetail?.employee_id === emp.employee_id ? 'bg-[var(--primary)]/5' : ''
                          }`}
                          onClick={() => { setSelectedEmpDetail(emp); setDrawerTab('BALANCE'); }}
                        >
                          <td className="py-3 px-4 font-medium text-[var(--text-heading)]">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-[var(--secondary)]/15 text-[var(--secondary)] border border-[var(--secondary)]/30 flex items-center justify-center text-xs font-bold">
                                {emp.employee_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                              </div>
                              <div>{emp.employee_name}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-[var(--text-secondary)] font-mono">{emp.employee_code}</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">{emp.department}</td>
                          
                          {/* CL Progress */}
                          <td className="py-3 px-4">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-[var(--text-primary)] font-bold">{emp.casual_leave.used} / {emp.casual_leave.quota}</span>
                              <span className="text-[var(--primary)] font-semibold">{emp.casual_leave.available} left</span>
                            </div>
                            <div className="w-full bg-[var(--bg-surface-muted)] rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-[var(--primary)] h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, (emp.casual_leave.used / (emp.casual_leave.quota || 1)) * 100)}%` }}
                              />
                            </div>
                          </td>

                          {/* PL Progress */}
                          <td className="py-3 px-4">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-[var(--text-primary)] font-bold">{emp.privilege_leave.used} / {emp.privilege_leave.quota}</span>
                              <span className="text-[var(--secondary)] font-semibold">{emp.privilege_leave.available} left</span>
                            </div>
                            <div className="w-full bg-[var(--bg-surface-muted)] rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-[var(--secondary)] h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, (emp.privilege_leave.used / (emp.privilege_leave.quota || 1)) * 100)}%` }}
                              />
                            </div>
                          </td>

                          {/* SL Progress */}
                          <td className="py-3 px-4">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-[var(--text-primary)] font-bold">{emp.sick_leave.used} / {emp.sick_leave.quota}</span>
                              <span className="text-[var(--badge-warning-text)] font-semibold">{emp.sick_leave.available} left</span>
                            </div>
                            <div className="w-full bg-[var(--bg-surface-muted)] rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-[var(--badge-warning-text)] h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, (emp.sick_leave.used / (emp.sick_leave.quota || 1)) * 100)}%` }}
                              />
                            </div>
                          </td>

                          <td className="py-3 px-4 font-bold text-[var(--primary)] font-mono">{emp.total_available}</td>

                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${
                              emp.status.toUpperCase() === 'ACTIVE'
                                ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border border-[var(--badge-success-border)]'
                                : 'bg-[var(--badge-danger-bg)] text-[var(--badge-danger-text)] border border-[var(--badge-danger-border)]'
                            }`}>
                              {emp.status}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedEmpDetail(emp); setDrawerTab('BALANCE'); }}
                              className="px-3 py-1.5 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--primary)] rounded-lg text-xs font-semibold border border-[var(--border-default)] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION FOOTER */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-secondary)] pt-2">
                <div>
                  Showing {filteredEmpBalances.length === 0 ? 0 : (empPage - 1) * empLimit + 1} to {Math.min(empPage * empLimit, filteredEmpBalances.length)} of {filteredEmpBalances.length} employees
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={empPage <= 1}
                    onClick={() => setEmpPage(p => Math.max(1, p - 1))}
                    className="p-1.5 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 cursor-pointer"
                  >
                    &lt;
                  </button>
                  {Array.from({ length: Math.ceil(filteredEmpBalances.length / empLimit) || 1 }, (_, i) => i + 1).slice(0, 5).map(p => (
                    <button
                      key={p}
                      onClick={() => setEmpPage(p)}
                      className={`px-3 py-1 rounded-lg border font-semibold cursor-pointer ${
                        empPage === p
                          ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]'
                          : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    disabled={empPage >= Math.ceil(filteredEmpBalances.length / empLimit)}
                    onClick={() => setEmpPage(p => Math.min(Math.ceil(filteredEmpBalances.length / empLimit), p + 1))}
                    className="p-1.5 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 cursor-pointer"
                  >
                    &gt;
                  </button>

                  <select
                    value={empLimit}
                    onChange={e => { setEmpLimit(Number(e.target.value)); setEmpPage(1); }}
                    className="ml-2 py-1 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--input-text)] focus:outline-hidden cursor-pointer"
                  >
                    <option value={5}>5 per page</option>
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* NON-MANAGEMENT MY BALANCE CARD */
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-6 space-y-6 shadow-xs">
              <h2 className="text-lg font-bold text-[var(--text-heading)]">My Leave Entitlements & Balances</h2>

              <div className="p-4 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-default)] flex items-center justify-between">
                <div>
                  <div className="text-xs text-[var(--text-secondary)] uppercase font-semibold">Casual Leave Monthly Quota</div>
                  <div className="text-sm font-semibold text-[var(--text-heading)] mt-1">
                    {monthlyUsage.clUsedThisMonth} / {monthlyUsage.clMonthlyLimit} CL used this calendar month
                  </div>
                </div>
                <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] px-3 py-1.5 rounded-lg border border-[var(--border-default)] font-medium">
                  Resets monthly
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {myBalances.map((b: any) => (
                  <div key={b.id} className="p-4 bg-[var(--bg-surface-muted)]/50 rounded-xl border border-[var(--border-default)] space-y-3 shadow-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[var(--text-heading)]">{b.leave_type_name}</span>
                      <span className="text-xs font-mono text-[var(--text-secondary)]">Code: {b.leave_type_code}</span>
                    </div>
                    <div className="text-2xl font-black text-[var(--primary)] font-mono">{b.available} <span className="text-xs font-normal text-[var(--text-secondary)]">days available</span></div>
                    <div className="text-xs text-[var(--text-secondary)] flex justify-between border-t border-[var(--border-default)] pt-2">
                      <span>Quota: {b.quota}</span>
                      <span>Used: {b.used}</span>
                      <span>Pending: {b.pending}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION E — LEAVE REQUESTS */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-6 space-y-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-heading)]">Leave Requests</h2>
                <p className="text-xs text-[var(--text-secondary)]">Manage and review employee leave requests & deduction allocations</p>
              </div>

              {/* Status Tabs Container */}
              <div className="w-full md:w-auto overflow-x-auto no-scrollbar py-0.5">
                <div className="flex items-center gap-1 bg-[var(--bg-surface-muted)] p-1 rounded-xl border border-[var(--border-default)] text-xs min-w-max">
                  {(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setReqTab(tab)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        reqTab === tab
                          ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {tab === 'PENDING' ? `Pending (${leaveRequests.filter(r => r.status === 'PENDING').length})` : tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 border-t border-[var(--border-default)] pt-4">
              <div className="relative w-full sm:w-auto">
                <Search className="h-4 w-4 absolute left-3 top-3 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={reqSearch}
                  onChange={e => setReqSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--input-text)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--primary)] w-full sm:w-48"
                />
              </div>

              {isManagement && (
                <select
                  value={reqDeptFilter}
                  onChange={e => setReqDeptFilter(e.target.value)}
                  className="w-full sm:w-auto py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--input-text)] focus:outline-hidden focus:border-[var(--primary)] cursor-pointer"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}

              <select
                value={reqTypeFilter}
                onChange={e => setReqTypeFilter(e.target.value)}
                className="w-full sm:w-auto py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--input-text)] focus:outline-hidden focus:border-[var(--primary)] cursor-pointer"
              >
                <option value="ALL">All Leave Types</option>
                <option value="CL">Casual Leave (CL)</option>
                <option value="PL">Privilege Leave (PL/EL)</option>
                <option value="SL">Sick Leave (SL)</option>
              </select>

              {(reqSearch || reqDeptFilter !== 'ALL' || reqTypeFilter !== 'ALL') && (
                <button
                  onClick={() => { setReqSearch(''); setReqDeptFilter('ALL'); setReqTypeFilter('ALL'); }}
                  className="text-xs text-[var(--primary)] font-semibold hover:underline self-start sm:self-center cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* REQUESTS TABLE */}
            <div className="overflow-x-auto rounded-xl border border-[var(--border-default)]">
              <table className="w-full text-left text-sm text-[var(--text-primary)]">
                <thead className="bg-[var(--bg-surface-muted)] text-xs uppercase text-[var(--text-secondary)] font-semibold border-b border-[var(--border-default)]">
                  <tr>
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Requested Leave</th>
                    <th className="py-3.5 px-4">Dates</th>
                    <th className="py-3.5 px-4 text-center">Days</th>
                    <th className="py-3.5 px-4">Actual Allocation</th>
                    <th className="py-3.5 px-4">Reason</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[var(--text-muted)]">
                        No leave requests found.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map(req => {
                      const isConverted = req.conversion_reason || (req.requested_leave_type_name && req.actual_deduction_type && req.requested_leave_type_name !== req.actual_deduction_type);

                      return (
                        <tr key={req.id} className="hover:bg-[var(--bg-surface-hover)] transition">
                          <td className="py-3 px-4 font-medium text-[var(--text-heading)]">
                            <div>{req.first_name} {req.last_name}</div>
                            <div className="text-xs text-[var(--text-muted)] font-mono">{req.employee_code}</div>
                          </td>

                          <td className="py-3 px-4 text-[var(--text-primary)]">
                            {req.requested_leave_type_name || req.leave_type_name}
                          </td>

                          <td className="py-3 px-4 text-xs font-mono text-[var(--text-secondary)]">
                            {req.start_date ? new Date(req.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''} – {req.end_date ? new Date(req.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                          </td>

                          <td className="py-3 px-4 text-center font-bold text-[var(--text-heading)] font-mono">{req.total_days}</td>

                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 ${
                              isConverted
                                ? 'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border border-[var(--badge-warning-border)]'
                                : 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border border-[var(--border-default)]'
                            }`}>
                              {req.total_days} {req.actual_deduction_type || req.leave_type_name}
                            </span>
                            {isConverted && (
                              <div className="text-[10px] text-[var(--badge-warning-text)] mt-1 max-w-[180px]">
                                {req.conversion_reason}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-xs text-[var(--text-secondary)] max-w-[160px] truncate" title={req.reason}>
                            {req.reason}
                          </td>

                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 text-xs rounded-full font-bold uppercase tracking-wider ${
                              req.status === 'APPROVED' ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border border-[var(--badge-success-border)]' :
                              req.status === 'PENDING' ? 'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border border-[var(--badge-warning-border)]' :
                              req.status === 'REJECTED' ? 'bg-[var(--badge-danger-bg)] text-[var(--badge-danger-text)] border border-[var(--badge-danger-border)]' :
                              'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-default)]'
                            }`}>
                              {req.status}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isManagement && req.status === 'PENDING' && (
                                <>
                                  <button
                                    onClick={() => handleApprove(req.id)}
                                    className="px-2.5 py-1 bg-[var(--badge-success-bg)] hover:opacity-90 text-[var(--badge-success-text)] border border-[var(--badge-success-border)] text-xs rounded-lg font-semibold transition-opacity cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleReject(req.id)}
                                    className="px-2.5 py-1 bg-[var(--badge-danger-bg)] hover:opacity-90 text-[var(--badge-danger-text)] text-xs rounded-lg font-semibold border border-[var(--badge-danger-border)] transition-opacity cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {(req.status === 'PENDING' || (isManagement && req.status === 'APPROVED')) && (
                                <button
                                  onClick={() => handleCancelLeave(req.id)}
                                  className="px-2.5 py-1 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs rounded-lg font-medium border border-[var(--border-default)] transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* SECTION D — EMPLOYEE LEAVE DETAILS (SIDE DRAWER) */}
        {selectedEmpDetail && (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-6 space-y-6 shadow-md h-fit sticky top-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-heading)]">{selectedEmpDetail.employee_name}</h3>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5 font-mono">{selectedEmpDetail.employee_code} • {selectedEmpDetail.department}</div>
              </div>
              <button
                onClick={() => setSelectedEmpDetail(null)}
                className="p-1 hover:bg-[var(--bg-surface-muted)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-[var(--border-default)]">
              <button
                onClick={() => setDrawerTab('BALANCE')}
                className={`pb-2.5 px-4 font-semibold text-xs border-b-2 transition-colors cursor-pointer ${
                  drawerTab === 'BALANCE'
                    ? 'border-[var(--primary)] text-[var(--primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Leave Balance
              </button>
              <button
                onClick={() => setDrawerTab('HISTORY')}
                className={`pb-2.5 px-4 font-semibold text-xs border-b-2 transition-colors cursor-pointer ${
                  drawerTab === 'HISTORY'
                    ? 'border-[var(--primary)] text-[var(--primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Leave History
              </button>
            </div>

            {drawerTab === 'BALANCE' ? (
              <div className="space-y-4">
                {/* Individual Balance Cards */}
                <div className="p-4 bg-[var(--bg-surface-muted)]/50 rounded-xl border border-[var(--border-default)] space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[var(--text-heading)] text-sm">Casual Leave (CL)</span>
                    <span className="text-xs font-bold text-[var(--primary)]">{selectedEmpDetail.casual_leave.available} Remaining</span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] flex justify-between">
                    <span>Total: {selectedEmpDetail.casual_leave.quota}</span>
                    <span>Used: {selectedEmpDetail.casual_leave.used}</span>
                    <span>Pending: {selectedEmpDetail.casual_leave.pending}</span>
                  </div>
                  <div className="w-full bg-[var(--bg-surface-muted)] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[var(--primary)] h-1.5 rounded-full" style={{ width: `${Math.min(100, (selectedEmpDetail.casual_leave.used / (selectedEmpDetail.casual_leave.quota || 1)) * 100)}%` }} />
                  </div>
                </div>

                <div className="p-4 bg-[var(--bg-surface-muted)]/50 rounded-xl border border-[var(--border-default)] space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[var(--text-heading)] text-sm">Privilege Leave (EL/PL)</span>
                    <span className="text-xs font-bold text-[var(--secondary)]">{selectedEmpDetail.privilege_leave.available} Remaining</span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] flex justify-between">
                    <span>Total: {selectedEmpDetail.privilege_leave.quota}</span>
                    <span>Used: {selectedEmpDetail.privilege_leave.used}</span>
                    <span>Pending: {selectedEmpDetail.privilege_leave.pending}</span>
                  </div>
                  <div className="w-full bg-[var(--bg-surface-muted)] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[var(--secondary)] h-1.5 rounded-full" style={{ width: `${Math.min(100, (selectedEmpDetail.privilege_leave.used / (selectedEmpDetail.privilege_leave.quota || 1)) * 100)}%` }} />
                  </div>
                </div>

                <div className="p-4 bg-[var(--bg-surface-muted)]/50 rounded-xl border border-[var(--border-default)] space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[var(--text-heading)] text-sm">Sick Leave (SL)</span>
                    <span className="text-xs font-bold text-[var(--badge-warning-text)]">{selectedEmpDetail.sick_leave.available} Remaining</span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] flex justify-between">
                    <span>Total: {selectedEmpDetail.sick_leave.quota}</span>
                    <span>Used: {selectedEmpDetail.sick_leave.used}</span>
                    <span>Pending: {selectedEmpDetail.sick_leave.pending}</span>
                  </div>
                  <div className="w-full bg-[var(--bg-surface-muted)] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[var(--badge-warning-text)] h-1.5 rounded-full" style={{ width: `${Math.min(100, (selectedEmpDetail.sick_leave.used / (selectedEmpDetail.sick_leave.quota || 1)) * 100)}%` }} />
                  </div>
                </div>

                {/* Monthly Usage Box */}
                <div className="p-3.5 bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-[var(--primary)]">Casual Leave Monthly Usage</div>
                  <div className="text-[var(--text-heading)] font-semibold">
                    {selectedEmpDetail.monthly_cl_used} / 2 used — {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                </div>

                {/* Policy Information Box */}
                <div className="p-4 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-default)] text-xs space-y-2 text-[var(--text-secondary)]">
                  <div className="font-bold text-[var(--text-heading)] flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-[var(--primary)]" /> Casual Leave Policy
                  </div>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Maximum 2 CL days can be consumed per calendar month.</li>
                    <li>Maximum 2 consecutive CL days per request.</li>
                    <li>A CL request of 3+ consecutive days is allocated entirely to Privilege Leave.</li>
                    <li>If requested CL exceeds remaining monthly quota, the entire request converts to Privilege Leave.</li>
                    <li>A request is never split between CL and Privilege Leave.</li>
                  </ul>
                </div>
              </div>
            ) : (
              /* HISTORY TAB */
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {leaveRequests.filter(r => r.employee_id === selectedEmpDetail.employee_id).length === 0 ? (
                  <div className="text-center py-6 text-xs text-[var(--text-muted)]">No leave history found for this employee.</div>
                ) : (
                  leaveRequests.filter(r => r.employee_id === selectedEmpDetail.employee_id).map(r => (
                    <div key={r.id} className="p-3 bg-[var(--bg-surface-muted)]/50 rounded-xl border border-[var(--border-default)] text-xs space-y-1.5">
                      <div className="flex justify-between font-semibold text-[var(--text-heading)]">
                        <span>{r.requested_leave_type_name || r.leave_type_name} ({r.total_days} days)</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'APPROVED' ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)]' :
                          r.status === 'PENDING' ? 'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)]' :
                          'bg-[var(--badge-danger-bg)] text-[var(--badge-danger-text)]'
                        }`}>
                          {r.status}
                        </span>
                      </div>
                      <div className="text-[var(--text-secondary)]">
                        Actual Allocation: <span className="text-[var(--text-heading)] font-semibold">{r.total_days} {r.actual_deduction_type || r.leave_type_name}</span>
                      </div>
                      {r.conversion_reason && (
                        <div className="text-[var(--badge-warning-text)] text-[11px]">Reason: {r.conversion_reason}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* APPLY LEAVE MODAL */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg-surface-elevated)] rounded-2xl border border-[var(--border-default)] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-[var(--text-heading)]">Apply for Leave</h3>

            {formError && (
              <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> <span className="font-semibold">{formError}</span>
              </div>
            )}

            <form onSubmit={handleApply} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Leave Type</label>
                <select
                  required
                  value={formData.leaveTypeId}
                  onChange={e => setFormData({ ...formData, leaveTypeId: e.target.value })}
                  className="w-full py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--input-text)] focus:outline-hidden focus:border-[var(--primary)] cursor-pointer"
                >
                  <option value="">Select leave type</option>
                  {leaveTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--input-text)] font-mono focus:outline-hidden focus:border-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--input-text)] font-mono focus:outline-hidden focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Total Days</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  required
                  value={formData.totalDays}
                  onChange={e => setFormData({ ...formData, totalDays: parseFloat(e.target.value) || 1 })}
                  className="w-full py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--input-text)] focus:outline-hidden focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Reason</label>
                <textarea
                  required
                  rows={3}
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Reason for leave request..."
                  className="w-full py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--input-text)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--primary)]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl transition-colors text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-bold rounded-xl transition-colors text-xs cursor-pointer shadow-xs"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIGURE POLICY MODAL */}
      {showPolicyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg-surface-elevated)] rounded-2xl border border-[var(--border-default)] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-[var(--text-heading)]">Configure Leave Policy Quotas</h3>
            <form onSubmit={handlePolicySave} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Casual Leave Annual Quota (CL)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={policyData.clQuota}
                  onChange={e => setPolicyData({ ...policyData, clQuota: parseFloat(e.target.value) || 0 })}
                  className="w-full py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--input-text)] focus:outline-hidden focus:border-[var(--primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Privilege Leave Annual Quota (EL/PL)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={policyData.elQuota}
                  onChange={e => setPolicyData({ ...policyData, elQuota: parseFloat(e.target.value) || 0 })}
                  className="w-full py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--input-text)] focus:outline-hidden focus:border-[var(--primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Sick Leave Annual Quota (SL)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={policyData.slQuota}
                  onChange={e => setPolicyData({ ...policyData, slQuota: parseFloat(e.target.value) || 0 })}
                  className="w-full py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--input-text)] focus:outline-hidden focus:border-[var(--primary)]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPolicyModal(false)}
                  className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl transition-colors text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-bold rounded-xl transition-colors text-xs cursor-pointer shadow-xs"
                >
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST EMPLOYEE LEAVE MODAL */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg-surface-elevated)] rounded-2xl border border-[var(--border-default)] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-[var(--text-heading)]">Adjust Employee Leave Entitlement</h3>
            <form onSubmit={handleAdjustmentSave} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Employee</label>
                <select
                  required
                  value={adjustmentData.employeeId}
                  onChange={e => setAdjustmentData({ ...adjustmentData, employeeId: e.target.value })}
                  className="w-full py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--input-text)] focus:outline-hidden focus:border-[var(--primary)] cursor-pointer"
                >
                  <option value="">Select employee</option>
                  {allBalancesData.map(e => (
                    <option key={e.employee_id} value={e.employee_id}>{e.employee_name} ({e.employee_code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Leave Type</label>
                <select
                  required
                  value={adjustmentData.leaveTypeId}
                  onChange={e => setAdjustmentData({ ...adjustmentData, leaveTypeId: e.target.value })}
                  className="w-full py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--input-text)] focus:outline-hidden focus:border-[var(--primary)] cursor-pointer"
                >
                  <option value="">Select leave type</option>
                  {leaveTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Adjustment Type</label>
                  <select
                    value={adjustmentData.adjustmentType}
                    onChange={e => setAdjustmentData({ ...adjustmentData, adjustmentType: e.target.value as any })}
                    className="w-full py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--input-text)] focus:outline-hidden focus:border-[var(--primary)] cursor-pointer"
                  >
                    <option value="INCREMENT">Add (+)</option>
                    <option value="DECREMENT">Deduct (-)</option>
                    <option value="OVERRIDE">Override (=)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Value (Days)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={adjustmentData.adjustmentValue}
                    onChange={e => setAdjustmentData({ ...adjustmentData, adjustmentValue: parseFloat(e.target.value) || 0 })}
                    className="w-full py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--input-text)] focus:outline-hidden focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Reason</label>
                <textarea
                  required
                  rows={2}
                  value={adjustmentData.reason}
                  onChange={e => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                  placeholder="Reason for adjustment..."
                  className="w-full py-2 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--input-text)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--primary)]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl transition-colors text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-bold rounded-xl transition-colors text-xs cursor-pointer shadow-xs"
                >
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
