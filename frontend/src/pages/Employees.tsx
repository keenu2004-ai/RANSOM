import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { 
  Users, Plus, Search, Filter, RefreshCw, UserCheck, UserX, Network, 
  ChevronLeft, ChevronRight, CheckCircle2
} from 'lucide-react';

export const Employees: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'list' | 'orgChart'>('list');
  const [employees, setEmployees] = useState<any[]>([]);
  const [orgChart, setOrgChart] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  // Add Employee Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    employment_type: 'FULL_TIME'
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      if (activeTab === 'list') {
        const res = await apiFetch('/employees', {
          params: { search, status, page, limit: 10 }
        });
        setEmployees(res.employees);
        setPagination(res.pagination);
      } else {
        const res = await apiFetch('/employees/org-chart');
        setOrgChart(res.orgChart);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [activeTab, page, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEmployees();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await apiFetch('/employees', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setShowAddModal(false);
      setFormData({ first_name: '', last_name: '', email: '', phone: '', employment_type: 'FULL_TIME' });
      fetchEmployees();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this employee profile?')) return;
    try {
      await apiFetch(`/employees/${id}/deactivate`, { method: 'POST' });
      fetchEmployees();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await apiFetch(`/employees/${id}/restore`, { method: 'POST' });
      fetchEmployees();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-cyan-400" />
            <span>Employee Directory</span>
          </h1>
          <p className="text-xs text-slate-400">Manage organizational personnel, employment statuses, and team hierarchies</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'list' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Employee List
            </button>
            <button
              onClick={() => setActiveTab('orgChart')}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'orgChart' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Org Chart
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {activeTab === 'list' && (
        <>
          {/* Filters Bar */}
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="relative flex-1 min-w-[200px]">
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
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>

            <button type="submit" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl transition-all">
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
                    <th className="px-6 py-3.5">Employment</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-500">Fetching employee records...</td>
                    </tr>
                  ) : employees.length > 0 ? (
                    employees.map(emp => (
                      <tr key={emp.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-mono font-semibold text-cyan-400">{emp.employee_code}</td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-100">{emp.first_name} {emp.last_name}</div>
                          <div className="text-[11px] text-slate-500">{emp.email}</div>
                        </td>
                        <td className="px-6 py-4">{emp.department_name || 'Unassigned'}</td>
                        <td className="px-6 py-4">{emp.designation_name || 'Unassigned'}</td>
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
                          {emp.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleDeactivate(emp.id)}
                              className="px-2.5 py-1 text-[11px] font-medium bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded-lg transition-all"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestore(emp.id)}
                              className="px-2.5 py-1 text-[11px] font-medium bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 rounded-lg transition-all"
                            >
                              Restore
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
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Create New Employee</h3>

            {formError && <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl">{formError}</div>}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Work Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
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
    </div>
  );
};
