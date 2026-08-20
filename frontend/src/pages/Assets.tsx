import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { 
  Package, Plus, Search, Filter, Wrench, RefreshCw, UserCheck, 
  RotateCcw, History, FileSpreadsheet, ShieldAlert, CheckCircle2, 
  AlertTriangle, Clock, X, Edit3, Trash2, Tag, Calendar, User, DollarSign,
  Info, Box, Shield, WrenchIcon, Layers, FileText, ChevronRight, Eye, Check, XCircle, Monitor, Laptop, HardDrive, AlertOctagon
} from 'lucide-react';

export const Assets: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ASSETS' | 'MY_ASSETS' | 'CATEGORIES' | 'REQUESTS'>('ASSETS');

  const [assets, setAssets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [assetRequests, setAssetRequests] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  
  // Phase 4 Asset Request Modals
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [selectedFulfillAssetId, setSelectedFulfillAssetId] = useState<string>('');

  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [assetHistory, setAssetHistory] = useState<any[]>([]);

  // Form States
  const [assetForm, setAssetForm] = useState({
    assetCode: '',
    assetName: '',
    categoryId: '',
    assetType: 'HARDWARE',
    brand: '',
    model: '',
    serialNumber: '',
    purchaseDate: '',
    purchasePrice: 0,
    currentValue: 0,
    warrantyStartDate: '',
    warrantyEndDate: '',
    vendor: '',
    invoiceNumber: '',
    condition: 'NEW',
    location: 'HQ Main Office',
    description: '',
    assignmentStatus: 'IN_STOCK' as 'IN_STOCK' | 'ASSIGNED',
    assignedEmployeeId: '',
    assignedDate: new Date().toISOString().split('T')[0],
    expectedReturnDate: '',
    assignmentCondition: 'NEW',
    assignmentNotes: ''
  });

  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    assignedDate: new Date().toISOString().split('T')[0],
    expectedReturnDate: '',
    condition: 'EXCELLENT',
    notes: ''
  });

  const [returnForm, setReturnForm] = useState({
    returnedDate: new Date().toISOString().split('T')[0],
    condition: 'GOOD',
    notes: ''
  });

  const [statusUpdateForm, setStatusUpdateForm] = useState({
    status: 'RETIRED',
    notes: ''
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    code: '',
    description: ''
  });

  const [requestForm, setRequestForm] = useState({
    categoryId: '',
    reason: '',
    priority: 'NORMAL',
    requiredDate: ''
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isManagerOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '');
  const canManageCategories = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(user?.role || '');
  const canDeleteAssets = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(user?.role || '');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, catsRes, assetsRes, empRes, reqsRes] = await Promise.all([
        apiFetch('/assets/summary').catch(() => null),
        apiFetch('/assets/categories').catch(() => []),
        apiFetch('/assets').catch(() => []),
        apiFetch('/employees').catch(() => []),
        apiFetch('/assets/requests').catch(() => [])
      ]);

      setSummary(sumRes?.summary || sumRes || null);
      
      const fetchedCats = Array.isArray(catsRes) ? catsRes : (catsRes?.categories || catsRes?.data || []);
      setCategories(fetchedCats);

      const fetchedAssets = Array.isArray(assetsRes) ? assetsRes : (assetsRes?.assets || assetsRes?.data || []);
      setAssets(fetchedAssets);

      const fetchedEmps = Array.isArray(empRes) ? empRes : (empRes?.employees || empRes?.data || []);
      setEmployees(fetchedEmps);

      const fetchedReqs = Array.isArray(reqsRes) ? reqsRes : (reqsRes?.requests || reqsRes?.data || []);
      setAssetRequests(fetchedReqs);

      if (fetchedCats.length > 0) {
        setAssetForm(prev => prev.categoryId ? prev : { ...prev, categoryId: fetchedCats[0].id });
        setRequestForm(prev => prev.categoryId ? prev : { ...prev, categoryId: fetchedCats[0].id });
      }
    } catch (err) {
      console.error('Error fetching asset data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Asset Categories Management
  const handleOpenCategoryModal = () => {
    setCategoryError(null);
    setCategoryForm({ name: '', code: '', description: '' });
    setShowCategoryModal(true);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError(null);

    if (!categoryForm.name || categoryForm.name.trim() === '') {
      setCategoryError('Category name is required.');
      return;
    }

    const code = categoryForm.code && categoryForm.code.trim() !== ''
      ? categoryForm.code.trim().toUpperCase()
      : `CAT-${categoryForm.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')}`;

    try {
      await apiFetch('/assets/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: categoryForm.name.trim(),
          code,
          description: categoryForm.description.trim() || undefined
        })
      });

      setShowCategoryModal(false);
      setSuccessMsg(`Category '${categoryForm.name.trim()}' created successfully.`);
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setCategoryError(err.message || 'Failed to create asset category.');
    }
  };

  // Asset Request Actions
  const handleOpenRequestModal = () => {
    setRequestError(null);
    setRequestForm({
      categoryId: categories.length > 0 ? categories[0].id : '',
      reason: '',
      priority: 'NORMAL',
      requiredDate: ''
    });
    setShowRequestModal(true);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError(null);

    if (!requestForm.reason || requestForm.reason.trim() === '') {
      setRequestError('Please provide a reason for the asset request.');
      return;
    }

    try {
      await apiFetch('/assets/requests', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: requestForm.categoryId || undefined,
          reason: requestForm.reason.trim(),
          priority: requestForm.priority,
          requiredDate: requestForm.requiredDate || undefined
        })
      });

      setShowRequestModal(false);
      setSuccessMsg('Asset request submitted successfully.');
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setRequestError(err.message || 'Failed to submit asset request.');
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      await apiFetch(`/assets/requests/${requestId}/approve`, { method: 'PUT' });
      setSuccessMsg('Asset request approved. Ready for fulfillment.');
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to approve request.');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (reason === null) return;
    if (reason.trim() === '') {
      alert('Rejection reason is required.');
      return;
    }

    try {
      await apiFetch(`/assets/requests/${requestId}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ rejectionReason: reason })
      });
      setSuccessMsg('Asset request rejected.');
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to reject request.');
    }
  };

  const handleOpenFulfillModal = (req: any) => {
    setSelectedRequest(req);
    const available = assets.filter(a => a.status === 'AVAILABLE');
    setSelectedFulfillAssetId(available.length > 0 ? available[0].id : '');
    setShowFulfillModal(true);
  };

  const handleFulfillRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !selectedFulfillAssetId) {
      alert('Please select an available asset to fulfill this request.');
      return;
    }

    try {
      await apiFetch(`/assets/requests/${selectedRequest.id}/fulfill`, {
        method: 'PUT',
        body: JSON.stringify({ assetId: selectedFulfillAssetId })
      });

      setShowFulfillModal(false);
      setSelectedRequest(null);
      setSuccessMsg('Asset assigned and request fulfilled successfully.');
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to fulfill request.');
    }
  };

  // Standard Inventory Handlers
  const handleOpenAddAsset = () => {
    setFormError(null);
    setAssetForm({
      assetCode: '',
      assetName: '',
      categoryId: categories.length > 0 ? categories[0].id : '',
      assetType: 'HARDWARE',
      brand: '',
      model: '',
      serialNumber: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      purchasePrice: 0,
      currentValue: 0,
      warrantyStartDate: '',
      warrantyEndDate: '',
      vendor: '',
      invoiceNumber: '',
      condition: 'NEW',
      location: 'HQ Main Office',
      description: '',
      assignmentStatus: 'IN_STOCK',
      assignedEmployeeId: employees.length > 0 ? employees[0].id : '',
      assignedDate: new Date().toISOString().split('T')[0],
      expectedReturnDate: '',
      assignmentCondition: 'NEW',
      assignmentNotes: ''
    });
    setShowAddModal(true);
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!assetForm.assetName || assetForm.assetName.trim() === '') {
      setFormError('Please enter an asset name.');
      return;
    }

    if (assetForm.assignmentStatus === 'ASSIGNED' && (!assetForm.assignedEmployeeId || assetForm.assignedEmployeeId.trim() === '')) {
      setFormError('Please select a valid employee for assignment.');
      return;
    }

    try {
      const payload: any = {
        assetName: assetForm.assetName.trim(),
        assetType: assetForm.assetType,
        categoryId: assetForm.categoryId,
        serialNumber: assetForm.serialNumber ? assetForm.serialNumber.trim() : undefined,
        purchasePrice: Number(assetForm.purchasePrice) || 0,
        currentValue: Number(assetForm.currentValue) || 0,
        brand: assetForm.brand,
        model: assetForm.model,
        location: assetForm.location,
        condition: assetForm.condition,
        assignmentStatus: assetForm.assignmentStatus
      };

      if (assetForm.assignmentStatus === 'ASSIGNED') {
        payload.assignedEmployeeId = assetForm.assignedEmployeeId;
        payload.assignedDate = assetForm.assignedDate;
      }

      await apiFetch('/assets', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowAddModal(false);
      setSuccessMsg('Asset registered successfully.');
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create asset.');
    }
  };

  const handleViewDetails = async (asset: any) => {
    setSelectedAsset(asset);
    try {
      const histRes = await apiFetch(`/assets/${asset.id}/history`).catch(() => []);
      const historyItems = Array.isArray(histRes) ? histRes : (histRes?.data || []);
      setAssetHistory(historyItems);
    } catch (err) {
      console.error(err);
      setAssetHistory([]);
    }
    setShowDetailsModal(true);
  };

  const handleOpenAssign = (asset: any) => {
    setSelectedAsset(asset);
    setAssignForm({
      employeeId: employees.length > 0 ? employees[0].id : '',
      assignedDate: new Date().toISOString().split('T')[0],
      expectedReturnDate: '',
      condition: asset.condition || 'EXCELLENT',
      notes: ''
    });
    setShowAssignModal(true);
  };

  const handleAssignAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset || !assignForm.employeeId) return;

    try {
      await apiFetch(`/assets/${selectedAsset.id}/assign`, {
        method: 'POST',
        body: JSON.stringify(assignForm)
      });
      setShowAssignModal(false);
      setSuccessMsg('Asset assigned successfully.');
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to assign asset.');
    }
  };

  const handleOpenReturn = (asset: any) => {
    setSelectedAsset(asset);
    setReturnForm({
      returnedDate: new Date().toISOString().split('T')[0],
      condition: asset.condition || 'GOOD',
      notes: ''
    });
    setShowReturnModal(true);
  };

  const handleReturnAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    try {
      await apiFetch(`/assets/${selectedAsset.id}/return`, {
        method: 'POST',
        body: JSON.stringify(returnForm)
      });
      setShowReturnModal(false);
      setSuccessMsg('Asset returned to stock.');
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to return asset.');
    }
  };

  // Safe Soft Delete Handlers
  const handleOpenDelete = (asset: any) => {
    setSelectedAsset(asset);
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const handleDeleteAsset = async () => {
    if (!selectedAsset) return;
    setDeleteError(null);

    try {
      await apiFetch(`/assets/${selectedAsset.id}`, { method: 'DELETE' });
      setShowDeleteModal(false);
      setSuccessMsg(`Asset '${selectedAsset.asset_code}' removed from active inventory.`);
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete asset.');
    }
  };

  // Status Change (Retire / Dispose / Lost / Damaged)
  const handleOpenStatusModal = (asset: any) => {
    setSelectedAsset(asset);
    setStatusUpdateForm({
      status: asset.status === 'AVAILABLE' ? 'RETIRED' : asset.status,
      notes: ''
    });
    setShowStatusModal(true);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    try {
      await apiFetch(`/assets/${selectedAsset.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(statusUpdateForm)
      });

      setShowStatusModal(false);
      setSuccessMsg(`Asset '${selectedAsset.asset_code}' status updated to ${statusUpdateForm.status}.`);
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update asset status.');
    }
  };

  const exportCSV = () => {
    const headers = ['Asset Code', 'Name', 'Category', 'Type', 'Serial Number', 'Status', 'Condition', 'Assigned To', 'Price'];
    const rows = assets.map(a => [
      a.asset_code,
      `"${a.asset_name}"`,
      `"${a.category_name}"`,
      a.asset_type,
      a.serial_number || '',
      a.status,
      a.condition,
      `"${a.employee_name || 'Unassigned'}"`,
      a.purchase_price
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `asset_inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const codeMatch = a.asset_code?.toLowerCase().includes(term);
        const nameMatch = a.asset_name?.toLowerCase().includes(term);
        const serialMatch = a.serial_number?.toLowerCase().includes(term);
        const empMatch = a.employee_name?.toLowerCase().includes(term);
        if (!codeMatch && !nameMatch && !serialMatch && !empMatch) return false;
      }
      if (statusFilter && a.status !== statusFilter) return false;
      if (categoryFilter && a.category_id !== categoryFilter) return false;
      if (conditionFilter && a.condition !== conditionFilter) return false;
      return true;
    });
  }, [assets, searchTerm, statusFilter, categoryFilter, conditionFilter]);

  const myAssignedAssets = useMemo(() => {
    if (!user?.employeeId) return [];
    return assets.filter(a => a.assigned_employee_id === user.employeeId);
  }, [assets, user?.employeeId]);

  const availableAssetsList = useMemo(() => assets.filter(a => a.status === 'AVAILABLE'), [assets]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-cyan-400" />
            <span>Asset Management</span>
          </h1>
          <p className="text-xs text-slate-400">Enterprise hardware inventory, allocations, self-service requisitions, and audit trail</p>
        </div>

        <div className="flex items-center gap-2">
          {user?.employeeId && (
            <button
              onClick={handleOpenRequestModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Request New Asset</span>
            </button>
          )}

          {canManageCategories && (
            <button
              onClick={handleOpenCategoryModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Add Category</span>
            </button>
          )}

          {isManagerOrAdmin && (
            <>
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handleOpenAddAsset}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Register New Asset</span>
              </button>
            </>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2 shadow">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Total Assets</span>
          <p className="text-xl font-extrabold text-white">{summary?.total_assets || assets.length}</p>
          <span className="text-[10px] text-slate-500">In Database</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">In Stock</span>
          <p className="text-xl font-extrabold text-emerald-400">{summary?.available_count || availableAssetsList.length}</p>
          <span className="text-[10px] text-slate-500">Ready to Assign</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Assigned</span>
          <p className="text-xl font-extrabold text-cyan-400">{summary?.assigned_count || assets.filter(a => a.status === 'ASSIGNED').length}</p>
          <span className="text-[10px] text-slate-500">With Employees</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Requests</span>
          <p className="text-xl font-extrabold text-indigo-400">{assetRequests.filter(r => r.status === 'SUBMITTED').length}</p>
          <span className="text-[10px] text-slate-500">Pending Review</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Maintenance</span>
          <p className="text-xl font-extrabold text-amber-400">{summary?.maintenance_count || 0}</p>
          <span className="text-[10px] text-slate-500">Under Repair</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Damaged/Lost</span>
          <p className="text-xl font-extrabold text-rose-400">{(summary?.damaged_count || 0) + (summary?.lost_count || 0)}</p>
          <span className="text-[10px] text-slate-500">Attention Req.</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Retired</span>
          <p className="text-xl font-extrabold text-slate-400">{summary?.retired_count || 0}</p>
          <span className="text-[10px] text-slate-500">Decommissioned</span>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('ASSETS')}
          className={`pb-3 px-3 border-b-2 transition-all ${
            activeTab === 'ASSETS' ? 'border-cyan-400 text-cyan-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Asset Inventory ({filteredAssets.length})
        </button>

        {user?.employeeId && (
          <button
            onClick={() => setActiveTab('MY_ASSETS')}
            className={`pb-3 px-3 border-b-2 transition-all ${
              activeTab === 'MY_ASSETS' ? 'border-emerald-400 text-emerald-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            My Assigned Company Assets ({myAssignedAssets.length})
          </button>
        )}

        <button
          onClick={() => setActiveTab('REQUESTS')}
          className={`pb-3 px-3 border-b-2 transition-all ${
            activeTab === 'REQUESTS' ? 'border-indigo-400 text-indigo-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Asset Requests ({assetRequests.length})
        </button>

        {isManagerOrAdmin && (
          <button
            onClick={() => setActiveTab('CATEGORIES')}
            className={`pb-3 px-3 border-b-2 transition-all ${
              activeTab === 'CATEGORIES' ? 'border-cyan-400 text-cyan-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Asset Categories ({categories.length})
          </button>
        )}
      </div>

      {/* 1. ASSETS INVENTORY TAB */}
      {activeTab === 'ASSETS' && (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search asset code, name, serial number, employee..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300"
              >
                <option value="">All Statuses</option>
                <option value="AVAILABLE">AVAILABLE (In Stock)</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="UNDER_MAINTENANCE">UNDER MAINTENANCE</option>
                <option value="DAMAGED">DAMAGED</option>
                <option value="LOST">LOST</option>
                <option value="RETIRED">RETIRED</option>
                <option value="DISPOSED">DISPOSED</option>
              </select>

              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300"
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Asset Code</th>
                  <th className="p-3">Asset Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Serial / Specs</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Assigned Employee</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredAssets.map(a => (
                  <tr key={a.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-cyan-400">{a.asset_code}</td>
                    <td className="p-3 font-bold text-white">{a.asset_name}</td>
                    <td className="p-3 text-slate-300">{a.category_name}</td>
                    <td className="p-3 font-mono text-slate-400">{a.serial_number || 'N/A'}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        a.status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                        a.status === 'ASSIGNED' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                        a.status === 'UNDER_MAINTENANCE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                        a.status === 'RETIRED' || a.status === 'DISPOSED' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                        'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}>
                        {a.status === 'AVAILABLE' ? 'IN STOCK' : a.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {a.assigned_employee_id ? (
                        <div className="font-semibold text-slate-200">
                          {a.employee_first_name} {a.employee_last_name}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button onClick={() => handleViewDetails(a)} className="p-1 text-slate-400 hover:text-cyan-400" title="View Audit Details">
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {isManagerOrAdmin && (
                        <button onClick={() => handleOpenStatusModal(a)} className="p-1 text-slate-400 hover:text-amber-400" title="Update Status (Retire/Dispose/Maintenance)">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}

                      {isManagerOrAdmin && a.status === 'AVAILABLE' && (
                        <button onClick={() => handleOpenAssign(a)} className="px-2 py-0.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 rounded text-[10px] font-bold">
                          Assign
                        </button>
                      )}
                      
                      {isManagerOrAdmin && a.status === 'ASSIGNED' && (
                        <button onClick={() => handleOpenReturn(a)} className="px-2 py-0.5 bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 rounded text-[10px] font-bold">
                          Return
                        </button>
                      )}

                      {canDeleteAssets && (
                        <button onClick={() => handleOpenDelete(a)} className="p-1 text-slate-400 hover:text-rose-400" title="Soft Delete Asset">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredAssets.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-500 italic">No asset inventory records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. MY ASSIGNED COMPANY ASSETS TAB (EMPLOYEE PERSONAL VIEW) */}
      {activeTab === 'MY_ASSETS' && (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Box className="w-4 h-4 text-emerald-400" />
                <span>My Company Assets ({myAssignedAssets.length})</span>
              </h3>
              <p className="text-xs text-slate-400">All company equipment and hardware currently assigned to your profile</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myAssignedAssets.map(a => (
              <div key={a.id} className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3 shadow-md hover:border-slate-700 transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[10px] font-bold text-cyan-400 block">{a.asset_code}</span>
                    <h4 className="font-bold text-slate-100 text-sm">{a.asset_name}</h4>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    {a.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Category:</span>
                    <span className="font-medium text-slate-200">{a.category_name || 'Hardware'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Serial Number:</span>
                    <span className="font-mono text-slate-200">{a.serial_number || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Brand / Model:</span>
                    <span className="text-slate-200">{a.brand || ''} {a.model || ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Assigned Date:</span>
                    <span className="font-mono text-slate-300">{a.assigned_date ? new Date(a.assigned_date).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            ))}

            {myAssignedAssets.length === 0 && (
              <div className="col-span-full p-8 text-center text-slate-500 italic border border-slate-800 rounded-xl">
                No company assets currently assigned to your profile.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. ASSET CATEGORIES TAB */}
      {activeTab === 'CATEGORIES' && (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-cyan-400" />
                <span>Asset Categories ({categories.length})</span>
              </h3>
              <p className="text-xs text-slate-400">Database-backed equipment classifications (Electronic, Hardware, Parts, Machine, etc.)</p>
            </div>

            {canManageCategories && (
              <button
                onClick={handleOpenCategoryModal}
                className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map(c => (
              <div key={c.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm">{c.name}</h4>
                  <span className="font-mono text-[10px] font-bold text-cyan-400 px-2 py-0.5 bg-cyan-950 border border-cyan-800 rounded">{c.code}</span>
                </div>
                <p className="text-xs text-slate-400 min-h-[36px]">{c.description || 'No description provided.'}</p>
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Assets count: <strong className="text-white">{c.total_assets || 0}</strong></span>
                  <span className="text-emerald-400 font-bold">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ASSET REQUESTS TAB (PHASE 4) */}
      {activeTab === 'REQUESTS' && (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Employee Asset Requisitions</span>
            </h3>

            {user?.employeeId && (
              <button
                onClick={handleOpenRequestModal}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition-all flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span>Request Asset</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Request #</th>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Reason / Purpose</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Required Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {assetRequests.map(r => (
                  <tr key={r.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-indigo-400">{r.request_number}</td>
                    <td className="p-3 font-semibold text-slate-200">
                      <div>{r.employee_name}</div>
                      <span className="text-[10px] font-mono text-slate-500">{r.employee_code}</span>
                    </td>
                    <td className="p-3 font-medium text-slate-300">{r.category_name || 'General Hardware'}</td>
                    <td className="p-3 max-w-[250px] truncate text-slate-200">{r.reason}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        r.priority === 'URGENT' ? 'bg-rose-950 text-rose-400 border-rose-800' :
                        r.priority === 'HIGH' ? 'bg-amber-950 text-amber-400 border-amber-800' :
                        'bg-slate-950 text-slate-400 border-slate-800'
                      }`}>
                        {r.priority}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-400">{r.required_date ? new Date(r.required_date).toLocaleDateString() : 'N/A'}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        r.status === 'FULFILLED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                        r.status === 'APPROVED' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                        r.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {isManagerOrAdmin && r.status === 'SUBMITTED' && (
                        <>
                          <button onClick={() => handleApproveRequest(r.id)} className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded text-[10px] font-bold">
                            Approve
                          </button>
                          <button onClick={() => handleRejectRequest(r.id)} className="px-2 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded text-[10px] font-bold">
                            Reject
                          </button>
                        </>
                      )}
                      {isManagerOrAdmin && r.status === 'APPROVED' && (
                        <button onClick={() => handleOpenFulfillModal(r)} className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[10px] font-bold shadow flex items-center gap-1 inline-flex">
                          <span>Fulfill & Assign</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                      {r.status === 'FULFILLED' && r.fulfilled_asset_code && (
                        <span className="text-[10px] font-mono text-emerald-400 font-bold block">Assigned: {r.fulfilled_asset_code}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {assetRequests.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500 italic">No asset requests found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SOFT DELETE CONFIRMATION MODAL */}
      {showDeleteModal && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-rose-400 flex items-center gap-2">
                <AlertOctagon className="w-5 h-5" />
                <span>Confirm Asset Soft-Delete</span>
              </h3>
              <button type="button" onClick={() => setShowDeleteModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 text-xs">
              <div>Asset Code: <strong className="font-mono text-cyan-400">{selectedAsset.asset_code}</strong></div>
              <div>Asset Name: <strong className="text-white">{selectedAsset.asset_name}</strong></div>
              <div>Current Status: <strong className="text-emerald-400">{selectedAsset.status}</strong></div>
              {selectedAsset.assigned_employee_id && (
                <div className="text-rose-400 font-bold">Assigned To: {selectedAsset.employee_first_name} {selectedAsset.employee_last_name}</div>
              )}
            </div>

            {selectedAsset.status === 'ASSIGNED' ? (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Cannot delete an assigned asset. Please return the asset to available stock first.</span>
              </div>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>This action will soft-delete the asset from active inventory. Historical audit logs will be preserved.</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button type="button" onClick={() => setShowDeleteModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium text-xs">Cancel</button>
              <button
                type="button"
                onClick={handleDeleteAsset}
                disabled={selectedAsset.status === 'ASSIGNED'}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold uppercase shadow disabled:opacity-50"
              >
                YES, SOFT-DELETE ASSET
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE STATUS MODAL (RETIRE / DISPOSE / MAINTENANCE / DAMAGED) */}
      {showStatusModal && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-amber-400" />
                <span>Update Asset Status: {selectedAsset.asset_code}</span>
              </h3>
              <button type="button" onClick={() => setShowStatusModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">New Status *</label>
                <select
                  value={statusUpdateForm.status}
                  onChange={e => setStatusUpdateForm({ ...statusUpdateForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-semibold"
                >
                  <option value="AVAILABLE">AVAILABLE (In Stock)</option>
                  <option value="UNDER_MAINTENANCE">UNDER MAINTENANCE</option>
                  <option value="DAMAGED">DAMAGED</option>
                  <option value="LOST">LOST</option>
                  <option value="RETIRED">RETIRED (Decommissioned)</option>
                  <option value="DISPOSED">DISPOSED (Scrapped)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Audit Notes</label>
                <textarea
                  rows={3}
                  value={statusUpdateForm.notes}
                  onChange={e => setStatusUpdateForm({ ...statusUpdateForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="State reason for retiring or changing status..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowStatusModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-bold uppercase shadow">UPDATE STATUS</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CATEGORY MODAL (SUPER_ADMIN / HR_MANAGER) */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-cyan-400" />
                <span>Create Asset Category</span>
              </h3>
              <button type="button" onClick={() => setShowCategoryModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {categoryError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{categoryError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Category Name *</label>
                <input type="text" required value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="e.g. Machine, Electronic, Parts" />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Category Code (Optional)</label>
                <input type="text" value={categoryForm.code} onChange={e => setCategoryForm({ ...categoryForm, code: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono uppercase" placeholder="e.g. CAT-MACHINE" />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Description</label>
                <textarea rows={3} value={categoryForm.description} onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Describe equipment types in this category..." />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowCategoryModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-bold uppercase shadow">CREATE CATEGORY</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER NEW ASSET MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">Add New Asset</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAsset} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Asset Name *</label>
                <input type="text" required value={assetForm.assetName} onChange={e => setAssetForm({ ...assetForm, assetName: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Dell Latitude Laptop / Microscope" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Asset Category *</label>
                  <select value={assetForm.categoryId} onChange={e => setAssetForm({ ...assetForm, categoryId: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-semibold">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Asset Type *</label>
                  <input type="text" required value={assetForm.assetType} onChange={e => setAssetForm({ ...assetForm, assetType: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="HARDWARE / MACHINE / ELECTRONIC" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Serial Number</label>
                  <input type="text" value={assetForm.serialNumber} onChange={e => setAssetForm({ ...assetForm, serialNumber: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono" placeholder="SN-882299" />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Purchase Price (₹)</label>
                  <input type="number" step="0.01" min="0" value={assetForm.purchasePrice} onChange={e => setAssetForm({ ...assetForm, purchasePrice: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono font-bold" placeholder="65000" />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Initial Status *</label>
                <select value={assetForm.assignmentStatus} onChange={e => setAssetForm({ ...assetForm, assignmentStatus: e.target.value as any })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-semibold">
                  <option value="IN_STOCK">In Stock (Available)</option>
                  <option value="ASSIGNED">Assign to Employee</option>
                </select>
              </div>

              {assetForm.assignmentStatus === 'ASSIGNED' && (
                <div className="space-y-3 p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-xl">
                  <div>
                    <label className="block text-cyan-300 mb-1 font-medium">Assign To Employee *</label>
                    <select value={assetForm.assignedEmployeeId} onChange={e => setAssetForm({ ...assetForm, assignedEmployeeId: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-semibold">
                      {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_code})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-cyan-300 mb-1 font-medium">Assignment Date</label>
                    <input type="date" value={assetForm.assignedDate} onChange={e => setAssetForm({ ...assetForm, assignedDate: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono" />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-bold uppercase shadow">REGISTER ASSET</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN ASSET MODAL */}
      {showAssignModal && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">Assign Asset: {selectedAsset.asset_code}</h3>
              <button type="button" onClick={() => setShowAssignModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAssignAsset} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Employee *</label>
                <select value={assignForm.employeeId} onChange={e => setAssignForm({ ...assignForm, employeeId: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-semibold">
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_code})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Assignment Date *</label>
                <input type="date" required value={assignForm.assignedDate} onChange={e => setAssignForm({ ...assignForm, assignedDate: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono" />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowAssignModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-bold uppercase shadow">ASSIGN</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RETURN ASSET MODAL */}
      {showReturnModal && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">Return Asset to Stock</h3>
              <button type="button" onClick={() => setShowReturnModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleReturnAsset} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Returned Date *</label>
                <input type="date" required value={returnForm.returnedDate} onChange={e => setReturnForm({ ...returnForm, returnedDate: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono" />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Return Condition</label>
                <select value={returnForm.condition} onChange={e => setReturnForm({ ...returnForm, condition: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200">
                  <option value="EXCELLENT">EXCELLENT</option>
                  <option value="GOOD">GOOD</option>
                  <option value="FAIR">FAIR</option>
                  <option value="POOR">POOR</option>
                  <option value="DAMAGED">DAMAGED</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowReturnModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-bold uppercase shadow">CONFIRM RETURN</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSET DETAILS & AUDIT HISTORY MODAL */}
      {showDetailsModal && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-cyan-400" />
                <span>{selectedAsset.asset_code} — Details & History</span>
              </h3>
              <button type="button" onClick={() => setShowDetailsModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">ASSET NAME</span>
                <span className="font-bold text-white">{selectedAsset.asset_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">SERIAL NUMBER</span>
                <span className="font-mono text-cyan-400">{selectedAsset.serial_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">STATUS</span>
                <span className="font-semibold text-emerald-400">{selectedAsset.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">ASSIGNED TO</span>
                <span className="font-semibold text-slate-200">{selectedAsset.employee_first_name ? `${selectedAsset.employee_first_name} ${selectedAsset.employee_last_name}` : 'Unassigned'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-xs text-slate-300">Lifecycle Audit History</h4>
              <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-800 rounded-xl p-3 bg-slate-950/60">
                {assetHistory.map(h => (
                  <div key={h.id} className="text-xs p-2 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-bold text-cyan-400 block">{h.action}</span>
                      <span className="text-[10px] text-slate-400">{h.notes || 'Status update'}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                ))}
                {assetHistory.length === 0 && <div className="text-slate-500 text-xs italic text-center p-2">No history records found.</div>}
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button type="button" onClick={() => setShowDetailsModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
