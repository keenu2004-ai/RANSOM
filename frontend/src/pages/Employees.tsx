import React, { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { hasPermission, getAllowedAssignableRoles } from '../utils/permissions';
import { SmartDeleteConfirmationModal } from '../components/SmartDeleteConfirmationModal';
import {
  Users, Plus, Search, Filter, RefreshCw, UserCheck, UserX, Network,
  ChevronLeft, ChevronRight, CheckCircle2, Edit3, X, Building2, Briefcase, Trash2, AlertTriangle
} from 'lucide-react';

export const Employees: React.FC = () => {
  const { user } = useAuth();
  const allowedRolesForActor = getAllowedAssignableRoles(user?.role);
  const [activeTab, setActiveTab] = useState<'list' | 'orgChart'>('list');
  const [employees, setEmployees] = useState<any[]>([]);
  const [orgChart, setOrgChart] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Master Settings Data (Departments & Designations)
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [filterDepartmentId, setFilterDepartmentId] = useState('');
  const [page, setPage] = useState(1);

  // Success Alert Toast
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add Employee Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
    phone: '',
    employment_type: 'FULL_TIME',
    department_id: '',
    designation_id: '',
    system_role: 'EMPLOYEE',
    region: ''
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Employee Modal
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    employment_type: 'FULL_TIME',
    department_id: '',
    designation_id: '',
    region: ''
  });
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Permanent Delete Modal State
  const [deleteConfirmEmp, setDeleteConfirmEmp] = useState<any | null>(null);
  const [deleteConfirmCodeInput, setDeleteConfirmCodeInput] = useState<string>('');
  const [deletingEmp, setDeletingEmp] = useState<boolean>(false);

  // Fetch Master Settings (Departments & Designations)
  const fetchMasterSettings = async () => {
    try {
      const [deptRes, desigRes] = await Promise.all([
        apiFetch('/settings/departments').catch(() => ({ departments: [] })),
        apiFetch('/settings/designations').catch(() => ({ designations: [] }))
      ]);
      setDepartments(deptRes.departments || []);
      setDesignations(desigRes.designations || []);
    } catch (err) {
      console.error('Error fetching master settings:', err);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      if (activeTab === 'list') {
        const res = await apiFetch('/employees', {
          params: { search, status, departmentId: filterDepartmentId, page, limit: 10 }
        });
        setEmployees(res.employees || []);
        setPagination(res.pagination || {});
      } else {
        const res = await apiFetch('/employees/org-chart');
        setOrgChart(res.orgChart || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterSettings();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [activeTab, page, status, filterDepartmentId]);

  // Filtered Designations for Create Modal based on selected department_id
  const createAvailableDesignations = useMemo(() => {
    if (!formData.department_id) return designations;
    return designations.filter(d => !d.department_id || d.department_id === formData.department_id);
  }, [designations, formData.department_id]);

  // Filtered Designations for Edit Modal based on selected department_id
  const editAvailableDesignations = useMemo(() => {
    if (!editFormData.department_id) return designations;
    return designations.filter(d => !d.department_id || d.department_id === editFormData.department_id);
  }, [designations, editFormData.department_id]);

  // When Create Department changes, reset designation if incompatible
  const handleCreateDeptChange = (deptId: string) => {
    let newDesig = formData.designation_id;
    if (deptId && newDesig) {
      const valid = designations.some(d => d.id === newDesig && (!d.department_id || d.department_id === deptId));
      if (!valid) newDesig = '';
    }
    setFormData({ ...formData, department_id: deptId, designation_id: newDesig });
  };

  // When Edit Department changes, reset designation if incompatible
  const handleEditDeptChange = (deptId: string) => {
    let newDesig = editFormData.designation_id;
    if (deptId && newDesig) {
      const valid = designations.some(d => d.id === newDesig && (!d.department_id || d.department_id === deptId));
      if (!valid) newDesig = '';
    }
    setEditFormData({ ...editFormData, department_id: deptId, designation_id: newDesig });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEmployees();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formData.password && formData.password !== formData.confirm_password) {
      setFormError('Initial password and confirmation do not match.');
      return;
    }

    if (formData.password && formData.password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    try {
      const payload: any = { ...formData };
      delete payload.confirm_password;
      if (!payload.password) delete payload.password;
      if (!payload.department_id) delete payload.department_id;
      if (!payload.designation_id) delete payload.designation_id;

      await apiFetch('/employees', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setShowAddModal(false);
      setFormData({
        first_name: '', last_name: '', email: '', password: '', confirm_password: '', phone: '',
        employment_type: 'FULL_TIME', department_id: '', designation_id: '', system_role: 'EMPLOYEE', region: ''
      });
      setSuccessMsg('Employee profile & user credentials created successfully.');
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchEmployees();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create employee.');
    }
  };

  const [empAssets, setEmpAssets] = useState<any[]>([]);

  const openEditModal = async (emp: any) => {
    setEditingEmployee(emp);
    setEditFormData({
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      employment_type: emp.employment_type || 'FULL_TIME',
      department_id: emp.department_id || '',
      designation_id: emp.designation_id || '',
      region: emp.region || ''
    });
    setEditFormError(null);
    try {
      const res = await apiFetch(`/assets?assignedEmployeeId=${emp.id}`);
      setEmpAssets(res.data?.assets || []);
    } catch (err) {
      setEmpAssets([]);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setEditFormError(null);
    setEditLoading(true);
    try {
      const payload: any = { ...editFormData };
      if (!payload.department_id) payload.department_id = null;
      if (!payload.designation_id) payload.designation_id = null;

      await apiFetch(`/employees/${editingEmployee.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      setEditingEmployee(null);
      setSuccessMsg(`Employee ${editFormData.first_name} ${editFormData.last_name} updated successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchEmployees();
    } catch (err: any) {
      setEditFormError(err.message || 'Failed to update employee profile.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeactivate = async (emp: any) => {
    const confirmMessage = `Deactivate / Delete Employee?\n\nEmployee: ${emp.first_name} ${emp.last_name} (${emp.employee_code || 'EMP'})\n\nThis will deactivate the employee account and remove the employee from active workforce lists. Historical attendance, leave, expense, asset, and task records will be preserved.\n\nProceed with deactivation?`;
    if (!confirm(confirmMessage)) return;
    try {
      await apiFetch(`/employees/${emp.id}/deactivate`, { method: 'POST' });
      setSuccessMsg(`Employee ${emp.first_name} ${emp.last_name} deactivated successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate employee.');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await apiFetch(`/employees/${id}/restore`, { method: 'POST' });
      setSuccessMsg(`Employee profile restored successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed to restore employee.');
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteConfirmEmp || deleteConfirmCodeInput.trim().toUpperCase() !== (deleteConfirmEmp.employee_code || '').toUpperCase()) return;
    setDeletingEmp(true);
    try {
      await apiFetch(`/employees/${deleteConfirmEmp.id}`, { method: 'DELETE' });
      setSuccessMsg(`Employee ${deleteConfirmEmp.first_name} ${deleteConfirmEmp.last_name} (${deleteConfirmEmp.employee_code}) permanently deleted.`);
      setDeleteConfirmEmp(null);
      setDeleteConfirmCodeInput('');
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed to permanently delete employee.');
    } finally {
      setDeletingEmp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Notification Alert */}
      {successMsg && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-2xl flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="p-1 hover:bg-emerald-900 rounded"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-cyan-400 shrink-0" />
            <span>Employee Directory</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Manage organizational personnel, department assignments, and designations</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs font-semibold justify-center">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-lg transition-all ${activeTab === 'list' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Employee List
            </button>
            <button
              onClick={() => setActiveTab('orgChart')}
              className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-lg transition-all ${activeTab === 'orgChart' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Org Chart
            </button>
          </div>

          {hasPermission(user?.role, 'EMPLOYEE_CREATE') && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'list' && (
        <>
          {/* Filters Bar */}
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="relative flex-1 w-full min-w-0">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search name, code, email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <select
              value={filterDepartmentId}
              onChange={e => { setFilterDepartmentId(e.target.value); setPage(1); }}
              className="w-full sm:w-auto px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <select
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="w-full sm:w-auto px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>

            <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl transition-all">
              Filter
            </button>
          </form>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Code</th>
                    <th className="px-6 py-3.5">Employee</th>
                    <th className="px-6 py-3.5">Department</th>
                    <th className="px-6 py-3.5">Designation</th>
                    <th className="px-6 py-3.5">Region</th>
                    <th className="px-6 py-3.5">Employment</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-500">Fetching employee records...</td>
                    </tr>
                  ) : employees.length > 0 ? (
                    employees.map(emp => (
                      <tr key={emp.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-mono font-semibold text-cyan-400">{emp.employee_code}</td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-100">{emp.first_name} {emp.last_name}</div>
                          <div className="text-[11px] text-slate-500">{emp.email}</div>
                          {emp.phone && <div className="text-[10px] text-slate-500 font-mono">{emp.phone}</div>}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-200">
                            <Building2 className="w-3.5 h-3.5 text-cyan-500" />
                            {emp.department_name || 'Unassigned'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-300">
                            <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                            {emp.designation_name || 'Unassigned'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {emp.region === 'NORTH' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">NORTH</span>
                          ) : emp.region === 'SOUTH' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">SOUTH</span>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                            {emp.employment_type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {emp.status === 'ACTIVE' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">ACTIVE</span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">INACTIVE</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => openEditModal(emp)}
                            className="px-2.5 py-1 text-[11px] font-medium bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/50 rounded-lg transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          {emp.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleDeactivate(emp)}
                              className="px-2.5 py-1 text-[11px] font-medium bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded-lg transition-all cursor-pointer"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestore(emp.id)}
                              className="px-2.5 py-1 text-[11px] font-medium bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 rounded-lg transition-all cursor-pointer"
                            >
                              Restore
                            </button>
                          )}
                          {user?.role === 'SUPER_ADMIN' && (
                            <button
                              onClick={() => { setDeleteConfirmEmp(emp); setDeleteConfirmCodeInput(''); }}
                              className="px-2.5 py-1 text-[11px] font-medium bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700/60 rounded-lg transition-all inline-flex items-center gap-1 cursor-pointer"
                              title="Permanently Delete Employee Profile & Login Account"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete Permanently</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-500">No employee records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 bg-slate-950/60 border-t border-slate-800 text-xs">
                <span className="text-slate-400">Page {pagination.page} of {pagination.totalPages} ({pagination.total} Total Employees)</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-300 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-300 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'orgChart' && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
            <Network className="w-4 h-4 text-cyan-400" />
            <span>Company Reporting Hierarchy</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
            {orgChart.map(emp => (
              <div key={emp.id} className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                <div className="font-mono text-[10px] text-cyan-400 font-bold">{emp.employee_code}</div>
                <div className="font-bold text-slate-100 text-sm">{emp.first_name} {emp.last_name}</div>
                <div className="text-xs text-slate-400">{emp.designation_name || 'Staff'}</div>
                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">{emp.department_name || 'General'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">Create New Employee</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {formError && <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl">{formError}</div>}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">Personal Information</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Work Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="employee@theiakshi.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Initial Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                    placeholder="Leave blank for default"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Confirm Password</label>
                  <input
                    type="password"
                    value={formData.confirm_password}
                    onChange={e => setFormData({ ...formData, confirm_password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                    placeholder="Confirm initial password"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] pt-2 border-t border-slate-800">Organization & Role</div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Department</label>
                  <select
                    value={formData.department_id}
                    onChange={e => handleCreateDeptChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    <option value="">Select Department...</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Designation</label>
                  <select
                    value={formData.designation_id}
                    onChange={e => setFormData({ ...formData, designation_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    <option value="">Select Designation...</option>
                    {createAvailableDesignations.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Region / Location</label>
                <select
                  value={formData.region}
                  onChange={e => setFormData({ ...formData, region: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  <option value="">Unassigned (No Region)</option>
                  <option value="NORTH">North Region</option>
                  <option value="SOUTH">South Region</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Employment Type</label>
                <select
                  value={formData.employment_type}
                  onChange={e => setFormData({ ...formData, employment_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  <option value="FULL_TIME">Full-Time</option>
                  <option value="PART_TIME">Part-Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERN">Internship</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">System Permission Role</label>
                <select
                  value={formData.system_role}
                  onChange={e => setFormData({ ...formData, system_role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  {allowedRolesForActor.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-0.5">Determines application access permissions (independent of designation)</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-semibold shadow"
                >
                  Create Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-lg text-white">Edit Employee Profile</h3>
                <p className="text-xs text-cyan-400 font-mono">Code: {editingEmployee.employee_code}</p>
              </div>
              <button type="button" onClick={() => setEditingEmployee(null)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {editFormError && <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl">{editFormError}</div>}

            <form onSubmit={handleEditSave} className="space-y-4 text-xs">
              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">Personal Information</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">First Name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.first_name}
                    onChange={e => setEditFormData({ ...editFormData, first_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.last_name}
                    onChange={e => setEditFormData({ ...editFormData, last_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Work Email *</label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Phone Number</label>
                <input
                  type="text"
                  value={editFormData.phone}
                  onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] pt-2 border-t border-slate-800">Organization & Role</div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Department</label>
                  <select
                    value={editFormData.department_id}
                    onChange={e => handleEditDeptChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    <option value="">Select Department...</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Designation</label>
                  <select
                    value={editFormData.designation_id}
                    onChange={e => setEditFormData({ ...editFormData, designation_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    <option value="">Select Designation...</option>
                    {editAvailableDesignations.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Region / Location</label>
                <select
                  value={editFormData.region}
                  onChange={e => setEditFormData({ ...editFormData, region: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  <option value="">Unassigned (No Region)</option>
                  <option value="NORTH">North Region</option>
                  <option value="SOUTH">South Region</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Employment Type</label>
                <select
                  value={editFormData.employment_type}
                  onChange={e => setEditFormData({ ...editFormData, employment_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  <option value="FULL_TIME">Full-Time</option>
                  <option value="PART_TIME">Part-Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERN">Internship</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Assigned Company Assets</span>
                  <span className="text-[10px] text-cyan-400 font-mono">Total: {empAssets.length}</span>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-xl max-h-36 overflow-y-auto">
                  <table className="w-full text-left text-[11px] text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[9px] sticky top-0">
                      <tr>
                        <th className="p-2">Code & Name</th>
                        <th className="p-2">Category</th>
                        <th className="p-2">Serial</th>
                        <th className="p-2">Condition</th>
                        <th className="p-2">Assigned Date</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {empAssets.map(ast => (
                        <tr key={ast.id} className="hover:bg-slate-800/30">
                          <td className="p-2 font-bold text-white">
                            <div>{ast.asset_code}</div>
                            <span className="text-[10px] text-slate-400 font-normal">{ast.asset_name}</span>
                          </td>
                          <td className="p-2 text-slate-300">{ast.category_name}</td>
                          <td className="p-2 font-mono text-slate-400">{ast.serial_number || '-'}</td>
                          <td className="p-2"><span className="px-1.5 py-0.5 bg-slate-950 rounded text-[9px] font-mono">{ast.condition}</span></td>
                          <td className="p-2 font-mono text-slate-400">{ast.assigned_date ? ast.assigned_date.split('T')[0] : '-'}</td>
                          <td className="p-2">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">
                              {ast.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {empAssets.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-500 italic">
                            No company assets currently assigned to this employee.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-semibold shadow disabled:opacity-50"
                >
                  {editLoading ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart Delete Confirmation Modal */}
      {deleteConfirmEmp && (
        <SmartDeleteConfirmationModal
          isOpen={!!deleteConfirmEmp}
          onClose={() => setDeleteConfirmEmp(null)}
          onConfirm={handlePermanentDelete}
          title="Delete Employee Permanently"
          entityName={`${deleteConfirmEmp.first_name} ${deleteConfirmEmp.last_name}`}
          entityId={deleteConfirmEmp.employee_code}
          expectedValue={deleteConfirmEmp.employee_code || 'DELETE'}
          actionLabel="Delete Employee"
          isLoading={deletingEmp}
        />
      )}
    </div>
  );
};
