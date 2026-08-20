import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import {
  Receipt, Plus, Check, X, FileText, MapPin, Navigation,
  Building, Calendar, Upload, Trash2, Eye, AlertTriangle,
  ArrowRight, Edit, Hotel, Plane, Clock, ChevronRight, ShieldCheck, DollarSign
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
  const isManagerOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '');

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

  // File Attachment State
  const [attachment, setAttachment] = useState<{ name: string; url: string } | null>(null);

  // Common Form Error & Loading
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Details View Modal
  const [selectedSingleExpense, setSelectedSingleExpense] = useState<any | null>(null);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (user?.employeeId) {
        const myRes = await apiFetch('/expenses/my').catch(() => null);
        setMyExpenses(myRes?.expenses || myRes?.data?.expenses || []);

        const myTripRes = await apiFetch('/expenses/trips/my').catch(() => null);
        setMyTrips(myTripRes?.trips || myTripRes?.data?.trips || []);
      }
      if (isManagerOrAdmin) {
        const allRes = await apiFetch('/expenses').catch(() => null);
        setAllExpenses(allRes?.expenses || allRes?.data?.expenses || []);

        const allTripRes = await apiFetch('/expenses/trips/workforce').catch(() => null);
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
  }, [fetchData]);

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

  // Open Business / Local Travel Single Claim Modal
  const handleOpenSingleModal = (type: 'BUSINESS' | 'LOCAL_TRAVEL') => {
    setSingleClaimType(type);
    setFormError(null);
    setAttachment(null);
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
      const payload: any = {
        expenseType: singleClaimType,
        transactionDate: singleFormData.transactionDate,
        category: singleFormData.category,
        merchant: singleFormData.merchant ? singleFormData.merchant.trim() : undefined,
        currency: singleFormData.currency,
        amount: numericAmount,
        bucket: singleFormData.bucket,
        description: singleFormData.description.trim(),
        attachmentName: attachment?.name,
        receiptUrl: attachment?.url,
        status
      };

      if (singleClaimType === 'LOCAL_TRAVEL') {
        payload.transportMode = singleFormData.transportMode;
        payload.startLocation = singleFormData.startLocation.trim();
        payload.endLocation = singleFormData.endLocation.trim();
      }

      await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowSingleModal(false);
      setSuccessMsg(status === 'DRAFT' ? 'Expense claim saved as draft.' : 'Expense claim submitted successfully.');
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
      const payload = {
        ...travelFormData,
        amount,
        distanceKm: dist,
        attachmentName: attachment?.name,
        receiptUrl: attachment?.url
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
      const payload = {
        ...accomFormData,
        amount,
        attachmentName: attachment?.name,
        receiptUrl: attachment?.url
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
      const payload = {
        ...otherFormData,
        amount,
        attachmentName: attachment?.name,
        receiptUrl: attachment?.url
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

  const displayedSingleExpenses = (activeRoleTab === 'WORKFORCE' ? allExpenses : myExpenses).filter(ex => {
    if (typeFilter && ex.expense_type !== typeFilter) return false;
    if (statusFilter && ex.status !== statusFilter) return false;
    return true;
  });

  const displayedTrips = (activeRoleTab === 'WORKFORCE' ? allTrips : myTrips).filter(t => {
    if (statusFilter && t.status !== statusFilter) return false;
    return true;
  });

  // Subtotals
  const travelTotal = (activeTrip?.travelExpenses || []).reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
  const accomTotal = (activeTrip?.accommodationExpenses || []).reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
  const otherTotal = (activeTrip?.otherExpenses || []).reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
  const grandTripTotal = Number(activeTrip?.total_amount || 0) || (travelTotal + accomTotal + otherTotal);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-cyan-400" />
            <span>Expense Claims & Reimbursements</span>
          </h1>
          <p className="text-xs text-slate-400">Business Expenses, Local Travel & Complete Outstation Trip Claims</p>
        </div>

        {isManagerOrAdmin && (
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveRoleTab('MY_CLAIMS')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeRoleTab === 'MY_CLAIMS' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              My Claims
            </button>
            <button
              onClick={() => setActiveRoleTab('WORKFORCE')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeRoleTab === 'WORKFORCE' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Workforce Approvals
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

      {/* ---------------------------------------------------- */}
      {/* ACTIVE TRIP DETAILS WORKSPACE VIEW */}
      {/* ---------------------------------------------------- */}
      {activeTrip ? (
        <div className="space-y-6">
          {/* Trip Summary Card Header */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <button
                  onClick={() => setActiveTrip(null)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 mb-2"
                >
                  ← Back to Claims List
                </button>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-400" />
                    <span>Trip Expense Details</span>
                  </h2>
                  {activeTrip.status === 'DRAFT' && (
                    <button
                      onClick={handleOpenEditTrip}
                      className="p-1 text-slate-400 hover:text-cyan-400"
                      title="Edit Parent Trip Details"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="text-xl font-extrabold font-mono text-emerald-400 mt-1">
                  INR {grandTripTotal.toFixed(2)}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-300 mt-1 font-medium">
                  <span className="font-mono">{new Date(activeTrip.start_date).toDateString()} - {new Date(activeTrip.end_date).toDateString()}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-300 mt-3 pt-3 border-t border-slate-800/80 font-medium">
                  <div>Purpose: <strong className="text-white font-semibold">{activeTrip.purpose}</strong></div>
                  <div>Trip Location: <strong className="text-white font-semibold">{activeTrip.start_point} to {activeTrip.end_point}</strong></div>
                  <div>Currency: <strong className="font-mono text-emerald-400">{activeTrip.currency || 'INR'}</strong></div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  activeTrip.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                  activeTrip.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                  activeTrip.status === 'DRAFT' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                  'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  {activeTrip.status === 'DRAFT' ? 'Draft Mode' : activeTrip.status}
                </span>

                {isManagerOrAdmin && (activeTrip.status === 'SUBMITTED' || activeTrip.status === 'PENDING') && (
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => handleApproveTrip(activeTrip.id)} className="px-3 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-bold">Approve</button>
                    <button onClick={() => handleRejectTrip(activeTrip.id)} className="px-3 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-xl text-xs font-bold">Reject</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* THREE CHILD EXPENSE SECTIONS */}
          <div className="space-y-6">
            {/* 1. TRAVEL EXPENSE SECTION */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Plane className="w-4 h-4 text-indigo-400" />
                  <span>Travel Expense</span>
                </h3>
                {activeTrip.status === 'DRAFT' && (
                  <button
                    onClick={handleOpenAddTravel}
                    className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow flex items-center gap-1 text-xs font-semibold"
                    title="Add Travel Expense"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {(activeTrip.travelExpenses || []).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeTrip.travelExpenses.map((t: any) => (
                    <div key={t.id} className="p-4 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl space-y-2 text-xs transition-all relative group">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <span className="font-bold text-indigo-400 text-xs">{t.transport_mode}</span>
                        <span className="font-mono text-slate-400">{new Date(t.start_date).toLocaleDateString()} - {new Date(t.end_date).toLocaleDateString()}</span>
                      </div>
                      <div className="font-semibold text-slate-200">{t.start_location} → {t.end_location}</div>
                      <p className="text-slate-400 truncate">{t.purpose}</p>
                      {t.merchant && <div className="text-[10px] text-slate-500">Merchant: {t.merchant}</div>}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        <span className="font-mono font-bold text-emerald-400 text-sm">₹{Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        <div className="flex items-center gap-2">
                          {t.receipt_url && (
                            <a href={t.receipt_url} target="_blank" rel="noreferrer" className="px-2 py-0.5 bg-slate-800 text-cyan-300 rounded text-[10px] font-bold">File</a>
                          )}
                          {activeTrip.status === 'DRAFT' && (
                            <>
                              <button onClick={() => handleOpenEditTravel(t)} className="p-1 text-slate-400 hover:text-cyan-400"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteTravelChild(t.id)} className="p-1 text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 text-xs italic bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                  No travel expenses
                </div>
              )}
            </div>

            {/* 2. ACCOMMODATION EXPENSE SECTION */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Hotel className="w-4 h-4 text-cyan-400" />
                  <span>Accommodation Expense</span>
                </h3>
                {activeTrip.status === 'DRAFT' && (
                  <button
                    onClick={handleOpenAddAccom}
                    className="p-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-all shadow flex items-center gap-1 text-xs font-semibold"
                    title="Add Accommodation Expense"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {(activeTrip.accommodationExpenses || []).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeTrip.accommodationExpenses.map((a: any) => (
                    <div key={a.id} className="p-4 bg-slate-950 border border-slate-800 hover:border-cyan-500/50 rounded-xl space-y-2 text-xs transition-all relative group">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <span className="font-semibold text-slate-300">Hotel / Lodging</span>
                        <span className="font-mono text-slate-400">{new Date(a.start_date).toLocaleDateString()} - {new Date(a.end_date).toLocaleDateString()}</span>
                      </div>
                      <p className="font-medium text-slate-200">{a.accommodation_details}</p>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        <span className="font-mono font-bold text-emerald-400 text-sm">₹{Number(a.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        <div className="flex items-center gap-2">
                          {a.receipt_url && (
                            <a href={a.receipt_url} target="_blank" rel="noreferrer" className="px-2 py-0.5 bg-slate-800 text-cyan-300 rounded text-[10px] font-bold">File</a>
                          )}
                          {activeTrip.status === 'DRAFT' && (
                            <>
                              <button onClick={() => handleOpenEditAccom(a)} className="p-1 text-slate-400 hover:text-cyan-400"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteAccomChild(a.id)} className="p-1 text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 text-xs italic bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                  No accommodation expenses
                </div>
              )}
            </div>

            {/* 3. OTHER EXPENSE SECTION */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Other Expense</span>
                </h3>
                {activeTrip.status === 'DRAFT' && (
                  <button
                    onClick={handleOpenAddOther}
                    className="p-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-all shadow flex items-center gap-1 text-xs font-semibold"
                    title="Add Other Expense"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {(activeTrip.otherExpenses || []).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeTrip.otherExpenses.map((o: any) => (
                    <div key={o.id} className="p-4 bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-xl space-y-2 text-xs transition-all relative group">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <span className="font-bold text-amber-400 text-xs">{o.category}</span>
                        <span className="font-mono text-slate-400">{new Date(o.transaction_date).toLocaleDateString()}</span>
                      </div>
                      <p className="font-medium text-slate-200">{o.purpose}</p>
                      {o.merchant && <div className="text-[10px] text-slate-500">Merchant: {o.merchant}</div>}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        <span className="font-mono font-bold text-emerald-400 text-sm">₹{Number(o.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        <div className="flex items-center gap-2">
                          {o.receipt_url && (
                            <a href={o.receipt_url} target="_blank" rel="noreferrer" className="px-2 py-0.5 bg-slate-800 text-cyan-300 rounded text-[10px] font-bold">File</a>
                          )}
                          {activeTrip.status === 'DRAFT' && (
                            <>
                              <button onClick={() => handleOpenEditOther(o)} className="p-1 text-slate-400 hover:text-cyan-400"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteOtherChild(o.id)} className="p-1 text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 text-xs italic bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                  No other expenses
                </div>
              )}
            </div>
          </div>

          {/* FINAL TRIP SUBMIT BAR */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-2xl">
            <div>
              <span className="text-xs text-slate-400 block font-medium uppercase">TOTAL TRIP AMOUNT</span>
              <span className="text-2xl font-extrabold font-mono text-emerald-400">₹{grandTripTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTrip(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Back to Claims List
              </button>

              {activeTrip.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={handleOpenFinalSubmitModal}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-500/20"
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

            <div
              onClick={() => handleOpenSingleModal('LOCAL_TRAVEL')}
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

            <div
              onClick={handleOpenCreateTrip}
              className="p-5 bg-gradient-to-br from-slate-900 to-emerald-950/40 border border-slate-800 hover:border-emerald-500/60 rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.01] shadow-xl group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                  <MapPin className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px] font-bold rounded-full">ACTIVE</span>
              </div>
              <h3 className="font-bold text-white text-base mb-1">Trip Expense</h3>
              <p className="text-xs text-slate-400 mb-4">Multi-day outstation trips with travel, hotel & other expenses</p>
              <button className="w-full py-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white font-semibold text-xs rounded-xl border border-emerald-500/40 transition-all flex items-center justify-center gap-1.5">
                <Plus className="w-4 h-4" />
                <span>Create New Trip Claim</span>
              </button>
            </div>
          </div>

          {/* Main Table Tabs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setClaimCategoryTab('SINGLE_EXPENSES')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    claimCategoryTab === 'SINGLE_EXPENSES' ? 'bg-cyan-500 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  Single Claims (Business & Local Travel)
                </button>
                <button
                  onClick={() => setClaimCategoryTab('TRIP_EXPENSES')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    claimCategoryTab === 'TRIP_EXPENSES' ? 'bg-cyan-500 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  Trip Expenses ({displayedTrips.length})
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300"
                >
                  <option value="">All Statuses</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="PENDING">PENDING</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>
            </div>

            {claimCategoryTab === 'SINGLE_EXPENSES' && (
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
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
                  <tbody className="divide-y divide-slate-800/80">
                    {displayedSingleExpenses.map(ex => (
                      <tr key={ex.id} className="hover:bg-slate-800/40">
                        {activeRoleTab === 'WORKFORCE' && (
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
                        <td className="p-3 font-mono text-[10px]">{ex.bucket || 'Primary'}</td>
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
                          <button onClick={() => setSelectedSingleExpense(ex)} className="p-1 text-slate-400 hover:text-cyan-400" title="View Details">
                            <Eye className="w-4 h-4" />
                          </button>
                          {activeRoleTab === 'WORKFORCE' && (ex.status === 'SUBMITTED' || ex.status === 'PENDING') && (
                            <>
                              <button onClick={() => handleApproveSingle(ex.id)} className="px-2 py-0.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded text-[10px] font-bold">Approve</button>
                              <button onClick={() => handleRejectSingle(ex.id)} className="px-2 py-0.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded text-[10px] font-bold">Reject</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {displayedSingleExpenses.length === 0 && (
                      <tr><td colSpan={9} className="p-8 text-center text-slate-500 italic">No single expense claims found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {claimCategoryTab === 'TRIP_EXPENSES' && (
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
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
                  <tbody className="divide-y divide-slate-800/80">
                    {displayedTrips.map(tr => (
                      <tr key={tr.id} className="hover:bg-slate-800/40">
                        {activeRoleTab === 'WORKFORCE' && (
                          <td className="p-3 font-semibold text-slate-200">
                            <div>{tr.employee_name}</div>
                            <span className="text-[10px] font-mono text-slate-500">{tr.employee_code}</span>
                          </td>
                        )}
                        <td className="p-3 font-bold text-white">{tr.purpose}</td>
                        <td className="p-3 text-cyan-300 font-semibold">{tr.start_point} → {tr.end_point}</td>
                        <td className="p-3 font-mono text-slate-400">{new Date(tr.start_date).toLocaleDateString()} — {new Date(tr.end_date).toLocaleDateString()}</td>
                        <td className="p-3 space-x-1">
                          <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 text-indigo-400 font-mono text-[10px] rounded">{tr.travel_count || 0} Travel</span>
                          <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 text-cyan-400 font-mono text-[10px] rounded">{tr.accom_count || 0} Hotel</span>
                          <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 text-amber-400 font-mono text-[10px] rounded">{tr.other_count || 0} Other</span>
                        </td>
                        <td className="p-3 font-mono font-extrabold text-emerald-400">
                          ₹{Number(tr.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            tr.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                            tr.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                            tr.status === 'DRAFT' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {tr.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-1">
                          <button
                            onClick={() => loadTripDetails(tr.id)}
                            className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 rounded text-[10px] font-bold flex items-center gap-1 inline-flex"
                          >
                            <span>{tr.status === 'DRAFT' ? 'Manage Trip' : 'Trip Details'}</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>

                          {activeRoleTab === 'WORKFORCE' && (tr.status === 'SUBMITTED' || tr.status === 'PENDING') && (
                            <>
                              <button onClick={() => handleApproveTrip(tr.id)} className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded text-[10px] font-bold">Approve</button>
                              <button onClick={() => handleRejectTrip(tr.id)} className="px-2 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded text-[10px] font-bold">Reject</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {displayedTrips.length === 0 && (
                      <tr><td colSpan={8} className="p-8 text-center text-slate-500 italic">No trip expense claims found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODALS */}
      {/* ---------------------------------------------------- */}

      {/* ALERT MODAL: TRIP INITIATED */}
      {showInitiatedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl text-center">
            <h3 className="font-bold text-lg text-white">Trip Expense Initiated</h3>
            <p className="text-xs text-slate-300">You can add all the trip related expenses here.</p>
            <button
              onClick={() => setShowInitiatedAlert(false)}
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-extrabold text-xs shadow-lg"
            >
              OKAY
            </button>
          </div>
        </div>
      )}

      {/* 1. SINGLE CLAIM MODAL */}
      {showSingleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                {singleClaimType === 'BUSINESS' ? <Building className="w-5 h-5 text-cyan-400" /> : <Navigation className="w-5 h-5 text-indigo-400" />}
                <span>{singleClaimType === 'BUSINESS' ? 'Business Expense Claim' : 'Local Travel Expense Claim'}</span>
              </h3>
              <button type="button" onClick={() => setShowSingleModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={e => { e.preventDefault(); handleSubmitSingleClaim('SUBMITTED'); }} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Transaction Date *</label>
                  <input type="date" required value={singleFormData.transactionDate} onChange={e => setSingleFormData({ ...singleFormData, transactionDate: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono" />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Category *</label>
                  <select required value={singleFormData.category} onChange={e => setSingleFormData({ ...singleFormData, category: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200">
                    {(singleClaimType === 'BUSINESS' ? BUSINESS_CATEGORIES : LOCAL_TRAVEL_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Purpose / Note *</label>
                <textarea required rows={2} value={singleFormData.description} onChange={e => setSingleFormData({ ...singleFormData, description: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Reason for expense..." />
              </div>

              {singleClaimType === 'LOCAL_TRAVEL' && (
                <div className="space-y-3 p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-indigo-300 mb-1 font-medium">Mode of Transport *</label>
                      <select required value={singleFormData.transportMode} onChange={e => setSingleFormData({ ...singleFormData, transportMode: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200">
                        {TRANSPORT_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-indigo-300 mb-1 font-medium">Merchant *</label>
                      <input type="text" required value={singleFormData.merchant} onChange={e => setSingleFormData({ ...singleFormData, merchant: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Uber / Ola" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-indigo-300 mb-1 font-medium">Start Location *</label>
                      <input type="text" required value={singleFormData.startLocation} onChange={e => setSingleFormData({ ...singleFormData, startLocation: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="HQ Office" />
                    </div>
                    <div>
                      <label className="block text-indigo-300 mb-1 font-medium">End Location *</label>
                      <input type="text" required value={singleFormData.endLocation} onChange={e => setSingleFormData({ ...singleFormData, endLocation: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Client Site" />
                    </div>
                  </div>
                </div>
              )}

              {singleClaimType === 'BUSINESS' && (
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Merchant / Vendor</label>
                  <input type="text" value={singleFormData.merchant} onChange={e => setSingleFormData({ ...singleFormData, merchant: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Amazon / Vendor Name" />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Currency *</label>
                  <select value={singleFormData.currency} onChange={e => setSingleFormData({ ...singleFormData, currency: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono">
                    <option value="INR">Indian Rupee</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Amount *</label>
                  <input type="number" step="0.01" min="0.01" required value={singleFormData.amount} onChange={e => setSingleFormData({ ...singleFormData, amount: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono font-bold" placeholder="5500.00" />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Bucket *</label>
                  <select required value={singleFormData.bucket} onChange={e => setSingleFormData({ ...singleFormData, bucket: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200">
                    {BUCKET_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="block text-slate-300 font-medium">Upload Attachment</label>
                {!attachment ? (
                  <label className="flex items-center justify-center gap-2 p-3 bg-slate-950 border border-dashed border-slate-700 rounded-xl cursor-pointer text-slate-400 hover:text-cyan-300">
                    <Upload className="w-4 h-4" />
                    <span>Upload Receipt (PDF, JPG, PNG)</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} className="hidden" />
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-slate-950 border border-cyan-800/60 rounded-xl text-xs">
                    <span className="text-slate-200 truncate">{attachment.name}</span>
                    <button type="button" onClick={() => setAttachment(null)} className="p-1 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowSingleModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="button" disabled={submitting} onClick={() => handleSubmitSingleClaim('DRAFT')} className="px-4 py-2 bg-slate-950 border border-slate-700 text-slate-200 rounded-xl">Save Draft</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-cyan-500 text-white rounded-xl font-bold">SUBMIT</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CREATE PARENT TRIP MODAL */}
      {showCreateTripModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-400" />
                <span>Trip Expense</span>
              </h3>
              <button type="button" onClick={() => setShowCreateTripModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTripDraft} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Purpose *</label>
                <textarea required rows={2} value={tripFormData.purpose} onChange={e => setTripFormData({ ...tripFormData, purpose: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Client visit and business meetings" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Start Point *</label>
                  <input type="text" required value={tripFormData.startPoint} onChange={e => setTripFormData({ ...tripFormData, startPoint: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Delhi" />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">End Point *</label>
                  <input type="text" required value={tripFormData.endPoint} onChange={e => setTripFormData({ ...tripFormData, endPoint: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Mumbai" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Start Date *</label>
                  <input type="date" required value={tripFormData.startDate} onChange={e => setTripFormData({ ...tripFormData, startDate: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono" />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">End Date *</label>
                  <input type="date" required value={tripFormData.endDate} onChange={e => setTripFormData({ ...tripFormData, endDate: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono" />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Currency *</label>
                <select value={tripFormData.currency} onChange={e => setTripFormData({ ...tripFormData, currency: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono">
                  <option value="INR">Indian Rupee</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowCreateTripModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold shadow uppercase">SUBMIT</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PARENT TRIP DETAILS MODAL */}
      {showEditTripModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-cyan-400" />
                <span>Edit Trip Details</span>
              </h3>
              <button type="button" onClick={() => setShowEditTripModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateTripDraft} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Purpose *</label>
                <textarea required rows={2} value={tripFormData.purpose} onChange={e => setTripFormData({ ...tripFormData, purpose: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Start Point *</label>
                  <input type="text" required value={tripFormData.startPoint} onChange={e => setTripFormData({ ...tripFormData, startPoint: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">End Point *</label>
                  <input type="text" required value={tripFormData.endPoint} onChange={e => setTripFormData({ ...tripFormData, endPoint: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Start Date *</label>
                  <input type="date" required value={tripFormData.startDate} onChange={e => setTripFormData({ ...tripFormData, startDate: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono" />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">End Date *</label>
                  <input type="date" required value={tripFormData.endDate} onChange={e => setTripFormData({ ...tripFormData, endDate: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono" />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Currency *</label>
                <select value={tripFormData.currency} onChange={e => setTripFormData({ ...tripFormData, currency: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono">
                  <option value="INR">Indian Rupee</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowEditTripModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-bold shadow">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ADD / EDIT TRAVEL EXPENSE CHILD MODAL */}
      {showTravelModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Plane className="w-5 h-5 text-indigo-400" />
                <span>Travel Expense</span>
              </h3>
              <button type="button" onClick={() => setShowTravelModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitTravelChild} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Start Date *</label>
                  <input type="date" required value={travelFormData.startDate} onChange={e => setTravelFormData({ ...travelFormData, startDate: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono" />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">End Date *</label>
                  <input type="date" required value={travelFormData.endDate} onChange={e => setTravelFormData({ ...travelFormData, endDate: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Mode of Transport *</label>
                  <select value={travelFormData.transportMode} onChange={e => setTravelFormData({ ...travelFormData, transportMode: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200">
                    {TRANSPORT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Merchant</label>
                  <input type="text" value={travelFormData.merchant} onChange={e => setTravelFormData({ ...travelFormData, merchant: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Air India / Uber" />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Purpose of Travel *</label>
                <input type="text" required value={travelFormData.purpose} onChange={e => setTravelFormData({ ...travelFormData, purpose: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Travel to client office" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Start Location *</label>
                  <input type="text" required value={travelFormData.startLocation} onChange={e => setTravelFormData({ ...travelFormData, startLocation: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Delhi Airport" />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">End Location *</label>
                  <input type="text" required value={travelFormData.endLocation} onChange={e => setTravelFormData({ ...travelFormData, endLocation: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Mumbai Office" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Distance (in kms)</label>
                  <input type="number" step="0.1" min="0" value={travelFormData.distanceKm} onChange={e => setTravelFormData({ ...travelFormData, distanceKm: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono" placeholder="1150.0" />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Amount *</label>
                  <input type="number" step="0.01" min="0.01" required value={travelFormData.amount} onChange={e => setTravelFormData({ ...travelFormData, amount: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono font-bold" placeholder="5000.00" />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="block text-slate-300 font-medium">Upload Attachment</label>
                {!attachment ? (
                  <label className="flex items-center justify-center gap-2 p-3 bg-slate-950 border border-dashed border-slate-700 rounded-xl cursor-pointer text-slate-400 hover:text-cyan-300">
                    <Upload className="w-4 h-4" />
                    <span>Upload File (PDF, JPG, PNG)</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} className="hidden" />
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-slate-950 border border-cyan-800/60 rounded-xl text-xs">
                    <span className="text-slate-200 truncate">{attachment.name}</span>
                    <button type="button" onClick={() => setAttachment(null)} className="p-1 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowTravelModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold uppercase shadow">SUBMIT</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. ADD / EDIT ACCOMMODATION EXPENSE CHILD MODAL */}
      {showAccomModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Hotel className="w-5 h-5 text-cyan-400" />
                <span>Trip Accommodation Expense</span>
              </h3>
              <button type="button" onClick={() => setShowAccomModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAccomChild} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Start Date *</label>
                  <input type="date" required value={accomFormData.startDate} onChange={e => setAccomFormData({ ...accomFormData, startDate: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono" />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">End Date *</label>
                  <input type="date" required value={accomFormData.endDate} onChange={e => setAccomFormData({ ...accomFormData, endDate: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono" />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Accommodation Detail *</label>
                <textarea required rows={3} value={accomFormData.accommodationDetails} onChange={e => setAccomFormData({ ...accomFormData, accommodationDetails: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Hotel Taj Mumbai stay" />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Amount *</label>
                <input type="number" step="0.01" min="0.01" required value={accomFormData.amount} onChange={e => setAccomFormData({ ...accomFormData, amount: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono font-bold" placeholder="4000.00" />
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="block text-slate-300 font-medium">Upload Attachment</label>
                {!attachment ? (
                  <label className="flex items-center justify-center gap-2 p-3 bg-slate-950 border border-dashed border-slate-700 rounded-xl cursor-pointer text-slate-400 hover:text-cyan-300">
                    <Upload className="w-4 h-4" />
                    <span>Upload Invoice (PDF, JPG, PNG)</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} className="hidden" />
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-slate-950 border border-cyan-800/60 rounded-xl text-xs">
                    <span className="text-slate-200 truncate">{attachment.name}</span>
                    <button type="button" onClick={() => setAttachment(null)} className="p-1 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowAccomModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold uppercase shadow">SUBMIT</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. ADD / EDIT OTHER EXPENSE CHILD MODAL */}
      {showOtherModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <span>Trip Other Expense</span>
              </h3>
              <button type="button" onClick={() => setShowOtherModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitOtherChild} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Transaction Date *</label>
                  <input type="date" required value={otherFormData.transactionDate} onChange={e => setOtherFormData({ ...otherFormData, transactionDate: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono" />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Category *</label>
                  <select value={otherFormData.category} onChange={e => setOtherFormData({ ...otherFormData, category: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200">
                    {OTHER_EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Purpose / Notes *</label>
                <input type="text" required value={otherFormData.purpose} onChange={e => setOtherFormData({ ...otherFormData, purpose: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Client dinner" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Merchant</label>
                  <input type="text" value={otherFormData.merchant} onChange={e => setOtherFormData({ ...otherFormData, merchant: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200" placeholder="Restaurant" />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Amount *</label>
                  <input type="number" step="0.01" min="0.01" required value={otherFormData.amount} onChange={e => setOtherFormData({ ...otherFormData, amount: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono font-bold" placeholder="800.00" />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="block text-slate-300 font-medium">Upload Attachment</label>
                {!attachment ? (
                  <label className="flex items-center justify-center gap-2 p-3 bg-slate-950 border border-dashed border-slate-700 rounded-xl cursor-pointer text-slate-400 hover:text-cyan-300">
                    <Upload className="w-4 h-4" />
                    <span>Upload Receipt (PDF, JPG, PNG)</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} className="hidden" />
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-slate-950 border border-cyan-800/60 rounded-xl text-xs">
                    <span className="text-slate-200 truncate">{attachment.name}</span>
                    <button type="button" onClick={() => setAttachment(null)} className="p-1 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowOtherModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold uppercase shadow">SUBMIT</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. FINAL SUBMIT TRIP CONFIRMATION MODAL */}
      {showFinalSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Confirmation</span>
              </h3>
              <button type="button" onClick={() => setShowFinalSubmitModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300 text-sm">Are you sure you want to submit this request?</p>
              
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Trip Purpose:</span>
                  <span className="font-semibold text-slate-200">{activeTrip?.purpose}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Travel Expenses:</span>
                  <span className="font-mono text-indigo-400 font-bold">{activeTrip?.travelExpenses?.length || 0} items</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Accommodation Expenses:</span>
                  <span className="font-mono text-cyan-400 font-bold">{activeTrip?.accommodationExpenses?.length || 0} items</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Other Expenses:</span>
                  <span className="font-mono text-amber-400 font-bold">{activeTrip?.otherExpenses?.length || 0} items</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800 text-sm">
                  <span className="font-bold text-slate-300">Trip Total:</span>
                  <span className="font-mono font-extrabold text-emerald-400">₹{grandTripTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800 text-xs font-bold">
              <button type="button" onClick={() => setShowFinalSubmitModal(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl">CANCEL</button>
              <button type="button" disabled={submitting} onClick={handleConfirmFinalSubmitTrip} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl shadow uppercase">OKAY</button>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE EXPENSE DETAIL VIEW MODAL */}
      {selectedSingleExpense && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-cyan-400" />
                <span>Expense Claim Details</span>
              </h3>
              <button type="button" onClick={() => setSelectedSingleExpense(null)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px]">EXPENSE TYPE</span>
                  <span className="font-bold text-cyan-400">{selectedSingleExpense.expense_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">TRANSACTION DATE</span>
                  <span className="font-mono text-slate-200">{new Date(selectedSingleExpense.transaction_date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CATEGORY</span>
                  <span className="font-semibold text-slate-200">{selectedSingleExpense.category || selectedSingleExpense.category_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">AMOUNT</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">₹{Number(selectedSingleExpense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-2 p-3 bg-slate-950 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px]">PURPOSE / NOTE</span>
                  <p className="text-slate-200 font-medium">{selectedSingleExpense.description}</p>
                </div>
                {selectedSingleExpense.merchant && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">MERCHANT / VENDOR</span>
                    <span className="text-slate-200 font-semibold">{selectedSingleExpense.merchant}</span>
                  </div>
                )}
                {selectedSingleExpense.expense_type === 'LOCAL_TRAVEL' && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">MODE OF TRANSPORT</span>
                      <span className="text-indigo-300 font-semibold">{selectedSingleExpense.transport_mode}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">START → END LOCATION</span>
                      <span className="text-slate-200">{selectedSingleExpense.start_location} → {selectedSingleExpense.end_location}</span>
                    </div>
                  </div>
                )}
              </div>

              {selectedSingleExpense.receipt_url && (
                <div className="p-3 bg-slate-950 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span className="font-semibold text-slate-200 truncate">{selectedSingleExpense.attachment_name || 'Receipt Document'}</span>
                  </div>
                  <a href={selectedSingleExpense.receipt_url} target="_blank" rel="noreferrer" className="px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded text-[10px] font-bold">View File</a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button type="button" onClick={() => setSelectedSingleExpense(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
