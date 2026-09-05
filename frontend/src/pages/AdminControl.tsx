import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { getAllowedAssignableRoles, hasPermission } from '../utils/permissions';
import {
  ShieldCheck, Users, KeyRound, Shield, Search, Edit3, X,
  CheckCircle2, AlertTriangle, RefreshCw, Eye, EyeOff, Copy, Check
} from 'lucide-react';

export const AdminControl: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit Role Modal
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('EMPLOYEE');
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset Password Modal
  const [resettingUser, setResettingUser] = useState<any | null>(null);
  const [tempPasswordInput, setTempPasswordInput] = useState<string>('');
  const [showTempPassword, setShowTempPassword] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const allowedRolesForCurrentActor = getAllowedAssignableRoles(currentUser?.role);
  const canAssignRoles = hasPermission(currentUser?.role, 'USER_ROLE_ASSIGN');
  const canResetPassword = hasPermission(currentUser?.role, 'USER_PASSWORD_RESET');

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const uRes = await apiFetch('/users').catch(() => apiFetch('/admin/users').then(r => ({ data: { users: r.users || [] } })));
      const fetchedUsers = uRes.data?.users || uRes.users || [];
      setUsersList(fetchedUsers);
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

  const handleOpenResetModal = (targetUser: any) => {
    setResettingUser(targetUser);
    setTempPasswordInput(`TempPass#${Math.floor(1000 + Math.random() * 9000)}`);
    setShowTempPassword(true);
    setCopied(false);
    setResetErrorMsg(null);
  };

  const handleCopyTempPassword = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
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
      if (selectedRole !== (editingUser.role || editingUser.role_name)) {
        await apiFetch(`/users/${editingUser.id}/role`, {
          method: 'PUT',
          body: JSON.stringify({ role: selectedRole })
        });
      }

      if (selectedStatus !== editingUser.status) {
        await apiFetch(`/users/${editingUser.id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: selectedStatus })
        });
      }

      setEditingUser(null);
      setSuccessMsg(`System access for ${editingUser.email} updated to role '${selectedRole}'.`);
      setTimeout(() => setSuccessMsg(null), 5000);
      fetchAdminData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update user access role.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdminResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;

    if (resettingUser.id === currentUser?.userId) {
      setResetErrorMsg('For your own account password change, please use Settings -> Change Password.');
      return;
    }

    setResetting(true);
    setResetErrorMsg(null);

    try {
      const res = await apiFetch(`/users/${resettingUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: tempPasswordInput })
      });

      const tempPass = res.data?.temporaryPassword || tempPasswordInput;
      setSuccessMsg(`Password reset successfully for ${resettingUser.email}. Temporary password: ${tempPass}`);
      setResettingUser(null);
      setTimeout(() => setSuccessMsg(null), 10000);
    } catch (err: any) {
      setResetErrorMsg(err.message || 'Failed to reset user password.');
    } finally {
      setResetting(false);
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
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-semibold text-emerald-900">{successMsg}</p>
              <p className="text-[11px] text-emerald-700">User should sign in using the temporary password and change it in Settings immediately.</p>
            </div>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="p-1 hover:bg-emerald-100 rounded cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] flex items-center justify-between shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
            <h1 className="text-xl font-extrabold text-[var(--text-primary)] tracking-wide">Administration & Security Control</h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">Manage organization user accounts, system permission roles, and security credentials</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded-xl text-xs font-mono text-[var(--primary)] shadow-sm">
          <span>Authority: {currentUser?.role}</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[var(--border-subtle)] pb-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 min-w-max">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'users' ? 'bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--border-subtle)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Accounts Directory ({usersList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'roles' ? 'bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--border-subtle)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>System Permission Matrix</span>
          </button>
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-sm">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search login email, employee name, code, role..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] text-xs pl-9 pr-4 py-2.5 rounded-xl focus:border-[var(--primary)] outline-none shadow-sm"
              />
            </div>
            <button
              onClick={fetchAdminData}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Users Table */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[var(--text-secondary)]">
                <thead className="bg-[var(--bg-surface-muted)] text-[var(--text-muted)] font-semibold uppercase text-[10px] tracking-wider border-b border-[var(--border-subtle)]">
                  <tr>
                    <th className="px-6 py-3">Login User Email</th>
                    <th className="px-6 py-3">Linked Employee Profile</th>
                    <th className="px-6 py-3">System Role</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)]">Loading user account directory...</td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)]">No user accounts found matching query.</td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => {
                      const userRole = u.role || u.role_name || 'EMPLOYEE';
                      const isSelf = u.id === currentUser?.userId;

                      return (
                        <tr key={u.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                          <td className="px-6 py-4 font-semibold text-[var(--text-primary)]">
                            <div>{u.email}</div>
                            {isSelf && <span className="text-[10px] text-[var(--primary)] font-normal">(Current Account)</span>}
                          </td>
                          <td className="px-6 py-4">
                            {u.employee_name ? (
                              <div>
                                <span className="font-medium text-[var(--text-primary)]">{u.employee_name}</span>
                                <span className="text-[var(--text-muted)] text-[10px] block font-mono">{u.employee_code}</span>
                              </div>
                            ) : (
                              <span className="italic text-[var(--text-muted)]">Management Account</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--border-subtle)]">
                              {userRole}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}>
                              {u.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              {canAssignRoles && (
                                <button
                                  onClick={() => handleOpenEditModal(u)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-[var(--primary)]" />
                                  <span>{isSelf ? 'View Access' : 'Assign Role'}</span>
                                </button>
                              )}

                              {canResetPassword && !isSelf && (
                                <button
                                  onClick={() => handleOpenResetModal(u)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-amber-800 border border-[var(--border-subtle)] rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm"
                                  title="Reset User Password"
                                >
                                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Reset Password</span>
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
      )}

      {activeTab === 'roles' && (
        <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl space-y-4 shadow-sm">
          <h3 className="font-semibold text-sm text-[var(--text-primary)]">Centralized System Role Permission Hierarchy</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded-xl space-y-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-surface)] text-[var(--primary)] border border-[var(--border-subtle)]">SUPER_ADMIN</span>
              <p className="text-xs text-[var(--text-secondary)] pt-1">Full Organization & System Operational Control. Can assign all roles and reset passwords.</p>
            </div>
            <div className="p-4 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded-xl space-y-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-surface)] text-[var(--primary)] border border-[var(--border-subtle)]">ADMIN</span>
              <p className="text-xs text-[var(--text-secondary)] pt-1">Full Organization Operational Control. Can assign HR_MANAGER, OPERATIONAL_MANAGER, EMPLOYEE roles & reset passwords.</p>
            </div>
            <div className="p-4 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded-xl space-y-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-surface)] text-[var(--primary)] border border-[var(--border-subtle)]">HR_MANAGER</span>
              <p className="text-xs text-[var(--text-secondary)] pt-1">Workforce & HR Management Scope. Can assign OPERATIONAL_MANAGER & EMPLOYEE roles and reset passwords if permitted.</p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-2xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
                <h3 className="font-bold text-[var(--text-primary)] text-sm">Assign User System Role</h3>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAccessChange} className="space-y-4">
              <div className="p-3 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-subtle)] text-xs space-y-1">
                <p className="text-[var(--text-secondary)] font-medium">Target User: <span className="text-[var(--text-primary)] font-bold">{editingUser.email}</span></p>
                <p className="text-[var(--text-secondary)] font-medium">Linked Profile: <span className="text-[var(--primary)] font-mono">{editingUser.employee_name ? `${editingUser.employee_name} (${editingUser.employee_code})` : 'Management Only'}</span></p>
              </div>

              {editingUser.id === currentUser?.userId && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px]">
                  ⚠️ Note: You are viewing your own user account. Self-role modification is strictly forbidden by policy.
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Assign System Role</label>
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value)}
                  disabled={editingUser.id === currentUser?.userId || allowedRolesForCurrentActor.length === 0}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] text-xs px-3 py-2.5 rounded-xl focus:border-[var(--primary)] outline-none disabled:opacity-50 shadow-sm"
                >
                  {(allowedRolesForCurrentActor.length > 0 ? allowedRolesForCurrentActor : ['SUPER_ADMIN', 'HR_MANAGER', 'OPERATIONAL_MANAGER', 'EMPLOYEE']).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Allowed roles: {allowedRolesForCurrentActor.join(', ')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Account Status</label>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  disabled={editingUser.id === currentUser?.userId}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] text-xs px-3 py-2.5 rounded-xl focus:border-[var(--primary)] outline-none disabled:opacity-50 shadow-sm"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || editingUser.id === currentUser?.userId}
                  className="px-4 py-2 btn-theme-primary font-semibold text-xs rounded-xl shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving Access...' : 'Save Role Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Password Reset Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-2xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-[var(--text-primary)] text-sm">Administrator Password Reset</h3>
              </div>
              <button onClick={() => setResettingUser(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{resetErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAdminResetPasswordSubmit} className="space-y-4">
              <div className="p-3 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-subtle)] text-xs space-y-1">
                <p className="text-[var(--text-secondary)] font-medium">Target Account: <span className="text-[var(--text-primary)] font-bold">{resettingUser.email}</span></p>
                <p className="text-[var(--text-secondary)] font-medium">Linked Employee: <span className="text-amber-800 font-mono">{resettingUser.employee_name ? `${resettingUser.employee_name} (${resettingUser.employee_code})` : 'Management Only'}</span></p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)]">Temporary Password</label>
                  <button
                    type="button"
                    onClick={() => setTempPasswordInput(`TempPass#${Math.floor(1000 + Math.random() * 9000)}`)}
                    className="text-[10px] text-[var(--primary)] hover:underline font-mono cursor-pointer"
                  >
                    Auto-Generate
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showTempPassword ? 'text' : 'password'}
                    required
                    value={tempPasswordInput}
                    onChange={e => setTempPasswordInput(e.target.value)}
                    placeholder="Enter or generate temporary password..."
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-amber-800 font-mono text-xs pl-3 pr-20 py-2.5 rounded-xl focus:border-amber-500 outline-none shadow-sm"
                  />
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowTempPassword(!showTempPassword)}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded cursor-pointer"
                      title={showTempPassword ? 'Hide password' : 'Show password'}
                    >
                      {showTempPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyTempPassword(tempPasswordInput)}
                      className="p-1 text-[var(--primary)] hover:opacity-80 rounded cursor-pointer"
                      title="Copy temporary password"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting || !tempPasswordInput}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {resetting ? 'Resetting Password...' : 'Confirm Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
