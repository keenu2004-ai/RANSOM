import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ExpenseRepository } from '../repositories/expenseRepository';
import { TripExpenseRepository } from '../repositories/tripExpenseRepository';
import { authenticate } from '../middleware/authMiddleware';
import { requireEmployee } from '../middleware/requireEmployee';
import { requireRole } from '../middleware/rbacMiddleware';
import { validateExpenseApprover } from '../utils/approvalHierarchy';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

const BUCKETS = ['Exit', 'Internal', 'Onboarding', 'Other', 'Primary'] as const;
const BUSINESS_CATEGORIES = ['Courier', 'Food', 'Office Supply', 'Others', 'Raw Material'] as const;
const LOCAL_TRAVEL_CATEGORIES = [
  'Bike', 'Bike Taxi', 'Courier', 'Field Visits', 'Flight', 'Food',
  'Metro Train', 'Office Supply', 'Others', 'Raw Material', 'Taxi', 'Train'
] as const;
const TRANSPORT_MODES = [
  'Auto', 'Bus', 'Flight', 'Other', 'Public Transportation', 'Metro', 'Taxi', 'Train'
] as const;
const OTHER_EXPENSE_CATEGORIES = ['Food', 'Other', 'Courier', 'Office Supply', 'Raw Material', 'Miscellaneous'] as const;

// Validation Schema for Business & Local Travel
const createExpenseSchema = z.object({
  expenseType: z.enum(['BUSINESS', 'LOCAL_TRAVEL']),
  transactionDate: z.string().optional(),
  category: z.string().min(1, 'Category is required.'),
  merchant: z.string().optional(),
  currency: z.string().default('INR'),
  amount: z.number().gt(0, 'Amount must be greater than 0.'),
  bucket: z.enum(BUCKETS, { errorMap: () => ({ message: 'Invalid expense bucket specified.' }) }),
  transportMode: z.enum(TRANSPORT_MODES).optional(),
  startLocation: z.string().optional(),
  endLocation: z.string().optional(),
  description: z.string().min(1, 'Purpose / Note is required.'),
  attachmentName: z.string().optional(),
  receiptUrl: z.string().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED']).optional().default('SUBMITTED')
}).superRefine((data, ctx) => {
  if (data.expenseType === 'BUSINESS') {
    if (!BUSINESS_CATEGORIES.includes(data.category as any)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid Category for Business Expense. Allowed: ${BUSINESS_CATEGORIES.join(', ')}`,
        path: ['category']
      });
    }
  } else if (data.expenseType === 'LOCAL_TRAVEL') {
    if (!LOCAL_TRAVEL_CATEGORIES.includes(data.category as any)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid Category for Local Travel Expense. Allowed: ${LOCAL_TRAVEL_CATEGORIES.join(', ')}`,
        path: ['category']
      });
    }
    if (!data.transportMode || !TRANSPORT_MODES.includes(data.transportMode as any)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Valid Mode of Transport is required for Local Travel.`,
        path: ['transportMode']
      });
    }
    if (!data.merchant || data.merchant.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Merchant is required for Local Travel Expense.',
        path: ['merchant']
      });
    }
    if (!data.startLocation || data.startLocation.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Start Location is required for Local Travel Expense.',
        path: ['startLocation']
      });
    }
    if (!data.endLocation || data.endLocation.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End Location is required for Local Travel Expense.',
        path: ['endLocation']
      });
    }
  }
});

// Trip Parent Schema
const createTripSchema = z.object({
  purpose: z.string().min(1, 'Purpose is required.'),
  startPoint: z.string().min(1, 'Start Point is required.'),
  endPoint: z.string().min(1, 'End Point is required.'),
  startDate: z.string().min(1, 'Start Date is required.'),
  endDate: z.string().min(1, 'End Date is required.'),
  currency: z.string().default('INR')
}).superRefine((data, ctx) => {
  if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End Date cannot be before Start Date.',
      path: ['endDate']
    });
  }
});

// Travel Child Schema
const createTravelSchema = z.object({
  startDate: z.string().min(1, 'Start Date is required.'),
  endDate: z.string().min(1, 'End Date is required.'),
  transportMode: z.enum(TRANSPORT_MODES, { errorMap: () => ({ message: 'Valid Mode of Transport is required.' }) }),
  purpose: z.string().min(1, 'Purpose is required.'),
  merchant: z.string().optional(),
  startLocation: z.string().min(1, 'Start Location is required.'),
  endLocation: z.string().min(1, 'End Location is required.'),
  distanceKm: z.number().min(0, 'Distance cannot be negative.').optional().default(0),
  currency: z.string().default('INR'),
  amount: z.number().gt(0, 'Amount must be greater than 0.'),
  attachmentName: z.string().optional(),
  receiptUrl: z.string().optional()
}).superRefine((data, ctx) => {
  if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Travel End Date cannot be before Start Date.',
      path: ['endDate']
    });
  }
});

// Accommodation Child Schema
const createAccommodationSchema = z.object({
  startDate: z.string().min(1, 'Start Date is required.'),
  endDate: z.string().min(1, 'End Date is required.'),
  currency: z.string().default('INR'),
  amount: z.number().gt(0, 'Amount must be greater than 0.'),
  accommodationDetails: z.string().min(1, 'Accommodation Details are required.'),
  attachmentName: z.string().optional(),
  receiptUrl: z.string().optional()
}).superRefine((data, ctx) => {
  if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Accommodation End Date cannot be before Start Date.',
      path: ['endDate']
    });
  }
});

// Other Child Schema
const createOtherSchema = z.object({
  transactionDate: z.string().min(1, 'Transaction Date is required.'),
  category: z.string().min(1, 'Category is required.'),
  merchant: z.string().optional(),
  currency: z.string().default('INR'),
  amount: z.number().gt(0, 'Amount must be greater than 0.'),
  purpose: z.string().min(1, 'Purpose is required.'),
  attachmentName: z.string().optional(),
  receiptUrl: z.string().optional()
});

// Personal self-service: My expenses
router.get('/my', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Personal expenses require a linked employee profile.', code: 'EMPLOYEE_PROFILE_REQUIRED' });
    }
    const { expenseType, status, category } = req.query;
    const expenses = await ExpenseRepository.findByEmployee(organizationId, employeeId, {
      expenseType: expenseType as string,
      status: status as string,
      category: category as string
    });
    return res.status(200).json({ success: true, data: { expenses } });
  } catch (error) {
    return next(error);
  }
});

// Categories list helper
router.get('/categories', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        businessCategories: BUSINESS_CATEGORIES,
        localTravelCategories: LOCAL_TRAVEL_CATEGORIES,
        transportModes: TRANSPORT_MODES,
        buckets: BUCKETS,
        otherCategories: OTHER_EXPENSE_CATEGORIES
      }
    });
  } catch (error) {
    return next(error);
  }
});

// ============================================================
// TRIP EXPENSE ENDPOINTS
// ============================================================

// 1. Create Parent Trip Draft
router.post('/trips', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    const validated = createTripSchema.parse(req.body);
    const trip = await TripExpenseRepository.createTrip(organizationId, employeeId, validated);
    return res.status(201).json({ success: true, data: { trip, message: 'Trip Expense draft created successfully.' } });
  } catch (error) {
    return next(error);
  }
});

// 2. Get My Trip Claims
router.get('/trips/my', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Trip expenses require a linked employee profile.', code: 'EMPLOYEE_PROFILE_REQUIRED' });
    }
    const { status } = req.query;
    const trips = await TripExpenseRepository.findByEmployee(organizationId, employeeId, { status: status as string });
    return res.status(200).json({ success: true, data: { trips } });
  } catch (error) {
    return next(error);
  }
});

// 3. Get Workforce Trip Claims (Approvers)
router.get('/trips/workforce', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const { status, page, limit } = req.query;
    const result = await TripExpenseRepository.findAll(organizationId, {
      status: status as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 50
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
});

// 4. Get Single Trip Details with Children
router.get('/trips/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const trip = await TripExpenseRepository.getTripById(req.params.id, organizationId);
    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip Expense not found.', code: 'TRIP_NOT_FOUND' });
    }

    const isOwner = req.user!.employeeId && req.user!.employeeId === trip.employee_id;
    const isManagerOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(req.user!.role);

    if (!isOwner && !isManagerOrAdmin) {
      return res.status(403).json({ success: false, error: 'Access denied to this trip expense.', code: 'FORBIDDEN' });
    }

    return res.status(200).json({ success: true, data: { trip } });
  } catch (error) {
    return next(error);
  }
});

// 5. Update Trip Draft Details
router.put('/trips/:id', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    const updated = await TripExpenseRepository.updateTripDraft(req.params.id, organizationId, employeeId, req.body);
    if (!updated) {
      return res.status(400).json({ success: false, error: 'Trip Expense not found or not in DRAFT status.', code: 'INVALID_TRIP_UPDATE' });
    }
    return res.status(200).json({ success: true, data: { trip: updated, message: 'Trip Expense draft updated successfully.' } });
  } catch (error) {
    return next(error);
  }
});

// 6. Delete Trip Draft
router.delete('/trips/:id', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    const deleted = await TripExpenseRepository.deleteTripDraft(req.params.id, organizationId, employeeId);
    if (!deleted) {
      return res.status(400).json({ success: false, error: 'Trip Expense not found or not in DRAFT status.', code: 'INVALID_TRIP_DELETE' });
    }
    return res.status(200).json({ success: true, data: { message: 'Trip Expense draft deleted successfully.' } });
  } catch (error) {
    return next(error);
  }
});

// 7. Final Trip Submission (Enforces >= 1 child expense & calculates total)
router.post('/trips/:id/submit', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    const submittedTrip = await TripExpenseRepository.submitTrip(req.params.id, organizationId, employeeId);
    return res.status(200).json({ success: true, data: { trip: submittedTrip, message: 'Trip Expense submitted successfully for approval.' } });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Failed to submit Trip Expense.', code: 'TRIP_SUBMIT_ERROR' });
  }
});

// 8. Approve Trip (Approver)
router.put('/trips/:id/approve', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const trip = await TripExpenseRepository.getTripById(req.params.id, organizationId);
    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip Expense not found.', code: 'TRIP_NOT_FOUND' });
    }

    const validation = await validateExpenseApprover(organizationId, trip.employee_id, {
      userId: req.user!.userId,
      role: req.user!.role,
      organizationId,
      employeeId: req.user!.employeeId
    });

    if (!validation.allowed) {
      return res.status(403).json({ success: false, error: validation.reason, code: 'APPROVAL_AUTHORITY_DENIED' });
    }

    const updated = await TripExpenseRepository.updateStatus(req.params.id, organizationId, 'APPROVED', req.user!.employeeId || undefined);
    return res.status(200).json({ success: true, data: { trip: updated, message: 'Trip Expense approved successfully.' } });
  } catch (error) {
    return next(error);
  }
});

// 9. Reject Trip (Approver)
router.put('/trips/:id/reject', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const trip = await TripExpenseRepository.getTripById(req.params.id, organizationId);
    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip Expense not found.', code: 'TRIP_NOT_FOUND' });
    }

    const validation = await validateExpenseApprover(organizationId, trip.employee_id, {
      userId: req.user!.userId,
      role: req.user!.role,
      organizationId,
      employeeId: req.user!.employeeId
    });

    if (!validation.allowed) {
      return res.status(403).json({ success: false, error: validation.reason, code: 'APPROVAL_AUTHORITY_DENIED' });
    }

    const updated = await TripExpenseRepository.updateStatus(req.params.id, organizationId, 'REJECTED', req.user!.employeeId || undefined, req.body.rejectionReason);
    return res.status(200).json({ success: true, data: { trip: updated, message: 'Trip Expense rejected.' } });
  } catch (error) {
    return next(error);
  }
});

// ------------------------------------------------------------
// CHILD EXPENSE ENDPOINTS (Travel, Accommodation, Other)
// ------------------------------------------------------------

// A. Travel Expenses
router.post('/trips/:tripId/travel', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    const validated = createTravelSchema.parse(req.body);
    const item = await TripExpenseRepository.addTravelExpense(organizationId, employeeId, req.params.tripId, validated);
    return res.status(201).json({ success: true, data: { item, message: 'Travel Expense added to Trip.' } });
  } catch (error) {
    return next(error);
  }
});

router.put('/trips/:tripId/travel/:id', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    const item = await TripExpenseRepository.updateTravelExpense(req.params.id, req.params.tripId, organizationId, employeeId, req.body);
    return res.status(200).json({ success: true, data: { item, message: 'Travel Expense updated.' } });
  } catch (error) {
    return next(error);
  }
});

router.delete('/trips/:tripId/travel/:id', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    await TripExpenseRepository.deleteTravelExpense(req.params.id, req.params.tripId, organizationId, employeeId);
    return res.status(200).json({ success: true, data: { message: 'Travel Expense removed from Trip.' } });
  } catch (error) {
    return next(error);
  }
});

// B. Accommodation Expenses
router.post('/trips/:tripId/accommodation', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    const validated = createAccommodationSchema.parse(req.body);
    const item = await TripExpenseRepository.addAccommodationExpense(organizationId, employeeId, req.params.tripId, validated);
    return res.status(201).json({ success: true, data: { item, message: 'Accommodation Expense added to Trip.' } });
  } catch (error) {
    return next(error);
  }
});

router.put('/trips/:tripId/accommodation/:id', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    const item = await TripExpenseRepository.updateAccommodationExpense(req.params.id, req.params.tripId, organizationId, employeeId, req.body);
    return res.status(200).json({ success: true, data: { item, message: 'Accommodation Expense updated.' } });
  } catch (error) {
    return next(error);
  }
});

router.delete('/trips/:tripId/accommodation/:id', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    await TripExpenseRepository.deleteAccommodationExpense(req.params.id, req.params.tripId, organizationId, employeeId);
    return res.status(200).json({ success: true, data: { message: 'Accommodation Expense removed from Trip.' } });
  } catch (error) {
    return next(error);
  }
});

// C. Other Expenses
router.post('/trips/:tripId/other', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    const validated = createOtherSchema.parse(req.body);
    const item = await TripExpenseRepository.addOtherExpense(organizationId, employeeId, req.params.tripId, validated);
    return res.status(201).json({ success: true, data: { item, message: 'Other Expense added to Trip.' } });
  } catch (error) {
    return next(error);
  }
});

router.put('/trips/:tripId/other/:id', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    const item = await TripExpenseRepository.updateOtherExpense(req.params.id, req.params.tripId, organizationId, employeeId, req.body);
    return res.status(200).json({ success: true, data: { item, message: 'Other Expense updated.' } });
  } catch (error) {
    return next(error);
  }
});

router.delete('/trips/:tripId/other/:id', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    await TripExpenseRepository.deleteOtherExpense(req.params.id, req.params.tripId, organizationId, employeeId);
    return res.status(200).json({ success: true, data: { message: 'Other Expense removed from Trip.' } });
  } catch (error) {
    return next(error);
  }
});

// ============================================================
// BUSINESS & LOCAL TRAVEL SINGLE EXPENSE ENDPOINTS
// ============================================================

// Create new single expense claim (DRAFT or SUBMITTED)
router.post('/', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    
    const validatedData = createExpenseSchema.parse(req.body);
    const expense = await ExpenseRepository.create(organizationId, employeeId, validatedData as any);
    
    const message = validatedData.status === 'DRAFT'
      ? 'Expense claim draft saved successfully.'
      : 'Expense claim submitted successfully.';

    return res.status(201).json({ success: true, data: { expense, message } });
  } catch (error) {
    return next(error);
  }
});

// Get single expense details by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const expense = await ExpenseRepository.findById(req.params.id, organizationId);
    
    if (!expense) {
      return res.status(404).json({ success: false, error: 'Expense claim not found.', code: 'EXPENSE_NOT_FOUND' });
    }

    const isOwner = req.user!.employeeId && req.user!.employeeId === expense.employee_id;
    const isManagerOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(req.user!.role);

    if (!isOwner && !isManagerOrAdmin) {
      return res.status(403).json({ success: false, error: 'Access denied to this expense claim.', code: 'FORBIDDEN' });
    }

    return res.status(200).json({ success: true, data: { expense } });
  } catch (error) {
    return next(error);
  }
});

// Update draft single expense
router.put('/:id', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    const updated = await ExpenseRepository.updateDraft(req.params.id, organizationId, employeeId, req.body);
    if (!updated) {
      return res.status(400).json({ success: false, error: 'Expense claim not found or not in DRAFT status.', code: 'INVALID_DRAFT_UPDATE' });
    }
    return res.status(200).json({ success: true, data: { expense: updated, message: 'Draft expense updated successfully.' } });
  } catch (error) {
    return next(error);
  }
});

// Submit draft single expense
router.post('/:id/submit', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    const submitted = await ExpenseRepository.submitDraft(req.params.id, organizationId, employeeId);
    if (!submitted) {
      return res.status(400).json({ success: false, error: 'Expense claim not found or already submitted.', code: 'INVALID_DRAFT_SUBMIT' });
    }
    return res.status(200).json({ success: true, data: { expense: submitted, message: 'Draft expense claim submitted successfully.' } });
  } catch (error) {
    return next(error);
  }
});

// Administrative Overview: List all workforce claims (Requires Admin/Manager role)
router.get('/', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const { expenseType, status, category, date, page, limit } = req.query;
    const result = await ExpenseRepository.findAll(organizationId, {
      expenseType: expenseType as string,
      status: status as string,
      category: category as string,
      date: date as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 50
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
});

// Approve single claim (Requires Admin/Manager role & hierarchical approval authority)
router.put('/:id/approve', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const expense = await ExpenseRepository.findById(req.params.id, organizationId);
    if (!expense) {
      return res.status(404).json({ success: false, error: 'Expense claim not found.', code: 'EXPENSE_NOT_FOUND' });
    }

    const validation = await validateExpenseApprover(organizationId, expense.employee_id, {
      userId: req.user!.userId,
      role: req.user!.role,
      organizationId,
      employeeId: req.user!.employeeId
    });

    if (!validation.allowed) {
      return res.status(403).json({ success: false, error: validation.reason, code: 'APPROVAL_AUTHORITY_DENIED' });
    }

    const updated = await ExpenseRepository.updateStatus(req.params.id, organizationId, 'APPROVED', req.user!.employeeId || undefined);
    return res.status(200).json({ success: true, data: { expense: updated, message: 'Expense claim approved.' } });
  } catch (error) {
    return next(error);
  }
});

// Reject single claim (Requires Admin/Manager role & hierarchical approval authority)
router.put('/:id/reject', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const expense = await ExpenseRepository.findById(req.params.id, organizationId);
    if (!expense) {
      return res.status(404).json({ success: false, error: 'Expense claim not found.', code: 'EXPENSE_NOT_FOUND' });
    }

    const validation = await validateExpenseApprover(organizationId, expense.employee_id, {
      userId: req.user!.userId,
      role: req.user!.role,
      organizationId,
      employeeId: req.user!.employeeId
    });

    if (!validation.allowed) {
      return res.status(403).json({ success: false, error: validation.reason, code: 'APPROVAL_AUTHORITY_DENIED' });
    }

    const updated = await ExpenseRepository.updateStatus(req.params.id, organizationId, 'REJECTED', req.user!.employeeId || undefined, req.body.rejectionReason);
    return res.status(200).json({ success: true, data: { expense: updated, message: 'Expense claim rejected.' } });
  } catch (error) {
    return next(error);
  }
});

// SUPER_ADMIN ONLY Expense Deletion Endpoint
router.delete('/:id', requireRole('SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const userId = req.user!.userId;
    const { id } = req.params;

    const deleted = await ExpenseRepository.deleteSuperAdmin(id, organizationId, userId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Expense claim not found or access denied.',
        code: 'EXPENSE_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      data: { message: 'Expense claim permanently deleted.', expense: deleted }
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
