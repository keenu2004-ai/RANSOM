import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { 
  Package, Plus, Search, Filter, Wrench, RefreshCw, UserCheck, 
  RotateCcw, History, FileSpreadsheet, ShieldAlert, CheckCircle2, 
  AlertTriangle, Clock, X, Edit3, Trash2, Tag, Calendar, User, DollarSign,
  Info, Box, Shield, WrenchIcon, Layers, FileText, ChevronRight, Eye
} from 'lucide-react';

export const Assets: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ASSETS' | 'CATEGORIES'>('ASSETS');

  const [assets, setAssets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
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
  const [showMaintModal, setShowMaintModal] = useState(false);

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

  const [maintForm, setMaintForm] = useState({
    maintenanceType: 'REPAIR',
    vendor: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    cost: 0,
    description: ''
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    code: '',
    description: ''
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isManagerOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, catsRes, assetsRes, empRes] = await Promise.all([
        apiFetch('/assets/summary').catch(() => ({ data: null })),
        apiFetch('/assets/categories').catch(() => ({ data: [] })),
        apiFetch('/assets').catch(() => ({ data: { assets: [] } })),
        apiFetch('/employees').catch(() => ({ employees: [] }))
      ]);

      setSummary(sumRes.data || null);
      const fetchedCats = catsRes.data || [];
      setCategories(fetchedCats);
      setAssets(assetsRes.data?.assets || []);
      setEmployees(empRes.employees || []);

      // If form has no category selected yet, set first category ID
      if (fetchedCats.length > 0) {
        setAssetForm(prev => prev.categoryId ? prev : { ...prev, categoryId: fetchedCats[0].id });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenAddAsset = () => {
    setFormError(null);
    setAssetForm({
      assetName: '',
      assetType: 'Laptop',
      serialNumber: '',
      price: 0,
      assignmentStatus: 'IN_STOCK',
      assignedEmployeeId: employees.length > 0 ? employees[0].id : '',
      assignedDate: new Date().toISOString().split('T')[0]
    } as any);
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
        serialNumber: assetForm.serialNumber ? assetForm.serialNumber.trim() : undefined,
        price: Number((assetForm as any).price) || 0,
        assignmentStatus: assetForm.assignmentStatus
      };

      if (assetForm.assignmentStatus === 'ASSIGNED') {
        payload.assignedEmployeeId = assetForm.assignedEmployeeId;
        payload.assignedDate = assetForm.assignedDate;
      } else {
        payload.assignedEmployeeId = null;
      }

      await apiFetch('/assets', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowAddModal(false);
      setSuccessMsg(assetForm.assignmentStatus === 'ASSIGNED' 
        ? 'Asset added and assigned successfully.' 
        : 'Asset added successfully and placed in stock.');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to add asset.');
    }
  };

  const handleCreateCategoryFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError(null);
    if (!categoryForm.name || !categoryForm.code) {
      setCategoryError('Category Name and Code are required.');
      return;
    }

    try {
      const res = await apiFetch('/assets/categories', {
        method: 'POST',
        body: JSON.stringify(categoryForm)
      });
      const newCategory = res.data;

      // Refresh categories list
      const catsRes = await apiFetch('/assets/categories');
      const updatedCats = catsRes.data || [];
      setCategories(updatedCats);

      // Automatically select the newly created category in asset form
      if (newCategory?.id) {
        setAssetForm(prev => ({ ...prev, categoryId: newCategory.id }));
      }

      setShowCategoryModal(false);
      setCategoryForm({ name: '', code: '', description: '' });
      setSuccessMsg(`Category '${newCategory.name}' created and selected.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setCategoryError(err.message || 'Failed to create asset category.');
    }
  };

  const handleAssignAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setFormError(null);
    try {
      await apiFetch(`/assets/${selectedAsset.id}/assign`, {
        method: 'POST',
        body: JSON.stringify(assignForm)
      });
      setShowAssignModal(false);
      setSelectedAsset(null);
      setSuccessMsg('Asset allocated to employee successfully.');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to assign asset.');
    }
  };

  const handleReturnAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setFormError(null);
    try {
      await apiFetch(`/assets/${selectedAsset.id}/return`, {
        method: 'POST',
        body: JSON.stringify(returnForm)
      });
      setShowReturnModal(false);
      setSelectedAsset(null);
      setSuccessMsg('Asset returned to available stock.');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to process return.');
    }
  };

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setFormError(null);
    try {
      await apiFetch(`/assets/${selectedAsset.id}/maintenance`, {
        method: 'POST',
        body: JSON.stringify(maintForm)
      });
      setShowMaintModal(false);
      setSelectedAsset(null);
      setSuccessMsg('Maintenance ticket logged. Asset status set to UNDER_MAINTENANCE.');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to log maintenance.');
    }
  };

  const openAssetDetails = async (asset: any) => {
    setSelectedAsset(asset);
    try {
      const histRes = await apiFetch(`/assets/${asset.id}/history`);
      setAssetHistory(histRes.data || []);
      setShowDetailsModal(true);
    } catch (err: any) {
      console.error(err);
      setShowDetailsModal(true);
    }
  };

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      let matchesStatus = true;
      if (statusFilter === 'IN_STOCK') {
        matchesStatus = !a.assigned_employee_id && a.status === 'AVAILABLE';
      } else if (statusFilter) {
        matchesStatus = a.status === statusFilter;
      }

      const matchesSearch = !searchTerm || (
        a.asset_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.serial_number && a.serial_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.employee_first_name && `${a.employee_first_name} ${a.employee_last_name}`.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      const matchesCategory = !categoryFilter || a.category_id === categoryFilter;
      const matchesCondition = !conditionFilter || a.condition === conditionFilter;

      return matchesStatus && matchesSearch && matchesCategory && matchesCondition;
    });
  }, [assets, searchTerm, statusFilter, categoryFilter, conditionFilter]);

  const exportCSV = () => {
    const headers = ['Asset Code', 'Asset Name', 'Category', 'Status', 'Condition', 'Assigned Employee', 'Purchase Price', 'Current Value', 'Serial Number'];
    const rows = filteredAssets.map(a => [
      a.asset_code,
      a.asset_name,
      a.category_name,
      a.status,
      a.condition,
      a.employee_first_name ? `${a.employee_first_name} ${a.employee_last_name} (${a.employee_code})` : 'Unassigned',
      a.purchase_price,
      a.current_value,
      a.serial_number || 'N/A'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Asset_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (asset: any) => {
    if (!asset.assigned_employee_id && asset.status === 'AVAILABLE') {
      return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60">IN STOCK</span>;
    }
    switch (asset.status) {
      case 'ASSIGNED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/60">ASSIGNED</span>;
      case 'UNDER_MAINTENANCE':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-400 border border-amber-800/60">MAINTENANCE</span>;
      case 'DAMAGED':
      case 'LOST':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 text-rose-400 border border-rose-800/60">{asset.status}</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">{asset.status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-cyan-400" />
            <span>Asset Management</span>
          </h1>
          <p className="text-xs text-slate-400">Enterprise hardware inventory, stock management, allocations, and lifecycle audit log</p>
        </div>

        {isManagerOrAdmin && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2 shadow">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* KPI Cards — Derived Stock Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Total Assets</span>
          <p className="text-xl font-extrabold text-white">{summary?.total_assets || 0}</p>
          <span className="text-[10px] text-cyan-400 font-mono">Valuation: ₹{(Number(summary?.total_current_value || 0)).toLocaleString()}</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Assigned</span>
          <p className="text-xl font-extrabold text-cyan-400">{summary?.assigned_count || 0}</p>
          <span className="text-[10px] text-slate-500">With employees</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">In Stock</span>
          <p className="text-xl font-extrabold text-emerald-400">{summary?.in_stock_count || summary?.available_count || 0}</p>
          <span className="text-[10px] text-slate-500">Unassigned pool</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Under Maintenance</span>
          <p className="text-xl font-extrabold text-amber-400">{summary?.maintenance_count || 0}</p>
          <span className="text-[10px] text-slate-500">In service</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Damaged / Lost</span>
          <p className="text-xl font-extrabold text-rose-400">{(summary?.damaged_count || 0) + (summary?.lost_count || 0)}</p>
          <span className="text-[10px] text-slate-500">Requires review</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Retired</span>
          <p className="text-xl font-extrabold text-slate-400">{summary?.retired_count || 0}</p>
          <span className="text-[10px] text-slate-500">Decommissioned</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Disposed</span>
          <p className="text-xl font-extrabold text-slate-500">{summary?.disposed_count || 0}</p>
          <span className="text-[10px] text-slate-600">Written off</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('ASSETS')}
          className={`pb-3 px-2 border-b-2 transition-all ${
            activeTab === 'ASSETS' ? 'border-cyan-400 text-cyan-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Asset Inventory & Stock ({filteredAssets.length})
        </button>
        <button
          onClick={() => setActiveTab('CATEGORIES')}
          className={`pb-3 px-2 border-b-2 transition-all ${
            activeTab === 'CATEGORIES' ? 'border-cyan-400 text-cyan-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Asset Categories Matrix ({categories.length})
        </button>
      </div>

      {activeTab === 'ASSETS' && (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search asset code, asset name, serial number, employee name..."
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
                <option value="IN_STOCK">In Stock (Unassigned)</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                <option value="DAMAGED">Damaged</option>
                <option value="LOST">Lost</option>
                <option value="RETIRED">Retired</option>
                <option value="DISPOSED">Disposed</option>
              </select>

              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300"
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={conditionFilter}
                onChange={e => setConditionFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300"
              >
                <option value="">All Conditions</option>
                <option value="NEW">NEW</option>
                <option value="EXCELLENT">EXCELLENT</option>
                <option value="GOOD">GOOD</option>
                <option value="FAIR">FAIR</option>
                <option value="POOR">POOR</option>
                <option value="DAMAGED">DAMAGED</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Asset Code & Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Brand / Model</th>
                  <th className="p-3">Serial Number</th>
                  <th className="p-3">Assigned Employee</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Condition</th>
                  <th className="p-3">Valuation (₹)</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredAssets.map(asset => (
                  <tr key={asset.id} className="hover:bg-slate-800/40 transition-all">
                    <td className="p-3">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{asset.asset_code}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{asset.asset_name}</div>
                    </td>
                    <td className="p-3 font-medium text-slate-300">{asset.category_name}</td>
                    <td className="p-3">
                      <span className="text-slate-200">{asset.brand || '-'}</span>
                      {asset.model && <span className="text-slate-500 block text-[10px]">{asset.model}</span>}
                    </td>
                    <td className="p-3 font-mono text-slate-400 text-[11px]">{asset.serial_number || '-'}</td>
                    <td className="p-3">
                      {asset.employee_first_name ? (
                        <div>
                          <div className="font-semibold text-cyan-400">{asset.employee_first_name} {asset.employee_last_name}</div>
                          <span className="text-[10px] text-slate-500 font-mono">{asset.employee_code}</span>
                        </div>
                      ) : (
                        <span className="text-emerald-400 font-semibold text-[11px] italic">In Stock</span>
                      )}
                    </td>
                    <td className="p-3">{getStatusBadge(asset)}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded font-mono text-[10px]">
                        {asset.condition}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-200">
                      ₹{Number(asset.current_value || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => openAssetDetails(asset)}
                        className="p-1 text-slate-400 hover:text-cyan-400"
                        title="View Asset Details & History"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {isManagerOrAdmin && asset.status === 'AVAILABLE' && (
                        <button
                          onClick={() => {
                            setSelectedAsset(asset);
                            setAssignForm({
                              employeeId: employees[0]?.id || '',
                              assignedDate: new Date().toISOString().split('T')[0],
                              expectedReturnDate: '',
                              condition: asset.condition || 'EXCELLENT',
                              notes: ''
                            });
                            setShowAssignModal(true);
                          }}
                          className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 rounded-lg text-[10px] font-bold"
                          title="Assign to Employee"
                        >
                          Assign
                        </button>
                      )}

                      {isManagerOrAdmin && asset.status === 'ASSIGNED' && (
                        <button
                          onClick={() => {
                            setSelectedAsset(asset);
                            setReturnForm({
                              returnedDate: new Date().toISOString().split('T')[0],
                              condition: asset.condition || 'GOOD',
                              notes: ''
                            });
                            setShowReturnModal(true);
                          }}
                          className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 rounded-lg text-[10px] font-bold"
                          title="Process Return"
                        >
                          Return
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredAssets.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500 italic">
                      No assets found matching the specified filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'CATEGORIES' && (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white">Asset Categories Matrix</h3>
            {isManagerOrAdmin && (
              <button
                onClick={() => setShowCategoryModal(true)}
                className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-xs rounded-xl shadow"
              >
                + Add Category
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map(c => (
              <div key={c.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white">{c.name}</h4>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">{c.code}</span>
                </div>
                <p className="text-xs text-slate-400">{c.description || 'Standard hardware category'}</p>
                <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono flex items-center justify-between">
                  <span>Total Registered Assets:</span>
                  <span className="font-bold text-slate-200">{c.total_assets || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SIMPLE ADD NEW ASSET MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">Add New Asset</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
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
                <input
                  type="text"
                  required
                  value={assetForm.assetName}
                  onChange={e => setAssetForm({ ...assetForm, assetName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="Dell Latitude Laptop"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Asset Type *</label>
                <select
                  required
                  value={assetForm.assetType}
                  onChange={e => setAssetForm({ ...assetForm, assetType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  <option value="Laptop">Laptop</option>
                  <option value="Desktop">Desktop</option>
                  <option value="Monitor">Monitor</option>
                  <option value="Mobile">Mobile</option>
                  <option value="Tablet">Tablet</option>
                  <option value="Keyboard">Keyboard</option>
                  <option value="Mouse">Mouse</option>
                  <option value="Headset">Headset</option>
                  <option value="Printer">Printer</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Vehicle">Vehicle</option>
                  <option value="ID Card">ID Card</option>
                  <option value="Access Card">Access Card</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Serial Number</label>
                <input
                  type="text"
                  value={assetForm.serialNumber || ''}
                  onChange={e => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                  placeholder="SN-987654 (Optional)"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Asset Price (₹)</label>
                <input
                  type="number"
                  value={(assetForm as any).price || ''}
                  onChange={e => setAssetForm({ ...assetForm, price: parseFloat(e.target.value) || 0 } as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                  placeholder="55000 (Optional)"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-3">
                <label className="block text-slate-300 font-bold">Asset Status</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-200">
                    <input
                      type="radio"
                      name="assignmentStatus"
                      value="IN_STOCK"
                      checked={assetForm.assignmentStatus === 'IN_STOCK'}
                      onChange={() => setAssetForm({ ...assetForm, assignmentStatus: 'IN_STOCK' })}
                      className="w-4 h-4 text-cyan-500"
                    />
                    <span>In Stock</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-200">
                    <input
                      type="radio"
                      name="assignmentStatus"
                      value="ASSIGNED"
                      checked={assetForm.assignmentStatus === 'ASSIGNED'}
                      onChange={() => setAssetForm({ ...assetForm, assignmentStatus: 'ASSIGNED' })}
                      className="w-4 h-4 text-cyan-500"
                    />
                    <span>Assign to Employee</span>
                  </label>
                </div>

                {assetForm.assignmentStatus === 'ASSIGNED' && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-slate-300 mb-1 font-medium">Employee *</label>
                      <select
                        required
                        value={assetForm.assignedEmployeeId || ''}
                        onChange={e => setAssetForm({ ...assetForm, assignedEmployeeId: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                      >
                        <option value="">Select Employee...</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name} ({emp.employee_code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1 font-medium">Assignment Date</label>
                      <input
                        type="date"
                        value={assetForm.assignedDate || new Date().toISOString().split('T')[0]}
                        onChange={e => setAssetForm({ ...assetForm, assignedDate: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                )}
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
                  Add Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CATEGORY MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">Create Asset Category</h3>
              <button type="button" onClick={() => setShowCategoryModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {categoryError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl font-semibold">
                {categoryError}
              </div>
            )}

            <form onSubmit={handleCreateCategoryFromModal} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Category Name *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={e => {
                    const name = e.target.value;
                    const code = `CAT-${name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}`;
                    setCategoryForm({ ...categoryForm, name, code });
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="e.g. Software License / Vehicle"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Category Code *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.code}
                  onChange={e => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                  placeholder="CAT-SOFTWARE"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Description</label>
                <textarea
                  rows={2}
                  value={categoryForm.description}
                  onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="Category description..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-semibold shadow"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSET DETAILS & HISTORY MODAL */}
      {showDetailsModal && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-2xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-white">{selectedAsset.asset_name}</h3>
                  <span className="font-mono text-xs text-cyan-400 bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded">{selectedAsset.asset_code}</span>
                </div>
                <p className="text-xs text-slate-400">Category: {selectedAsset.category_name}</p>
              </div>
              <button type="button" onClick={() => setShowDetailsModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
                <span className="text-[10px] text-slate-500 font-medium">Status</span>
                <div>{getStatusBadge(selectedAsset)}</div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
                <span className="text-[10px] text-slate-500 font-medium">Condition</span>
                <p className="font-bold text-slate-200">{selectedAsset.condition}</p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
                <span className="text-[10px] text-slate-500 font-medium">Assigned Employee</span>
                <p className="font-bold text-cyan-400">
                  {selectedAsset.employee_first_name ? `${selectedAsset.employee_first_name} ${selectedAsset.employee_last_name}` : 'In Stock'}
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
                <span className="text-[10px] text-slate-500 font-medium">Brand & Model</span>
                <p className="font-semibold text-slate-200">{selectedAsset.brand || '-'} {selectedAsset.model || ''}</p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
                <span className="text-[10px] text-slate-500 font-medium">Serial Number</span>
                <p className="font-mono text-slate-300">{selectedAsset.serial_number || '-'}</p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
                <span className="text-[10px] text-slate-500 font-medium">Location</span>
                <p className="font-semibold text-slate-200">{selectedAsset.location || '-'}</p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
                <span className="text-[10px] text-slate-500 font-medium">Purchase Price</span>
                <p className="font-mono text-slate-200">₹{Number(selectedAsset.purchase_price || 0).toLocaleString()}</p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
                <span className="text-[10px] text-slate-500 font-medium">Current Valuation</span>
                <p className="font-mono text-cyan-400 font-bold">₹{Number(selectedAsset.current_value || 0).toLocaleString()}</p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
                <span className="text-[10px] text-slate-500 font-medium">Purchase Date</span>
                <p className="font-mono text-slate-300">{selectedAsset.purchase_date ? selectedAsset.purchase_date.split('T')[0] : '-'}</p>
              </div>
            </div>

            {/* Audit History Timeline */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                <History className="w-4 h-4 text-cyan-400" />
                <span>Asset Audit History Log</span>
              </h4>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {assetHistory.map((h, idx) => (
                  <div key={idx} className="relative flex items-start gap-3 pl-7 text-xs">
                    <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-cyan-400 border-2 border-slate-900" />
                    <div className="flex-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-400 uppercase text-[10px]">{h.action}</span>
                        <span className="text-[10px] font-mono text-slate-500">{new Date(h.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-300 text-[11px]">{h.notes}</p>
                      {h.employee_first_name && (
                        <span className="text-[10px] text-cyan-400 block font-mono">Target Employee: {h.employee_first_name} {h.employee_last_name} ({h.employee_code})</span>
                      )}
                    </div>
                  </div>
                ))}
                {assetHistory.length === 0 && (
                  <p className="text-xs text-slate-500 italic text-center py-3">No history entries logged.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {showAssignModal && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">Allocate Asset to Employee</h3>
              <button type="button" onClick={() => setShowAssignModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
              <div className="font-bold text-cyan-400">{selectedAsset.asset_code} — {selectedAsset.asset_name}</div>
              <div className="text-slate-400">Category: {selectedAsset.category_name}</div>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl">{formError}</div>
            )}

            <form onSubmit={handleAssignAsset} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Select Employee *</label>
                <select
                  required
                  value={assignForm.employeeId}
                  onChange={e => setAssignForm({ ...assignForm, employeeId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-medium"
                >
                  <option value="">Select Employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Assignment Date *</label>
                  <input
                    type="date"
                    required
                    value={assignForm.assignedDate}
                    onChange={e => setAssignForm({ ...assignForm, assignedDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Expected Return Date</label>
                  <input
                    type="date"
                    value={assignForm.expectedReturnDate}
                    onChange={e => setAssignForm({ ...assignForm, expectedReturnDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Allocation Notes</label>
                <textarea
                  rows={2}
                  value={assignForm.notes}
                  onChange={e => setAssignForm({ ...assignForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="Reason for allocation or accessories provided..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-semibold shadow"
                >
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RETURN MODAL */}
      {showReturnModal && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">Process Asset Return</h3>
              <button type="button" onClick={() => setShowReturnModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
              <div className="font-bold text-amber-400">{selectedAsset.asset_code} — {selectedAsset.asset_name}</div>
              <div className="text-slate-400">Currently assigned to: {selectedAsset.employee_first_name} {selectedAsset.employee_last_name}</div>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl">{formError}</div>
            )}

            <form onSubmit={handleReturnAsset} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Return Date *</label>
                  <input
                    type="date"
                    required
                    value={returnForm.returnedDate}
                    onChange={e => setReturnForm({ ...returnForm, returnedDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Return Condition *</label>
                  <select
                    value={returnForm.condition}
                    onChange={e => setReturnForm({ ...returnForm, condition: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    <option value="EXCELLENT">EXCELLENT</option>
                    <option value="GOOD">GOOD</option>
                    <option value="FAIR">FAIR</option>
                    <option value="POOR">POOR</option>
                    <option value="DAMAGED">DAMAGED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Return Inspection Notes</label>
                <textarea
                  rows={2}
                  value={returnForm.notes}
                  onChange={e => setReturnForm({ ...returnForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="Physical condition inspection notes..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow"
                >
                  Process Return to Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
