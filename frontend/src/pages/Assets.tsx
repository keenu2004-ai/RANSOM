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

  const [deleteOption, setDeleteOption] = useState<'PERMANENT' | 'SOFT'>('PERMANENT');

  // Delete Handlers (Soft Archive or Permanent Hard Delete)
  const handleOpenDelete = (asset: any) => {
    setSelectedAsset(asset);
    setDeleteOption('PERMANENT');
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const handleDeleteAsset = async () => {
    if (!selectedAsset) return;
    setDeleteError(null);

    try {
      if (deleteOption === 'PERMANENT') {
        await apiFetch(`/assets/${selectedAsset.id}/permanent`, { method: 'DELETE' });
        setSuccessMsg(`Asset '${selectedAsset.asset_code}' permanently deleted from the system.`);
      } else {
        await apiFetch(`/assets/${selectedAsset.id}`, { method: 'DELETE' });
        setSuccessMsg(`Asset '${selectedAsset.asset_code}' archived to inactive inventory.`);
      }
      setShowDeleteModal(false);
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
            <Package className="w-6 h-6 text-[var(--primary)]" />
            <span>Asset Management</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">Enterprise hardware inventory, allocations, self-service requisitions, and audit trail</p>
        </div>

        <div className="flex items-center gap-2">
          {user?.employeeId && (
            <button
              onClick={handleOpenRequestModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[var(--primary)] hover:bg-[var(--primary)] text-white rounded-xl text-xs font-semibold shadow transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Request New Asset</span>
            </button>
          )}

          {canManageCategories && (
            <button
              onClick={handleOpenCategoryModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] rounded-xl text-xs font-semibold transition-all"
            >
              <Plus className="w-4 h-4 text-[var(--primary)]" />
              <span>Add Category</span>
            </button>
          )}

          {isManagerOrAdmin && (
            <>
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] rounded-xl text-xs font-semibold transition-all"
              >
                <FileSpreadsheet className="w-4 h-4 text-[var(--badge-success-text)]" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handleOpenAddAsset}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-semibold text-xs rounded-xl shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Register New Asset</span>
              </button>
            </>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] rounded-xl text-[var(--badge-success-text)] text-xs flex items-center gap-2 shadow">
          <CheckCircle2 className="w-4 h-4 text-[var(--badge-success-text)] shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-1">
          <span className="text-[11px] text-[var(--text-secondary)] font-medium">Total Assets</span>
          <p className="text-xl font-extrabold text-white">{summary?.total_assets || assets.length}</p>
          <span className="text-[10px] text-[var(--text-muted)]">In Database</span>
        </div>

        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-1">
          <span className="text-[11px] text-[var(--text-secondary)] font-medium">In Stock</span>
          <p className="text-xl font-extrabold text-[var(--badge-success-text)]">{summary?.available_count || availableAssetsList.length}</p>
          <span className="text-[10px] text-[var(--text-muted)]">Ready to Assign</span>
        </div>

        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-1">
          <span className="text-[11px] text-[var(--text-secondary)] font-medium">Assigned</span>
          <p className="text-xl font-extrabold text-[var(--primary)]">{summary?.assigned_count || assets.filter(a => a.status === 'ASSIGNED').length}</p>
          <span className="text-[10px] text-[var(--text-muted)]">With Employees</span>
        </div>

        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-1">
          <span className="text-[11px] text-[var(--text-secondary)] font-medium">Requests</span>
          <p className="text-xl font-extrabold text-[var(--secondary)]">{assetRequests.filter(r => r.status === 'SUBMITTED').length}</p>
          <span className="text-[10px] text-[var(--text-muted)]">Pending Review</span>
        </div>

        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-1">
          <span className="text-[11px] text-[var(--text-secondary)] font-medium">Maintenance</span>
          <p className="text-xl font-extrabold text-[var(--badge-warning-text)]">{summary?.maintenance_count || 0}</p>
          <span className="text-[10px] text-[var(--text-muted)]">Under Repair</span>
        </div>

        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-1">
          <span className="text-[11px] text-[var(--text-secondary)] font-medium">Damaged/Lost</span>
          <p className="text-xl font-extrabold text-[var(--action-danger-bg)]">{(summary?.damaged_count || 0) + (summary?.lost_count || 0)}</p>
          <span className="text-[10px] text-[var(--text-muted)]">Attention Req.</span>
        </div>

        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-1">
          <span className="text-[11px] text-[var(--text-secondary)] font-medium">Retired</span>
          <p className="text-xl font-extrabold text-[var(--text-secondary)]">{summary?.retired_count || 0}</p>
          <span className="text-[10px] text-[var(--text-muted)]">Decommissioned</span>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-default)] text-xs font-semibold">
        <button
          onClick={() => setActiveTab('ASSETS')}
          className={`pb-3 px-3 border-b-2 transition-all ${
            activeTab === 'ASSETS' ? 'border-[var(--primary)] text-[var(--primary)] font-bold' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Asset Inventory ({filteredAssets.length})
        </button>

        {user?.employeeId && (
          <button
            onClick={() => setActiveTab('MY_ASSETS')}
            className={`pb-3 px-3 border-b-2 transition-all ${
              activeTab === 'MY_ASSETS' ? 'border-[var(--badge-success-border)] text-[var(--badge-success-text)] font-bold' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            My Assigned Company Assets ({myAssignedAssets.length})
          </button>
        )}

        <button
          onClick={() => setActiveTab('REQUESTS')}
          className={`pb-3 px-3 border-b-2 transition-all ${
            activeTab === 'REQUESTS' ? 'border-[var(--primary)] text-[var(--secondary)] font-bold' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Asset Requests ({assetRequests.length})
        </button>

        {isManagerOrAdmin && (
          <button
            onClick={() => setActiveTab('CATEGORIES')}
            className={`pb-3 px-3 border-b-2 transition-all ${
              activeTab === 'CATEGORIES' ? 'border-[var(--primary)] text-[var(--primary)] font-bold' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Asset Categories ({categories.length})
          </button>
        )}
      </div>

      {/* 1. ASSETS INVENTORY TAB */}
      {activeTab === 'ASSETS' && (
        <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search asset code, name, serial number, employee..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-xs text-[var(--text-heading)] placeholder-[var(--text-muted)]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-xs text-[var(--text-primary)]"
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
                className="px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-xs text-[var(--text-primary)]"
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-[var(--border-default)] rounded-xl">
            <table className="w-full text-left text-xs text-[var(--text-primary)]">
              <thead className="bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] uppercase font-semibold text-[10px] border-b border-[var(--border-default)]">
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
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredAssets.map(a => (
                  <tr key={a.id} className="hover:bg-[var(--bg-surface-muted)]">
                    <td className="p-3 font-mono font-bold text-[var(--primary)]">{a.asset_code}</td>
                    <td className="p-3 font-bold text-white">{a.asset_name}</td>
                    <td className="p-3 text-[var(--text-primary)]">{a.category_name}</td>
                    <td className="p-3 font-mono text-[var(--text-secondary)]">{a.serial_number || 'N/A'}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        a.status === 'AVAILABLE' ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border-[var(--badge-success-border)]' :
                        a.status === 'ASSIGNED' ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30' :
                        a.status === 'UNDER_MAINTENANCE' ? 'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border-[var(--badge-warning-border)]' :
                        a.status === 'RETIRED' || a.status === 'DISPOSED' ? 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border-[var(--border-default)]' :
                        'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border-[var(--action-danger-bg)]/30'
                      }`}>
                        {a.status === 'AVAILABLE' ? 'IN STOCK' : a.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {a.assigned_employee_id ? (
                        <div className="font-semibold text-[var(--text-primary)]">
                          {a.employee_first_name} {a.employee_last_name}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] italic">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button onClick={() => handleViewDetails(a)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--primary)]" title="View Audit Details">
                        <Eye className="w-4 h-4" />
                      </button>

                      {isManagerOrAdmin && (
                        <button onClick={() => handleOpenStatusModal(a)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--badge-warning-text)]" title="Update Status (Retire/Dispose/Maintenance)">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}

                      {isManagerOrAdmin && a.status === 'AVAILABLE' && (
                        <button onClick={() => handleOpenAssign(a)} className="px-2 py-0.5 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] border border-[var(--primary)] text-[var(--primary)] rounded text-[10px] font-bold">
                          Assign
                        </button>
                      )}

                      {isManagerOrAdmin && a.status === 'ASSIGNED' && (
                        <button onClick={() => handleOpenReturn(a)} className="px-2 py-0.5 bg-[var(--badge-warning-bg)] hover:bg-amber-900 border border-[var(--badge-warning-border)] text-[var(--badge-warning-text)] rounded text-[10px] font-bold">
                          Return
                        </button>
                      )}

                      {canDeleteAssets && (
                        <button onClick={() => handleOpenDelete(a)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--action-danger-bg)]" title="Soft Delete Asset">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredAssets.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-[var(--text-muted)] italic">No asset inventory records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. MY ASSIGNED COMPANY ASSETS TAB (EMPLOYEE PERSONAL VIEW) */}
      {activeTab === 'MY_ASSETS' && (
        <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Box className="w-4 h-4 text-[var(--badge-success-text)]" />
                <span>My Company Assets ({myAssignedAssets.length})</span>
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">All company equipment and hardware currently assigned to your profile</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myAssignedAssets.map(a => (
              <div key={a.id} className="p-4 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl space-y-3 shadow-md hover:border-[var(--border-default)] transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[10px] font-bold text-[var(--primary)] block">{a.asset_code}</span>
                    <h4 className="font-bold text-[var(--text-heading)] text-sm">{a.asset_name}</h4>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30">
                    {a.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-[var(--text-primary)] pt-2 border-t border-[var(--border-default)]">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Category:</span>
                    <span className="font-medium text-[var(--text-primary)]">{a.category_name || 'Hardware'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Serial Number:</span>
                    <span className="font-mono text-[var(--text-primary)]">{a.serial_number || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Brand / Model:</span>
                    <span className="text-[var(--text-primary)]">{a.brand || ''} {a.model || ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Assigned Date:</span>
                    <span className="font-mono text-[var(--text-primary)]">{a.assigned_date ? new Date(a.assigned_date).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            ))}

            {myAssignedAssets.length === 0 && (
              <div className="col-span-full p-8 text-center text-[var(--text-muted)] italic border border-[var(--border-default)] rounded-xl">
                No company assets currently assigned to your profile.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. ASSET CATEGORIES TAB */}
      {activeTab === 'CATEGORIES' && (
        <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-[var(--primary)]" />
                <span>Asset Categories ({categories.length})</span>
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">Database-backed equipment classifications (Electronic, Hardware, Parts, Machine, etc.)</p>
            </div>

            {canManageCategories && (
              <button
                onClick={handleOpenCategoryModal}
                className="px-3.5 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl text-xs font-semibold shadow transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map(c => (
              <div key={c.id} className="p-4 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm">{c.name}</h4>
                  <span className="font-mono text-[10px] font-bold text-[var(--primary)] px-2 py-0.5 bg-[var(--bg-surface-muted)] border border-[var(--primary)] rounded">{c.code}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] min-h-[36px]">{c.description || 'No description provided.'}</p>
                <div className="pt-2 border-t border-[var(--border-default)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                  <span>Assets count: <strong className="text-white">{c.total_assets || 0}</strong></span>
                  <span className="text-[var(--badge-success-text)] font-bold">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ASSET REQUESTS TAB (PHASE 4) */}
      {activeTab === 'REQUESTS' && (
        <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--secondary)]" />
              <span>Employee Asset Requisitions</span>
            </h3>

            {user?.employeeId && (
              <button
                onClick={handleOpenRequestModal}
                className="px-3 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary)] text-white rounded-xl text-xs font-semibold shadow transition-all flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span>Request Asset</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-[var(--border-default)] rounded-xl">
            <table className="w-full text-left text-xs text-[var(--text-primary)]">
              <thead className="bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] uppercase font-semibold text-[10px] border-b border-[var(--border-default)]">
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
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {assetRequests.map(r => (
                  <tr key={r.id} className="hover:bg-[var(--bg-surface-muted)]">
                    <td className="p-3 font-mono font-bold text-[var(--secondary)]">{r.request_number}</td>
                    <td className="p-3 font-semibold text-[var(--text-primary)]">
                      <div>{r.employee_name}</div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">{r.employee_code}</span>
                    </td>
                    <td className="p-3 font-medium text-[var(--text-primary)]">{r.category_name || 'General Hardware'}</td>
                    <td className="p-3 max-w-[250px] truncate text-[var(--text-primary)]">{r.reason}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        r.priority === 'URGENT' ? 'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border-[var(--action-danger-bg)]/30' :
                        r.priority === 'HIGH' ? 'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border-[var(--badge-warning-border)]' :
                        'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border-[var(--border-default)]'
                      }`}>
                        {r.priority}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[var(--text-secondary)]">{r.required_date ? new Date(r.required_date).toLocaleDateString() : 'N/A'}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        r.status === 'FULFILLED' ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border-[var(--badge-success-border)]' :
                        r.status === 'APPROVED' ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30' :
                        r.status === 'REJECTED' ? 'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border-[var(--action-danger-bg)]/30' :
                        'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border-[var(--badge-warning-border)]'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {isManagerOrAdmin && r.status === 'SUBMITTED' && (
                        <>
                          <button onClick={() => handleApproveRequest(r.id)} className="px-2 py-1 bg-[var(--badge-success-bg)] hover:bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] text-[var(--badge-success-text)] rounded text-[10px] font-bold">
                            Approve
                          </button>
                          <button onClick={() => handleRejectRequest(r.id)} className="px-2 py-1 bg-[var(--action-danger-soft)] hover:bg-rose-900 border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] rounded text-[10px] font-bold">
                            Reject
                          </button>
                        </>
                      )}
                      {isManagerOrAdmin && r.status === 'APPROVED' && (
                        <button onClick={() => handleOpenFulfillModal(r)} className="px-2.5 py-1 bg-[var(--primary)] hover:bg-[var(--primary)] text-white rounded text-[10px] font-bold shadow flex items-center gap-1 inline-flex">
                          <span>Fulfill & Assign</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                      {r.status === 'FULFILLED' && r.fulfilled_asset_code && (
                        <span className="text-[10px] font-mono text-[var(--badge-success-text)] font-bold block">Assigned: {r.fulfilled_asset_code}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {assetRequests.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-[var(--text-muted)] italic">No asset requests found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PERMANENT / SOFT DELETE CONFIRMATION MODAL */}
      {showDeleteModal && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-surface-muted)] backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[var(--border-default)] pb-3">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-[var(--action-danger-soft)] text-rose-500 rounded-full border border-[var(--action-danger-bg)]/30 shrink-0">
                  <AlertOctagon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[var(--action-danger-bg)]">
                    Delete Asset Permanently?
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                    This will permanently delete the asset from the system. This action cannot be undone.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowDeleteModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {deleteError && (
              <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--action-danger-bg)] shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Asset Identity Box */}
            <div className="p-3.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Asset Code:</span>
                <strong className="font-mono text-[var(--primary)]">{selectedAsset.asset_code}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Asset Name:</span>
                <strong className="text-white">{selectedAsset.asset_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Current Status:</span>
                <strong className="text-[var(--badge-success-text)]">{selectedAsset.status}</strong>
              </div>
              {selectedAsset.assigned_employee_id && (
                <div className="flex justify-between text-[var(--action-danger-bg)] font-bold pt-1 border-t border-[var(--border-default)]">
                  <span>Assigned To:</span>
                  <span>{selectedAsset.employee_first_name} {selectedAsset.employee_last_name}</span>
                </div>
              )}
            </div>

            {/* Choose Delete Option */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[var(--text-primary)]">Choose Delete Option:</label>

              {/* Option 1: Permanently Delete */}
              <div
                onClick={() => setDeleteOption('PERMANENT')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  deleteOption === 'PERMANENT'
                    ? 'bg-[var(--action-danger-soft)] border-[var(--action-danger-bg)]/30 ring-2 ring-1 ring-[var(--primary)]/30'
                    : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-default)]'
                }`}
              >
                <div className={`p-2 rounded-xl border shrink-0 ${
                  deleteOption === 'PERMANENT' ? 'bg-[var(--action-danger-bg)] text-white border-[var(--action-danger-bg)]/30' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)]'
                }`}>
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className={`text-xs font-bold ${deleteOption === 'PERMANENT' ? 'text-[var(--action-danger-bg)]' : 'text-[var(--text-primary)]'}`}>
                    Permanently Delete
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    Remove this asset from the system completely (cannot be recovered)
                  </div>
                </div>
                <input
                  type="radio"
                  name="delete_opt"
                  checked={deleteOption === 'PERMANENT'}
                  onChange={() => setDeleteOption('PERMANENT')}
                  className="mt-1 accent-rose-600"
                />
              </div>

              {/* Option 2: Soft Delete (Archive) */}
              <div
                onClick={() => setDeleteOption('SOFT')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  deleteOption === 'SOFT'
                    ? 'bg-[var(--secondary)]/15 border-[var(--primary)] ring-2 ring-1 ring-[var(--primary)]/30'
                    : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-default)]'
                }`}
              >
                <div className={`p-2 rounded-xl border shrink-0 ${
                  deleteOption === 'SOFT' ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)]'
                }`}>
                  <Box className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className={`text-xs font-bold ${deleteOption === 'SOFT' ? 'text-[var(--secondary)]' : 'text-[var(--text-primary)]'}`}>
                    Soft Delete (Archive)
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    Move to inactive inventory (can be restored later)
                  </div>
                </div>
                <input
                  type="radio"
                  name="delete_opt"
                  checked={deleteOption === 'SOFT'}
                  onChange={() => setDeleteOption('SOFT')}
                  className="mt-1 accent-[var(--primary)]"
                />
              </div>
            </div>

            {selectedAsset.status === 'ASSIGNED' && (
              <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[var(--action-danger-bg)] shrink-0" />
                <span>Cannot delete an assigned asset. Return the asset to available stock first.</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded-xl font-medium text-xs transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAsset}
                disabled={selectedAsset.status === 'ASSIGNED'}
                className="px-5 py-2 bg-[var(--action-danger-bg)] hover:bg-[var(--action-danger-bg)] text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              >
                {deleteOption === 'PERMANENT' ? 'Delete Permanently' : 'Archive Asset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE STATUS MODAL (RETIRE / DISPOSE / MAINTENANCE / DAMAGED) */}
      {showStatusModal && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[var(--badge-warning-text)]" />
                <span>Update Asset Status: {selectedAsset.asset_code}</span>
              </h3>
              <button type="button" onClick={() => setShowStatusModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">New Status *</label>
                <select
                  value={statusUpdateForm.status}
                  onChange={e => setStatusUpdateForm({ ...statusUpdateForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-semibold"
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
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Audit Notes</label>
                <textarea
                  rows={3}
                  value={statusUpdateForm.notes}
                  onChange={e => setStatusUpdateForm({ ...statusUpdateForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]"
                  placeholder="State reason for retiring or changing status..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
                <button type="button" onClick={() => setShowStatusModal(false)} className="px-4 py-2 bg-[var(--bg-surface-muted)] text-[var(--text-primary)] rounded-xl font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[var(--badge-warning-bg)] hover:bg-amber-400 text-white rounded-xl font-bold uppercase shadow">UPDATE STATUS</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CATEGORY MODAL (SUPER_ADMIN / HR_MANAGER) */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-[var(--primary)]" />
                <span>Create Asset Category</span>
              </h3>
              <button type="button" onClick={() => setShowCategoryModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {categoryError && (
              <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--action-danger-bg)] shrink-0" />
                <span>{categoryError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Category Name *</label>
                <input type="text" required value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="e.g. Machine, Electronic, Parts" />
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Category Code (Optional)</label>
                <input type="text" value={categoryForm.code} onChange={e => setCategoryForm({ ...categoryForm, code: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono uppercase" placeholder="e.g. CAT-MACHINE" />
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Description</label>
                <textarea rows={3} value={categoryForm.description} onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="Describe equipment types in this category..." />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
                <button type="button" onClick={() => setShowCategoryModal(false)} className="px-4 py-2 bg-[var(--bg-surface-muted)] text-[var(--text-primary)] rounded-xl font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl font-bold uppercase shadow">CREATE CATEGORY</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER NEW ASSET MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-lg text-white">Add New Asset</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--action-danger-bg)] shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAsset} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Asset Name *</label>
                <input type="text" required value={assetForm.assetName} onChange={e => setAssetForm({ ...assetForm, assetName: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="Dell Latitude Laptop / Microscope" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Asset Category *</label>
                  <select value={assetForm.categoryId} onChange={e => setAssetForm({ ...assetForm, categoryId: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-semibold">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Asset Type *</label>
                  <input type="text" required value={assetForm.assetType} onChange={e => setAssetForm({ ...assetForm, assetType: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="HARDWARE / MACHINE / ELECTRONIC" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Serial Number</label>
                  <input type="text" value={assetForm.serialNumber} onChange={e => setAssetForm({ ...assetForm, serialNumber: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono" placeholder="SN-882299" />
                </div>
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Purchase Price (₹)</label>
                  <input type="number" step="0.01" min="0" value={assetForm.purchasePrice} onChange={e => setAssetForm({ ...assetForm, purchasePrice: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono font-bold" placeholder="65000" />
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Initial Status *</label>
                <select value={assetForm.assignmentStatus} onChange={e => setAssetForm({ ...assetForm, assignmentStatus: e.target.value as any })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-semibold">
                  <option value="IN_STOCK">In Stock (Available)</option>
                  <option value="ASSIGNED">Assign to Employee</option>
                </select>
              </div>

              {assetForm.assignmentStatus === 'ASSIGNED' && (
                <div className="space-y-3 p-3 bg-[var(--badge-info-bg)] border border-[var(--primary)]/30 rounded-xl">
                  <div>
                    <label className="block text-[var(--primary)] mb-1 font-medium">Assign To Employee *</label>
                    <select value={assetForm.assignedEmployeeId} onChange={e => setAssetForm({ ...assetForm, assignedEmployeeId: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-semibold">
                      {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_code})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[var(--primary)] mb-1 font-medium">Assignment Date</label>
                    <input type="date" value={assetForm.assignedDate} onChange={e => setAssetForm({ ...assetForm, assignedDate: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono" />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-[var(--bg-surface-muted)] text-[var(--text-primary)] rounded-xl font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl font-bold uppercase shadow">REGISTER ASSET</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN ASSET MODAL */}
      {showAssignModal && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-lg text-white">Assign Asset: {selectedAsset.asset_code}</h3>
              <button type="button" onClick={() => setShowAssignModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAssignAsset} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Employee *</label>
                <select value={assignForm.employeeId} onChange={e => setAssignForm({ ...assignForm, employeeId: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-semibold">
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_code})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Assignment Date *</label>
                <input type="date" required value={assignForm.assignedDate} onChange={e => setAssignForm({ ...assignForm, assignedDate: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono" />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
                <button type="button" onClick={() => setShowAssignModal(false)} className="px-4 py-2 bg-[var(--bg-surface-muted)] text-[var(--text-primary)] rounded-xl font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl font-bold uppercase shadow">ASSIGN</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RETURN ASSET MODAL */}
      {showReturnModal && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-lg text-white">Return Asset to Stock</h3>
              <button type="button" onClick={() => setShowReturnModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleReturnAsset} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Returned Date *</label>
                <input type="date" required value={returnForm.returnedDate} onChange={e => setReturnForm({ ...returnForm, returnedDate: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono" />
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Return Condition</label>
                <select value={returnForm.condition} onChange={e => setReturnForm({ ...returnForm, condition: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]">
                  <option value="EXCELLENT">EXCELLENT</option>
                  <option value="GOOD">GOOD</option>
                  <option value="FAIR">FAIR</option>
                  <option value="POOR">POOR</option>
                  <option value="DAMAGED">DAMAGED</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
                <button type="button" onClick={() => setShowReturnModal(false)} className="px-4 py-2 bg-[var(--bg-surface-muted)] text-[var(--text-primary)] rounded-xl font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[var(--badge-warning-bg)] hover:bg-amber-400 text-white rounded-xl font-bold uppercase shadow">CONFIRM RETURN</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSET DETAILS & AUDIT HISTORY MODAL */}
      {showDetailsModal && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-[var(--primary)]" />
                <span>{selectedAsset.asset_code} — Details & History</span>
              </h3>
              <button type="button" onClick={() => setShowDetailsModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--bg-surface-muted)] rounded-xl text-xs">
              <div>
                <span className="text-[var(--text-secondary)] block text-[10px]">ASSET NAME</span>
                <span className="font-bold text-white">{selectedAsset.asset_name}</span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)] block text-[10px]">SERIAL NUMBER</span>
                <span className="font-mono text-[var(--primary)]">{selectedAsset.serial_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)] block text-[10px]">STATUS</span>
                <span className="font-semibold text-[var(--badge-success-text)]">{selectedAsset.status}</span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)] block text-[10px]">ASSIGNED TO</span>
                <span className="font-semibold text-[var(--text-primary)]">{selectedAsset.employee_first_name ? `${selectedAsset.employee_first_name} ${selectedAsset.employee_last_name}` : 'Unassigned'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-xs text-[var(--text-primary)]">Lifecycle Audit History</h4>
              <div className="max-h-48 overflow-y-auto space-y-2 border border-[var(--border-default)] rounded-xl p-3 bg-[var(--bg-surface-muted)]">
                {assetHistory.map(h => (
                  <div key={h.id} className="text-xs p-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[var(--primary)] block">{h.action}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">{h.notes || 'Status update'}</span>
                    </div>
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                ))}
                {assetHistory.length === 0 && <div className="text-[var(--text-muted)] text-xs italic text-center p-2">No history records found.</div>}
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-[var(--border-default)]">
              <button type="button" onClick={() => setShowDetailsModal(false)} className="px-4 py-2 bg-[var(--bg-surface-muted)] text-[var(--text-primary)] rounded-xl text-xs font-medium">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
