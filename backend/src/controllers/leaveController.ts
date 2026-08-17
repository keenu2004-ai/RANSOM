import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { LeaveRepository } from '../repositories/leaveRepository';
import { AuthenticatedRequest } from '../types';

const applyLeaveSchema = z.object({
  leaveTypeId: z.string().uuid('Valid Leave Type ID is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  totalDays: z.number().positive('Total days must be positive'),
  reason: z.string().min(1, 'Reason is required')
});

export class LeaveController {
  // Personal self-service: Requires employeeId
  static async myBalance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;

      if (!employeeId) {
        return res.status(400).json({
          success: false,
          error: 'Personal leave balances require a linked employee profile.',
          code: 'EMPLOYEE_PROFILE_REQUIRED'
        });
      }

      const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
      const balances = await LeaveRepository.findBalancesByEmployee(employeeId, organizationId, year);

      return res.status(200).json({
        success: true,
        data: { balances }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Personal self-service: Requires employeeId
  static async apply(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;

      const parseResult = applyLeaveSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: parseResult.error.errors[0].message,
          code: 'VALIDATION_ERROR'
        });
      }

      const leaveRequest = await LeaveRepository.applyLeave(organizationId, employeeId!, parseResult.data);

      return res.status(201).json({
        success: true,
        data: { leaveRequest, message: 'Leave request submitted successfully.' }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Administrative Overview: Does NOT require employeeId
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { status, page, limit } = req.query;

      const result = await LeaveRepository.findAll(organizationId, {
        status: status as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      return next(error);
    }
  }

  // Leave Types configuration list
  static async types(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const types = await LeaveRepository.findTypes(organizationId);
      return res.status(200).json({
        success: true,
        data: { leaveTypes: types }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Administrative Approval: Does NOT require employeeId on reviewer
  static async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;
      const reviewerEmployeeId = req.user!.employeeId || undefined;

      const updated = await LeaveRepository.updateStatus(id, organizationId, 'APPROVED', reviewerEmployeeId);
      return res.status(200).json({
        success: true,
        data: { leaveRequest: updated, message: 'Leave request approved successfully.' }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Administrative Rejection: Does NOT require employeeId on reviewer
  static async reject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;
      const { rejectionReason } = req.body;
      const reviewerEmployeeId = req.user!.employeeId || undefined;

      const updated = await LeaveRepository.updateStatus(id, organizationId, 'REJECTED', reviewerEmployeeId, rejectionReason);
      return res.status(200).json({
        success: true,
        data: { leaveRequest: updated, message: 'Leave request rejected.' }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Personal Monthly CL Usage Counter
  static async monthlyUsage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;
      if (!employeeId) {
        return res.status(400).json({ success: false, error: 'Employee profile required.', code: 'EMPLOYEE_PROFILE_REQUIRED' });
      }

      const now = new Date();
      const year = req.query.year ? parseInt(req.query.year as string, 10) : now.getFullYear();
      const month = req.query.month ? parseInt(req.query.month as string, 10) : (now.getMonth() + 1);

      const clUsedThisMonth = await LeaveRepository.getMonthlyCLUsage(employeeId, organizationId, year, month);

      return res.status(200).json({
        success: true,
        data: {
          clUsedThisMonth,
          clMonthlyLimit: 2
        }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Administrative Policy Quotas Update
  static async updatePolicy(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { clQuota, elQuota, slQuota } = req.body;

      if (typeof clQuota !== 'number' || typeof elQuota !== 'number' || typeof slQuota !== 'number') {
        return res.status(400).json({ success: false, error: 'clQuota, elQuota, and slQuota must be numbers.', code: 'VALIDATION_ERROR' });
      }

      const result = await LeaveRepository.updatePolicy(organizationId, { clQuota, elQuota, slQuota });
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      return next(error);
    }
  }
}
