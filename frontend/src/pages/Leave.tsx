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

            // Auto-select first employee for drawer default if not set
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 text-slate-100 max-w-[1600px] mx-auto min-w-0 w-full overflow-x-hidden">
      {/* SECTION A — HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-4 sm:p-6 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CalendarDays className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-400 shrink-0" />
            <span>Leave Management & Policy</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage employee leave balances, entitlements, requests, and leave policies.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowApplyModal(true)}
            className="w-full sm:w-auto justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm transition shadow-lg shadow-indigo-600/20 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Apply Leave
          </button>

          {isManagement && (
            <>
              <button
                onClick={() => setShowAdjustmentModal(true)}
                className="w-full sm:w-auto justify-center px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium text-sm border border-slate-700 transition flex items-center gap-2"
              >
                <Sliders className="h-4 w-4 text-indigo-400" /> Adjust Employee Leave
              </button>

              <button
                onClick={() => setShowPolicyModal(true)}
                className="w-full sm:w-auto justify-center px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium text-sm border border-slate-700 transition flex items-center gap-2"
              >
                <Settings className="h-4 w-4 text-indigo-400" /> Configure Policy
              </button>
            </>
          )}
        </div>
      </div>

      {policySuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 flex-shrink-0" />
          {policySuccess}
        </div>
      )}

      {/* SECTION B — SUMMARY CARDS */}
      {isManagement && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{summaryData.totalEmployees}</div>
              <div className="text-xs text-slate-400">
                Total Employees <span className="text-indigo-400 font-medium">({summaryData.activeEmployees} Active)</span>
              </div>
            </div>
          </div>

          <div className="p-5 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{summaryData.pendingRequests}</div>
              <div className="text-xs text-slate-400">Pending Requests</div>
            </div>
          </div>

          <div className="p-5 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{summaryData.approvedThisYear}</div>
              <div className="text-xs text-slate-400">Approved This Year</div>
            </div>
          </div>

          <div className="p-5 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{summaryData.avgLeaveUsage}</div>
              <div className="text-xs text-slate-400">Avg. Leave Usage / Employee</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SECTION C — PRIMARY VIEW: EMPLOYEE LEAVE BALANCES */}
        <div className={`${selectedEmpDetail ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-6 transition-all duration-300`}>
          {isManagement ? (
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Employee Leave Balances</h2>
                  <p className="text-xs text-slate-400">View and track leave quota & remaining balances for all employees</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-3 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search employee..."
                      value={empSearch}
                      onChange={e => setEmpSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48 sm:w-64"
                    />
                  </div>

                  <select
                    value={empDeptFilter}
                    onChange={e => setEmpDeptFilter(e.target.value)}
                    className="py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All Departments</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>

                  <select
                    value={empStatusFilter}
                    onChange={e => setEmpStatusFilter(e.target.value)}
                    className="py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              {/* EMPLOYEE LEAVE BALANCES TABLE */}
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 font-semibold border-b border-slate-800">
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
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {paginatedEmpBalances.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500">
                          No employee balances match your search/filter criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedEmpBalances.map(emp => (
                        <tr
                          key={emp.employee_id}
                          className={`hover:bg-slate-800/40 transition cursor-pointer ${
                            selectedEmpDetail?.employee_id === emp.employee_id ? 'bg-indigo-500/10' : ''
                          }`}
                          onClick={() => { setSelectedEmpDetail(emp); setDrawerTab('BALANCE'); }}
                        >
                          <td className="py-3 px-4 font-medium text-white">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold">
                                {emp.employee_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                              </div>
                              <div>{emp.employee_name}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-400 font-mono">{emp.employee_code}</td>
                          <td className="py-3 px-4 text-slate-400">{emp.department}</td>
                          
                          {/* CL Progress */}
                          <td className="py-3 px-4">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-300 font-bold">{emp.casual_leave.used} / {emp.casual_leave.quota} used</span>
                              <span className="text-cyan-400 font-medium">{emp.casual_leave.available} remaining</span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-cyan-500 h-1.5 rounded-full" 
                                style={{ width: `${Math.min(100, (emp.casual_leave.used / (emp.casual_leave.quota || 1)) * 100)}%` }} 
                              />
                            </div>
                          </td>

                          {/* PL Progress */}
                          <td className="py-3 px-4">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-300 font-bold">{emp.privilege_leave.used} / {emp.privilege_leave.quota} used</span>
                              <span className="text-emerald-400 font-medium">{emp.privilege_leave.available} remaining</span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-1.5 rounded-full" 
                                style={{ width: `${Math.min(100, (emp.privilege_leave.used / (emp.privilege_leave.quota || 1)) * 100)}%` }} 
                              />
                            </div>
                          </td>

                          {/* SL Progress */}
                          <td className="py-3 px-4">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-300 font-bold">{emp.sick_leave.used} / {emp.sick_leave.quota} used</span>
                              <span className="text-amber-400 font-medium">{emp.sick_leave.available} remaining</span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-amber-500 h-1.5 rounded-full" 
                                style={{ width: `${Math.min(100, (emp.sick_leave.used / (emp.sick_leave.quota || 1)) * 100)}%` }} 
                              />
                            </div>
                          </td>

                          <td className="py-3 px-4 font-bold text-indigo-400">{emp.total_available}</td>

                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${
                              emp.status.toUpperCase() === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {emp.status}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedEmpDetail(emp); setDrawerTab('BALANCE'); }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 rounded-lg text-xs font-medium border border-slate-700 transition inline-flex items-center gap-1.5"
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 pt-2">
                <div>
                  Showing {filteredEmpBalances.length === 0 ? 0 : (empPage - 1) * empLimit + 1} to {Math.min(empPage * empLimit, filteredEmpBalances.length)} of {filteredEmpBalances.length} employees
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={empPage <= 1}
                    onClick={() => setEmpPage(p => Math.max(1, p - 1))}
                    className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-800 disabled:opacity-40"
                  >
                    &lt;
                  </button>
                  {Array.from({ length: Math.ceil(filteredEmpBalances.length / empLimit) || 1 }, (_, i) => i + 1).slice(0, 5).map(p => (
                    <button
                      key={p}
                      onClick={() => setEmpPage(p)}
                      className={`px-3 py-1 rounded-lg border font-medium ${
                        empPage === p
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    disabled={empPage >= Math.ceil(filteredEmpBalances.length / empLimit)}
                    onClick={() => setEmpPage(p => Math.min(Math.ceil(filteredEmpBalances.length / empLimit), p + 1))}
                    className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-800 disabled:opacity-40"
                  >
                    &gt;
                  </button>

                  <select
                    value={empLimit}
                    onChange={e => { setEmpLimit(Number(e.target.value)); setEmpPage(1); }}
                    className="ml-2 py-1 px-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none"
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
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-sm">
              <h2 className="text-lg font-semibold text-white">My Leave Entitlements & Balances</h2>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold">Casual Leave Monthly Quota</div>
                  <div className="text-sm font-medium text-white mt-1">
                    {monthlyUsage.clUsedThisMonth} / {monthlyUsage.clMonthlyLimit} CL used this calendar month
                  </div>
                </div>
                <div className="text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                  Resets monthly
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {myBalances.map((b: any) => (
                  <div key={b.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-white">{b.leave_type_name}</span>
                      <span className="text-xs font-mono text-slate-400">Code: {b.leave_type_code}</span>
                    </div>
                    <div className="text-2xl font-bold text-indigo-400">{b.available} <span className="text-xs font-normal text-slate-400">days available</span></div>
                    <div className="text-xs text-slate-400 flex justify-between border-t border-slate-800 pt-2">
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
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Leave Requests</h2>
                <p className="text-xs text-slate-400">Manage and review employee leave requests & deduction allocations</p>
              </div>

              {/* Status Tabs Container */}
              <div className="w-full md:w-auto overflow-x-auto no-scrollbar py-0.5">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs min-w-max">
                  {(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setReqTab(tab)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                        reqTab === tab
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab === 'PENDING' ? `Pending (${leaveRequests.filter(r => r.status === 'PENDING').length})` : tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 border-t border-slate-800/80 pt-4">
              <div className="relative w-full sm:w-auto">
                <Search className="h-4 w-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={reqSearch}
                  onChange={e => setReqSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-full sm:w-48"
                />
              </div>

              {isManagement && (
                <select
                  value={reqDeptFilter}
                  onChange={e => setReqDeptFilter(e.target.value)}
                  className="w-full sm:w-auto py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
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
                className="w-full sm:w-auto py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Leave Types</option>
                <option value="CL">Casual Leave (CL)</option>
                <option value="PL">Privilege Leave (PL/EL)</option>
                <option value="SL">Sick Leave (SL)</option>
              </select>

              {(reqSearch || reqDeptFilter !== 'ALL' || reqTypeFilter !== 'ALL') && (
                <button
                  onClick={() => { setReqSearch(''); setReqDeptFilter('ALL'); setReqTypeFilter('ALL'); }}
                  className="text-xs text-indigo-400 hover:underline self-start sm:self-center"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* REQUESTS TABLE */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 font-semibold border-b border-slate-800">
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
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No leave requests found.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map(req => {
                      const isConverted = req.conversion_reason || (req.requested_leave_type_name && req.actual_deduction_type && req.requested_leave_type_name !== req.actual_deduction_type);

                      return (
                        <tr key={req.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 font-medium text-white">
                            <div>{req.first_name} {req.last_name}</div>
                            <div className="text-xs text-slate-500 font-mono">{req.employee_code}</div>
                          </td>

                          <td className="py-3 px-4 text-slate-300">
                            {req.requested_leave_type_name || req.leave_type_name}
                          </td>

                          <td className="py-3 px-4 text-xs font-mono text-slate-400">
                            {req.start_date ? new Date(req.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''} – {req.end_date ? new Date(req.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                          </td>

                          <td className="py-3 px-4 text-center font-bold text-white">{req.total_days}</td>

                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 ${
                              isConverted
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-800 text-slate-200 border border-slate-700'
                            }`}>
                              {req.total_days} {req.actual_deduction_type || req.leave_type_name}
                            </span>
                            {isConverted && (
                              <div className="text-[10px] text-amber-400/80 mt-1 max-w-[180px]">
                                {req.conversion_reason}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-xs text-slate-400 max-w-[160px] truncate" title={req.reason}>
                            {req.reason}
                          </td>

                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${
                              req.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              req.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              req.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                              'bg-slate-800 text-slate-400 border border-slate-700'
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
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg font-medium transition"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleReject(req.id)}
                                    className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 text-xs rounded-lg font-medium border border-rose-500/30 transition"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {(req.status === 'PENDING' || (isManagement && req.status === 'APPROVED')) && (
                                <button
                                  onClick={() => handleCancelLeave(req.id)}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs rounded-lg font-medium transition"
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
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-xl h-fit sticky top-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedEmpDetail.employee_name}</h3>
                <div className="text-xs text-slate-400 mt-0.5 font-mono">{selectedEmpDetail.employee_code} • {selectedEmpDetail.department}</div>
              </div>
              <button
                onClick={() => setSelectedEmpDetail(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-slate-800">
              <button
                onClick={() => setDrawerTab('BALANCE')}
                className={`pb-2.5 px-4 font-medium text-xs border-b-2 transition ${
                  drawerTab === 'BALANCE'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Leave Balance
              </button>
              <button
                onClick={() => setDrawerTab('HISTORY')}
                className={`pb-2.5 px-4 font-medium text-xs border-b-2 transition ${
                  drawerTab === 'HISTORY'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Leave History
              </button>
            </div>

            {drawerTab === 'BALANCE' ? (
              <div className="space-y-4">
                {/* Individual Balance Cards */}
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white text-sm">Casual Leave (CL)</span>
                    <span className="text-xs font-bold text-cyan-400">{selectedEmpDetail.casual_leave.available} Remaining</span>
                  </div>
                  <div className="text-xs text-slate-400 flex justify-between">
                    <span>Total: {selectedEmpDetail.casual_leave.quota}</span>
                    <span>Used: {selectedEmpDetail.casual_leave.used}</span>
                    <span>Pending: {selectedEmpDetail.casual_leave.pending}</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (selectedEmpDetail.casual_leave.used / (selectedEmpDetail.casual_leave.quota || 1)) * 100)}%` }} />
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white text-sm">Privilege Leave (EL/PL)</span>
                    <span className="text-xs font-bold text-emerald-400">{selectedEmpDetail.privilege_leave.available} Remaining</span>
                  </div>
                  <div className="text-xs text-slate-400 flex justify-between">
                    <span>Total: {selectedEmpDetail.privilege_leave.quota}</span>
                    <span>Used: {selectedEmpDetail.privilege_leave.used}</span>
                    <span>Pending: {selectedEmpDetail.privilege_leave.pending}</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (selectedEmpDetail.privilege_leave.used / (selectedEmpDetail.privilege_leave.quota || 1)) * 100)}%` }} />
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white text-sm">Sick Leave (SL)</span>
                    <span className="text-xs font-bold text-amber-400">{selectedEmpDetail.sick_leave.available} Remaining</span>
                  </div>
                  <div className="text-xs text-slate-400 flex justify-between">
                    <span>Total: {selectedEmpDetail.sick_leave.quota}</span>
                    <span>Used: {selectedEmpDetail.sick_leave.used}</span>
                    <span>Pending: {selectedEmpDetail.sick_leave.pending}</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (selectedEmpDetail.sick_leave.used / (selectedEmpDetail.sick_leave.quota || 1)) * 100)}%` }} />
                  </div>
                </div>

                {/* Monthly Usage Box */}
                <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs space-y-1">
                  <div className="font-semibold text-indigo-300">Casual Leave Monthly Usage</div>
                  <div className="text-slate-300 font-bold">
                    {selectedEmpDetail.monthly_cl_used} / 2 used — {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                </div>

                {/* Policy Information Box */}
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2 text-slate-400">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-indigo-400" /> Casual Leave Policy
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
                  <div className="text-center py-6 text-xs text-slate-500">No leave history found for this employee.</div>
                ) : (
                  leaveRequests.filter(r => r.employee_id === selectedEmpDetail.employee_id).map(r => (
                    <div key={r.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1.5">
                      <div className="flex justify-between font-semibold text-slate-200">
                        <span>{r.requested_leave_type_name || r.leave_type_name} ({r.total_days} days)</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                          r.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                          r.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-rose-500/10 text-rose-400'
                        }`}>
                          {r.status}
                        </span>
                      </div>
                      <div className="text-slate-400">
                        Actual Allocation: <span className="text-white font-medium">{r.total_days} {r.actual_deduction_type || r.leave_type_name}</span>
                      </div>
                      {r.conversion_reason && (
                        <div className="text-amber-400 text-[11px]">Reason: {r.conversion_reason}</div>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Apply for Leave</h3>

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {formError}
              </div>
            )}

            <form onSubmit={handleApply} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Leave Type</label>
                <select
                  required
                  value={formData.leaveTypeId}
                  onChange={e => setFormData({ ...formData, leaveTypeId: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select leave type</option>
                  {leaveTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Total Days</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  required
                  value={formData.totalDays}
                  onChange={e => setFormData({ ...formData, totalDays: parseFloat(e.target.value) || 1 })}
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Reason</label>
                <textarea
                  required
                  rows={3}
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Reason for leave request..."
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition text-xs font-medium"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Configure Leave Policy Quotas</h3>
            <form onSubmit={handlePolicySave} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Casual Leave Annual Quota (CL)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={policyData.clQuota}
                  onChange={e => setPolicyData({ ...policyData, clQuota: parseFloat(e.target.value) || 0 })}
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Privilege Leave Annual Quota (EL/PL)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={policyData.elQuota}
                  onChange={e => setPolicyData({ ...policyData, elQuota: parseFloat(e.target.value) || 0 })}
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Sick Leave Annual Quota (SL)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={policyData.slQuota}
                  onChange={e => setPolicyData({ ...policyData, slQuota: parseFloat(e.target.value) || 0 })}
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPolicyModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition text-xs font-medium"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Adjust Employee Leave Entitlement</h3>
            <form onSubmit={handleAdjustmentSave} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Employee</label>
                <select
                  required
                  value={adjustmentData.employeeId}
                  onChange={e => setAdjustmentData({ ...adjustmentData, employeeId: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select employee</option>
                  {allBalancesData.map(e => (
                    <option key={e.employee_id} value={e.employee_id}>{e.employee_name} ({e.employee_code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Leave Type</label>
                <select
                  required
                  value={adjustmentData.leaveTypeId}
                  onChange={e => setAdjustmentData({ ...adjustmentData, leaveTypeId: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select leave type</option>
                  {leaveTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Adjustment Type</label>
                  <select
                    value={adjustmentData.adjustmentType}
                    onChange={e => setAdjustmentData({ ...adjustmentData, adjustmentType: e.target.value as any })}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="INCREMENT">Add (+)</option>
                    <option value="DECREMENT">Deduct (-)</option>
                    <option value="OVERRIDE">Override (=)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Value (Days)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={adjustmentData.adjustmentValue}
                    onChange={e => setAdjustmentData({ ...adjustmentData, adjustmentValue: parseFloat(e.target.value) || 0 })}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Reason</label>
                <textarea
                  required
                  rows={2}
                  value={adjustmentData.reason}
                  onChange={e => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                  placeholder="Reason for adjustment..."
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition text-xs font-medium"
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
