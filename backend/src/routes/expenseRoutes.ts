import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ExpenseRepository } from '../repositories/expenseRepository';
import { authenticate } from '../middleware/authMiddleware';
import { requireEmployee } from '../middleware/requireEmployee';
import { requireRole } from '../middleware/rbacMiddleware';
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

// Validation Schema
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
        buckets: BUCKETS
      }
    });
  } catch (error) {
    return next(error);
  }
});

// Create new expense claim (DRAFT or SUBMITTED)
router.post('/', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    
    // Explicit rejection of TRIP expense
    if (req.body.expenseType === 'TRIP') {
      return res.status(400).json({
        success: false,
        error: 'Trip Expense is coming soon and not active in Phase 1.',
        code: 'TRIP_EXPENSE_UNSUPPORTED'
      });
    }

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

// Get single expense details by ID (Security: Owner or Admin/Manager)
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const expense = await ExpenseRepository.findById(req.params.id, organizationId);
    
    if (!expense) {
      return res.status(404).json({ success: false, error: 'Expense claim not found.', code: 'EXPENSE_NOT_FOUND' });
    }

    // Security check: must be owner OR have manager/admin role
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

// Update draft expense
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

// Submit draft expense
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

// Approve claim (Requires Admin/Manager role)
router.put('/:id/approve', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await ExpenseRepository.updateStatus(req.params.id, req.user!.organizationId, 'APPROVED', req.user!.employeeId || undefined);
    return res.status(200).json({ success: true, data: { expense: updated, message: 'Expense claim approved.' } });
  } catch (error) {
    return next(error);
  }
});

// Reject claim (Requires Admin/Manager role)
router.put('/:id/reject', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await ExpenseRepository.updateStatus(req.params.id, req.user!.organizationId, 'REJECTED', req.user!.employeeId || undefined, req.body.rejectionReason);
    return res.status(200).json({ success: true, data: { expense: updated, message: 'Expense claim rejected.' } });
  } catch (error) {
    return next(error);
  }
});

export default router;
