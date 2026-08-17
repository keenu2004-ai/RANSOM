import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import {
  Receipt, Plus, Check, X, FileText, MapPin, Navigation, CreditCard,
  Building, Calendar, DollarSign, Upload, Trash2, Eye, AlertTriangle, ShieldCheck, Clock
} from 'lucide-react';

const BUCKET_OPTIONS = ['Exit', 'Internal', 'Onboarding', 'Other', 'Primary'];
const BUSINESS_CATEGORIES = ['Courier', 'Food', 'Office Supply', 'Others', 'Raw Material'];
const LOCAL_TRAVEL_CATEGORIES = [
  'Bike', 'Bike Taxi', 'Courier', 'Field Visits', 'Flight', 'Food',
  'Metro Train', 'Office Supply', 'Others', 'Raw Material', 'Taxi', 'Train'
];
const TRANSPORT_MODES = [
  'Auto', 'Bus', 'Flight', 'Other', 'Public Transportation', 'Metro', 'Taxi', 'Train'
];

export const Expenses: React.FC = () => {
  const { user } = useAuth();
  const isManagerOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '');

  const [myExpenses, setMyExpenses] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'MY_CLAIMS' | 'WORKFORCE'>('MY_CLAIMS');

  // Modal State
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimType, setClaimType] = useState<'BUSINESS' | 'LOCAL_TRAVEL'>('BUSINESS');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Attachment state
  const [attachment, setAttachment] = useState<{ name: string; url: string } | null>(null);

  // Detail view modal
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    description: '',
    category: 'Food',
    merchant: '',
    currency: 'INR',
    amount: '',
    bucket: 'Internal',
    transportMode: 'Taxi',
    startLocation: '',
    endLocation: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (user?.employeeId) {
        const myRes = await apiFetch('/expenses/my').catch(() => ({ data: { expenses: [] } }));
        setMyExpenses(myRes.data?.expenses || []);
      }
      if (isManagerOrAdmin) {
        const allRes = await apiFetch('/expenses').catch(() => ({ data: { expenses: [] } }));
        setAllExpenses(allRes.data?.expenses || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, isManagerOrAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (type: 'BUSINESS' | 'LOCAL_TRAVEL') => {
    setClaimType(type);
    setFormError(null);
    setAttachment(null);
    setFormData({
      transactionDate: new Date().toISOString().split('T')[0],
      description: '',
      category: type === 'BUSINESS' ? BUSINESS_CATEGORIES[0] : LOCAL_TRAVEL_CATEGORIES[0],
      merchant: '',
      currency: 'INR',
      amount: '',
      bucket: BUCKET_OPTIONS[1], // Internal
      transportMode: TRANSPORT_MODES[6], // Taxi
      startLocation: '',
      endLocation: ''
    });
    setShowClaimModal(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setFormError('Invalid file format. Please upload a PDF, JPG, or PNG document.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError('File size exceeds 10MB limit.');
      return;
    }

    setFormError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        url: reader.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitClaim = async (status: 'DRAFT' | 'SUBMITTED') => {
    setFormError(null);

    const numericAmount = parseFloat(formData.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFormError('Amount must be a positive number greater than ₹0.');
      return;
    }

    if (!formData.description || formData.description.trim() === '') {
      setFormError('Purpose / Note is required.');
      return;
    }

    if (claimType === 'LOCAL_TRAVEL') {
      if (!formData.merchant || formData.merchant.trim() === '') {
        setFormError('Merchant is required for Local Travel Expense.');
        return;
      }
      if (!formData.startLocation || formData.startLocation.trim() === '') {
        setFormError('Start Location is required for Local Travel Expense.');
        return;
      }
      if (!formData.endLocation || formData.endLocation.trim() === '') {
        setFormError('End Location is required for Local Travel Expense.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: any = {
        expenseType: claimType,
        transactionDate: formData.transactionDate,
        category: formData.category,
        merchant: formData.merchant ? formData.merchant.trim() : undefined,
        currency: formData.currency,
        amount: numericAmount,
        bucket: formData.bucket,
        description: formData.description.trim(),
        attachmentName: attachment?.name,
        receiptUrl: attachment?.url,
        status
      };

      if (claimType === 'LOCAL_TRAVEL') {
        payload.transportMode = formData.transportMode;
        payload.startLocation = formData.startLocation.trim();
        payload.endLocation = formData.endLocation.trim();
      }

      await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowClaimModal(false);
      setSuccessMsg(status === 'DRAFT' ? 'Expense claim saved as draft.' : 'Expense claim submitted successfully.');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit expense claim.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await apiFetch(`/expenses/${id}/approve`, { method: 'PUT' });
      setSuccessMsg('Expense claim approved successfully.');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      await apiFetch(`/expenses/${id}/reject`, { method: 'PUT', body: JSON.stringify({ rejectionReason: reason }) });
      setSuccessMsg('Expense claim rejected.');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const displayedExpenses = (activeTab === 'WORKFORCE' ? allExpenses : myExpenses).filter(ex => {
    if (typeFilter && ex.expense_type !== typeFilter) return false;
    if (statusFilter && ex.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-cyan-400" />
            <span>Expense Claims & Reimbursements</span>
          </h1>
          <p className="text-xs text-slate-400">Submit and manage Business & Local Travel expense claims in INR (₹)</p>
        </div>

        {isManagerOrAdmin && (
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveTab('MY_CLAIMS')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'MY_CLAIMS' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              My Claims ({myExpenses.length})
            </button>
            <button
              onClick={() => setActiveTab('WORKFORCE')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'WORKFORCE' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Workforce Approvals ({allExpenses.filter(e => e.status === 'SUBMITTED' || e.status === 'PENDING').length})
            </button>
          </div>
        )}
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs rounded-xl font-semibold flex items-center gap-2 shadow-lg">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. EXPENSE CLAIM LANDING OPTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Business Expense */}
        <div
          onClick={() => handleOpenModal('BUSINESS')}
          className="p-5 bg-gradient-to-br from-slate-900 to-cyan-950/40 border border-slate-800 hover:border-cyan-500/60 rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.01] shadow-xl group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20 group-hover:bg-cyan-500 group-hover:text-white transition-all">
              <Building className="w-6 h-6" />
            </div>
            <span className="px-2.5 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px] font-bold rounded-full">ACTIVE</span>
          </div>
          <h3 className="font-bold text-white text-base mb-1">Business Expense</h3>
          <p className="text-xs text-slate-400 mb-4">Submit food, courier, office supply, or raw material claims</p>
          <button className="w-full py-2 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-white font-semibold text-xs rounded-xl border border-cyan-500/40 transition-all flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>New Business Claim</span>
          </button>
        </div>

        {/* Local Travel Expense */}
        <div
          onClick={() => handleOpenModal('LOCAL_TRAVEL')}
          className="p-5 bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-slate-800 hover:border-indigo-500/60 rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.01] shadow-xl group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-all">
              <Navigation className="w-6 h-6" />
            </div>
            <span className="px-2.5 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px] font-bold rounded-full">ACTIVE</span>
          </div>
          <h3 className="font-bold text-white text-base mb-1">Local Travel Expense</h3>
          <p className="text-xs text-slate-400 mb-4">Submit taxi, auto, metro, bus, or field visit travel claims</p>
          <button className="w-full py-2 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white font-semibold text-xs rounded-xl border border-indigo-500/40 transition-all flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>New Local Travel Claim</span>
          </button>
        </div>

        {/* Trip Expense — DISABLED / COMING SOON */}
        <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl opacity-65 cursor-not-allowed shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-slate-800 text-slate-500 rounded-xl">
              <MapPin className="w-6 h-6" />
            </div>
            <span className="px-2.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-bold rounded-full">COMING SOON</span>
          </div>
          <h3 className="font-bold text-slate-300 text-base mb-1">Trip Expense</h3>
          <p className="text-xs text-slate-500 mb-4">Multi-day outstation business travel & lodging claims</p>
          <button disabled className="w-full py-2 bg-slate-800 text-slate-500 font-semibold text-xs rounded-xl border border-slate-700 cursor-not-allowed">
            Phase 2 Feature
          </button>
        </div>
      </div>

      {/* Claims List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl space-y-4 p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-sm">
              {activeTab === 'WORKFORCE' ? 'Workforce Expense Claims' : 'My Expense Claims History'}
            </h3>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300"
            >
              <option value="">All Expense Types</option>
              <option value="BUSINESS">Business Expense</option>
              <option value="LOCAL_TRAVEL">Local Travel Expense</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                {activeTab === 'WORKFORCE' && <th className="p-3">Employee</th>}
                <th className="p-3">Expense Type</th>
                <th className="p-3">Date</th>
                <th className="p-3">Category</th>
                <th className="p-3">Merchant / Locations</th>
                <th className="p-3">Amount (₹)</th>
                <th className="p-3">Bucket</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {displayedExpenses.map(ex => (
                <tr key={ex.id} className="hover:bg-slate-800/40 transition-all">
                  {activeTab === 'WORKFORCE' && (
                    <td className="p-3 font-semibold text-slate-200">
                      <div>{ex.employee_name}</div>
                      <span className="text-[10px] font-mono text-slate-500">{ex.employee_code}</span>
                    </td>
                  )}
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      ex.expense_type === 'LOCAL_TRAVEL'
                        ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                        : 'bg-cyan-950 text-cyan-300 border-cyan-800'
                    }`}>
                      {ex.expense_type === 'LOCAL_TRAVEL' ? 'Local Travel' : 'Business'}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-400">{ex.transaction_date ? new Date(ex.transaction_date).toLocaleDateString() : '-'}</td>
                  <td className="p-3 font-semibold text-slate-200">{ex.category || ex.category_name}</td>
                  <td className="p-3 max-w-[200px] truncate">
                    {ex.merchant && <span className="font-semibold text-slate-200 block">{ex.merchant}</span>}
                    {ex.expense_type === 'LOCAL_TRAVEL' && ex.start_location && (
                      <span className="text-[10px] text-slate-400 block truncate">
                        {ex.start_location} → {ex.end_location} ({ex.transport_mode})
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono font-bold text-emerald-400">
                    ₹{Number(ex.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded font-mono text-[10px]">
                      {ex.bucket || 'Primary'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      ex.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                      ex.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                      ex.status === 'DRAFT' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                      'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}>
                      {ex.status}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-1">
                    <button
                      onClick={() => setSelectedExpense(ex)}
                      className="p-1 text-slate-400 hover:text-cyan-400"
                      title="View Expense Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {activeTab === 'WORKFORCE' && (ex.status === 'SUBMITTED' || ex.status === 'PENDING') && (
                      <>
                        <button
                          onClick={() => handleApprove(ex.id)}
                          className="px-2 py-0.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded text-[10px] font-bold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(ex.id)}
                          className="px-2 py-0.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded text-[10px] font-bold"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}

              {displayedExpenses.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 italic">
                    No expense claims found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2 & 3. BUSINESS / LOCAL TRAVEL EXPENSE FORM MODAL */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                {claimType === 'BUSINESS' ? <Building className="w-5 h-5 text-cyan-400" /> : <Navigation className="w-5 h-5 text-indigo-400" />}
                <span>{claimType === 'BUSINESS' ? 'Business Expense Claim' : 'Local Travel Expense Claim'}</span>
              </h3>
              <button type="button" onClick={() => setShowClaimModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={e => { e.preventDefault(); handleSubmitClaim('SUBMITTED'); }} className="space-y-4 text-xs">
              {/* Transaction Date & Purpose */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Transaction Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.transactionDate}
                    onChange={e => setFormData({ ...formData, transactionDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    {(claimType === 'BUSINESS' ? BUSINESS_CATEGORIES : LOCAL_TRAVEL_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Purpose / Note *</label>
                <textarea
                  required
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="Reason for expense, project context, or items purchased..."
                />
              </div>

              {/* Local Travel Exclusive Fields */}
              {claimType === 'LOCAL_TRAVEL' && (
                <div className="space-y-3 p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-indigo-300 mb-1 font-medium">Mode of Transport *</label>
                      <select
                        required
                        value={formData.transportMode}
                        onChange={e => setFormData({ ...formData, transportMode: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                      >
                        {TRANSPORT_MODES.map(mode => (
                          <option key={mode} value={mode}>{mode}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-indigo-300 mb-1 font-medium">Merchant *</label>
                      <input
                        type="text"
                        required
                        value={formData.merchant}
                        onChange={e => setFormData({ ...formData, merchant: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                        placeholder="Uber / Ola / Local Auto / IRCTC"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-indigo-300 mb-1 font-medium">Start Location *</label>
                      <input
                        type="text"
                        required
                        value={formData.startLocation}
                        onChange={e => setFormData({ ...formData, startLocation: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                        placeholder="Theiakshi HQ Office"
                      />
                    </div>

                    <div>
                      <label className="block text-indigo-300 mb-1 font-medium">End Location *</label>
                      <input
                        type="text"
                        required
                        value={formData.endLocation}
                        onChange={e => setFormData({ ...formData, endLocation: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                        placeholder="Client Office, Noida"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Merchant for Business Expense */}
              {claimType === 'BUSINESS' && (
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Merchant / Vendor</label>
                  <input
                    type="text"
                    value={formData.merchant}
                    onChange={e => setFormData({ ...formData, merchant: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                    placeholder="Amazon / Vendor Name / Restaurant"
                  />
                </div>
              )}

              {/* Financial & Bucket */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Currency *</label>
                  <select
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                  >
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono font-bold"
                    placeholder="5500.00"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Bucket *</label>
                  <select
                    required
                    value={formData.bucket}
                    onChange={e => setFormData({ ...formData, bucket: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    {BUCKET_OPTIONS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Upload Attachment */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="block text-slate-300 font-medium">Upload Attachment / Receipt</label>
                {!attachment ? (
                  <label className="flex items-center justify-center gap-2 p-3 bg-slate-950 border border-dashed border-slate-700 hover:border-cyan-500 rounded-xl cursor-pointer text-slate-400 hover:text-cyan-300 transition-all">
                    <Upload className="w-4 h-4" />
                    <span>Upload Document / Receipt (PDF, JPG, PNG)</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} className="hidden" />
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-slate-950 border border-cyan-800/60 rounded-xl text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="text-slate-200 truncate">{attachment.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="p-1 text-slate-400 hover:text-rose-400"
                      title="Remove Attachment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmitClaim('DRAFT')}
                  className="px-4 py-2 bg-slate-950 border border-slate-700 hover:border-slate-600 text-slate-200 rounded-xl font-medium"
                >
                  Save Draft
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-bold shadow"
                >
                  Submit Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPENSE DETAIL VIEW MODAL */}
      {selectedExpense && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-cyan-400" />
                <span>Expense Claim Details</span>
              </h3>
              <button type="button" onClick={() => setSelectedExpense(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px]">EXPENSE TYPE</span>
                  <span className="font-bold text-cyan-400">{selectedExpense.expense_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">TRANSACTION DATE</span>
                  <span className="font-mono text-slate-200">{new Date(selectedExpense.transaction_date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CATEGORY</span>
                  <span className="font-semibold text-slate-200">{selectedExpense.category || selectedExpense.category_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">AMOUNT</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">₹{Number(selectedExpense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-2 p-3 bg-slate-950 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px]">PURPOSE / NOTE</span>
                  <p className="text-slate-200 font-medium">{selectedExpense.description}</p>
                </div>
                {selectedExpense.merchant && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">MERCHANT / VENDOR</span>
                    <span className="text-slate-200 font-semibold">{selectedExpense.merchant}</span>
                  </div>
                )}
                {selectedExpense.expense_type === 'LOCAL_TRAVEL' && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">MODE OF TRANSPORT</span>
                      <span className="text-indigo-300 font-semibold">{selectedExpense.transport_mode}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">START → END LOCATION</span>
                      <span className="text-slate-200">{selectedExpense.start_location} → {selectedExpense.end_location}</span>
                    </div>
                  </div>
                )}
              </div>

              {selectedExpense.receipt_url && (
                <div className="p-3 bg-slate-950 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span className="font-semibold text-slate-200 truncate">{selectedExpense.attachment_name || 'Receipt Document'}</span>
                  </div>
                  <a
                    href={selectedExpense.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded text-[10px] font-bold"
                  >
                    View File
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedExpense(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
