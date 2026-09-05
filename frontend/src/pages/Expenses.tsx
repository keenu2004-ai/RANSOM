
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch, apiDownload, getApiUrl, getSecureFileUrl, buildAttachmentViewPath } from '../services/api-client';
import { FileViewerModal } from '../components/common/FileViewerModal';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';
import { getFinancialYearPeriod } from '../utils/financialYear';
import {
  Receipt, Plus, Check, X, FileText, MapPin, Navigation,
  Building, Calendar, Upload, Trash2, Eye, AlertTriangle,
  ArrowRight, Edit, Hotel, Plane, Clock, ChevronRight, ShieldCheck, DollarSign,
  ChevronLeft, Download, Users, PieChart, TrendingUp, Search, Filter, RefreshCw,
  ChevronDown, CheckCircle2, XCircle, AlertCircle, Ban
} from 'lucide-react';

const BUCKET_OPTIONS = ['Exit', 'Internal', 'Onboarding', 'Other', 'Primary'];
const BUSINESS_CATEGORIES = ['Courier', 'Food', 'Office Supply', 'Others', 'Raw Material'];
const LOCAL_TRAVEL_CATEGORIES = [
  'Bike', 'Bike Taxi', 'Courier', 'Field Visits', 'Flight', 'Food',
  'Metro Train', 'Office Supply', 'Others', 'Raw Material', 'Taxi', 'Train'
];
const TRANSPORT_MODES = [
  'Auto', 'Bus', 'Flight', 'Others', 'Public Transportation', 'Taxi', 'Train'
];
const OTHER_EXPENSE_CATEGORIES = ['Food', 'General Expense', 'Other', 'Courier', 'Office Supply', 'Raw Material'];

export const Expenses: React.FC = () => {
  const { user } = useAuth();
  const isManagerOrAdmin = hasPermission(user?.role, 'EXPENSE_WORKFORCE_VIEW');

  // FY Management State
  const [selectedStartYear, setSelectedStartYear] = useState<number>(() => {
    const m = new Date().getMonth() + 1;
    const y = new Date().getFullYear();
    return m >= 4 ? y : y - 1;
  });

  const currentFy = getFinancialYearPeriod(selectedStartYear);

  // Main Mode: MANAGEMENT vs PERSONAL
  const [mainViewMode, setMainViewMode] = useState<'MANAGEMENT' | 'PERSONAL'>(() => {
    return isManagerOrAdmin ? 'MANAGEMENT' : 'PERSONAL';
  });

  // Management State
  const [mgmtSummary, setMgmtSummary] = useState<any | null>(null);
  const [mgmtOverview, setMgmtOverview] = useState<any[]>([]);
  const [mgmtPagination, setMgmtPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [mgmtSearch, setMgmtSearch] = useState('');
  const [mgmtDeptFilter, setMgmtDeptFilter] = useState('');
  const [mgmtStatusFilter, setMgmtStatusFilter] = useState('');
  const [mgmtAnalytics, setMgmtAnalytics] = useState<any | null>(null);
  const [mgmtRecent, setMgmtRecent] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<{ id: string; name: string }[]>([]);

  // Employee Side Drawer State
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [empDrawerYear, setEmpDrawerYear] = useState<number>(selectedStartYear);
  const [empDrawerData, setEmpDrawerData] = useState<any | null>(null);
  const [loadingEmpDrawer, setLoadingEmpDrawer] = useState(false);

  // Download Dropdown Portal State & Positioning
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const downloadBtnRef = useRef<HTMLButtonElement>(null);
  const downloadDropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const updateDropdownPosition = useCallback(() => {
    if (downloadBtnRef.current) {
      const rect = downloadBtnRef.current.getBoundingClientRect();
      const dropdownWidth = 176; // w-44 = 11rem = 176px
      let left = rect.right - dropdownWidth;
      if (left < 10) left = 10;
      if (left + dropdownWidth > window.innerWidth - 10) {
        left = window.innerWidth - dropdownWidth - 10;
      }
      setDropdownStyle({
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${left}px`,
      });
    }
  }, []);

  useEffect(() => {
    if (showDownloadDropdown) {
      updateDropdownPosition();
      const handleScrollOrResize = () => updateDropdownPosition();
      const handleClickOutside = (e: MouseEvent) => {
        if (
          downloadBtnRef.current &&
          !downloadBtnRef.current.contains(e.target as Node) &&
          downloadDropdownRef.current &&
          !downloadDropdownRef.current.contains(e.target as Node)
        ) {
          setShowDownloadDropdown(false);
        }
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowDownloadDropdown(false);
        }
      };

      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showDownloadDropdown, updateDropdownPosition]);

  // Employee Individual Records State
  const [empRecordsList, setEmpRecordsList] = useState<any[]>([]);
  const [loadingEmpRecords, setLoadingEmpRecords] = useState(false);
  const [empRecordPage, setEmpRecordPage] = useState(1);
  const [empRecordTotalPages, setEmpRecordTotalPages] = useState(1);
  const [empRecordTypeFilter, setEmpRecordTypeFilter] = useState('');
  const [empRecordStatusFilter, setEmpRecordStatusFilter] = useState('');
  const [empRecordSummary, setEmpRecordSummary] = useState({
    totalRecords: 0,
    approvedAmount: 0,
    pendingAmount: 0,
    rejectedAmount: 0,
    totalRequested: 0
  });

  // Loading & Error States for Management
  const [loadingMgmt, setLoadingMgmt] = useState(false);
  const [mgmtError, setMgmtError] = useState<string | null>(null);

  // Management Ledger Modal State (ALL, APPROVED, PENDING, REJECTED)
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerType, setLedgerType] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');
  const [ledgerRecords, setLedgerRecords] = useState<any[]>([]);
  const [ledgerTotalAmount, setLedgerTotalAmount] = useState(0);
  const [ledgerTotalRecords, setLedgerTotalRecords] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Category Analytics Modal State
  const [showCategoryAnalyticsModal, setShowCategoryAnalyticsModal] = useState(false);

  // Claims lists
  const [myExpenses, setMyExpenses] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [myTrips, setMyTrips] = useState<any[]>([]);
  const [allTrips, setAllTrips] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active Main View Tab
  const [claimCategoryTab, setClaimCategoryTab] = useState<'SINGLE_EXPENSES' | 'TRIP_EXPENSES'>('SINGLE_EXPENSES');
  const [activeRoleTab, setActiveRoleTab] = useState<'MY_CLAIMS' | 'WORKFORCE'>('MY_CLAIMS');

  // Single Expense Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Business & Local Travel Modal
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [singleClaimType, setSingleClaimType] = useState<'BUSINESS' | 'LOCAL_TRAVEL'>('BUSINESS');

  // Trip Parent Create & Edit Modals
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);
  const [showEditTripModal, setShowEditTripModal] = useState(false);
  const [showFinalSubmitModal, setShowFinalSubmitModal] = useState(false);
  const [showInitiatedAlert, setShowInitiatedAlert] = useState(false);

  const [activeTrip, setActiveTrip] = useState<any | null>(null); // Active Trip workspace

  // Child Expense Modals
  const [showTravelModal, setShowTravelModal] = useState(false);
  const [showAccomModal, setShowAccomModal] = useState(false);
  const [showOtherModal, setShowOtherModal] = useState(false);

  const [editingChild, setEditingChild] = useState<any | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // File Attachment State
  const [attachment, setAttachment] = useState<{ name: string; url: string } | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);

  // Common Form Error & Loading
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Details View Modal
  const [selectedSingleExpense, setSelectedSingleExpense] = useState<any | null>(null);

  // In-App File Viewer Modal
  const [activeViewFile, setActiveViewFile] = useState<{ url: string; name: string } | null>(null);

  // Super Admin Delete State
  const [deleteConfirmExpense, setDeleteConfirmExpense] = useState<any | null>(null);
  const [deleteConfirmTrip, setDeleteConfirmTrip] = useState<any | null>(null);
  const [deleteInputText, setDeleteInputText] = useState('');
  const [deletingExpense, setDeletingExpense] = useState(false);
  const [deletingTrip, setDeletingTrip] = useState(false);

  // Global Modal Body Scroll Lock & Escape Listener Hook
  const isAnyModalOpen = Boolean(
    showInitiatedAlert ||
    showSingleModal ||
    showCreateTripModal ||
    showEditTripModal ||
    showTravelModal ||
    showAccomModal ||
    showOtherModal ||
    showFinalSubmitModal ||
    selectedSingleExpense ||
    activeViewFile ||
    deleteConfirmExpense ||
    deleteConfirmTrip ||
    showCategoryAnalyticsModal ||
    showLedgerModal
  );

  useEffect(() => {
    if (isAnyModalOpen) {
      setShowDownloadDropdown(false);

      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (activeViewFile) {
            setActiveViewFile(null);
          } else if (deleteConfirmExpense) {
            setDeleteConfirmExpense(null);
          } else if (deleteConfirmTrip) {
            setDeleteConfirmTrip(null);
          } else if (showFinalSubmitModal) {
            setShowFinalSubmitModal(false);
          } else if (selectedSingleExpense) {
            setSelectedSingleExpense(null);
          } else if (showInitiatedAlert) {
            setShowInitiatedAlert(false);
          } else if (showSingleModal) {
            setShowSingleModal(false);
          } else if (showCreateTripModal) {
            setShowCreateTripModal(false);
          } else if (showEditTripModal) {
            setShowEditTripModal(false);
          } else if (showTravelModal) {
            setShowTravelModal(false);
          } else if (showAccomModal) {
            setShowAccomModal(false);
          } else if (showOtherModal) {
            setShowOtherModal(false);
          } else if (showCategoryAnalyticsModal) {
            setShowCategoryAnalyticsModal(false);
          } else if (showLedgerModal) {
            setShowLedgerModal(false);
          }
        }
      };

      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => {
        document.body.style.overflow = previousOverflow;
        window.removeEventListener('keydown', handleGlobalKeyDown);
      };
    }
  }, [
    isAnyModalOpen,
    activeViewFile,
    deleteConfirmExpense,
    deleteConfirmTrip,
    showFinalSubmitModal,
    selectedSingleExpense,
    showInitiatedAlert,
    showSingleModal,
    showCreateTripModal,
    showEditTripModal,
    showTravelModal,
    showAccomModal,
    showOtherModal,
    showCategoryAnalyticsModal,
    showLedgerModal
  ]);

  // Form State
  const [singleFormData, setSingleFormData] = useState({
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

  const [tripFormData, setTripFormData] = useState({
    purpose: '',
    startPoint: '',
    endPoint: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    currency: 'INR'
  });

  const [travelFormData, setTravelFormData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    transportMode: 'Flight',
    purpose: '',
    merchant: '',
    startLocation: '',
    endLocation: '',
    distanceKm: '0',
    currency: 'INR',
    amount: ''
  });

  const [accomFormData, setAccomFormData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    currency: 'INR',
    amount: '',
    accommodationDetails: ''
  });

  const [otherFormData, setOtherFormData] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    category: 'Food',
    merchant: '',
    currency: 'INR',
    amount: '',
    purpose: ''
  });

  // Fetch Departments
  useEffect(() => {
    apiFetch('/employees/departments')
      .then(res => setDepartmentsList(res.departments || res || []))
      .catch(() => {});
  }, []);

  // Fetch Management Dashboard Data
  const fetchManagementData = useCallback(async () => {
    if (!isManagerOrAdmin) return;
    setLoadingMgmt(true);
    setMgmtError(null);

    try {
      const [summaryRes, overviewRes, analyticsRes, recentRes] = await Promise.all([
        apiFetch(`/expenses/management/summary?startYear=${selectedStartYear}`).catch(() => null),
        apiFetch(`/expenses/management/employees`, {
          params: {
            startYear: selectedStartYear,
            search: mgmtSearch,
            departmentId: mgmtDeptFilter,
            status: mgmtStatusFilter,
            page: mgmtPagination.page,
            limit: mgmtPagination.limit
          }
        }).catch(() => null),
        apiFetch(`/expenses/management/analytics?startYear=${selectedStartYear}`).catch(() => null),
        apiFetch(`/expenses/management/recent?startYear=${selectedStartYear}&limit=5`).catch(() => null)
      ]);

      setMgmtSummary(summaryRes?.summary || null);

      setMgmtOverview(overviewRes?.employees || []);
      if (overviewRes?.pagination) {
        setMgmtPagination(overviewRes.pagination);
      }

      setMgmtAnalytics(analyticsRes || null);
      setMgmtRecent(recentRes?.recentRequests || []);
    } catch (err: any) {
      console.error('Failed to load expense management data:', err);
      setMgmtError(err.message || 'Unable to load expense analytics.');
    } finally {
      setLoadingMgmt(false);
    }
  }, [isManagerOrAdmin, selectedStartYear, mgmtSearch, mgmtDeptFilter, mgmtStatusFilter, mgmtPagination.page, mgmtPagination.limit]);

  // Fetch Employee Drawer Details
  const fetchEmpDrawerDetails = useCallback(async (empId: string, yr: number) => {
    setLoadingEmpDrawer(true);
    try {
      const res = await apiFetch(`/expenses/management/employees/${empId}?startYear=${yr}`);
      setEmpDrawerData(res || null);
    } catch (err: any) {
      alert(err.message || 'Failed to load employee expense details.');
    } finally {
      setLoadingEmpDrawer(false);
    }
  }, []);

  // Fetch Employee Individual Records
  const fetchEmpRecordDetails = useCallback(async (empId: string, yr: number, page: number, type: string, status: string) => {
    setLoadingEmpRecords(true);
    try {
      const res = await apiFetch(`/expenses/management/employees/${empId}/records`, {
        params: {
          startYear: yr,
          page,
          limit: 5,
          type,
          status
        }
      });
      setEmpRecordsList(res?.records || []);
      if (res?.summary) {
        setEmpRecordSummary(res.summary);
      }
      if (res?.pagination) {
        setEmpRecordTotalPages(res.pagination.totalPages || 1);
      }
    } catch (err: any) {
      console.warn('Failed to load employee expense records:', err.message);
    } finally {
      setLoadingEmpRecords(false);
    }
  }, []);

  // Fetch Management Ledger Data
  const fetchLedgerData = useCallback(async (type: string, page: number, search: string) => {
    setLoadingLedger(true);
    try {
      const statusParam = type === 'ALL' ? '' : type;
      const res = await apiFetch('/expenses/management/ledger', {
        params: {
          startYear: selectedStartYear,
          status: statusParam,
          search,
          page,
          limit: 10
        }
      });
      setLedgerRecords(res?.records || []);
      setLedgerTotalAmount(res?.totalAmount || 0);
      setLedgerTotalRecords(res?.totalRecords || 0);
      setLedgerPage(res?.pagination?.page || 1);
      setLedgerTotalPages(res?.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to load ledger records:', err.message);
    } finally {
      setLoadingLedger(false);
    }
  }, [selectedStartYear]);

  const handleOpenLedgerModal = (type: 'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED') => {
    setLedgerType(type);
    setLedgerPage(1);
    setLedgerSearch('');
    setShowLedgerModal(true);
    fetchLedgerData(type, 1, '');
  };

  useEffect(() => {
    if (selectedEmpId) {
      fetchEmpDrawerDetails(selectedEmpId, empDrawerYear);
      fetchEmpRecordDetails(selectedEmpId, empDrawerYear, empRecordPage, empRecordTypeFilter, empRecordStatusFilter);
    }
  }, [selectedEmpId, empDrawerYear, empRecordPage, empRecordTypeFilter, empRecordStatusFilter, fetchEmpDrawerDetails, fetchEmpRecordDetails]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [];
      if (user?.employeeId) {
        promises.push(apiFetch('/expenses/my').catch(() => null));
        promises.push(apiFetch('/expenses/trips/my').catch(() => null));
      } else {
        promises.push(Promise.resolve(null), Promise.resolve(null));
      }
      if (isManagerOrAdmin) {
        promises.push(apiFetch('/expenses').catch(() => null));
        promises.push(apiFetch('/expenses/trips/workforce').catch(() => null));
      } else {
        promises.push(Promise.resolve(null), Promise.resolve(null));
      }

      const [myRes, myTripRes, allRes, allTripRes] = await Promise.all(promises);

      if (user?.employeeId) {
        setMyExpenses(myRes?.expenses || myRes?.data?.expenses || []);
        setMyTrips(myTripRes?.trips || myTripRes?.data?.trips || []);
      }
      if (isManagerOrAdmin) {
        setAllExpenses(allRes?.expenses || allRes?.data?.expenses || []);
        setAllTrips(allTripRes?.trips || allTripRes?.data?.trips || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, isManagerOrAdmin]);

  useEffect(() => {
    fetchData();
    if (isManagerOrAdmin) {
      fetchManagementData();
    }
  }, [fetchData, fetchManagementData, isManagerOrAdmin]);

  const handleDownloadReport = async (format: 'xlsx' | 'csv' = 'xlsx') => {
    try {
      const fyStr = currentFy.label.replace(/\s+/g, '');
      const filename = `Theiakshi_Expense_Report_${fyStr}.${format}`;
      await apiDownload(`/expenses/management/report`, {
        params: {
          startYear: selectedStartYear,
          departmentId: mgmtDeptFilter,
          status: mgmtStatusFilter,
          format
        }
      }, filename);
    } catch (err: any) {
      alert(err.message || 'Download failed.');
    }
  };

  const loadTripDetails = async (tripId: string) => {
    try {
      const res = await apiFetch(`/expenses/trips/${tripId}`);
      setActiveTrip(res?.trip || res?.data?.trip || null);
    } catch (err: any) {
      alert(err.message || 'Failed to load trip details.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setFormError('Invalid file format. Please upload a PDF, JPG, or PNG document.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setFormError('File size exceeds 15MB limit.');
      return;
    }

    setFormError(null);
    setRawFile(file);
    setAttachment({
      name: file.name,
      url: URL.createObjectURL(file)
    });
  };

  // Helper to upload rawFile to Google Drive or resolve clean receipt URL
  const resolveAttachmentUrl = async (folder: string): Promise<{ receiptUrl: string | null; attachmentName: string | null }> => {
    if (rawFile) {
      const safeFilename = rawFile.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const uniqueId = Math.random().toString(36).substring(2, 10);
      const objectPath = `organizations/expenses/${folder.toLowerCase()}/${uniqueId}_${safeFilename}`;

      const token = localStorage.getItem('theiakshi_auth_token') || '';
      const uploadUrl = getApiUrl(`/files/upload-direct?objectPath=${encodeURIComponent(objectPath)}`);

      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': rawFile.type,
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: rawFile
      });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to upload attachment file to server.');
      }

      const uploadData = await uploadRes.json();
      if (!uploadData.success || !uploadData.objectPath) {
        throw new Error(uploadData.error || 'Failed to upload attachment file to Google Drive.');
      }

      const completeRes = await apiFetch<{ attachment: { id: string } }>('/files/upload-complete', {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'EXPENSE',
          entityId: null,
          originalFilename: rawFile.name,
          objectPath: uploadData.objectPath,
          mimeType: rawFile.type,
          fileSize: rawFile.size,
          storageFileId: uploadData.storageFileId || null,
          storageFolderId: uploadData.storageFolderId || null
        })
      });

      if (completeRes && completeRes.attachment?.id) {
        if (attachment?.url && attachment.url.startsWith('blob:')) {
          URL.revokeObjectURL(attachment.url);
        }
        return {
          receiptUrl: `/api/files/${completeRes.attachment.id}/view`,
          attachmentName: rawFile.name
        };
      }
    }

    if (attachment && attachment.url) {
      if (!attachment.url.startsWith('blob:') && !attachment.url.startsWith('data:')) {
        return {
          receiptUrl: attachment.url,
          attachmentName: attachment.name || 'Receipt Document'
        };
      }
    }
    return { receiptUrl: null, attachmentName: null };
  };

  // Open Business / Local Travel Single Claim Modal
  const handleOpenSingleModal = (type: 'BUSINESS' | 'LOCAL_TRAVEL') => {
    setEditingExpenseId(null);
    setSingleClaimType(type);
    setFormError(null);
    setAttachment(null);
    setRawFile(null);
    setSingleFormData({
      transactionDate: new Date().toISOString().split('T')[0],
      description: '',
      category: type === 'BUSINESS' ? BUSINESS_CATEGORIES[0] : LOCAL_TRAVEL_CATEGORIES[0],
      merchant: '',
      currency: 'INR',
      amount: '',
      bucket: BUCKET_OPTIONS[1],
      transportMode: TRANSPORT_MODES[5],
      startLocation: '',
      endLocation: ''
    });
    setShowSingleModal(true);
  };

  const handleOpenEditSingle = (exp: any) => {
    setEditingExpenseId(exp.id);
    setSingleClaimType(exp.expense_type);
    setFormError(null);
    setAttachment(exp.receipt_url ? { name: exp.attachment_name || 'Receipt Document', url: exp.receipt_url } : null);
    setRawFile(null);
    setSingleFormData({
      transactionDate: exp.transaction_date ? new Date(exp.transaction_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      description: exp.description || '',
      category: exp.category || exp.category_name || (exp.expense_type === 'BUSINESS' ? BUSINESS_CATEGORIES[0] : LOCAL_TRAVEL_CATEGORIES[0]),
      merchant: exp.merchant || '',
      currency: exp.currency || 'INR',
      amount: String(exp.amount || ''),
      bucket: exp.bucket || BUCKET_OPTIONS[1],
      transportMode: exp.transport_mode || TRANSPORT_MODES[5],
      startLocation: exp.start_location || '',
      endLocation: exp.end_location || ''
    });
    setShowSingleModal(true);
  };

  const handleDeleteExpenseByEmployee = async (exp: any) => {
    if (!confirm(`Are you sure you want to delete this ${exp.expense_type} claim for ₹${exp.amount}?`)) return;
    try {
      await apiFetch(`/expenses/${exp.id}`, { method: 'DELETE' });
      setSuccessMsg('Expense claim deleted successfully.');
      setSelectedSingleExpense(null);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense claim.');
    }
  };

  const handleDeleteTripByEmployee = async (trip: any) => {
    if (!confirm(`Are you sure you want to delete this trip claim "${trip.purpose}"?`)) return;
    try {
      await apiFetch(`/expenses/trips/${trip.id}`, { method: 'DELETE' });
      setSuccessMsg('Trip Expense claim deleted successfully.');
      setActiveTrip(null);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete trip expense claim.');
    }
  };

  // Submit Business or Local Travel Single Expense
  const handleSubmitSingleClaim = async (status: 'DRAFT' | 'SUBMITTED') => {
    setFormError(null);
    const numericAmount = parseFloat(singleFormData.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFormError('Amount must be a positive number greater than ₹0.');
      return;
    }

    if (!singleFormData.description || singleFormData.description.trim() === '') {
      setFormError('Purpose / Note is required.');
      return;
    }

    if (singleClaimType === 'LOCAL_TRAVEL') {
      if (!singleFormData.merchant || singleFormData.merchant.trim() === '') {
        setFormError('Merchant is required for Local Travel Expense.');
        return;
      }
      if (!singleFormData.startLocation || singleFormData.startLocation.trim() === '') {
        setFormError('Start Location is required for Local Travel Expense.');
        return;
      }
      if (!singleFormData.endLocation || singleFormData.endLocation.trim() === '') {
        setFormError('End Location is required for Local Travel Expense.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const { receiptUrl, attachmentName } = await resolveAttachmentUrl(singleClaimType);

      const payload: any = {
        expenseType: singleClaimType,
        transactionDate: singleFormData.transactionDate,
        category: singleFormData.category,
        merchant: singleFormData.merchant ? singleFormData.merchant.trim() : undefined,
        currency: singleFormData.currency,
        amount: numericAmount,
        bucket: singleFormData.bucket,
        description: singleFormData.description.trim(),
        attachmentName: attachmentName || undefined,
        receiptUrl: receiptUrl || undefined,
        status
      };

      if (singleClaimType === 'LOCAL_TRAVEL') {
        payload.transportMode = singleFormData.transportMode;
        payload.startLocation = singleFormData.startLocation.trim();
        payload.endLocation = singleFormData.endLocation.trim();
      }

      if (editingExpenseId) {
        await apiFetch(`/expenses/${editingExpenseId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/expenses', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setRawFile(null);
      setAttachment(null);
      setShowSingleModal(false);
      setEditingExpenseId(null);
      setSuccessMsg(editingExpenseId ? 'Expense claim updated successfully.' : (status === 'DRAFT' ? 'Expense claim saved as draft.' : 'Expense claim submitted successfully.'));
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit expense claim.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Create Parent Trip Modal
  const handleOpenCreateTrip = () => {
    setFormError(null);
    setTripFormData({
      purpose: '',
      startPoint: '',
      endPoint: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      currency: 'INR'
    });
    setShowCreateTripModal(true);
  };

  // Submit Parent Trip Draft Creation
  const handleCreateTripDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tripFormData.purpose || tripFormData.purpose.trim() === '') {
      setFormError('Please enter the trip purpose.');
      return;
    }
    if (!tripFormData.startPoint || tripFormData.startPoint.trim() === '') {
      setFormError('Please enter the trip start point.');
      return;
    }
    if (!tripFormData.endPoint || tripFormData.endPoint.trim() === '') {
      setFormError('Please enter the trip end point.');
      return;
    }
    if (new Date(tripFormData.endDate) < new Date(tripFormData.startDate)) {
      setFormError('End date cannot be before start date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/expenses/trips', {
        method: 'POST',
        body: JSON.stringify(tripFormData)
      });

      setShowCreateTripModal(false);
      const createdTripId = res?.trip?.id || res?.data?.trip?.id;
      fetchData();
      if (createdTripId) {
        await loadTripDetails(createdTripId);
        setShowInitiatedAlert(true);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to create Trip Expense draft.');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Parent Trip Details
  const handleOpenEditTrip = () => {
    if (!activeTrip) return;
    setFormError(null);
    setTripFormData({
      purpose: activeTrip.purpose || '',
      startPoint: activeTrip.start_point || '',
      endPoint: activeTrip.end_point || '',
      startDate: activeTrip.start_date ? new Date(activeTrip.start_date).toISOString().split('T')[0] : '',
      endDate: activeTrip.end_date ? new Date(activeTrip.end_date).toISOString().split('T')[0] : '',
      currency: activeTrip.currency || 'INR'
    });
    setShowEditTripModal(true);
  };

  const handleUpdateTripDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip) return;
    setFormError(null);

    if (new Date(tripFormData.endDate) < new Date(tripFormData.startDate)) {
      setFormError('End date cannot be before start date.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/expenses/trips/${activeTrip.id}`, {
        method: 'PUT',
        body: JSON.stringify(tripFormData)
      });
      setShowEditTripModal(false);
      await loadTripDetails(activeTrip.id);
      fetchData();
      setSuccessMsg('Trip details updated successfully.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update trip details.');
    } finally {
      setSubmitting(false);
    }
  };

  // Travel Child Handlers
  const handleOpenAddTravel = () => {
    setEditingChild(null);
    setFormError(null);
    setAttachment(null);
    setRawFile(null);
    setTravelFormData({
      startDate: activeTrip?.start_date ? new Date(activeTrip.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      endDate: activeTrip?.end_date ? new Date(activeTrip.end_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      transportMode: 'Flight',
      purpose: '',
      merchant: '',
      startLocation: activeTrip?.start_point || '',
      endLocation: activeTrip?.end_point || '',
      distanceKm: '0',
      currency: activeTrip?.currency || 'INR',
      amount: ''
    });
    setShowTravelModal(true);
  };

  const handleOpenEditTravel = (item: any) => {
    setEditingChild(item);
    setFormError(null);
    setRawFile(null);
    setAttachment(item.receipt_url ? { name: item.attachment_name || 'Attached File', url: item.receipt_url } : null);
    setTravelFormData({
      startDate: item.start_date ? new Date(item.start_date).toISOString().split('T')[0] : '',
      endDate: item.end_date ? new Date(item.end_date).toISOString().split('T')[0] : '',
      transportMode: item.transport_mode || 'Flight',
      purpose: item.purpose || '',
      merchant: item.merchant || '',
      startLocation: item.start_location || '',
      endLocation: item.end_location || '',
      distanceKm: item.distance_km ? String(item.distance_km) : '0',
      currency: item.currency || 'INR',
      amount: item.amount ? String(item.amount) : ''
    });
    setShowTravelModal(true);
  };

  const handleSubmitTravelChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amount = parseFloat(travelFormData.amount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Amount must be a positive number greater than ₹0.');
      return;
    }
    if (new Date(travelFormData.endDate) < new Date(travelFormData.startDate)) {
      setFormError('End date cannot be before start date.');
      return;
    }

    const dist = parseFloat(travelFormData.distanceKm || '0');
    if (isNaN(dist) || dist < 0) {
      setFormError('Distance cannot be negative.');
      return;
    }

    setSubmitting(true);
    try {
      const { receiptUrl, attachmentName } = await resolveAttachmentUrl('trip_travel');

      const payload = {
        ...travelFormData,
        amount,
        distanceKm: dist,
        attachmentName: attachmentName || undefined,
        receiptUrl: receiptUrl || undefined
      };

      if (editingChild) {
        await apiFetch(`/expenses/trips/${activeTrip.id}/travel/${editingChild.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch(`/expenses/trips/${activeTrip.id}/travel`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setRawFile(null);
      setAttachment(null);
      setShowTravelModal(false);
      await loadTripDetails(activeTrip.id);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Travel expense could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTravelChild = async (travelId: string) => {
    if (!confirm('Remove this travel expense from the trip?')) return;
    try {
      await apiFetch(`/expenses/trips/${activeTrip.id}/travel/${travelId}`, { method: 'DELETE' });
      await loadTripDetails(activeTrip.id);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Accommodation Child Handlers
  const handleOpenAddAccom = () => {
    setEditingChild(null);
    setFormError(null);
    setAttachment(null);
    setRawFile(null);
    setAccomFormData({
      startDate: activeTrip?.start_date ? new Date(activeTrip.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      endDate: activeTrip?.end_date ? new Date(activeTrip.end_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      currency: activeTrip?.currency || 'INR',
      amount: '',
      accommodationDetails: ''
    });
    setShowAccomModal(true);
  };

  const handleOpenEditAccom = (item: any) => {
    setEditingChild(item);
    setFormError(null);
    setRawFile(null);
    setAttachment(item.receipt_url ? { name: item.attachment_name || 'Attached File', url: item.receipt_url } : null);
    setAccomFormData({
      startDate: item.start_date ? new Date(item.start_date).toISOString().split('T')[0] : '',
      endDate: item.end_date ? new Date(item.end_date).toISOString().split('T')[0] : '',
      currency: item.currency || 'INR',
      amount: item.amount ? String(item.amount) : '',
      accommodationDetails: item.accommodation_details || ''
    });
    setShowAccomModal(true);
  };

  const handleSubmitAccomChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amount = parseFloat(accomFormData.amount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Amount must be a positive number greater than ₹0.');
      return;
    }
    if (new Date(accomFormData.endDate) < new Date(accomFormData.startDate)) {
      setFormError('End date cannot be before start date.');
      return;
    }
    if (!accomFormData.accommodationDetails || accomFormData.accommodationDetails.trim() === '') {
      setFormError('Accommodation details are required.');
      return;
    }

    setSubmitting(true);
    try {
      const { receiptUrl, attachmentName } = await resolveAttachmentUrl('trip_accommodation');

      const payload = {
        ...accomFormData,
        amount,
        attachmentName: attachmentName || undefined,
        receiptUrl: receiptUrl || undefined
      };

      if (editingChild) {
        await apiFetch(`/expenses/trips/${activeTrip.id}/accommodation/${editingChild.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch(`/expenses/trips/${activeTrip.id}/accommodation`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setRawFile(null);
      setAttachment(null);
      setShowAccomModal(false);
      await loadTripDetails(activeTrip.id);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Accommodation expense could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccomChild = async (accomId: string) => {
    if (!confirm('Remove this accommodation expense from the trip?')) return;
    try {
      await apiFetch(`/expenses/trips/${activeTrip.id}/accommodation/${accomId}`, { method: 'DELETE' });
      await loadTripDetails(activeTrip.id);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Other Child Handlers
  const handleOpenAddOther = () => {
    setEditingChild(null);
    setFormError(null);
    setAttachment(null);
    setRawFile(null);
    setOtherFormData({
      transactionDate: activeTrip?.start_date ? new Date(activeTrip.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      category: 'Food',
      merchant: '',
      currency: activeTrip?.currency || 'INR',
      amount: '',
      purpose: ''
    });
    setShowOtherModal(true);
  };

  const handleOpenEditOther = (item: any) => {
    setEditingChild(item);
    setFormError(null);
    setRawFile(null);
    setAttachment(item.receipt_url ? { name: item.attachment_name || 'Attached File', url: item.receipt_url } : null);
    setOtherFormData({
      transactionDate: item.transaction_date ? new Date(item.transaction_date).toISOString().split('T')[0] : '',
      category: item.category || 'Food',
      merchant: item.merchant || '',
      currency: item.currency || 'INR',
      amount: item.amount ? String(item.amount) : '',
      purpose: item.purpose || ''
    });
    setShowOtherModal(true);
  };

  const handleSubmitOtherChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amount = parseFloat(otherFormData.amount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Amount must be a positive number greater than ₹0.');
      return;
    }
    if (!otherFormData.purpose || otherFormData.purpose.trim() === '') {
      setFormError('Purpose is required.');
      return;
    }

    setSubmitting(true);
    try {
      const { receiptUrl, attachmentName } = await resolveAttachmentUrl('trip_other');

      const payload = {
        ...otherFormData,
        amount,
        attachmentName: attachmentName || undefined,
        receiptUrl: receiptUrl || undefined
      };

      if (editingChild) {
        await apiFetch(`/expenses/trips/${activeTrip.id}/other/${editingChild.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch(`/expenses/trips/${activeTrip.id}/other`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setRawFile(null);
      setAttachment(null);
      setShowOtherModal(false);
      await loadTripDetails(activeTrip.id);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Other expense could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOtherChild = async (otherId: string) => {
    if (!confirm('Remove this other expense from the trip?')) return;
    try {
      await apiFetch(`/expenses/trips/${activeTrip.id}/other/${otherId}`, { method: 'DELETE' });
      await loadTripDetails(activeTrip.id);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // FINAL TRIP EXPENSE SUBMISSION
  const handleOpenFinalSubmitModal = () => {
    if (!activeTrip) return;
    const totalChildren = (activeTrip.travelExpenses?.length || 0) + (activeTrip.accommodationExpenses?.length || 0) + (activeTrip.otherExpenses?.length || 0);

    if (totalChildren === 0) {
      alert('Please add at least one travel, accommodation, or other expense before submitting the trip.');
      return;
    }
    setShowFinalSubmitModal(true);
  };

  const handleConfirmFinalSubmitTrip = async () => {
    if (!activeTrip) return;
    setSubmitting(true);
    try {
      await apiFetch(`/expenses/trips/${activeTrip.id}/submit`, { method: 'POST' });
      setShowFinalSubmitModal(false);
      setSuccessMsg('Trip expense submitted successfully.');
      await loadTripDetails(activeTrip.id);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit trip expense.');
    } finally {
      setSubmitting(false);
    }
  };

  // Approve / Reject Trip
  const handleApproveTrip = async (tripId: string) => {
    try {
      await apiFetch(`/expenses/trips/${tripId}/approve`, { method: 'PUT' });
      setSuccessMsg('Trip Expense approved successfully.');
      if (activeTrip?.id === tripId) await loadTripDetails(tripId);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectTrip = async (tripId: string) => {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      await apiFetch(`/expenses/trips/${tripId}/reject`, { method: 'PUT', body: JSON.stringify({ rejectionReason: reason }) });
      setSuccessMsg('Trip Expense rejected.');
      if (activeTrip?.id === tripId) await loadTripDetails(tripId);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApproveSingle = async (id: string) => {
    try {
      await apiFetch(`/expenses/${id}/approve`, { method: 'PUT' });
      setSuccessMsg('Expense claim approved successfully.');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectSingle = async (id: string) => {
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

  const handleDeleteSuperAdmin = async () => {
    if (!deleteConfirmExpense || deleteInputText !== 'DELETE') return;
    try {
      setDeletingExpense(true);
      await apiFetch(`/expenses/${deleteConfirmExpense.id}`, { method: 'DELETE' });
      setSuccessMsg('Expense claim permanently deleted.');
      setDeleteConfirmExpense(null);
      setDeleteInputText('');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Failed to delete expense: ${err.message || 'Error executing deletion'}`);
    } finally {
      setDeletingExpense(false);
    }
  };

  const handleDeleteSuperAdminTrip = async () => {
    if (!deleteConfirmTrip || deleteInputText !== 'DELETE') return;
    try {
      setDeletingTrip(true);
      await apiFetch(`/expenses/trips/${deleteConfirmTrip.id}`, { method: 'DELETE' });
      setSuccessMsg('Trip Expense claim permanently deleted.');
      setDeleteConfirmTrip(null);
      setDeleteInputText('');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Failed to delete trip expense: ${err.message || 'Error executing deletion'}`);
    } finally {
      setDeletingTrip(false);
    }
  };

  const empSummaryMetrics = useMemo(() => {
    const exList = myExpenses || [];
    const tripList = myTrips || [];

    const getStatusMatch = (status: string, targetBucket: string) => {
      if (targetBucket === 'ALL') return true;
      if (targetBucket === 'SUBMITTED') {
        return status === 'SUBMITTED' || status === 'PENDING';
      }
      return status === targetBucket;
    };

    const computeBucket = (bucket: string) => {
      const matchedExpenses = exList.filter((e: any) => getStatusMatch(e.status, bucket));
      const matchedTrips = tripList.filter((t: any) => getStatusMatch(t.status, bucket));

      const exSum = matchedExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
      const tripSum = matchedTrips.reduce((sum: number, t: any) => sum + Number(t.total_amount || 0), 0);

      return {
        count: matchedExpenses.length + matchedTrips.length,
        amount: exSum + tripSum
      };
    };

    return {
      total: computeBucket('ALL'),
      draft: computeBucket('DRAFT'),
      submitted: computeBucket('SUBMITTED'),
      approved: computeBucket('APPROVED'),
      rejected: computeBucket('REJECTED'),
      cancelled: computeBucket('CANCELLED')
    };
  }, [myExpenses, myTrips]);

  const displayedSingleExpenses = (activeRoleTab === 'WORKFORCE' ? allExpenses : myExpenses).filter(ex => {
    if (typeFilter && ex.expense_type !== typeFilter) return false;
    if (statusFilter) {
      if (statusFilter === 'PENDING' || statusFilter === 'SUBMITTED') {
        if (ex.status !== 'PENDING' && ex.status !== 'SUBMITTED') return false;
      } else if (ex.status !== statusFilter) {
        return false;
      }
    }
    return true;
  });

  const displayedTrips = (activeRoleTab === 'WORKFORCE' ? allTrips : myTrips).filter(t => {
    if (statusFilter) {
      if (statusFilter === 'PENDING' || statusFilter === 'SUBMITTED') {
        if (t.status !== 'PENDING' && t.status !== 'SUBMITTED') return false;
      } else if (t.status !== statusFilter) {
        return false;
      }
    }
    return true;
  });

  // Subtotals
  const travelTotal = (activeTrip?.travelExpenses || []).reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
  const accomTotal = (activeTrip?.accommodationExpenses || []).reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
  const otherTotal = (activeTrip?.otherExpenses || []).reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
  const grandTripTotal = Number(activeTrip?.total_amount || 0) || (travelTotal + accomTotal + otherTotal);

  return (
    <div className="space-y-6 text-[var(--text-heading)] font-sans">
      {/* SUCCESS BANNER */}
      {successMsg && (
        <div className="p-4 bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] rounded-2xl flex items-center justify-between text-[var(--badge-success-text)] text-sm shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-[var(--badge-success-text)] shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-[var(--badge-success-text)] hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* TOP PAGE HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-default)] backdrop-blur-md shadow-lg">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Receipt className="w-7 h-7 text-[var(--primary)]" />
            <span>Expense Management</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Track, approve and analyze employee business expenses, local travel and outstation trips</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Main View Mode Selector (For HR/Super Admin) */}
          {isManagerOrAdmin && (
            <div className="flex items-center bg-[var(--bg-surface-muted)] p-1 rounded-xl border border-[var(--border-default)] text-xs">
              <button
                onClick={() => setMainViewMode('MANAGEMENT')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  mainViewMode === 'MANAGEMENT'
                    ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow-md shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                <PieChart className="w-3.5 h-3.5" />
                <span>Analytics Dashboard</span>
              </button>
              <button
                onClick={() => {
                  setMainViewMode('PERSONAL');
                  if (isManagerOrAdmin) {
                    setActiveRoleTab('WORKFORCE');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  mainViewMode === 'PERSONAL'
                    ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow-md shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Expense Claims Panel</span>
              </button>
            </div>
          )}

          {/* FY Selector */}
          {mainViewMode === 'MANAGEMENT' && isManagerOrAdmin && (
            <div className="flex items-center gap-1 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl p-1 text-xs">
              <button
                onClick={() => setSelectedStartYear(prev => prev - 1)}
                className="p-1.5 hover:bg-[var(--bg-surface-muted)] rounded-lg text-[var(--text-secondary)] hover:text-white transition-colors"
                title="Previous FY"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 text-center">
                <div className="font-bold text-[var(--primary)]">{currentFy.label}</div>
                <div className="text-[10px] text-[var(--text-secondary)]">{currentFy.displayRange}</div>
              </div>
              <button
                onClick={() => setSelectedStartYear(prev => prev + 1)}
                className="p-1.5 hover:bg-[var(--bg-surface-muted)] rounded-lg text-[var(--text-secondary)] hover:text-white transition-colors"
                title="Next FY"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Download Expense Report Dropdown */}
          {mainViewMode === 'MANAGEMENT' && isManagerOrAdmin && (
            <div className="relative">
              <button
                ref={downloadBtnRef}
                onClick={() => setShowDownloadDropdown(prev => !prev)}
                className="px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Expense Report</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showDownloadDropdown && createPortal(
                <div
                  ref={downloadDropdownRef}
                  style={dropdownStyle}
                  className="w-44 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl shadow-2xl overflow-hidden z-[1000] animate-in fade-in zoom-in-95 duration-100"
                >
                  <button
                    onClick={() => {
                      setShowDownloadDropdown(false);
                      handleDownloadReport('xlsx');
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-[var(--badge-success-text)]" />
                    <span>Excel Workbook (.xlsx)</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowDownloadDropdown(false);
                      handleDownloadReport('csv');
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] flex items-center gap-2 font-medium border-t border-[var(--border-default)] cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-[var(--badge-warning-text)]" />
                    <span>CSV File (.csv)</span>
                  </button>
                </div>,
                document.body
              )}
            </div>
          )}
        </div>
      </div>

      {/* MANAGEMENT DASHBOARD VIEW */}
      {mainViewMode === 'MANAGEMENT' && isManagerOrAdmin && (
        <div className="space-y-4">
          {loadingMgmt && (
            <div className="p-12 text-center bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)]">
              <RefreshCw className="w-8 h-8 text-[var(--primary)] animate-spin mx-auto mb-3" />
              <p className="text-xs font-medium text-[var(--text-secondary)]">Loading Expense Analytics & Overview for {currentFy.label}...</p>
            </div>
          )}

          {mgmtError && !loadingMgmt && (
            <div className="p-6 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 rounded-xl text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-[var(--action-danger-bg)] mx-auto" />
              <p className="text-xs font-semibold text-[var(--action-danger-bg)]">{mgmtError}</p>
              <button onClick={fetchManagementData} className="px-3 py-1.5 bg-[var(--action-danger-bg)] text-white rounded-lg text-xs font-bold cursor-pointer">Retry</button>
            </div>
          )}

          {!loadingMgmt && !mgmtError && (
            <div className="flex gap-4 items-start relative">
              {/* MAIN CONTENT AREA */}
              <div className="flex-1 space-y-4 min-w-0">
                {/* 5 KPI CARDS IN ONE ROW (CLICKABLE NAVIGATION) */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* Card 1: Employees with Expenses */}
                  <div
                    onClick={() => {
                      setMgmtStatusFilter('');
                      const el = document.getElementById('employee-overview-table');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`bg-[var(--bg-surface)] border rounded-xl p-3.5 space-y-1.5 shadow-md cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${
                      mgmtStatusFilter === '' ? 'border-[var(--primary)]/70 ring-1 ring-1 ring-[var(--primary)]/30' : 'border-[var(--border-default)] hover:border-[var(--primary)]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-[var(--badge-info-bg)] border border-[var(--primary)]/30 rounded-lg text-[var(--primary)]">
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium text-[var(--text-primary)]">Employees with Expenses</span>
                      </div>
                      {mgmtSummary?.yoyEmployeesPct !== null && mgmtSummary?.yoyEmployeesPct !== undefined && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          mgmtSummary.yoyEmployeesPct >= 0 ? 'text-[var(--badge-success-text)] bg-[var(--badge-success-bg)] border-[var(--badge-success-border)]' : 'text-[var(--action-danger-bg)] bg-[var(--action-danger-soft)] border-[var(--action-danger-bg)]/30'
                        }`}>
                          {mgmtSummary.yoyEmployeesPct >= 0 ? '+' : ''}{mgmtSummary.yoyEmployeesPct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <div className="text-xl font-black text-white pt-1">{mgmtSummary?.employeesWithExpenses || 0}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">of {mgmtSummary?.totalEmployees || 0} total employees</div>
                  </div>

                  {/* Card 2: Total Expense Amount */}
                  <div
                    onClick={() => handleOpenLedgerModal('ALL')}
                    className="bg-[var(--bg-surface)] border border-[var(--primary)]/30 hover:border-[var(--primary)]/30 ring-1 ring-1 ring-[var(--primary)]/30 rounded-xl p-3.5 space-y-1.5 shadow-md cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-[var(--secondary)]/15 border border-[var(--secondary)]/30 rounded-lg text-[var(--secondary)]">
                          <DollarSign className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium text-[var(--text-primary)]">Total Expense Amount</span>
                      </div>
                      {mgmtSummary?.yoyTotalAmountPct !== null && mgmtSummary?.yoyTotalAmountPct !== undefined && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          mgmtSummary.yoyTotalAmountPct >= 0 ? 'text-[var(--badge-success-text)] bg-[var(--badge-success-bg)] border-[var(--badge-success-border)]' : 'text-[var(--action-danger-bg)] bg-[var(--action-danger-soft)] border-[var(--action-danger-bg)]/30'
                        }`}>
                          {mgmtSummary.yoyTotalAmountPct >= 0 ? '+' : ''}{mgmtSummary.yoyTotalAmountPct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <div className="text-xl font-black text-white pt-1">₹{Number(mgmtSummary?.totalExpenseAmount !== undefined ? mgmtSummary.totalExpenseAmount : (mgmtSummary?.totalRequestedAmount || 0)).toLocaleString('en-IN')}</div>
                    <div className="text-[10px] text-[var(--secondary)] font-medium flex items-center justify-between">
                      <span>Click to view ALL Ledger</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>

                  {/* Card 3: Approved Amount */}
                  <div
                    onClick={() => handleOpenLedgerModal('APPROVED')}
                    className="bg-[var(--bg-surface)] border border-[var(--badge-success-border)] hover:border-[var(--badge-success-border)] ring-1 ring-1 ring-[var(--primary)]/30 rounded-xl p-3.5 space-y-1.5 shadow-md cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] rounded-lg text-[var(--badge-success-text)]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium text-[var(--text-primary)]">Approved Amount</span>
                      </div>
                    </div>
                    <div className="text-xl font-black text-white pt-1">₹{Number(mgmtSummary?.approvedAmount || 0).toLocaleString('en-IN')}</div>
                    <div className="text-[10px] text-[var(--badge-success-text)] font-medium flex items-center justify-between">
                      <span>Click for Approved Ledger</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>

                  {/* Card 4: Pending Amount */}
                  <div
                    onClick={() => handleOpenLedgerModal('PENDING')}
                    className="bg-[var(--bg-surface)] border border-[var(--badge-warning-border)] hover:border-[var(--badge-warning-border)] ring-1 ring-1 ring-[var(--primary)]/30 rounded-xl p-3.5 space-y-1.5 shadow-md cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-[var(--badge-warning-bg)] border border-[var(--badge-warning-border)] rounded-lg text-[var(--badge-warning-text)]">
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium text-[var(--text-primary)]">Pending Amount</span>
                      </div>
                    </div>
                    <div className="text-xl font-black text-white pt-1">₹{Number(mgmtSummary?.pendingAmount || 0).toLocaleString('en-IN')}</div>
                    <div className="text-[10px] text-[var(--badge-warning-text)] font-medium flex items-center justify-between">
                      <span>Pending Approval Center</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>

                  {/* Card 5: Rejected Amount */}
                  <div
                    onClick={() => handleOpenLedgerModal('REJECTED')}
                    className="bg-[var(--bg-surface)] border border-[var(--action-danger-bg)]/30 hover:border-[var(--action-danger-bg)]/30 ring-1 ring-1 ring-[var(--primary)]/30 rounded-xl p-3.5 space-y-1.5 shadow-md cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 rounded-lg text-[var(--action-danger-bg)]">
                          <XCircle className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium text-[var(--text-primary)]">Rejected Amount</span>
                      </div>
                    </div>
                    <div className="text-xl font-black text-white pt-1">₹{Number(mgmtSummary?.rejectedAmount || 0).toLocaleString('en-IN')}</div>
                    <div className="text-[10px] text-[var(--action-danger-bg)] font-medium flex items-center justify-between">
                      <span>Click for Rejected Ledger</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>

                {/* EMPLOYEE OVERVIEW TABLE */}
                <div id="employee-overview-table" className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4 space-y-3 shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-[var(--primary)]" />
                        <span>Employee Expense Overview</span>
                      </h2>
                      <p className="text-[11px] text-[var(--text-secondary)]">View employee-wise expense summary for the selected financial year</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2" />
                        <input
                          type="text"
                          value={mgmtSearch}
                          onChange={e => { setMgmtSearch(e.target.value); setMgmtPagination(p => ({ ...p, page: 1 })); }}
                          placeholder="Search by name or employee code..."
                          className="pl-8 pr-2.5 py-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-lg text-xs text-white placeholder-[var(--text-muted)] w-52"
                        />
                      </div>

                      <select
                        value={mgmtDeptFilter}
                        onChange={e => { setMgmtDeptFilter(e.target.value); setMgmtPagination(p => ({ ...p, page: 1 })); }}
                        className="px-2.5 py-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-lg text-xs text-white"
                      >
                        <option value="">All Departments</option>
                        {departmentsList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>

                      <select
                        value={mgmtStatusFilter}
                        onChange={e => { setMgmtStatusFilter(e.target.value); setMgmtPagination(p => ({ ...p, page: 1 })); }}
                        className="px-2.5 py-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-lg text-xs text-white"
                      >
                        <option value="">All Statuses</option>
                        <option value="APPROVED">Approved Claims</option>
                        <option value="SUBMITTED">Pending Claims</option>
                        <option value="REJECTED">Rejected Claims</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-[var(--border-default)] rounded-lg">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border-b border-[var(--border-default)] font-semibold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3">Employee</th>
                          <th className="py-2.5 px-3">Code</th>
                          <th className="py-2.5 px-3">Department</th>
                          <th className="py-2.5 px-3 text-right">Approved (₹)</th>
                          <th className="py-2.5 px-3 text-right">Pending (₹)</th>
                          <th className="py-2.5 px-3 text-right">Rejected (₹)</th>
                          <th className="py-2.5 px-3 text-right">Total Requested (₹)</th>
                          <th className="py-2.5 px-3 text-right">Total Expense (₹)</th>
                          <th className="py-2.5 px-3">Top Category</th>
                          <th className="py-2.5 px-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {mgmtOverview.length === 0 ? (
                          <tr><td colSpan={10} className="py-6 text-center text-[var(--text-muted)]">No employee expense activity in {currentFy.label}.</td></tr>
                        ) : (
                          mgmtOverview.map(emp => {
                            const approvedPct = emp.totalRequested > 0 ? (emp.approvedAmount / emp.totalRequested) * 100 : 0;
                            const pendingPct = emp.totalRequested > 0 ? (emp.pendingAmount / emp.totalRequested) * 100 : 0;
                            const rejectedPct = emp.totalRequested > 0 ? (emp.rejectedAmount / emp.totalRequested) * 100 : 0;

                            return (
                              <tr key={emp.employeeId} className="hover:bg-[var(--bg-surface-muted)] transition-colors">
                                <td className="py-2 px-3 font-bold text-white flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-[var(--primary)] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                    {emp.employeeName.substring(0, 2).toUpperCase()}
                                  </div>
                                  <span className="truncate">{emp.employeeName}</span>
                                </td>
                                <td className="py-2 px-3 font-mono text-[var(--text-secondary)]">{emp.employeeCode}</td>
                                <td className="py-2 px-3 text-[var(--text-primary)]">{emp.department}</td>
                                <td className="py-2 px-3 text-right font-medium text-[var(--text-primary)]">
                                  <div>₹{emp.approvedAmount.toLocaleString('en-IN')}</div>
                                  <div className="w-full bg-[var(--bg-surface-muted)] h-1 rounded-full overflow-hidden mt-1">
                                    <div className="bg-[var(--badge-success-bg)] h-full rounded-full" style={{ width: `${Math.min(100, approvedPct)}%` }}></div>
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-medium text-[var(--text-primary)]">
                                  <div>₹{emp.pendingAmount.toLocaleString('en-IN')}</div>
                                  <div className="w-full bg-[var(--bg-surface-muted)] h-1 rounded-full overflow-hidden mt-1">
                                    <div className="bg-[var(--badge-warning-bg)] h-full rounded-full" style={{ width: `${Math.min(100, pendingPct)}%` }}></div>
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-medium text-[var(--text-primary)]">
                                  <div>₹{emp.rejectedAmount.toLocaleString('en-IN')}</div>
                                  <div className="w-full bg-[var(--bg-surface-muted)] h-1 rounded-full overflow-hidden mt-1">
                                    <div className="bg-[var(--action-danger-bg)] h-full rounded-full" style={{ width: `${Math.min(100, rejectedPct)}%` }}></div>
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-white">₹{emp.totalRequested.toLocaleString('en-IN')}</td>
                                <td className="py-2 px-3 text-right font-bold text-[var(--text-primary)]">₹{emp.totalExpense.toLocaleString('en-IN')}</td>
                                <td className="py-2 px-3 text-[var(--text-primary)]">
                                  <span className="px-2 py-0.5 bg-[var(--badge-info-bg)] border border-[var(--badge-info-border)] text-[var(--badge-info-text)] rounded text-[10px] font-medium">
                                    {emp.topCategory || 'N/A'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    onClick={() => setSelectedEmpId(emp.employeeId)}
                                    className="px-2 py-1 bg-[var(--badge-info-bg)] hover:bg-[var(--bg-surface-hover)] border border-[var(--badge-info-border)]/60 text-[var(--badge-info-text)] rounded text-[10px] font-bold flex items-center gap-1 mx-auto cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>View</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pt-1">
                    <div>Showing 1 to {mgmtOverview.length} of {mgmtPagination.total} employees</div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          disabled={mgmtPagination.page <= 1}
                          onClick={() => setMgmtPagination(p => ({ ...p, page: p.page - 1 }))}
                          className="px-2 py-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] disabled:opacity-40 rounded text-[var(--text-primary)] text-[11px]"
                        >
                          &lt;
                        </button>
                        {[...Array(mgmtPagination.totalPages || 1)].map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setMgmtPagination(p => ({ ...p, page: i + 1 }))}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                              mgmtPagination.page === i + 1 ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-white border border-[var(--border-default)]'
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                        <button
                          disabled={mgmtPagination.page >= mgmtPagination.totalPages}
                          onClick={() => setMgmtPagination(p => ({ ...p, page: p.page + 1 }))}
                          className="px-2 py-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] disabled:opacity-40 rounded text-[var(--text-primary)] text-[11px]"
                        >
                          &gt;
                        </button>
                      </div>

                      <select
                        value={mgmtPagination.limit}
                        onChange={e => setMgmtPagination(p => ({ ...p, limit: Number(e.target.value), page: 1 }))}
                        className="px-2 py-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded text-xs text-[var(--text-primary)]"
                      >
                        <option value={5}>5 per page</option>
                        <option value={10}>10 per page</option>
                        <option value={20}>20 per page</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* EXPENSE ANALYSIS SECTION */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4 space-y-4 shadow-md">
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-[var(--secondary)]" />
                      <span>Expense Analysis</span>
                    </h2>
                    <p className="text-[11px] text-[var(--text-secondary)]">Visual breakdown of expenses for {currentFy.label}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Expense by Category (Donut Chart representation) */}
                    <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-xl p-3.5 space-y-3">
                      <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider">Expense by Category</h3>
                      <div className="flex flex-col items-center justify-center py-2">
                        <div className="relative w-36 h-36 flex items-center justify-center rounded-full border-8 border-[var(--primary)] border-t-[var(--secondary)] border-r-[var(--badge-warning-text)] border-b-[var(--badge-success-text)] shadow-inner">
                          <div className="text-center">
                            <div className="text-xs font-black text-white">₹{(Number(mgmtSummary?.totalRequestedAmount || 0) / 100000).toFixed(2)}L</div>
                            <div className="text-[9px] text-[var(--text-secondary)]">Total Expenses</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-[11px]">
                        {mgmtAnalytics?.categoryBreakdown?.map((cat: any, idx: number) => {
                          const colors = ['bg-[var(--primary)]', 'bg-[var(--primary)]', 'bg-[var(--badge-warning-bg)]', 'bg-[var(--primary)]', 'bg-[var(--secondary)]', 'bg-[var(--badge-success-bg)]', 'bg-[var(--action-danger-bg)]'];
                          return (
                            <div key={cat.category} className="flex items-center justify-between text-[var(--text-primary)]">
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${colors[idx % colors.length]}`}></span>
                                <span>{cat.category}</span>
                              </div>
                              <span className="font-mono font-medium text-[var(--text-secondary)]">{cat.percentage.toFixed(0)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Monthly Expense Trend (Apr - Mar) */}
                    <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider">Monthly Expense Trend</h3>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="flex items-center gap-1 text-[var(--text-secondary)]"><span className="w-2 h-2 rounded-full bg-[var(--badge-success-bg)]"></span> Approved</span>
                          <span className="flex items-center gap-1 text-[var(--text-secondary)]"><span className="w-2 h-2 rounded-full bg-[var(--badge-warning-bg)]"></span> Pending</span>
                          <span className="flex items-center gap-1 text-[var(--text-secondary)]"><span className="w-2 h-2 rounded-full bg-[var(--action-danger-bg)]"></span> Rejected</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-1 h-36 items-end pt-4 pb-1 border-b border-[var(--border-default)]">
                        {mgmtAnalytics?.monthlyTrend?.map((m: any) => {
                          const maxVal = Math.max(...mgmtAnalytics.monthlyTrend.map((x: any) => x.total || 1), 1);
                          const appH = (m.approved / maxVal) * 100;
                          const pendH = (m.pending / maxVal) * 100;
                          const rejH = (m.rejected / maxVal) * 100;

                          return (
                            <div key={m.month} className="flex flex-col items-center h-full justify-end">
                              <div className="w-full max-w-[14px] bg-[var(--bg-surface)] rounded-t flex flex-col justify-end overflow-hidden" style={{ height: '100%' }}>
                                <div className="bg-[var(--action-danger-bg)] w-full" style={{ height: `${rejH}%` }}></div>
                                <div className="bg-[var(--badge-warning-bg)] w-full" style={{ height: `${pendH}%` }}></div>
                                <div className="bg-[var(--badge-success-bg)] w-full" style={{ height: `${appH}%` }}></div>
                              </div>
                              <span className="text-[9px] text-[var(--text-secondary)] mt-1">{m.month}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Top Cost Categories */}
                    <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider">Top Cost Categories</h3>
                        <button onClick={() => setShowCategoryAnalyticsModal(true)} className="text-[11px] text-[var(--badge-info-text)] hover:text-[var(--badge-info-text)] font-semibold cursor-pointer">View All</button>
                      </div>

                      <div className="space-y-2 text-xs">
                        {mgmtAnalytics?.categoryBreakdown?.slice(0, 5).map((cat: any, idx: number) => (
                          <div key={cat.category} className="flex items-center justify-between p-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="w-4 h-4 rounded bg-[var(--bg-surface-muted)] flex items-center justify-center text-[10px] font-bold text-[var(--text-secondary)]">{idx + 1}</span>
                              <span className="font-medium text-[var(--text-primary)]">{cat.category}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-white">₹{cat.amount.toLocaleString('en-IN')}</span>
                              <span className="text-[10px] text-[var(--text-secondary)] font-mono">{cat.percentage.toFixed(0)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Department Analysis & Cost Optimization Insight */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-xl p-3.5 space-y-2">
                      <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider">Department Analysis</h3>
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-[var(--text-muted)] border-b border-[var(--border-default)] text-[10px] uppercase">
                            <th className="pb-1.5">Department</th>
                            <th className="pb-1.5 text-right">Active Emps</th>
                            <th className="pb-1.5 text-right">Total Expense</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)] text-[11px]">
                          {mgmtAnalytics?.departmentAnalysis?.map((d: any) => (
                            <tr key={d.department}>
                              <td className="py-1.5 text-[var(--text-primary)] font-medium">{d.department}</td>
                              <td className="py-1.5 text-right text-[var(--text-secondary)]">{d.employeesWithExpenses}</td>
                              <td className="py-1.5 text-right font-bold text-[var(--text-primary)]">₹{d.totalExpense.toLocaleString('en-IN')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-[var(--bg-surface)] border border-[var(--primary)]/30 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-[var(--badge-warning-text)] font-bold text-xs">
                        <TrendingUp className="w-4 h-4" />
                        <span>Cost Optimization Insight</span>
                      </div>
                      <p className="text-xs font-medium text-[var(--text-primary)] leading-relaxed pt-1">
                        {mgmtAnalytics?.costOptimizationInsight || "No expense data available for cost optimization analysis."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* RECENT EXPENSE REQUESTS */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4 space-y-3 shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[var(--primary)]" />
                        <span>Recent Expense Requests</span>
                      </h2>
                      <p className="text-[11px] text-[var(--text-secondary)]">Latest expense claims submitted by employees</p>
                    </div>
                    <button
                      onClick={() => {
                        setMainViewMode('PERSONAL');
                        setActiveRoleTab('WORKFORCE');
                      }}
                      className="text-xs text-[var(--badge-info-text)] hover:text-[var(--badge-info-text)] font-semibold cursor-pointer"
                    >
                      View All
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-[var(--border-default)] rounded-lg">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border-b border-[var(--border-default)] font-semibold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3">Employee</th>
                          <th className="py-2.5 px-3">Code</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {mgmtRecent.length === 0 ? (
                          <tr><td colSpan={8} className="py-6 text-center text-[var(--text-muted)]">No recent expense requests for {currentFy.label}.</td></tr>
                        ) : (
                          mgmtRecent.map(req => (
                            <tr key={req.id} className="hover:bg-[var(--bg-surface-muted)] transition-colors">
                              <td className="py-2 px-3 font-bold text-white flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-[var(--action-danger-bg)] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                  {req.employeeName.substring(0, 2).toUpperCase()}
                                </div>
                                <span>{req.employeeName}</span>
                              </td>
                              <td className="py-2 px-3 font-mono text-[var(--text-secondary)]">{req.employeeCode}</td>
                              <td className="py-2 px-3 text-[var(--text-primary)]">{req.claimType}</td>
                              <td className="py-2 px-3 text-[var(--text-secondary)] font-mono">{new Date(req.date).toLocaleDateString()}</td>
                              <td className="py-2 px-3 text-[var(--text-primary)]">{req.category}</td>
                              <td className="py-2 px-3 text-right font-bold text-white">₹{req.amount.toLocaleString('en-IN')}</td>
                              <td className="py-2 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  req.status === 'APPROVED' ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border-[var(--badge-success-border)]' :
                                  req.status === 'REJECTED' ? 'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border-[var(--action-danger-bg)]/30' :
                                  'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border-[var(--badge-warning-border)]'
                                }`}>
                                  {req.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => {
                                    if (req.claimSource === 'TRIP' || req.claimType === 'TRIP' || req.expense_type === 'TRIP') {
                                      loadTripDetails(req.id);
                                    } else {
                                      setSelectedSingleExpense(req);
                                    }
                                  }}
                                  className="px-2 py-0.5 bg-[var(--badge-info-bg)] hover:bg-[var(--bg-surface-hover)] border border-[var(--badge-info-border)]/60 text-[var(--badge-info-text)] rounded text-[10px] font-bold flex items-center gap-1 mx-auto cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>View</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE EMPLOYEE DETAILS DRAWER (WHEN EMPLOYEE SELECTED) */}
              {selectedEmpId && (
                <div className="w-80 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4 space-y-4 shadow-xl shrink-0 animate-in slide-in-from-right duration-200">
                  <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Employee Expense Details</h3>
                    <button onClick={() => setSelectedEmpId(null)} className="text-[var(--text-secondary)] hover:text-white"><X className="w-4 h-4" /></button>
                  </div>

                  {loadingEmpDrawer ? (
                    <div className="py-12 text-center text-xs text-[var(--text-secondary)]">Loading details...</div>
                  ) : empDrawerData ? (
                    <>
                      <div className="flex items-center gap-3 bg-[var(--bg-surface-elevated)] p-3 rounded-lg border border-[var(--border-default)]">
                        <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-sm font-black text-white shrink-0">
                          {empDrawerData.employee.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{empDrawerData.employee.name}</div>
                          <div className="text-[10px] text-[var(--text-secondary)] font-mono">{empDrawerData.employee.employeeCode}</div>
                          <div className="text-[10px] text-[var(--text-secondary)]">{empDrawerData.employee.department}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-[var(--bg-surface-elevated)] border border-[var(--badge-success-border)] p-2.5 rounded-lg space-y-1">
                          <div className="text-[10px] text-[var(--badge-success-text)] font-bold">Approved</div>
                          <div className="text-sm font-black text-white">₹{empDrawerData.summary.approvedAmount.toLocaleString('en-IN')}</div>
                        </div>
                        <div className="bg-[var(--bg-surface-elevated)] border border-[var(--badge-warning-border)] p-2.5 rounded-lg space-y-1">
                          <div className="text-[10px] text-[var(--badge-warning-text)] font-bold">Pending</div>
                          <div className="text-sm font-black text-white">₹{empDrawerData.summary.pendingAmount.toLocaleString('en-IN')}</div>
                        </div>
                        <div className="bg-[var(--bg-surface-elevated)] border border-[var(--action-danger-bg)]/30 p-2.5 rounded-lg space-y-1">
                          <div className="text-[10px] text-[var(--action-danger-bg)] font-bold">Rejected</div>
                          <div className="text-sm font-black text-white">₹{empDrawerData.summary.rejectedAmount.toLocaleString('en-IN')}</div>
                        </div>
                        <div className="bg-[var(--bg-surface-elevated)] border border-[var(--primary)]/30 p-2.5 rounded-lg space-y-1">
                          <div className="text-[10px] text-[var(--badge-info-text)] font-bold">Total Requested</div>
                          <div className="text-sm font-black text-white">₹{empDrawerData.summary.totalRequestedAmount.toLocaleString('en-IN')}</div>
                        </div>
                      </div>

                      <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-lg p-3 space-y-2">
                        <h4 className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider">Expense by Category</h4>
                        {empDrawerData.categories.map((c: any) => (
                          <div key={c.category} className="space-y-1 text-[11px]">
                            <div className="flex justify-between text-[var(--text-primary)]">
                              <span>{c.category}</span>
                              <span className="font-mono font-medium">₹{c.amount.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="w-full bg-[var(--bg-surface-muted)] h-1 rounded-full overflow-hidden">
                              <div className="bg-[var(--primary)] h-full rounded-full" style={{ width: `${Math.min(100, (c.amount / (empDrawerData.summary.totalRequestedAmount || 1)) * 100)}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-3 bg-[var(--bg-surface)] border border-[var(--primary)]/30 rounded-lg space-y-1 text-xs">
                        <div className="text-[10px] font-bold text-[var(--badge-warning-text)] uppercase">Cost Optimization Insight</div>
                        <p className="text-[11px] text-[var(--text-primary)] leading-normal pt-1">
                          Top spend for {empDrawerData.employee.name} is concentrated in local travel and business expenses.
                        </p>
                      </div>

                      {/* INDIVIDUAL EXPENSE RECORDS SECTION */}
                      <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
                          <h4 className="text-[10px] font-bold text-white uppercase tracking-wider">Individual Expense Records</h4>
                          <span className="text-[10px] text-[var(--text-secondary)] font-mono">Total: {empRecordSummary.totalRecords}</span>
                        </div>

                        {/* Record Filters */}
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          <select
                            value={empRecordTypeFilter}
                            onChange={e => { setEmpRecordTypeFilter(e.target.value); setEmpRecordPage(1); }}
                            className="px-2 py-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded text-[var(--text-primary)]"
                          >
                            <option value="">All Types</option>
                            <option value="BUSINESS">Business</option>
                            <option value="LOCAL_TRAVEL">Local Travel</option>
                            <option value="TRIP">Trip Expense</option>
                          </select>

                          <select
                            value={empRecordStatusFilter}
                            onChange={e => { setEmpRecordStatusFilter(e.target.value); setEmpRecordPage(1); }}
                            className="px-2 py-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded text-[var(--text-primary)]"
                          >
                            <option value="">All Statuses</option>
                            <option value="APPROVED">Approved</option>
                            <option value="SUBMITTED">Pending</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="DRAFT">Draft</option>
                          </select>
                        </div>

                        {/* Individual Record Table */}
                        {loadingEmpRecords ? (
                          <div className="py-6 text-center text-[10px] text-[var(--text-secondary)]">Loading records...</div>
                        ) : empRecordsList.length === 0 ? (
                          <div className="py-4 text-center text-[10px] text-[var(--text-muted)] italic">No records matching selected criteria.</div>
                        ) : (
                          <div className="space-y-2">
                            <div className="overflow-x-auto border border-[var(--border-default)] rounded">
                              <table className="w-full text-left text-[10px]">
                                <thead>
                                  <tr className="bg-[var(--bg-surface)] text-[var(--text-secondary)] border-b border-[var(--border-default)] font-semibold uppercase">
                                    <th className="py-1.5 px-2">Type</th>
                                    <th className="py-1.5 px-2">Date</th>
                                    <th className="py-1.5 px-2">Category</th>
                                    <th className="py-1.5 px-2 text-right">Amount (₹)</th>
                                    <th className="py-1.5 px-2 text-center">Status</th>
                                    <th className="py-1.5 px-2 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-subtle)]">
                                  {empRecordsList.map(rec => (
                                    <tr key={rec.id} className="hover:bg-[var(--bg-surface-muted)]">
                                      <td className="py-1.5 px-2 font-medium text-[var(--text-primary)]">{rec.expenseType}</td>
                                      <td className="py-1.5 px-2 font-mono text-[var(--text-secondary)]">{rec.date ? new Date(rec.date).toLocaleDateString() : '-'}</td>
                                      <td className="py-1.5 px-2 text-[var(--text-primary)] truncate max-w-[80px]">{rec.category}</td>
                                      <td className="py-1.5 px-2 text-right font-bold text-white">₹{rec.amount.toLocaleString('en-IN')}</td>
                                      <td className="py-1.5 px-2 text-center">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                          rec.status === 'APPROVED' ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)]' :
                                          rec.status === 'REJECTED' ? 'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)]' :
                                          'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)]'
                                        }`}>
                                          {rec.status}
                                        </span>
                                      </td>
                                      <td className="py-1.5 px-2 text-center">
                                        <button
                                          onClick={() => {
                                            if (rec.claimSource === 'TRIP') {
                                              loadTripDetails(rec.id);
                                            } else {
                                              setSelectedSingleExpense(rec);
                                            }
                                          }}
                                          className="p-1 text-[var(--primary)] hover:text-white"
                                          title="View Claim Details"
                                        >
                                          <Eye className="w-3 h-3" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] pt-1">
                              <div>Page {empRecordPage} of {empRecordTotalPages}</div>
                              <div className="flex items-center gap-1">
                                <button
                                  disabled={empRecordPage <= 1}
                                  onClick={() => setEmpRecordPage(p => p - 1)}
                                  className="px-2 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-default)] disabled:opacity-40 rounded text-[var(--text-primary)]"
                                >
                                  &lt;
                                </button>
                                <button
                                  disabled={empRecordPage >= empRecordTotalPages}
                                  onClick={() => setEmpRecordPage(p => p + 1)}
                                  className="px-2 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-default)] disabled:opacity-40 rounded text-[var(--text-primary)]"
                                >
                                  &gt;
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <button onClick={() => setSelectedEmpId(null)} className="w-full py-1.5 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-white rounded-lg text-xs font-bold transition-colors">
                        Close Details
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* ACTIVE TRIP DETAILS WORKSPACE VIEW */}
      {/* ---------------------------------------------------- */}
      {activeTrip ? (
        <div className="space-y-6">
          {/* Trip Summary Card Header */}
          <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-default)] pb-4">
              <div>
                <button
                  onClick={() => setActiveTrip(null)}
                  className="text-xs text-[var(--primary)] hover:text-[var(--primary)] font-semibold flex items-center gap-1 mb-2"
                >
                  ← Back to Claims List
                </button>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-[var(--badge-success-text)]" />
                    <span>Trip Expense Details</span>
                  </h2>
                  {activeTrip.status === 'DRAFT' && (
                    <button
                      onClick={handleOpenEditTrip}
                      className="p-1 text-[var(--text-secondary)] hover:text-[var(--primary)]"
                      title="Edit Parent Trip Details"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="text-xl font-extrabold font-mono text-[var(--badge-success-text)] mt-1">
                  INR {grandTripTotal.toFixed(2)}
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-primary)] mt-1 font-medium">
                  <span className="font-mono">{new Date(activeTrip.start_date).toDateString()} - {new Date(activeTrip.end_date).toDateString()}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-[var(--text-primary)] mt-3 pt-3 border-t border-[var(--border-default)] font-medium">
                  <div>Purpose: <strong className="text-white font-semibold">{activeTrip.purpose}</strong></div>
                  <div>Trip Location: <strong className="text-white font-semibold">{activeTrip.start_point} to {activeTrip.end_point}</strong></div>
                  <div>Currency: <strong className="font-mono text-[var(--badge-success-text)]">{activeTrip.currency || 'INR'}</strong></div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  activeTrip.status === 'APPROVED' ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border-[var(--badge-success-border)]' :
                  activeTrip.status === 'REJECTED' ? 'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border-[var(--action-danger-bg)]/30' :
                  activeTrip.status === 'DRAFT' ? 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border-[var(--border-default)]' :
                  'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border-[var(--badge-warning-border)]'
                }`}>
                  {activeTrip.status === 'DRAFT' ? 'Draft Mode' : activeTrip.status}
                </span>

                {isManagerOrAdmin && (activeTrip.status === 'SUBMITTED' || activeTrip.status === 'PENDING') && (
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => handleApproveTrip(activeTrip.id)} className="px-3 py-1 bg-[var(--badge-success-bg)] hover:bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] text-[var(--badge-success-text)] rounded-xl text-xs font-bold">Approve</button>
                    <button onClick={() => handleRejectTrip(activeTrip.id)} className="px-3 py-1 bg-[var(--action-danger-soft)] hover:bg-rose-900 border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] rounded-xl text-xs font-bold">Reject</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* THREE CHILD EXPENSE SECTIONS */}
          <div className="space-y-6">
            {/* 1. TRAVEL EXPENSE SECTION */}
            <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Plane className="w-4 h-4 text-[var(--secondary)]" />
                  <span>Travel Expense</span>
                </h3>
                {activeTrip.status === 'DRAFT' && (
                  <button
                    onClick={handleOpenAddTravel}
                    className="p-1.5 bg-[var(--primary)] hover:bg-[var(--primary)] text-white rounded-lg transition-all shadow flex items-center gap-1 text-xs font-semibold"
                    title="Add Travel Expense"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {(activeTrip.travelExpenses || []).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeTrip.travelExpenses.map((t: any) => (
                    <div key={t.id} className="p-4 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] hover:border-[var(--secondary)]/30 rounded-xl space-y-2 text-xs transition-all relative group">
                      <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
                        <span className="font-bold text-[var(--secondary)] text-xs">{t.transport_mode}</span>
                        <span className="font-mono text-[var(--text-secondary)]">{new Date(t.start_date).toLocaleDateString()} - {new Date(t.end_date).toLocaleDateString()}</span>
                      </div>
                      <div className="font-semibold text-[var(--text-primary)]">{t.start_location} → {t.end_location}</div>
                      <p className="text-[var(--text-secondary)] truncate">{t.purpose}</p>
                      {t.merchant && <div className="text-[10px] text-[var(--text-muted)]">Merchant: {t.merchant}</div>}
                      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-default)]">
                        <span className="font-mono font-bold text-[var(--badge-success-text)] text-sm">₹{Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        <div className="flex items-center gap-2">
                          {t.receipt_url && (
                            <button
                              type="button"
                              onClick={() => setActiveViewFile({ url: t.receipt_url, name: `${t.transport_mode || 'Travel'}_Receipt` })}
                              className="px-2 py-0.5 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--primary)] rounded text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              File
                            </button>
                          )}
                          {activeTrip.status === 'DRAFT' && (
                            <>
                              <button onClick={() => handleOpenEditTravel(t)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--primary)]"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteTravelChild(t.id)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--action-danger-bg)]"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-[var(--text-muted)] text-xs italic bg-[var(--bg-surface-muted)] rounded-xl border border-dashed border-[var(--border-default)]">
                  No travel expenses
                </div>
              )}
            </div>

            {/* 2. ACCOMMODATION EXPENSE SECTION */}
            <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Hotel className="w-4 h-4 text-[var(--primary)]" />
                  <span>Accommodation Expense</span>
                </h3>
                {activeTrip.status === 'DRAFT' && (
                  <button
                    onClick={handleOpenAddAccom}
                    className="p-1.5 bg-[var(--primary)] hover:bg-[var(--primary)] text-white rounded-lg transition-all shadow flex items-center gap-1 text-xs font-semibold"
                    title="Add Accommodation Expense"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {(activeTrip.accommodationExpenses || []).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeTrip.accommodationExpenses.map((a: any) => (
                    <div key={a.id} className="p-4 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] hover:border-[var(--primary)]/30 rounded-xl space-y-2 text-xs transition-all relative group">
                      <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
                        <span className="font-semibold text-[var(--text-primary)]">Hotel / Lodging</span>
                        <span className="font-mono text-[var(--text-secondary)]">{new Date(a.start_date).toLocaleDateString()} - {new Date(a.end_date).toLocaleDateString()}</span>
                      </div>
                      <p className="font-medium text-[var(--text-primary)]">{a.accommodation_details}</p>
                      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-default)]">
                        <span className="font-mono font-bold text-[var(--badge-success-text)] text-sm">₹{Number(a.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        <div className="flex items-center gap-2">
                          {a.receipt_url && (
                            <button
                              type="button"
                              onClick={() => setActiveViewFile({ url: a.receipt_url, name: 'Accommodation_Receipt' })}
                              className="px-2 py-0.5 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--primary)] rounded text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              File
                            </button>
                          )}
                          {activeTrip.status === 'DRAFT' && (
                            <>
                              <button onClick={() => handleOpenEditAccom(a)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--primary)]"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteAccomChild(a.id)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--action-danger-bg)]"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-[var(--text-muted)] text-xs italic bg-[var(--bg-surface-muted)] rounded-xl border border-dashed border-[var(--border-default)]">
                  No accommodation expenses
                </div>
              )}
            </div>

            {/* 3. OTHER EXPENSE SECTION */}
            <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[var(--badge-warning-text)]" />
                  <span>Other Expense</span>
                </h3>
                {activeTrip.status === 'DRAFT' && (
                  <button
                    onClick={handleOpenAddOther}
                    className="p-1.5 bg-amber-600 hover:bg-[var(--badge-warning-bg)] text-white rounded-lg transition-all shadow flex items-center gap-1 text-xs font-semibold"
                    title="Add Other Expense"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {(activeTrip.otherExpenses || []).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeTrip.otherExpenses.map((o: any) => (
                    <div key={o.id} className="p-4 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] hover:border-[var(--badge-warning-border)] rounded-xl space-y-2 text-xs transition-all relative group">
                      <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
                        <span className="font-bold text-[var(--badge-warning-text)] text-xs">{o.category}</span>
                        <span className="font-mono text-[var(--text-secondary)]">{new Date(o.transaction_date).toLocaleDateString()}</span>
                      </div>
                      <p className="font-medium text-[var(--text-primary)]">{o.purpose}</p>
                      {o.merchant && <div className="text-[10px] text-[var(--text-muted)]">Merchant: {o.merchant}</div>}
                      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-default)]">
                        <span className="font-mono font-bold text-[var(--badge-success-text)] text-sm">₹{Number(o.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        <div className="flex items-center gap-2">
                          {o.receipt_url && (
                            <button
                              type="button"
                              onClick={() => setActiveViewFile({ url: o.receipt_url, name: `${o.category || 'Other'}_Receipt` })}
                              className="px-2 py-0.5 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--primary)] rounded text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              File
                            </button>
                          )}
                          {activeTrip.status === 'DRAFT' && (
                            <>
                              <button onClick={() => handleOpenEditOther(o)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--primary)]"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteOtherChild(o.id)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--action-danger-bg)]"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-[var(--text-muted)] text-xs italic bg-[var(--bg-surface-muted)] rounded-xl border border-dashed border-[var(--border-default)]">
                  No other expenses
                </div>
              )}
            </div>
          </div>

          {/* FINAL TRIP SUBMIT BAR */}
          <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-2xl">
            <div>
              <span className="text-xs text-[var(--text-secondary)] block font-medium uppercase">TOTAL TRIP AMOUNT</span>
              <span className="text-2xl font-extrabold font-mono text-[var(--badge-success-text)]">₹{grandTripTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTrip(null)}
                className="px-4 py-2.5 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded-xl text-xs font-semibold"
              >
                Back to Claims List
              </button>

              {activeTrip.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={handleOpenFinalSubmitModal}
                  className="px-6 py-2.5 bg-[var(--badge-success-bg)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-xs font-extrabold shadow-xs"
                >
                  SUBMIT
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ---------------------------------------------------- */
        /* MAIN CLAIMS LANDING PAGE */
        /* ---------------------------------------------------- */
        <div className="space-y-6">
          {/* Landing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => handleOpenSingleModal('BUSINESS')}
              className="p-5 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--primary)]/60 rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.01] shadow-xl group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-[var(--primary)]/10 text-[var(--primary)] rounded-xl border border-[var(--primary)]/30 group-hover:bg-[var(--primary)] group-hover:text-white transition-all">
                  <Building className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-0.5 bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] text-[var(--badge-success-text)] text-[10px] font-bold rounded-full">ACTIVE</span>
              </div>
              <h3 className="font-bold text-white text-base mb-1">Business Expense</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-4">Submit food, courier, office supply, or raw material claims</p>
              <button className="w-full py-2 bg-[var(--primary)]/20 hover:bg-[var(--primary)] text-[var(--primary)] hover:text-white font-semibold text-xs rounded-xl border border-[var(--primary)]/30 transition-all flex items-center justify-center gap-1.5">
                <Plus className="w-4 h-4" />
                <span>New Business Claim</span>
              </button>
            </div>

            <div
              onClick={() => handleOpenSingleModal('LOCAL_TRAVEL')}
              className="p-5 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--primary)]/60 rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.01] shadow-xl group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-[var(--secondary)]/15 text-[var(--secondary)] rounded-xl border border-[var(--secondary)]/30 group-hover:bg-[var(--primary)] group-hover:text-white transition-all">
                  <Navigation className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-0.5 bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] text-[var(--badge-success-text)] text-[10px] font-bold rounded-full">ACTIVE</span>
              </div>
              <h3 className="font-bold text-white text-base mb-1">Local Travel Expense</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-4">Submit taxi, auto, metro, bus, or field visit travel claims</p>
              <button className="w-full py-2 bg-[var(--secondary)]/20 hover:bg-[var(--primary)] text-[var(--secondary)] hover:text-white font-semibold text-xs rounded-xl border border-[var(--secondary)]/30 transition-all flex items-center justify-center gap-1.5">
                <Plus className="w-4 h-4" />
                <span>New Local Travel Claim</span>
              </button>
            </div>

            <div
              onClick={handleOpenCreateTrip}
              className="p-5 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--badge-success-border)] rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.01] shadow-xl group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] rounded-xl border border-[var(--badge-success-border)] group-hover:bg-[var(--badge-success-bg)] group-hover:text-white transition-all">
                  <MapPin className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-0.5 bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] text-[var(--badge-success-text)] text-[10px] font-bold rounded-full">ACTIVE</span>
              </div>
              <h3 className="font-bold text-white text-base mb-1">Trip Expense</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-4">Multi-day outstation trips with travel, hotel & other expenses</p>
              <button className="w-full py-2 bg-[var(--badge-success-bg)] hover:bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] hover:text-white font-semibold text-xs rounded-xl border border-[var(--badge-success-border)] transition-all flex items-center justify-center gap-1.5">
                <Plus className="w-4 h-4" />
                <span>Create New Trip Claim</span>
              </button>
            </div>
          </div>

          {/* NEW MY EXPENSES SUMMARY SECTION */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[var(--primary)]" />
                  <span>My Expenses Summary</span>
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Overview of all your expense claims and their current status
                </p>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[...Array(6)].map((_, idx) => (
                  <div key={idx} className="h-28 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl p-4 space-y-3 animate-pulse">
                    <div className="h-4 w-20 bg-[var(--bg-surface-muted)] rounded"></div>
                    <div className="h-5 w-16 bg-[var(--bg-surface-muted)] rounded"></div>
                    <div className="h-4 w-24 bg-[var(--bg-surface-muted)] rounded"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. TOTAL EXPENSES */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Filter by Total Expenses"
                  onClick={() => setStatusFilter('')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setStatusFilter(''); }}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none relative group flex flex-col justify-between ${
                    !statusFilter
                      ? 'bg-[var(--bg-surface)] border-[var(--primary)]/80 ring-1 ring-1 ring-[var(--primary)]/30 shadow-xs scale-[1.01]'
                      : 'bg-[var(--bg-surface-muted)] border-[var(--border-default)] hover:border-[var(--primary)]/30 hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-[var(--primary)]">Total Expenses</span>
                    <div className={`p-1.5 rounded-lg border transition-colors ${
                      !statusFilter ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]' : 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30 group-hover:bg-[var(--primary)] group-hover:text-[var(--primary-text)]'
                    }`}>
                      <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-white leading-tight">
                      {empSummaryMetrics.total.count} <span className="text-xs font-normal text-[var(--text-secondary)]">{empSummaryMetrics.total.count === 1 ? 'Claim' : 'Claims'}</span>
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold font-mono text-[var(--primary)] mt-1 truncate">
                      ₹{empSummaryMetrics.total.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-end">
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${!statusFilter ? 'text-[var(--primary)] translate-x-0.5' : 'text-[var(--text-muted)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5'}`} />
                  </div>
                </div>

                {/* 2. DRAFTS */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Filter by Draft Expenses"
                  onClick={() => setStatusFilter('DRAFT')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setStatusFilter('DRAFT'); }}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none relative group flex flex-col justify-between ${
                    statusFilter === 'DRAFT'
                      ? 'bg-[var(--bg-surface)] border-[var(--badge-warning-border)] ring-1 ring-1 ring-[var(--primary)]/30 shadow-xs scale-[1.01]'
                      : 'bg-[var(--bg-surface-muted)] border-[var(--border-default)] hover:border-[var(--badge-warning-border)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-[var(--badge-warning-text)]">Drafts</span>
                    <div className={`p-1.5 rounded-lg border transition-colors ${
                      statusFilter === 'DRAFT' ? 'bg-[var(--badge-warning-bg)] text-[var(--primary-text)] border-[var(--badge-warning-border)]' : 'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border-[var(--badge-warning-border)] group-hover:bg-[var(--badge-warning-bg)] group-hover:text-[var(--primary-text)]'
                    }`}>
                      <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-white leading-tight">
                      {empSummaryMetrics.draft.count} <span className="text-xs font-normal text-[var(--text-secondary)]">{empSummaryMetrics.draft.count === 1 ? 'Claim' : 'Claims'}</span>
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold font-mono text-[var(--badge-warning-text)] mt-1 truncate">
                      ₹{empSummaryMetrics.draft.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-end">
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${statusFilter === 'DRAFT' ? 'text-[var(--badge-warning-text)] translate-x-0.5' : 'text-[var(--text-muted)] group-hover:text-[var(--badge-warning-text)] group-hover:translate-x-0.5'}`} />
                  </div>
                </div>

                {/* 3. SUBMITTED */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Filter by Submitted Expenses"
                  onClick={() => setStatusFilter('PENDING')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setStatusFilter('PENDING'); }}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none relative group flex flex-col justify-between ${
                    statusFilter === 'PENDING' || statusFilter === 'SUBMITTED'
                      ? 'bg-[var(--bg-surface)] border-[var(--primary)]/80 ring-1 ring-1 ring-[var(--primary)]/30 shadow-xs scale-[1.01]'
                      : 'bg-[var(--bg-surface-muted)] border-[var(--border-default)] hover:border-[var(--secondary)]/30 hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-[var(--secondary)]">Submitted</span>
                    <div className={`p-1.5 rounded-lg border transition-colors ${
                      statusFilter === 'PENDING' || statusFilter === 'SUBMITTED' ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]' : 'bg-[var(--secondary)]/15 text-[var(--secondary)] border-[var(--secondary)]/30 group-hover:bg-[var(--primary)] group-hover:text-[var(--primary-text)]'
                    }`}>
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-white leading-tight">
                      {empSummaryMetrics.submitted.count} <span className="text-xs font-normal text-[var(--text-secondary)]">{empSummaryMetrics.submitted.count === 1 ? 'Claim' : 'Claims'}</span>
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold font-mono text-[var(--secondary)] mt-1 truncate">
                      ₹{empSummaryMetrics.submitted.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-end">
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${statusFilter === 'PENDING' || statusFilter === 'SUBMITTED' ? 'text-[var(--secondary)] translate-x-0.5' : 'text-[var(--text-muted)] group-hover:text-[var(--secondary)] group-hover:translate-x-0.5'}`} />
                  </div>
                </div>

                {/* 4. APPROVED */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Filter by Approved Expenses"
                  onClick={() => setStatusFilter('APPROVED')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setStatusFilter('APPROVED'); }}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none relative group flex flex-col justify-between ${
                    statusFilter === 'APPROVED'
                      ? 'bg-[var(--bg-surface)] border-[var(--badge-success-border)] ring-1 ring-1 ring-[var(--primary)]/30 shadow-xs scale-[1.01]'
                      : 'bg-[var(--bg-surface-muted)] border-[var(--border-default)] hover:border-[var(--badge-success-border)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-[var(--badge-success-text)]">Approved</span>
                    <div className={`p-1.5 rounded-lg border transition-colors ${
                      statusFilter === 'APPROVED' ? 'bg-[var(--badge-success-bg)] text-[var(--primary-text)] border-[var(--badge-success-border)]' : 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border-[var(--badge-success-border)] group-hover:bg-[var(--badge-success-bg)] group-hover:text-[var(--primary-text)]'
                    }`}>
                      <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-white leading-tight">
                      {empSummaryMetrics.approved.count} <span className="text-xs font-normal text-[var(--text-secondary)]">{empSummaryMetrics.approved.count === 1 ? 'Claim' : 'Claims'}</span>
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold font-mono text-[var(--badge-success-text)] mt-1 truncate">
                      ₹{empSummaryMetrics.approved.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-end">
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${statusFilter === 'APPROVED' ? 'text-[var(--badge-success-text)] translate-x-0.5' : 'text-[var(--text-muted)] group-hover:text-[var(--badge-success-text)] group-hover:translate-x-0.5'}`} />
                  </div>
                </div>

                {/* 5. REJECTED */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Filter by Rejected Expenses"
                  onClick={() => setStatusFilter('REJECTED')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setStatusFilter('REJECTED'); }}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none relative group flex flex-col justify-between ${
                    statusFilter === 'REJECTED'
                      ? 'bg-[var(--bg-surface)] border-[var(--action-danger-bg)]/30 ring-1 ring-1 ring-[var(--primary)]/30 shadow-xs scale-[1.01]'
                      : 'bg-[var(--bg-surface-muted)] border-[var(--border-default)] hover:border-[var(--action-danger-bg)]/30 hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-[var(--action-danger-bg)]">Rejected</span>
                    <div className={`p-1.5 rounded-lg border transition-colors ${
                      statusFilter === 'REJECTED' ? 'bg-[var(--action-danger-bg)] text-[var(--primary-text)] border-[var(--action-danger-bg)]/30' : 'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border-[var(--action-danger-bg)]/30 group-hover:bg-[var(--action-danger-bg)] group-hover:text-[var(--primary-text)]'
                    }`}>
                      <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-white leading-tight">
                      {empSummaryMetrics.rejected.count} <span className="text-xs font-normal text-[var(--text-secondary)]">{empSummaryMetrics.rejected.count === 1 ? 'Claim' : 'Claims'}</span>
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold font-mono text-[var(--action-danger-bg)] mt-1 truncate">
                      ₹{empSummaryMetrics.rejected.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-end">
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${statusFilter === 'REJECTED' ? 'text-[var(--action-danger-bg)] translate-x-0.5' : 'text-[var(--text-muted)] group-hover:text-[var(--action-danger-bg)] group-hover:translate-x-0.5'}`} />
                  </div>
                </div>

                {/* 6. CANCELLED */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Filter by Cancelled Expenses"
                  onClick={() => setStatusFilter('CANCELLED')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setStatusFilter('CANCELLED'); }}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none relative group flex flex-col justify-between ${
                    statusFilter === 'CANCELLED'
                      ? 'bg-[var(--bg-surface)] border-[var(--border-default)] ring-1 ring-[var(--border-default)] shadow-lg shadow-xs scale-[1.01]'
                      : 'bg-[var(--bg-surface-muted)] border-[var(--border-default)] hover:border-[var(--border-default)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">Cancelled</span>
                    <div className={`p-1.5 rounded-lg border transition-colors ${
                      statusFilter === 'CANCELLED' ? 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border-[var(--border-default)]' : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border-[var(--border-default)] group-hover:bg-[var(--bg-surface-hover)] group-hover:text-white'
                    }`}>
                      <Ban className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-white leading-tight">
                      {empSummaryMetrics.cancelled.count} <span className="text-xs font-normal text-[var(--text-secondary)]">{empSummaryMetrics.cancelled.count === 1 ? 'Claim' : 'Claims'}</span>
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold font-mono text-[var(--text-primary)] mt-1 truncate">
                      ₹{empSummaryMetrics.cancelled.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-end">
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${statusFilter === 'CANCELLED' ? 'text-[var(--text-primary)] translate-x-0.5' : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)] group-hover:translate-x-0.5'}`} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Table Tabs */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-[var(--bg-surface-muted)] p-1 rounded-xl border border-[var(--border-default)]">
                  <button
                    onClick={() => setClaimCategoryTab('SINGLE_EXPENSES')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      claimCategoryTab === 'SINGLE_EXPENSES' ? 'bg-[var(--primary)] text-white shadow' : 'text-[var(--text-secondary)] hover:text-white'
                    }`}
                  >
                    Single Claims (Business & Local Travel)
                  </button>
                  <button
                    onClick={() => setClaimCategoryTab('TRIP_EXPENSES')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      claimCategoryTab === 'TRIP_EXPENSES' ? 'bg-[var(--primary)] text-white shadow' : 'text-[var(--text-secondary)] hover:text-white'
                    }`}
                  >
                    Trip Expenses ({displayedTrips.length})
                  </button>
                </div>

                {isManagerOrAdmin && (
                  <div className="flex items-center gap-1 bg-[var(--bg-surface-muted)] p-1 rounded-xl border border-[var(--border-default)]">
                    <button
                      onClick={() => setActiveRoleTab('WORKFORCE')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        activeRoleTab === 'WORKFORCE' ? 'bg-[var(--primary)] text-white shadow' : 'text-[var(--text-secondary)] hover:text-white'
                      }`}
                    >
                      Workforce Claims ({allExpenses.length + allTrips.length})
                    </button>
                    <button
                      onClick={() => setActiveRoleTab('MY_CLAIMS')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        activeRoleTab === 'MY_CLAIMS' ? 'bg-[var(--primary)] text-white shadow' : 'text-[var(--text-secondary)] hover:text-white'
                      }`}
                    >
                      My Claims ({myExpenses.length + myTrips.length})
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
                >
                  <option value="">All Expenses</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="PENDING">SUBMITTED</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>

            {claimCategoryTab === 'SINGLE_EXPENSES' && (
              <div className="overflow-x-auto border border-[var(--border-default)] rounded-xl">
                <table className="w-full text-left text-xs text-[var(--text-primary)]">
                  <thead className="bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] uppercase font-semibold text-[10px] border-b border-[var(--border-default)]">
                    <tr>
                      {activeRoleTab === 'WORKFORCE' && <th className="p-3">Employee</th>}
                      <th className="p-3">Type</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Merchant / Locations</th>
                      <th className="p-3">Amount (₹)</th>
                      <th className="p-3">Bucket</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {displayedSingleExpenses.map(ex => (
                      <tr key={ex.id} className="hover:bg-[var(--bg-surface-muted)]">
                        {activeRoleTab === 'WORKFORCE' && (
                          <td className="p-3 font-semibold text-[var(--text-primary)]">
                            <div>{ex.employee_name}</div>
                            <span className="text-[10px] font-mono text-[var(--text-muted)]">{ex.employee_code}</span>
                          </td>
                        )}
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            ex.expense_type === 'LOCAL_TRAVEL'
                              ? 'bg-[var(--secondary)]/15 text-[var(--secondary)] border-[var(--secondary)]/30'
                              : 'bg-[var(--bg-surface-muted)] text-[var(--primary)] border-[var(--primary)]'
                          }`}>
                            {ex.expense_type === 'LOCAL_TRAVEL' ? 'Local Travel' : 'Business'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[var(--text-secondary)]">{ex.transaction_date ? new Date(ex.transaction_date).toLocaleDateString() : '-'}</td>
                        <td className="p-3 font-semibold text-[var(--text-primary)]">{ex.category || ex.category_name}</td>
                        <td className="p-3 max-w-[200px] truncate">
                          {ex.merchant && <span className="font-semibold text-[var(--text-primary)] block">{ex.merchant}</span>}
                          {ex.expense_type === 'LOCAL_TRAVEL' && ex.start_location && (
                            <span className="text-[10px] text-[var(--text-secondary)] block truncate">
                              {ex.start_location} → {ex.end_location} ({ex.transport_mode})
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-[var(--badge-success-text)]">
                          ₹{Number(ex.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 font-mono text-[10px]">{ex.bucket || 'Primary'}</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            ex.status === 'APPROVED' ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border-[var(--badge-success-border)]' :
                            ex.status === 'REJECTED' ? 'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border-[var(--action-danger-bg)]/30' :
                            ex.status === 'CANCELLED' ? 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border-[var(--border-default)]' :
                            ex.status === 'DRAFT' ? 'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border-[var(--badge-warning-border)]' :
                            'bg-[var(--secondary)]/15 text-[var(--secondary)] border-[var(--secondary)]/30'
                          }`}>
                            {ex.status === 'PENDING' ? 'SUBMITTED' : ex.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-1">
                          <button onClick={() => setSelectedSingleExpense(ex)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--primary)]" title="View Details">
                            <Eye className="w-4 h-4" />
                          </button>
                          {user?.role === 'SUPER_ADMIN' && (
                            <button
                              onClick={() => { setDeleteConfirmExpense(ex); setDeleteInputText(''); }}
                              className="p-1 text-[var(--action-danger-bg)] hover:text-[var(--action-danger-bg)] hover:bg-[var(--action-danger-soft)] rounded transition-colors inline-block"
                              title="Delete Expense Permanently (Super Admin Only)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {activeRoleTab === 'WORKFORCE' && user?.employeeId !== ex.employee_id && (ex.status === 'SUBMITTED' || ex.status === 'PENDING') && (
                            <>
                              <button onClick={() => handleApproveSingle(ex.id)} className="px-2 py-0.5 bg-[var(--badge-success-bg)] hover:bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] text-[var(--badge-success-text)] rounded text-[10px] font-bold">Approve</button>
                              <button onClick={() => handleRejectSingle(ex.id)} className="px-2 py-0.5 bg-[var(--action-danger-soft)] hover:bg-rose-900 border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] rounded text-[10px] font-bold">Reject</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {loading ? (
                      <tr>
                        <td colSpan={activeRoleTab === 'WORKFORCE' ? 9 : 8} className="p-8 text-center text-[var(--text-secondary)] font-medium">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--primary)]" />
                          <span>Loading claims...</span>
                        </td>
                      </tr>
                    ) : displayedSingleExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={activeRoleTab === 'WORKFORCE' ? 9 : 8} className="p-8 text-center text-[var(--text-secondary)] italic font-medium">
                          {statusFilter === 'APPROVED' ? 'No approved expenses yet. Submit an expense claim and it will appear here once approved.' :
                           statusFilter === 'DRAFT' ? 'No draft expenses. Create a claim to save it as a draft.' :
                           statusFilter === 'PENDING' || statusFilter === 'SUBMITTED' ? 'No submitted expenses currently under review.' :
                           statusFilter === 'REJECTED' ? 'No rejected expenses.' :
                           statusFilter === 'CANCELLED' ? 'No cancelled expenses.' :
                           'No single expense claims found.'}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}

            {claimCategoryTab === 'TRIP_EXPENSES' && (
              <div className="overflow-x-auto border border-[var(--border-default)] rounded-xl">
                <table className="w-full text-left text-xs text-[var(--text-primary)]">
                  <thead className="bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] uppercase font-semibold text-[10px] border-b border-[var(--border-default)]">
                    <tr>
                      {activeRoleTab === 'WORKFORCE' && <th className="p-3">Employee</th>}
                      <th className="p-3">Trip Purpose</th>
                      <th className="p-3">Route</th>
                      <th className="p-3">Dates</th>
                      <th className="p-3">Expenses Included</th>
                      <th className="p-3">Total Amount (₹)</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {displayedTrips.map(tr => (
                      <tr key={tr.id} className="hover:bg-[var(--bg-surface-muted)]">
                        {activeRoleTab === 'WORKFORCE' && (
                          <td className="p-3 font-semibold text-[var(--text-primary)]">
                            <div>{tr.employee_name}</div>
                            <span className="text-[10px] font-mono text-[var(--text-muted)]">{tr.employee_code}</span>
                          </td>
                        )}
                        <td className="p-3 font-bold text-white">{tr.purpose}</td>
                        <td className="p-3 text-[var(--primary)] font-semibold">{tr.start_point} → {tr.end_point}</td>
                        <td className="p-3 font-mono text-[var(--text-secondary)]">{new Date(tr.start_date).toLocaleDateString()} — {new Date(tr.end_date).toLocaleDateString()}</td>
                        <td className="p-3 space-x-1">
                          <span className="px-2 py-0.5 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] text-[var(--secondary)] font-mono text-[10px] rounded">{tr.travel_count || 0} Travel</span>
                          <span className="px-2 py-0.5 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] text-[var(--primary)] font-mono text-[10px] rounded">{tr.accom_count || 0} Hotel</span>
                          <span className="px-2 py-0.5 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] text-[var(--badge-warning-text)] font-mono text-[10px] rounded">{tr.other_count || 0} Other</span>
                        </td>
                        <td className="p-3 font-mono font-extrabold text-[var(--badge-success-text)]">
                          ₹{Number(tr.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            tr.status === 'APPROVED' ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border-[var(--badge-success-border)]' :
                            tr.status === 'REJECTED' ? 'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border-[var(--action-danger-bg)]/30' :
                            tr.status === 'CANCELLED' ? 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border-[var(--border-default)]' :
                            tr.status === 'DRAFT' ? 'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border-[var(--badge-warning-border)]' :
                            'bg-[var(--secondary)]/15 text-[var(--secondary)] border-[var(--secondary)]/30'
                          }`}>
                            {tr.status === 'PENDING' ? 'SUBMITTED' : tr.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-1">
                          <button
                            onClick={() => loadTripDetails(tr.id)}
                            className="px-2.5 py-1 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] border border-[var(--primary)] text-[var(--primary)] rounded text-[10px] font-bold flex items-center gap-1 inline-flex"
                          >
                            <span>{tr.status === 'DRAFT' ? 'Manage Trip' : 'Trip Details'}</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>

                          {activeRoleTab === 'WORKFORCE' && user?.employeeId !== tr.employee_id && (tr.status === 'SUBMITTED' || tr.status === 'PENDING') && (
                            <>
                              <button onClick={() => handleApproveTrip(tr.id)} className="px-2 py-1 bg-[var(--badge-success-bg)] hover:bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] text-[var(--badge-success-text)] rounded text-[10px] font-bold">Approve</button>
                              <button onClick={() => handleRejectTrip(tr.id)} className="px-2 py-1 bg-[var(--action-danger-soft)] hover:bg-rose-900 border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] rounded text-[10px] font-bold">Reject</button>
                            </>
                          )}

                          {user?.role === 'SUPER_ADMIN' && (
                            <button
                              onClick={() => {
                                setDeleteConfirmTrip(tr);
                                setDeleteInputText('');
                              }}
                              className="px-2.5 py-1 bg-[var(--action-danger-soft)] hover:bg-rose-900 border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              title="Delete Trip Expense (Super Admin)"
                            >
                              <Trash2 className="w-3 h-3 text-[var(--action-danger-bg)]" />
                              <span>Delete</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {loading ? (
                      <tr>
                        <td colSpan={activeRoleTab === 'WORKFORCE' ? 8 : 7} className="p-8 text-center text-[var(--text-secondary)] font-medium">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--primary)]" />
                          <span>Loading trip claims...</span>
                        </td>
                      </tr>
                    ) : displayedTrips.length === 0 ? (
                      <tr>
                        <td colSpan={activeRoleTab === 'WORKFORCE' ? 8 : 7} className="p-8 text-center text-[var(--text-secondary)] italic font-medium">
                          {statusFilter === 'APPROVED' ? 'No approved trip expenses yet.' :
                           statusFilter === 'DRAFT' ? 'No draft trip expenses. Create a trip to save it as a draft.' :
                           statusFilter === 'PENDING' || statusFilter === 'SUBMITTED' ? 'No submitted trip expenses under review.' :
                           statusFilter === 'REJECTED' ? 'No rejected trip expenses.' :
                           statusFilter === 'CANCELLED' ? 'No cancelled trip expenses.' :
                           'No trip expense claims found.'}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODALS (PORTAL RENDERED FOR ISOLATED OVERLAY STACKING) */}
      {/* ---------------------------------------------------- */}

      {/* ALERT MODAL: TRIP INITIATED */}
      {showInitiatedAlert && createPortal(
        <div className="fixed inset-0 z-[5000] bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl text-center z-[5001]">
            <h3 className="font-bold text-lg text-white">Trip Expense Initiated</h3>
            <p className="text-xs text-[var(--text-primary)]">You can add all the trip related expenses here.</p>
            <button
              onClick={() => setShowInitiatedAlert(false)}
              className="px-6 py-2 bg-[var(--badge-success-bg)] hover:bg-[var(--primary-hover)] text-white rounded-xl font-extrabold text-xs shadow-lg"
            >
              OKAY
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* 1. SINGLE CLAIM MODAL */}
      {showSingleModal && createPortal(
        <div className="fixed inset-0 z-[5000] bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto z-[5001]">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                {singleClaimType === 'BUSINESS' ? <Building className="w-5 h-5 text-[var(--primary)]" /> : <Navigation className="w-5 h-5 text-[var(--secondary)]" />}
                <span>{singleClaimType === 'BUSINESS' ? 'Business Expense Claim' : 'Local Travel Expense Claim'}</span>
              </h3>
              <button type="button" onClick={() => setShowSingleModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--action-danger-bg)] shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={e => { e.preventDefault(); handleSubmitSingleClaim('SUBMITTED'); }} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Transaction Date *</label>
                  <input type="date" required value={singleFormData.transactionDate} onChange={e => setSingleFormData({ ...singleFormData, transactionDate: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono" />
                </div>
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Category *</label>
                  <select required value={singleFormData.category} onChange={e => setSingleFormData({ ...singleFormData, category: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]">
                    {(singleClaimType === 'BUSINESS' ? BUSINESS_CATEGORIES : LOCAL_TRAVEL_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Purpose / Note *</label>
                <textarea required rows={2} value={singleFormData.description} onChange={e => setSingleFormData({ ...singleFormData, description: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="Reason for expense..." />
              </div>

              {singleClaimType === 'LOCAL_TRAVEL' && (
                <div className="space-y-3 p-3 bg-[var(--secondary)]/15 border border-[var(--secondary)]/30/40 rounded-xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[var(--secondary)] mb-1 font-medium">Mode of Transport *</label>
                      <select required value={singleFormData.transportMode} onChange={e => setSingleFormData({ ...singleFormData, transportMode: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]">
                        {TRANSPORT_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--secondary)] mb-1 font-medium">Merchant *</label>
                      <input type="text" required value={singleFormData.merchant} onChange={e => setSingleFormData({ ...singleFormData, merchant: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="Uber / Ola" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[var(--secondary)] mb-1 font-medium">Start Location *</label>
                      <input type="text" required value={singleFormData.startLocation} onChange={e => setSingleFormData({ ...singleFormData, startLocation: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="HQ Office" />
                    </div>
                    <div>
                      <label className="block text-[var(--secondary)] mb-1 font-medium">End Location *</label>
                      <input type="text" required value={singleFormData.endLocation} onChange={e => setSingleFormData({ ...singleFormData, endLocation: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="Client Site" />
                    </div>
                  </div>
                </div>
              )}

              {singleClaimType === 'BUSINESS' && (
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Merchant / Vendor</label>
                  <input type="text" value={singleFormData.merchant} onChange={e => setSingleFormData({ ...singleFormData, merchant: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="Amazon / Vendor Name" />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Currency *</label>
                  <select value={singleFormData.currency} onChange={e => setSingleFormData({ ...singleFormData, currency: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono">
                    <option value="INR">Indian Rupee</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Amount (₹) *</label>
                  <input type="number" step="0.01" required value={singleFormData.amount} onChange={e => setSingleFormData({ ...singleFormData, amount: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono font-bold" placeholder="0.00" />
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Expense Bucket *</label>
                <select value={singleFormData.bucket} onChange={e => setSingleFormData({ ...singleFormData, bucket: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono">
                  {BUCKET_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              {/* ATTACHMENT UPLOAD */}
              <div className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl space-y-2">
                <label className="block text-[var(--text-primary)] font-medium flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[var(--primary)]" />
                  <span>Receipt / Document Attachment</span>
                </label>
                <input
                  type="file"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setRawFile(file);
                      setAttachment({ name: file.name, url: URL.createObjectURL(file) });
                    }
                  }}
                  className="block w-full text-xs text-[var(--text-secondary)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--bg-surface-muted)] file:text-[var(--primary)] hover:file:bg-[var(--bg-surface)]"
                />
                {attachment && (
                  <div className="flex items-center justify-between text-xs text-[var(--text-primary)] bg-[var(--bg-surface)] p-2 rounded-lg">
                    <span className="truncate">{attachment.name}</span>
                    <button type="button" onClick={() => { setAttachment(null); setRawFile(null); }} className="text-[var(--action-danger-bg)] hover:text-[var(--action-danger-bg)] font-bold">Remove</button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)] font-bold">
                <button type="button" onClick={() => setShowSingleModal(false)} className="px-4 py-2 bg-[var(--bg-surface-muted)] text-[var(--text-primary)] rounded-xl font-medium">Cancel</button>
                <button type="button" disabled={submitting} onClick={() => handleSubmitSingleClaim('DRAFT')} className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded-xl">Save as Draft</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary)] text-white rounded-xl shadow uppercase">SUBMIT</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 2. CREATE PARENT TRIP MODAL */}
      {showCreateTripModal && createPortal(
        <div className="fixed inset-0 z-[5000] bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl z-[5001]">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[var(--badge-success-text)]" />
                <span>Trip Expense</span>
              </h3>
              <button type="button" onClick={() => setShowCreateTripModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--action-danger-bg)] shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTripDraft} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Purpose *</label>
                <textarea required rows={2} value={tripFormData.purpose} onChange={e => setTripFormData({ ...tripFormData, purpose: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="Client visit and business meetings" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Start Point *</label>
                  <input type="text" required value={tripFormData.startPoint} onChange={e => setTripFormData({ ...tripFormData, startPoint: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="Delhi" />
                </div>
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">End Point *</label>
                  <input type="text" required value={tripFormData.endPoint} onChange={e => setTripFormData({ ...tripFormData, endPoint: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="Mumbai" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Start Date *</label>
                  <input type="date" required value={tripFormData.startDate} onChange={e => setTripFormData({ ...tripFormData, startDate: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono" />
                </div>
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">End Date *</label>
                  <input type="date" required value={tripFormData.endDate} onChange={e => setTripFormData({ ...tripFormData, endDate: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono" />
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Currency *</label>
                <select value={tripFormData.currency} onChange={e => setTripFormData({ ...tripFormData, currency: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono">
                  <option value="INR">Indian Rupee</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
                <button type="button" onClick={() => setShowCreateTripModal(false)} className="px-4 py-2 bg-[var(--bg-surface-muted)] text-[var(--text-primary)] rounded-xl font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-[var(--badge-success-bg)] hover:bg-[var(--primary-hover)] text-white rounded-xl font-bold shadow uppercase">SUBMIT</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* EDIT PARENT TRIP DETAILS MODAL */}
      {showEditTripModal && createPortal(
        <div className="fixed inset-0 z-[5000] bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl z-[5001]">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-[var(--primary)]" />
                <span>Edit Trip Details</span>
              </h3>
              <button type="button" onClick={() => setShowEditTripModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--action-danger-bg)] shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateTripDraft} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Purpose *</label>
                <textarea required rows={2} value={tripFormData.purpose} onChange={e => setTripFormData({ ...tripFormData, purpose: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Start Point *</label>
                  <input type="text" required value={tripFormData.startPoint} onChange={e => setTripFormData({ ...tripFormData, startPoint: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" />
                </div>
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">End Point *</label>
                  <input type="text" required value={tripFormData.endPoint} onChange={e => setTripFormData({ ...tripFormData, endPoint: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Start Date *</label>
                  <input type="date" required value={tripFormData.startDate} onChange={e => setTripFormData({ ...tripFormData, startDate: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono" />
                </div>
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">End Date *</label>
                  <input type="date" required value={tripFormData.endDate} onChange={e => setTripFormData({ ...tripFormData, endDate: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono" />
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Currency *</label>
                <select value={tripFormData.currency} onChange={e => setTripFormData({ ...tripFormData, currency: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono">
                  <option value="INR">Indian Rupee</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
                <button type="button" onClick={() => setShowEditTripModal(false)} className="px-4 py-2 bg-[var(--bg-surface-muted)] text-[var(--text-primary)] rounded-xl font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl font-bold shadow">Save Changes</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 3. ADD / EDIT TRAVEL EXPENSE CHILD MODAL */}
      {showTravelModal && createPortal(
        <div className="fixed inset-0 z-[5000] bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto z-[5001]">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Plane className="w-5 h-5 text-[var(--secondary)]" />
                <span>Travel Expense</span>
              </h3>
              <button type="button" onClick={() => setShowTravelModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--action-danger-bg)] shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitTravelChild} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Start Date *</label>
                  <input type="date" required value={travelFormData.startDate} onChange={e => setTravelFormData({ ...travelFormData, startDate: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono" />
                </div>
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">End Date *</label>
                  <input type="date" required value={travelFormData.endDate} onChange={e => setTravelFormData({ ...travelFormData, endDate: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono" />
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Mode of Transport *</label>
                <select value={travelFormData.transportMode} onChange={e => setTravelFormData({ ...travelFormData, transportMode: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]">
                  {TRANSPORT_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Purpose *</label>
                <textarea required rows={2} value={travelFormData.purpose} onChange={e => setTravelFormData({ ...travelFormData, purpose: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="Flight from Delhi to Mumbai" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Start Location *</label>
                  <input type="text" required value={travelFormData.startLocation} onChange={e => setTravelFormData({ ...travelFormData, startLocation: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="DEL Airport" />
                </div>
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">End Location *</label>
                  <input type="text" required value={travelFormData.endLocation} onChange={e => setTravelFormData({ ...travelFormData, endLocation: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="BOM Airport" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Merchant / Airline</label>
                  <input type="text" value={travelFormData.merchant} onChange={e => setTravelFormData({ ...travelFormData, merchant: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="Indigo / Air India" />
                </div>
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Distance (Km)</label>
                  <input type="number" value={travelFormData.distanceKm} onChange={e => setTravelFormData({ ...travelFormData, distanceKm: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono" placeholder="0" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Currency *</label>
                  <select value={travelFormData.currency} onChange={e => setTravelFormData({ ...travelFormData, currency: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono">
                    <option value="INR">Indian Rupee</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Amount (₹) *</label>
                  <input type="number" step="0.01" required value={travelFormData.amount} onChange={e => setTravelFormData({ ...travelFormData, amount: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono font-bold" placeholder="0.00" />
                </div>
              </div>

              {/* ATTACHMENT UPLOAD */}
              <div className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl space-y-2">
                <label className="block text-[var(--text-primary)] font-medium flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[var(--secondary)]" />
                  <span>Ticket / Boarding Pass Attachment</span>
                </label>
                <input
                  type="file"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setRawFile(file);
                      setAttachment({ name: file.name, url: URL.createObjectURL(file) });
                    }
                  }}
                  className="block w-full text-xs text-[var(--text-secondary)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--bg-surface-muted)] file:text-[var(--secondary)] hover:file:bg-[var(--bg-surface)]"
                />
                {attachment && (
                  <div className="flex items-center justify-between text-xs text-[var(--text-primary)] bg-[var(--bg-surface)] p-2 rounded-lg">
                    <span className="truncate">{attachment.name}</span>
                    <button type="button" onClick={() => { setAttachment(null); setRawFile(null); }} className="text-[var(--action-danger-bg)] hover:text-[var(--action-danger-bg)] font-bold">Remove</button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
                <button type="button" onClick={() => setShowTravelModal(false)} className="px-4 py-2 bg-[var(--bg-surface-muted)] text-[var(--text-primary)] rounded-xl font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary)] text-white rounded-xl font-bold shadow uppercase">{editingChild ? 'UPDATE' : 'SUBMIT'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 4. ADD / EDIT ACCOMMODATION EXPENSE CHILD MODAL */}
      {showAccomModal && createPortal(
        <div className="fixed inset-0 z-[5000] bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto z-[5001]">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Hotel className="w-5 h-5 text-[var(--primary)]" />
                <span>Accommodation Expense</span>
              </h3>
              <button type="button" onClick={() => setShowAccomModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--action-danger-bg)] shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAccomChild} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Check-In Date *</label>
                  <input type="date" required value={accomFormData.startDate} onChange={e => setAccomFormData({ ...accomFormData, startDate: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono" />
                </div>
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Check-Out Date *</label>
                  <input type="date" required value={accomFormData.endDate} onChange={e => setAccomFormData({ ...accomFormData, endDate: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono" />
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Hotel Name & Details *</label>
                <textarea required rows={2} value={accomFormData.accommodationDetails} onChange={e => setAccomFormData({ ...accomFormData, accommodationDetails: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="Taj Hotel Mumbai - Deluxe Room" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Currency *</label>
                  <select value={accomFormData.currency} onChange={e => setAccomFormData({ ...accomFormData, currency: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono">
                    <option value="INR">Indian Rupee</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Amount (₹) *</label>
                  <input type="number" step="0.01" required value={accomFormData.amount} onChange={e => setAccomFormData({ ...accomFormData, amount: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono font-bold" placeholder="0.00" />
                </div>
              </div>

              {/* ATTACHMENT UPLOAD */}
              <div className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl space-y-2">
                <label className="block text-[var(--text-primary)] font-medium flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[var(--primary)]" />
                  <span>Hotel Receipt Attachment</span>
                </label>
                <input
                  type="file"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setRawFile(file);
                      setAttachment({ name: file.name, url: URL.createObjectURL(file) });
                    }
                  }}
                  className="block w-full text-xs text-[var(--text-secondary)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--bg-surface-muted)] file:text-[var(--primary)] hover:file:bg-[var(--bg-surface)]"
                />
                {attachment && (
                  <div className="flex items-center justify-between text-xs text-[var(--text-primary)] bg-[var(--bg-surface)] p-2 rounded-lg">
                    <span className="truncate">{attachment.name}</span>
                    <button type="button" onClick={() => { setAttachment(null); setRawFile(null); }} className="text-[var(--action-danger-bg)] hover:text-[var(--action-danger-bg)] font-bold">Remove</button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
                <button type="button" onClick={() => setShowAccomModal(false)} className="px-4 py-2 bg-[var(--bg-surface-muted)] text-[var(--text-primary)] rounded-xl font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary)] text-white rounded-xl font-bold shadow uppercase">{editingChild ? 'UPDATE' : 'SUBMIT'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 5. ADD / EDIT OTHER EXPENSE CHILD MODAL */}
      {showOtherModal && createPortal(
        <div className="fixed inset-0 z-[5000] bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto z-[5001]">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[var(--badge-warning-text)]" />
                <span>Other Trip Expense</span>
              </h3>
              <button type="button" onClick={() => setShowOtherModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--action-danger-bg)] shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitOtherChild} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Transaction Date *</label>
                  <input type="date" required value={otherFormData.transactionDate} onChange={e => setOtherFormData({ ...otherFormData, transactionDate: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono" />
                </div>
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Category *</label>
                  <select value={otherFormData.category} onChange={e => setOtherFormData({ ...otherFormData, category: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]">
                    {OTHER_EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Merchant / Vendor</label>
                <input type="text" value={otherFormData.merchant} onChange={e => setOtherFormData({ ...otherFormData, merchant: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="Restaurant Name" />
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-medium">Purpose / Note *</label>
                <textarea required rows={2} value={otherFormData.purpose} onChange={e => setOtherFormData({ ...otherFormData, purpose: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]" placeholder="Client dinner expense" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Currency *</label>
                  <select value={otherFormData.currency} onChange={e => setOtherFormData({ ...otherFormData, currency: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono">
                    <option value="INR">Indian Rupee</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">Amount (₹) *</label>
                  <input type="number" step="0.01" required value={otherFormData.amount} onChange={e => setOtherFormData({ ...otherFormData, amount: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono font-bold" placeholder="0.00" />
                </div>
              </div>

              {/* ATTACHMENT UPLOAD */}
              <div className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl space-y-2">
                <label className="block text-[var(--text-primary)] font-medium flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[var(--badge-warning-text)]" />
                  <span>Receipt Attachment</span>
                </label>
                <input
                  type="file"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setRawFile(file);
                      setAttachment({ name: file.name, url: URL.createObjectURL(file) });
                    }
                  }}
                  className="block w-full text-xs text-[var(--text-secondary)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--bg-surface-muted)] file:text-[var(--badge-warning-text)] hover:file:bg-[var(--bg-surface)]"
                />
                {attachment && (
                  <div className="flex items-center justify-between text-xs text-[var(--text-primary)] bg-[var(--bg-surface)] p-2 rounded-lg">
                    <span className="truncate">{attachment.name}</span>
                    <button type="button" onClick={() => { setAttachment(null); setRawFile(null); }} className="text-[var(--action-danger-bg)] hover:text-[var(--action-danger-bg)] font-bold">Remove</button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
                <button type="button" onClick={() => setShowOtherModal(false)} className="px-4 py-2 bg-[var(--bg-surface-muted)] text-[var(--text-primary)] rounded-xl font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-amber-600 hover:bg-[var(--badge-warning-bg)] text-white rounded-xl font-bold shadow uppercase">{editingChild ? 'UPDATE' : 'SUBMIT'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 6. FINAL SUBMIT TRIP CONFIRMATION MODAL */}
      {showFinalSubmitModal && createPortal(
        <div className="fixed inset-0 z-[6000] bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl z-[6001]">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--badge-success-text)]" />
                <span>Confirmation</span>
              </h3>
              <button type="button" onClick={() => setShowFinalSubmitModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[var(--text-primary)] text-sm">Are you sure you want to submit this request?</p>
              
              <div className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Trip Purpose:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{activeTrip?.purpose}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Travel Expenses:</span>
                  <span className="font-mono text-[var(--secondary)] font-bold">{activeTrip?.travelExpenses?.length || 0} items</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Accommodation Expenses:</span>
                  <span className="font-mono text-[var(--primary)] font-bold">{activeTrip?.accommodationExpenses?.length || 0} items</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Other Expenses:</span>
                  <span className="font-mono text-[var(--badge-warning-text)] font-bold">{activeTrip?.otherExpenses?.length || 0} items</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[var(--border-default)] text-sm">
                  <span className="font-bold text-[var(--text-primary)]">Trip Total:</span>
                  <span className="font-mono font-extrabold text-[var(--badge-success-text)]">₹{grandTripTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)] text-xs font-bold">
              <button type="button" onClick={() => setShowFinalSubmitModal(false)} className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded-xl">CANCEL</button>
              <button type="button" disabled={submitting} onClick={handleConfirmFinalSubmitTrip} className="px-5 py-2 bg-[var(--badge-success-bg)] hover:bg-[var(--primary-hover)] text-white rounded-xl shadow uppercase">OKAY</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SINGLE EXPENSE DETAIL VIEW MODAL */}
      {selectedSingleExpense && createPortal(
        <div className="fixed inset-0 z-[5000] bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-4 sm:p-6 rounded-2xl w-[min(calc(100vw-24px),540px)] space-y-4 shadow-2xl z-[5001] max-h-[calc(100vh-24px)] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[var(--primary)] shrink-0" />
                <span>Expense Claim Details</span>
              </h3>
              <button type="button" onClick={() => setSelectedSingleExpense(null)} className="p-1 text-[var(--text-secondary)] hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Employee Banner (if employee info is present) */}
              {(selectedSingleExpense.employeeName || selectedSingleExpense.employee_name || selectedSingleExpense.employeeCode || selectedSingleExpense.employee_code) && (
                <div className="flex items-center gap-3 bg-[var(--bg-surface-muted)] p-3 rounded-xl border border-[var(--border-default)]">
                  <div className="w-9 h-9 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {(selectedSingleExpense.employeeName || selectedSingleExpense.employee_name || 'EM').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">
                      {selectedSingleExpense.employeeName || selectedSingleExpense.employee_name}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                      {(selectedSingleExpense.employeeCode || selectedSingleExpense.employee_code) && (
                        <span className="font-mono">{selectedSingleExpense.employeeCode || selectedSingleExpense.employee_code}</span>
                      )}
                      {(selectedSingleExpense.departmentName || selectedSingleExpense.department_name || selectedSingleExpense.department) && (
                        <span>• {selectedSingleExpense.departmentName || selectedSingleExpense.department_name || selectedSingleExpense.department}</span>
                      )}
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                    selectedSingleExpense.status === 'APPROVED' ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border-[var(--badge-success-border)]' :
                    selectedSingleExpense.status === 'REJECTED' ? 'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border-[var(--action-danger-bg)]/30' :
                    selectedSingleExpense.status === 'CANCELLED' ? 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border-[var(--border-default)]' :
                    selectedSingleExpense.status === 'DRAFT' ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border-[var(--border-default)]' :
                    'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border-[var(--badge-warning-border)]'
                  }`}>
                    {selectedSingleExpense.status === 'PENDING' ? 'SUBMITTED' : selectedSingleExpense.status}
                  </span>
                </div>
              )}

              {/* Core Financial Details */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-default)]">
                <div>
                  <span className="text-[var(--text-secondary)] block text-[10px]">EXPENSE TYPE</span>
                  <span className="font-bold text-[var(--primary)]">{selectedSingleExpense.expense_type || selectedSingleExpense.claimType || selectedSingleExpense.expenseType || 'BUSINESS'}</span>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)] block text-[10px]">TRANSACTION DATE</span>
                  <span className="font-mono text-[var(--text-primary)]">
                    {selectedSingleExpense.transaction_date || selectedSingleExpense.date
                      ? new Date(selectedSingleExpense.transaction_date || selectedSingleExpense.date).toLocaleDateString()
                      : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)] block text-[10px]">CATEGORY</span>
                  <span className="font-semibold text-[var(--text-primary)]">{selectedSingleExpense.category || selectedSingleExpense.category_name || selectedSingleExpense.categoryName || '-'}</span>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)] block text-[10px]">AMOUNT</span>
                  <span className="font-mono font-bold text-[var(--badge-success-text)] text-sm">₹{Number(selectedSingleExpense.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {selectedSingleExpense.bucket && (
                  <div>
                    <span className="text-[var(--text-secondary)] block text-[10px]">BUCKET</span>
                    <span className="text-[var(--text-primary)] font-semibold">{selectedSingleExpense.bucket}</span>
                  </div>
                )}
                {!selectedSingleExpense.employeeName && !selectedSingleExpense.employee_name && (
                  <div>
                    <span className="text-[var(--text-secondary)] block text-[10px]">STATUS</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-block ${
                      selectedSingleExpense.status === 'APPROVED' ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border-[var(--badge-success-border)]' :
                      selectedSingleExpense.status === 'REJECTED' ? 'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border-[var(--action-danger-bg)]/30' :
                      selectedSingleExpense.status === 'CANCELLED' ? 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border-[var(--border-default)]' :
                      selectedSingleExpense.status === 'DRAFT' ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border-[var(--border-default)]' :
                      'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border-[var(--badge-warning-border)]'
                    }`}>
                      {selectedSingleExpense.status === 'PENDING' ? 'SUBMITTED' : selectedSingleExpense.status}
                    </span>
                  </div>
                )}
              </div>

              {/* Purpose & Merchant */}
              <div className="space-y-2 p-3 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-default)]">
                <div>
                  <span className="text-[var(--text-secondary)] block text-[10px]">PURPOSE / NOTE</span>
                  <p className="text-[var(--text-primary)] font-medium whitespace-pre-wrap">{selectedSingleExpense.description || selectedSingleExpense.purpose || '-'}</p>
                </div>
                {selectedSingleExpense.merchant && (
                  <div>
                    <span className="text-[var(--text-secondary)] block text-[10px]">MERCHANT / VENDOR</span>
                    <span className="text-[var(--text-primary)] font-semibold">{selectedSingleExpense.merchant}</span>
                  </div>
                )}
                {(selectedSingleExpense.expense_type === 'LOCAL_TRAVEL' || selectedSingleExpense.transport_mode || selectedSingleExpense.start_location) && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-default)]">
                    {selectedSingleExpense.transport_mode && (
                      <div>
                        <span className="text-[var(--text-secondary)] block text-[10px]">MODE OF TRANSPORT</span>
                        <span className="text-[var(--secondary)] font-semibold">{selectedSingleExpense.transport_mode}</span>
                      </div>
                    )}
                    {(selectedSingleExpense.start_location || selectedSingleExpense.end_location) && (
                      <div>
                        <span className="text-[var(--text-secondary)] block text-[10px]">ROUTE</span>
                        <span className="text-[var(--text-primary)]">{selectedSingleExpense.start_location || '-'} → {selectedSingleExpense.end_location || '-'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Approval Info */}
              {selectedSingleExpense.status === 'APPROVED' && (selectedSingleExpense.reviewed_by_name || selectedSingleExpense.approver || selectedSingleExpense.reviewed_at) && (
                <div className="p-3 bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] rounded-xl space-y-1 text-[11px]">
                  <span className="font-bold text-[10px] text-[var(--badge-success-text)] block uppercase">APPROVAL DETAILS</span>
                  <div className="flex flex-wrap items-center justify-between text-[var(--text-primary)]">
                    <span>Approved by: <strong>{selectedSingleExpense.reviewed_by_name || selectedSingleExpense.approver || 'Manager'}</strong></span>
                    {selectedSingleExpense.reviewed_at && (
                      <span className="text-[var(--text-secondary)] font-mono">{new Date(selectedSingleExpense.reviewed_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Rejection Details */}
              {(selectedSingleExpense.rejection_reason || selectedSingleExpense.rejectionReason) && (
                <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] rounded-xl space-y-1">
                  <span className="font-bold text-[10px] text-[var(--action-danger-bg)] block uppercase">REJECTION REASON</span>
                  <p className="leading-relaxed">{selectedSingleExpense.rejection_reason || selectedSingleExpense.rejectionReason}</p>
                  {(selectedSingleExpense.reviewed_by_name || selectedSingleExpense.approver) && (
                    <div className="text-[10px] text-[var(--text-secondary)] pt-1">
                      Reviewed by: {selectedSingleExpense.reviewed_by_name || selectedSingleExpense.approver}
                      {selectedSingleExpense.reviewed_at && ` on ${new Date(selectedSingleExpense.reviewed_at).toLocaleDateString()}`}
                    </div>
                  )}
                </div>
              )}

              {/* Cancellation Reason */}
              {(selectedSingleExpense.cancellation_reason || selectedSingleExpense.cancellationReason) && (
                <div className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-xl space-y-1">
                  <span className="font-bold text-[10px] text-[var(--text-secondary)] block uppercase">CANCELLATION REASON</span>
                  <p>{selectedSingleExpense.cancellation_reason || selectedSingleExpense.cancellationReason}</p>
                </div>
              )}

              {/* Attachment / Receipt View (Works for all statuses) */}
              {(selectedSingleExpense.receipt_url || selectedSingleExpense.receiptUrl || selectedSingleExpense.attachment_url || selectedSingleExpense.attachmentUrl) && (
                <div className="p-3 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-default)] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-[var(--primary)] shrink-0" />
                    <span className="font-semibold text-[var(--text-primary)] truncate">
                      {selectedSingleExpense.attachment_name || selectedSingleExpense.attachmentName || selectedSingleExpense.receipt_name || selectedSingleExpense.receiptName || 'Receipt / Document'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const fileUrl = selectedSingleExpense.receipt_url || selectedSingleExpense.receiptUrl || selectedSingleExpense.attachment_url || selectedSingleExpense.attachmentUrl;
                      const fileName = selectedSingleExpense.attachment_name || selectedSingleExpense.attachmentName || selectedSingleExpense.receipt_name || selectedSingleExpense.receiptName || 'Receipt_Document';
                      if (fileUrl) {
                        setActiveViewFile({ url: fileUrl, name: fileName });
                      }
                    }}
                    className="px-3 py-1.5 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--primary)] border border-[var(--primary)] rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View File</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-[var(--border-default)]">
              {isManagerOrAdmin && user?.employeeId !== (selectedSingleExpense.employee_id || selectedSingleExpense.employeeId) && (selectedSingleExpense.status === 'SUBMITTED' || selectedSingleExpense.status === 'PENDING') && (
                <>
                  <button
                    type="button"
                    onClick={() => { const id = selectedSingleExpense.id; setSelectedSingleExpense(null); handleApproveSingle(id); }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--badge-success-bg)] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer text-center"
                  >
                    Approve Claim
                  </button>
                  <button
                    type="button"
                    onClick={() => { const id = selectedSingleExpense.id; setSelectedSingleExpense(null); handleRejectSingle(id); }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-[var(--action-danger-bg)] hover:bg-[var(--action-danger-bg)] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer text-center"
                  >
                    Reject Claim
                  </button>
                </>
              )}
              {user?.employeeId === (selectedSingleExpense.employee_id || selectedSingleExpense.employeeId) && ['DRAFT', 'SUBMITTED', 'PENDING'].includes(selectedSingleExpense.status) && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const exp = selectedSingleExpense;
                      setSelectedSingleExpense(null);
                      handleOpenEditSingle(exp);
                    }}
                    className="w-full sm:w-auto px-3 py-2.5 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--primary)] border border-[var(--border-default)] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Expense</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const exp = selectedSingleExpense;
                      handleDeleteExpenseByEmployee(exp);
                    }}
                    className="w-full sm:w-auto px-3 py-2.5 bg-[var(--action-danger-soft)] hover:bg-rose-900 text-[var(--action-danger-bg)] border border-[var(--action-danger-bg)]/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Expense</span>
                  </button>
                </>
              )}
              {user?.role === 'SUPER_ADMIN' && (
                <button
                  type="button"
                  onClick={() => {
                    const exp = selectedSingleExpense;
                    setSelectedSingleExpense(null);
                    setDeleteConfirmExpense(exp);
                    setDeleteInputText('');
                  }}
                  className="w-full sm:w-auto px-3 py-2.5 bg-[var(--action-danger-soft)] hover:bg-rose-900 text-[var(--action-danger-bg)] border border-[var(--action-danger-bg)]/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Expense</span>
                </button>
              )}
              <button type="button" onClick={() => setSelectedSingleExpense(null)} className="w-full sm:w-auto px-4 py-2.5 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded-xl text-xs font-medium cursor-pointer text-center">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SUPER ADMIN DELETE CONFIRMATION MODAL */}
      {deleteConfirmExpense && createPortal(
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-[var(--bg-surface-muted)] backdrop-blur-xs">
          <div className="bg-[var(--bg-surface)] border border-[var(--action-danger-bg)]/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150 z-[6001]">
            <div className="flex items-center gap-3 text-[var(--action-danger-bg)] border-b border-[var(--border-default)] pb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Delete Expense Permanently?</h3>
            </div>

            <div className="space-y-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg-surface-muted)] p-3.5 rounded-xl border border-[var(--border-default)] font-mono">
              <p><span className="text-[var(--text-muted)]">Expense Type:</span> {deleteConfirmExpense.expense_type}</p>
              <p><span className="text-[var(--text-muted)]">Employee:</span> {deleteConfirmExpense.employee_name_snapshot || deleteConfirmExpense.employee_code_snapshot || deleteConfirmExpense.employee_id}</p>
              <p><span className="text-[var(--text-muted)]">Merchant / Category:</span> {deleteConfirmExpense.merchant || deleteConfirmExpense.category}</p>
              <p><span className="text-[var(--text-muted)]">Amount:</span> ₹{Number(deleteConfirmExpense.amount || 0).toLocaleString('en-IN')}</p>
              <p><span className="text-[var(--text-muted)]">Date:</span> {deleteConfirmExpense.transaction_date}</p>
              <p><span className="text-[var(--text-muted)]">Status:</span> {deleteConfirmExpense.status}</p>
            </div>

            <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 rounded-xl text-[11px] text-[var(--action-danger-bg)] leading-relaxed">
              <strong>Warning:</strong> This action permanently deletes the expense claim and associated application attachment metadata. This action cannot be undone.
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">
                Type <span className="font-mono text-[var(--action-danger-bg)] font-bold">DELETE</span> to confirm permanent deletion:
              </label>
              <input
                type="text"
                value={deleteInputText}
                onChange={e => setDeleteInputText(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-[var(--bg-surface-muted)] border border-[var(--border-default)] focus:border-[var(--primary)] rounded-xl px-3 py-2 text-xs text-white font-mono uppercase tracking-wider"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setDeleteConfirmExpense(null); setDeleteInputText(''); }}
                className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded-xl text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteInputText !== 'DELETE' || deletingExpense}
                onClick={handleDeleteSuperAdmin}
                className="px-4 py-2 bg-[var(--action-danger-bg)] hover:bg-[var(--action-danger-bg)] disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                {deletingExpense ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SUPER ADMIN TRIP DELETE CONFIRMATION MODAL */}
      {deleteConfirmTrip && createPortal(
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-[var(--bg-surface-muted)] backdrop-blur-xs">
          <div className="bg-[var(--bg-surface)] border border-[var(--action-danger-bg)]/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150 z-[6001]">
            <div className="flex items-center gap-3 text-[var(--action-danger-bg)] border-b border-[var(--border-default)] pb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Delete Trip Expense Permanently?</h3>
            </div>

            <div className="space-y-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg-surface-muted)] p-3.5 rounded-xl border border-[var(--border-default)] font-mono">
              <p><span className="text-[var(--text-muted)]">Trip / Purpose:</span> {deleteConfirmTrip.purpose}</p>
              <p>
                <span className="text-[var(--text-muted)]">Employee:</span> {
                  deleteConfirmTrip.employee_name || deleteConfirmTrip.employee_name_snapshot 
                    ? `${deleteConfirmTrip.employee_name || deleteConfirmTrip.employee_name_snapshot} ${deleteConfirmTrip.employee_code || deleteConfirmTrip.employee_code_snapshot ? `(${deleteConfirmTrip.employee_code || deleteConfirmTrip.employee_code_snapshot})` : ''}`
                    : 'Historical Record'
                }
                {!deleteConfirmTrip.employee_id && <span className="ml-1 text-[10px] text-[var(--badge-warning-text)] font-bold">(Historical Record)</span>}
              </p>
              <p><span className="text-[var(--text-muted)]">Destination:</span> {deleteConfirmTrip.start_point} → {deleteConfirmTrip.end_point}</p>
              <p><span className="text-[var(--text-muted)]">Date:</span> {deleteConfirmTrip.start_date} → {deleteConfirmTrip.end_date}</p>
              <p><span className="text-[var(--text-muted)]">Status:</span> {deleteConfirmTrip.status}</p>
              <p><span className="text-[var(--text-muted)]">Total Amount:</span> ₹{Number(deleteConfirmTrip.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              <p><span className="text-[var(--text-muted)]">Child Expenses:</span> {deleteConfirmTrip.travel_count || 0} Travel, {deleteConfirmTrip.accom_count || 0} Hotel, {deleteConfirmTrip.other_count || 0} Other</p>
            </div>

            <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 rounded-xl text-[11px] text-[var(--action-danger-bg)] leading-relaxed">
              <strong>Warning:</strong> This permanently deletes this trip claim and its associated child expenses and attachments from the application. This action cannot be undone.
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">
                Type <span className="font-mono text-[var(--action-danger-bg)] font-bold">DELETE</span> to confirm permanent deletion:
              </label>
              <input
                type="text"
                value={deleteInputText}
                onChange={e => setDeleteInputText(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-[var(--bg-surface-muted)] border border-[var(--border-default)] focus:border-[var(--primary)] rounded-xl px-3 py-2 text-xs text-white font-mono uppercase tracking-wider"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setDeleteConfirmTrip(null); setDeleteInputText(''); }}
                className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded-xl text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteInputText !== 'DELETE' || deletingTrip}
                onClick={handleDeleteSuperAdminTrip}
                className="px-4 py-2 bg-[var(--action-danger-bg)] hover:bg-[var(--action-danger-bg)] disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                {deletingTrip ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CATEGORY ANALYTICS MODAL */}
      {showCategoryAnalyticsModal && createPortal(
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-[var(--bg-surface-muted)] backdrop-blur-xs">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150 z-[5001]">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-[var(--secondary)]" />
                <span>Top Cost Categories Analytics ({currentFy.label})</span>
              </h3>
              <button onClick={() => setShowCategoryAnalyticsModal(false)} className="text-[var(--text-secondary)] hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto border border-[var(--border-default)] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] uppercase font-semibold text-[10px] border-b border-[var(--border-default)]">
                  <tr>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Total Amount (₹)</th>
                    <th className="p-3 text-right">Approved (₹)</th>
                    <th className="p-3 text-right">Pending (₹)</th>
                    <th className="p-3 text-right">Rejected (₹)</th>
                    <th className="p-3 text-right">Share (%)</th>
                    <th className="p-3 text-center">Claim Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {mgmtAnalytics?.categoryBreakdown?.map((cat: any) => (
                    <tr key={cat.category} className="hover:bg-[var(--bg-surface-muted)]">
                      <td className="p-3 font-bold text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)]"></span>
                        <span>{cat.category}</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-[var(--secondary)]">₹{cat.amount.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-mono text-[var(--badge-success-text)]">₹{(cat.approvedAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-mono text-[var(--badge-warning-text)]">₹{(cat.pendingAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-mono text-[var(--action-danger-bg)]">₹{(cat.rejectedAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-mono font-semibold text-[var(--text-primary)]">{cat.percentage.toFixed(1)}%</td>
                      <td className="p-3 text-center font-mono text-[var(--text-secondary)]">{cat.claimCount || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowCategoryAnalyticsModal(false)}
                className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* DETAILED EXPENSE LEDGER / PENDING APPROVAL CENTER MODAL */}
      {showLedgerModal && createPortal(
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-[var(--bg-surface-muted)] backdrop-blur-xs">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl max-w-5xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-150 z-[5001]">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-default)] pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {ledgerType === 'PENDING' ? <Clock className="w-5 h-5 text-[var(--badge-warning-text)]" /> :
                   ledgerType === 'APPROVED' ? <CheckCircle2 className="w-5 h-5 text-[var(--badge-success-text)]" /> :
                   ledgerType === 'REJECTED' ? <XCircle className="w-5 h-5 text-[var(--action-danger-bg)]" /> :
                   <DollarSign className="w-5 h-5 text-[var(--secondary)]" />}
                  <span>
                    {ledgerType === 'PENDING' ? 'Pending Approval Center' :
                     ledgerType === 'APPROVED' ? 'Detailed APPROVED Expense Ledger' :
                     ledgerType === 'REJECTED' ? 'Detailed REJECTED Expense Ledger' :
                     'Detailed ALL Expense Ledger'} ({currentFy.label})
                  </span>
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {ledgerType === 'PENDING' ? 'Review, view, approve or reject pending employee claims' :
                   ledgerType === 'APPROVED' ? 'List of all approved expense records' :
                   ledgerType === 'REJECTED' ? 'List of rejected expenses with reviewer metadata and persisted reasons' :
                   'Complete itemized ledger of all expense records'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-[var(--bg-surface-elevated)] px-4 py-2 rounded-xl border border-[var(--border-default)] text-right">
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Total Ledger Amount</div>
                  <div className="text-lg font-black text-white font-mono">₹{ledgerTotalAmount.toLocaleString('en-IN')}</div>
                </div>

                <button onClick={() => setShowLedgerModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter / Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={ledgerSearch}
                  onChange={e => {
                    setLedgerSearch(e.target.value);
                    fetchLedgerData(ledgerType, 1, e.target.value);
                  }}
                  placeholder="Search by employee name, code, merchant, purpose..."
                  className="w-full pl-9 pr-3 py-1.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-xl text-xs text-white placeholder-[var(--text-muted)]"
                />
              </div>

              <div className="text-xs text-[var(--text-secondary)]">
                Found <strong className="text-white">{ledgerTotalRecords}</strong> records
              </div>
            </div>

            {/* Ledger Table */}
            {loadingLedger ? (
              <div className="py-12 text-center text-xs text-[var(--text-secondary)]">Loading ledger records...</div>
            ) : ledgerRecords.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)] italic border border-[var(--border-default)] rounded-xl bg-[var(--bg-surface-elevated)]">
                No records found matching current criteria.
              </div>
            ) : (
              <div className="overflow-x-auto border border-[var(--border-default)] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] uppercase font-semibold text-[10px] border-b border-[var(--border-default)]">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Department</th>
                      <th className="p-3">Type & Date</th>
                      <th className="p-3">Category & Details</th>
                      <th className="p-3 text-right">Amount (₹)</th>
                      <th className="p-3 text-center">Status</th>
                      {ledgerType === 'REJECTED' && <th className="p-3">Rejection Reason & Approver</th>}
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {ledgerRecords.map(rec => (
                      <tr key={rec.id} className="hover:bg-[var(--bg-surface-muted)]">
                        <td className="p-3 font-bold text-white">
                          <div>{rec.employeeName}</div>
                          <span className="text-[10px] font-mono text-[var(--text-secondary)]">{rec.employeeCode}</span>
                        </td>
                        <td className="p-3 text-[var(--text-primary)]">{rec.department}</td>
                        <td className="p-3">
                          <div className="font-semibold text-[var(--text-primary)]">{rec.expenseType}</div>
                          <div className="text-[10px] font-mono text-[var(--text-secondary)]">{rec.date ? new Date(rec.date).toLocaleDateString() : '-'}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-[var(--text-primary)]">{rec.category}</div>
                          <div className="text-[10px] text-[var(--text-secondary)] truncate max-w-[180px]">{rec.merchant || rec.description || '-'}</div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-[var(--badge-success-text)]">
                          ₹{rec.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            rec.status === 'APPROVED' ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border-[var(--badge-success-border)]' :
                            rec.status === 'REJECTED' ? 'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border-[var(--action-danger-bg)]/30' :
                            'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border-[var(--badge-warning-border)]'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                        {ledgerType === 'REJECTED' && (
                          <td className="p-3 text-xs">
                            <div className="text-[var(--action-danger-bg)] font-semibold">{rec.rejectionReason || 'No reason provided'}</div>
                            <div className="text-[10px] text-[var(--text-secondary)]">Reviewed by: {rec.approver || 'System Admin'}</div>
                          </td>
                        )}
                        <td className="p-3 text-center space-x-1">
                          <button
                            onClick={() => {
                              if (rec.claimSource === 'TRIP') {
                                setShowLedgerModal(false);
                                loadTripDetails(rec.id);
                              } else {
                                setSelectedSingleExpense(rec);
                              }
                            }}
                            className="px-2 py-1 bg-[var(--badge-info-bg)] hover:bg-[var(--bg-surface-hover)] border border-[var(--badge-info-border)] text-[var(--badge-info-text)] rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            title="View Claim Details"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>

                          {(ledgerType === 'PENDING' || rec.status === 'SUBMITTED' || rec.status === 'PENDING') && (
                            <>
                              <button
                                onClick={async () => {
                                  if (rec.claimSource === 'TRIP') {
                                    await handleApproveTrip(rec.id);
                                  } else {
                                    await handleApproveSingle(rec.id);
                                  }
                                  fetchLedgerData(ledgerType, ledgerPage, ledgerSearch);
                                  fetchManagementData();
                                }}
                                className="px-2 py-1 bg-[var(--badge-success-bg)] hover:bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] text-[var(--badge-success-text)] rounded text-[10px] font-bold cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={async () => {
                                  if (rec.claimSource === 'TRIP') {
                                    await handleRejectTrip(rec.id);
                                  } else {
                                    await handleRejectSingle(rec.id);
                                  }
                                  fetchLedgerData(ledgerType, ledgerPage, ledgerSearch);
                                  fetchManagementData();
                                }}
                                className="px-2 py-1 bg-[var(--action-danger-soft)] hover:bg-rose-900 border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] rounded text-[10px] font-bold cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pt-2 border-t border-[var(--border-default)]">
              <div>Page {ledgerPage} of {ledgerTotalPages}</div>
              <div className="flex items-center gap-2">
                <button
                  disabled={ledgerPage <= 1}
                  onClick={() => {
                    const newPage = ledgerPage - 1;
                    setLedgerPage(newPage);
                    fetchLedgerData(ledgerType, newPage, ledgerSearch);
                  }}
                  className="px-3 py-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] disabled:opacity-40 rounded text-[var(--text-primary)] text-xs cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={ledgerPage >= ledgerTotalPages}
                  onClick={() => {
                    const newPage = ledgerPage + 1;
                    setLedgerPage(newPage);
                    fetchLedgerData(ledgerType, newPage, ledgerSearch);
                  }}
                  className="px-3 py-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] disabled:opacity-40 rounded text-[var(--text-primary)] text-xs cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* In-App Authenticated File Viewer */}
      {activeViewFile && (
        <FileViewerModal
          fileUrl={activeViewFile.url}
          fileName={activeViewFile.name}
          onClose={() => setActiveViewFile(null)}
        />
      )}
    </div>
  );
};
