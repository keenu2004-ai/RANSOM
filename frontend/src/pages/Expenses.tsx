import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { Receipt, Plus, Check, X } from 'lucide-react';

export const Expenses: React.FC = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [myExpenses, setMyExpenses] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [formData, setFormData] = useState({ categoryId: '', amount: '', description: '' });

  const fetchExpenses = async () => {
    try {
      const catRes = await apiFetch('/expenses/categories');
      setCategories(catRes.categories || []);

      if (user?.employeeId) {
        const myRes = await apiFetch('/expenses/my').catch(() => null);
        setMyExpenses(myRes?.expenses || []);
      }

      if (['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '')) {
        const allRes = await apiFetch('/expenses');
        setAllExpenses(allRes.expenses || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify({ ...formData, amount: parseFloat(formData.amount) })
      });
      setShowClaimModal(false);
      setFormData({ categoryId: '', amount: '', description: '' });
      fetchExpenses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await apiFetch(`/expenses/${id}/approve`, { method: 'PUT' });
      fetchExpenses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      await apiFetch(`/expenses/${id}/reject`, { method: 'PUT', body: JSON.stringify({ rejectionReason: reason }) });
      fetchExpenses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-400" />
            <span>Expense Claims & Reimbursements</span>
          </h1>
          <p className="text-xs text-slate-400">Submit business expense claims in INR (₹) and manage manager approval workflows</p>
        </div>

        {user?.employeeId && (
          <button
            onClick={() => {
              if (categories.length > 0) setFormData(f => ({ ...f, categoryId: categories[0].id }));
              setShowClaimModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-cyan-600 text-white font-semibold text-xs rounded-xl shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Expense Claim</span>
          </button>
        )}
      </div>

      {/* Admin Approval Table */}
      {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '') && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 font-semibold text-xs text-slate-300">
            Workforce Expense Claims Overview
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Amount (₹)</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allExpenses.length > 0 ? (
                  allExpenses.map(ex => (
                    <tr key={ex.id} className="hover:bg-slate-800/40">
                      <td className="px-6 py-3.5 font-semibold text-slate-200">{ex.employee_name} ({ex.employee_code})</td>
                      <td className="px-6 py-3.5 text-cyan-400 font-medium">{ex.category_name}</td>
                      <td className="px-6 py-3.5 font-mono font-bold text-emerald-400">₹ {parseFloat(ex.amount).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 max-w-xs truncate">{ex.description}</td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          ex.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          ex.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {ex.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right space-x-2">
                        {ex.status === 'PENDING' && (
                          <>
                            <button onClick={() => handleApprove(ex.id)} className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-lg">Approve</button>
                            <button onClick={() => handleReject(ex.id)} className="px-2.5 py-1 bg-rose-950 text-rose-300 border border-rose-800 rounded-lg">Reject</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No expense claims found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showClaimModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Submit Expense Claim</h3>
            <form onSubmit={handleSubmitClaim} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Category *</label>
                <select
                  value={formData.categoryId}
                  onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Amount (₹ INR) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Description *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="Describe expense rationale..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowClaimModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-500 text-white rounded-xl font-semibold">Submit Claim</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
