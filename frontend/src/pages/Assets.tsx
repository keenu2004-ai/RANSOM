import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { 
  Package, Plus, Search, Filter, Wrench, RefreshCw, UserCheck, 
  RotateCcw, History, FileSpreadsheet, ShieldAlert, CheckCircle2, 
  AlertTriangle, Clock, X, Edit3, Trash2, Tag, Calendar, User, DollarSign
} from 'lucide-react';

export const Assets: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ASSETS' | 'CATEGORIES' | 'REPORTS'>('ASSETS');

  const [assets, setAssets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

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
    description: ''
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
      setCategories(catsRes.data || []);
      setAssets(assetsRes.data?.assets || []);
      setEmployees(empRes.employees || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateOrUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (editingAsset) {
        await apiFetch(`/assets/${editingAsset.id}`, {
          method: 'PUT',
          body: JSON.stringify(assetForm)
        });
        setSuccessMsg('Asset metadata updated successfully.');
      } else {
        await apiFetch('/assets', {
          method: 'POST',
          body: JSON.stringify(assetForm)
        });
        setSuccessMsg('New asset registered into inventory.');
      }
      setShowAddModal(false);
      setEditingAsset(null);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save asset.');
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
      setSuccessMsg('Asset returned to available inventory.');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to return asset.');
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
      setSuccessMsg('Maintenance ticket logged. Asset status updated to UNDER_MAINTENANCE.');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to log maintenance.');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await apiFetch('/assets/categories', {
        method: 'POST',
        body: JSON.stringify(categoryForm)
      });
      setShowCategoryModal(false);
      setCategoryForm({ name: '', code: '', description: '' });
      setSuccessMsg('Asset category created successfully.');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create category.');
    }
  };

  const openHistory = async (asset: any) => {
    setSelectedAsset(asset);
    try {
      const res = await apiFetch(`/assets/${asset.id}/history`);
      setAssetHistory(res.data || []);
      setShowHistoryModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to load history');
    }
  };

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchesSearch = !searchTerm || (
        a.asset_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.serial_number && a.serial_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.employee_first_name && `${a.employee_first_name} ${a.employee_last_name}`.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      const matchesStatus = !statusFilter || a.status === statusFilter;
      const matchesCategory = !categoryFilter || a.category_id === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [assets, searchTerm, statusFilter, categoryFilter]);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60">AVAILABLE</span>;
      case 'ASSIGNED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/60">ASSIGNED</span>;
      case 'UNDER_MAINTENANCE':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-400 border border-amber-800/60">IN MAINTENANCE</span>;
      case 'DAMAGED':
      case 'LOST':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 text-rose-400 border border-rose-800/60">{status}</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-cyan-400" />
            <span>Asset Management</span>
          </h1>
          <p className="text-xs text-slate-400">Enterprise hardware, equipment, licensing, allocations, and maintenance lifecycle tracking</p>
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
              onClick={() => {
                setEditingAsset(null);
                setAssetForm({
                  assetCode: `TE-AST-${Math.floor(1000 + Math.random() * 9000)}`,
                  assetName: '',
                  categoryId: categories[0]?.id || '',
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
                  description: ''
                });
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Asset</span>
            </button>
          </div>
        )}
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-950/50 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2 shadow">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Total Assets</span>
          <p className="text-xl font-extrabold text-white">{summary?.total_assets || 0}</p>
          <span className="text-[10px] text-cyan-400 font-mono">Valuation: ₹{(Number(summary?.total_current_value || 0)).toLocaleString()}</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Available</span>
          <p className="text-xl font-extrabold text-emerald-400">{summary?.available_count || 0}</p>
          <span className="text-[10px] text-slate-500">Ready for allocation</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Assigned</span>
          <p className="text-xl font-extrabold text-cyan-400">{summary?.assigned_count || 0}</p>
          <span className="text-[10px] text-slate-500">With employees</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Maintenance</span>
          <p className="text-xl font-extrabold text-amber-400">{summary?.maintenance_count || 0}</p>
          <span className="text-[10px] text-slate-500">Under repair</span>
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
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('ASSETS')}
          className={`pb-3 px-2 border-b-2 transition-all ${
            activeTab === 'ASSETS' ? 'border-cyan-400 text-cyan-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Asset Inventory List ({filteredAssets.length})
        </button>
        <button
          onClick={() => setActiveTab('CATEGORIES')}
          className={`pb-3 px-2 border-b-2 transition-all ${
            activeTab === 'CATEGORIES' ? 'border-cyan-400 text-cyan-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Categories ({categories.length})
        </button>
      </div>

      {activeTab === 'ASSETS' && (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search asset code, name, serial, brand, employee..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300"
              >
                <option value="">All Statuses</option>
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
                <option value="DAMAGED">DAMAGED</option>
                <option value="LOST">LOST</option>
                <option value="RETIRED">RETIRED</option>
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
                  <th className="p-3">Value (₹)</th>
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
                        <span className="text-slate-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3">{getStatusBadge(asset.status)}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded font-mono text-[10px]">
                        {asset.condition}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-200">
                      ₹{Number(asset.current_value || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-right space-x-1">
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

                      <button
                        onClick={() => openHistory(asset)}
                        className="p-1 text-slate-400 hover:text-cyan-400"
                        title="View Audit History"
                      >
                        <History className="w-4 h-4" />
                      </button>

                      {isManagerOrAdmin && (
                        <button
                          onClick={() => {
                            setSelectedAsset(asset);
                            setMaintForm({
                              maintenanceType: 'REPAIR',
                              vendor: asset.vendor || '',
                              startDate: new Date().toISOString().split('T')[0],
                              endDate: '',
                              cost: 0,
                              description: ''
                            });
                            setShowMaintModal(true);
                          }}
                          className="p-1 text-slate-400 hover:text-amber-400"
                          title="Log Maintenance"
                        >
                          <Wrench className="w-4 h-4" />
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

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-2xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">
                {editingAsset ? 'Edit Asset Record' : 'Register New Asset'}
              </h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl">{formError}</div>
            )}

            <form onSubmit={handleCreateOrUpdateAsset} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Asset Code *</label>
                  <input
                    type="text"
                    required
                    value={assetForm.assetCode}
                    onChange={e => setAssetForm({ ...assetForm, assetCode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                    placeholder="TE-IT-1001"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Asset Name *</label>
                  <input
                    type="text"
                    required
                    value={assetForm.assetName}
                    onChange={e => setAssetForm({ ...assetForm, assetName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                    placeholder="Dell Latitude Laptop 5440"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Category *</label>
                  <select
                    value={assetForm.categoryId}
                    onChange={e => setAssetForm({ ...assetForm, categoryId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Brand</label>
                  <input
                    type="text"
                    value={assetForm.brand}
                    onChange={e => setAssetForm({ ...assetForm, brand: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                    placeholder="Dell"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Model</label>
                  <input
                    type="text"
                    value={assetForm.model}
                    onChange={e => setAssetForm({ ...assetForm, model: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                    placeholder="Latitude 5440"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Serial Number</label>
                  <input
                    type="text"
                    value={assetForm.serialNumber}
                    onChange={e => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                    placeholder="SN-987654"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Purchase Price (₹)</label>
                  <input
                    type="number"
                    value={assetForm.purchasePrice}
                    onChange={e => setAssetForm({ ...assetForm, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Current Valuation (₹)</label>
                  <input
                    type="number"
                    value={assetForm.currentValue}
                    onChange={e => setAssetForm({ ...assetForm, currentValue: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Condition</label>
                  <select
                    value={assetForm.condition}
                    onChange={e => setAssetForm({ ...assetForm, condition: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    <option value="NEW">NEW</option>
                    <option value="EXCELLENT">EXCELLENT</option>
                    <option value="GOOD">GOOD</option>
                    <option value="FAIR">FAIR</option>
                    <option value="POOR">POOR</option>
                    <option value="DAMAGED">DAMAGED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Location</label>
                  <input
                    type="text"
                    value={assetForm.location}
                    onChange={e => setAssetForm({ ...assetForm, location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                    placeholder="HQ Floor 3 IT Bay"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
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
                  Register Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
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
              <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl">{formError}</div>
            )}

            <form onSubmit={handleAssignAsset} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Select Employee *</label>
                <select
                  required
                  value={assignForm.employeeId}
                  onChange={e => setAssignForm({ ...assignForm, employeeId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
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
                  placeholder="Reason for allocation or special accessories provided..."
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

      {/* Return Modal */}
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
              <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl">{formError}</div>
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
                  placeholder="Notes on physical condition, missing accessories, or verification..."
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
                  Process Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Audit Modal */}
      {showHistoryModal && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-xl w-full space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-cyan-400" />
                  <span>Asset Timeline History</span>
                </h3>
                <p className="text-xs text-slate-400">{selectedAsset.asset_code} — {selectedAsset.asset_name}</p>
              </div>
              <button type="button" onClick={() => setShowHistoryModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
              {assetHistory.map((h, idx) => (
                <div key={idx} className="relative flex items-start gap-4 pl-8 text-xs">
                  <div className="absolute left-2 top-1.5 w-3 h-3 rounded-full bg-cyan-400 border-2 border-slate-900" />
                  <div className="flex-1 p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-400 uppercase">{h.action}</span>
                      <span className="text-[10px] font-mono text-slate-500">{new Date(h.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-300">{h.notes}</p>
                    {h.performed_by_email && (
                      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                        Logged by: {h.performed_by_email}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {assetHistory.length === 0 && (
                <p className="text-xs text-slate-500 py-4 text-center">No history records logged for this asset.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
