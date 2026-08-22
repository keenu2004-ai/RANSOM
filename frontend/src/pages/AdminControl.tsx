import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { getAllowedAssignableRoles, hasPermission } from '../utils/permissions';
import { ShieldCheck, Users, KeyRound, Shield, Search, Edit3, X, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export const AdminControl: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'permissions'>('users');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit Role Modal
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('EMPLOYEE');
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const allowedRolesForCurrentActor = getAllowedAssignableRoles(currentUser?.role);
  const canAssignRoles = hasPermission(currentUser?.role, 'USER_ROLE_ASSIGN');

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, rRes, pRes] = await Promise.all([
        apiFetch('/users').catch(() => apiFetch('/admin/users').then(r => ({ data: { users: r.users || [] } }))),
        apiFetch('/admin/roles').catch(() => ({ data: { roles: [] } })),
        apiFetch('/admin/permissions').catch(() => ({ data: { permissions: [] } }))
      ]);

      const fetchedUsers = uRes.data?.users || uRes.users || [];
      setUsersList(fetchedUsers);
      setRoles(rRes.data?.roles || rRes.roles || []);
      setPermissions(pRes.data?.permissions || pRes.permissions || []);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const handleOpenEditModal = (targetUser: any) => {
    setEditingUser(targetUser);
    setSelectedRole(targetUser.role || targetUser.role_name || 'EMPLOYEE');
    setSelectedStatus(targetUser.status || 'ACTIVE');
    setEditError(null);
  };

  const handleSaveAccessChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (editingUser.id === currentUser?.userId) {
      setEditError('Self-role modification is strictly forbidden. You cannot alter your own system role.');
      return;
    }

    setSaving(true);
    setEditError(null);

    try {
      // 1. Role Change Endpoint
      if (selectedRole !== (editingUser.role || editingUser.role_name)) {
        await apiFetch(`/users/${editingUser.id}/role`, {
          method: 'PUT',
          body: JSON.stringify({ role: selectedRole })
        });
      }

      // 2. Status Change Endpoint
      if (selectedStatus !== editingUser.status) {
        await apiFetch(`/users/${editingUser.id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: selectedStatus })
        });
      }

      setEditingUser(null);
      setSuccessMsg(`System access for ${editingUser.email} updated to role '${selectedRole}'.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchAdminData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update user access role.');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = usersList.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q)) ||
      (u.employee_name && u.employee_name.toLowerCase().includes(q)) ||
      (u.employee_code && u.employee_code.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {successMsg && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs font-medium flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="p-1 hover:bg-emerald-900 rounded"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <span>User Role & Account Access Control</span>
          </h1>
          <p className="text-xs text-slate-400">Manage login user identities, assign system permissions, and configure RBAC roles</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'users' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            User Accounts ({usersList.length})
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'roles' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            System Roles
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'permissions' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Permission Matrix
          </button>
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search login email, employee name, code, role..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs pl-9 pr-4 py-2.5 rounded-xl focus:border-cyan-500 outline-none"
              />
            </div>
            <button
              onClick={fetchAdminData}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Users Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3">Login User Email</th>
                    <th className="px-6 py-3">Linked Employee Profile</th>
                    <th className="px-6 py-3">System Role</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">Loading user account directory...</td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">No user accounts found matching query.</td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => {
                      const userRole = u.role || u.role_name || 'EMPLOYEE';
                      const isSelf = u.id === currentUser?.userId;

                      return (
                        <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 font-semibold text-slate-200">
                            <div>{u.email}</div>
                            {isSelf && <span className="text-[10px] text-cyan-400 font-normal">(Current Logged-in Account)</span>}
                          </td>
                          <td className="px-6 py-4">
                            {u.employee_name ? (
                              <div>
                                <span className="font-medium text-slate-200">{u.employee_name}</span>
                                <span className="text-slate-400 text-[10px] block font-mono">{u.employee_code}</span>
                              </div>
                            ) : (
                              <span className="italic text-slate-500">Not linked (Management-only Account)</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              userRole === 'SUPER_ADMIN' ? 'bg-purple-500/20 text-purple-400 border border-purple-800/50' :
                              userRole === 'ADMIN' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-800/50' :
                              userRole === 'HR_MANAGER' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-800/50' :
                              userRole === 'OPERATIONAL_MANAGER' ? 'bg-amber-500/20 text-amber-400 border border-amber-800/50' :
                              'bg-slate-800 text-slate-300'
                            }`}>
                              {userRole}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              u.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}>
                              {u.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {canAssignRoles && (
                              <button
                                onClick={() => handleOpenEditModal(u)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-semibold transition-all"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>{isSelf ? 'View Access' : 'Assign Role'}</span>
                              </button>
                            )}
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
      )}

      {activeTab === 'roles' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-200">Defined System Roles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map(r => (
              <div key={r.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-400 text-sm">{r.name}</span>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">System Role</span>
                </div>
                <p className="text-xs text-slate-400">{r.description || `Role ${r.name} authority scope.`}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-200">Registered RBAC Permissions Catalog ({permissions.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {permissions.map(p => (
              <div key={p.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
                <div className="font-mono text-cyan-400 text-[11px] font-semibold">{p.key}</div>
                <div className="text-slate-300 font-medium">{p.module} • {p.action}</div>
                <div className="text-slate-500 text-[10px]">{p.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Role & Access Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  <span>Assign System Role & Access</span>
                </h3>
                <p className="text-xs text-slate-400">{editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAccessChange} className="space-y-4">
              {/* Linked Employee Info */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
                <div className="text-slate-400 font-semibold">Linked Employee Profile:</div>
                {editingUser.employee_name ? (
                  <div className="text-slate-200 font-medium">{editingUser.employee_name} ({editingUser.employee_code})</div>
                ) : (
                  <div className="italic text-slate-500">Not linked (Management-only user account)</div>
                )}
              </div>

              {/* Self Escalation Warning */}
              {editingUser.id === currentUser?.userId && (
                <div className="p-3 bg-amber-950/60 border border-amber-800 rounded-xl text-amber-300 text-xs">
                  ⚠️ Note: You are viewing your own user account. Self-role modification is strictly forbidden by policy.
                </div>
              )}

              {/* System Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assign System Role</label>
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value)}
                  disabled={editingUser.id === currentUser?.userId || allowedRolesForCurrentActor.length === 0}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3 py-2.5 rounded-xl focus:border-cyan-500 outline-none disabled:opacity-50"
                >
                  {allowedRolesForCurrentActor.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Allowed roles by your authority ({currentUser?.role}): {allowedRolesForCurrentActor.join(', ')}
                </p>
              </div>

              {/* Account Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Account Status</label>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  disabled={editingUser.id === currentUser?.userId}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3 py-2.5 rounded-xl focus:border-cyan-500 outline-none disabled:opacity-50"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || editingUser.id === currentUser?.userId}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                >
                  {saving ? 'Saving Access...' : 'Save Role Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
