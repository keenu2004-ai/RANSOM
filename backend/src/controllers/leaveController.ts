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

  // Leave list endpoint for Management & Employee self-service
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const userRole = req.user!.role;
      const userEmpId = req.user!.employeeId;
      const { status, page, limit, employeeId } = req.query;

      const isManager = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(userRole);
      const targetEmpId = isManager && employeeId ? (employeeId as string) : (isManager ? undefined : (userEmpId || undefined));

      const result = await LeaveRepository.findAll(organizationId, {
        status: status as string,
        employeeId: targetEmpId,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 500
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
    } catch (error: any) {
      if (error.message?.includes('Leave request not found')) {
        return res.status(404).json({ success: false, code: 'LEAVE_NOT_FOUND', error: 'Leave request no longer exists.' });
      }
      if (error.message?.includes('already')) {
        return res.status(409).json({ success: false, code: 'REQUEST_NOT_PENDING', error: error.message });
      }
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
    } catch (error: any) {
      if (error.message?.includes('Leave request not found')) {
        return res.status(404).json({ success: false, code: 'LEAVE_NOT_FOUND', error: 'Leave request no longer exists.' });
      }
      if (error.message?.includes('already')) {
        return res.status(409).json({ success: false, code: 'REQUEST_NOT_PENDING', error: error.message });
      }
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
      const body = req.body || {};

      const cl = Number(body.clQuota ?? body.cl);
      const el = Number(body.elQuota ?? body.plQuota ?? body.el ?? body.pl);
      const sl = Number(body.slQuota ?? body.sl);
      const ol = Number(body.olQuota ?? body.ol ?? 0);

      if (isNaN(cl) || isNaN(el) || isNaN(sl) || cl < 0 || el < 0 || sl < 0) {
        return res.status(400).json({
          success: false,
          error: 'clQuota, elQuota, and slQuota must be valid non-negative numbers.',
          code: 'VALIDATION_ERROR'
        });
      }

      const result = await LeaveRepository.updatePolicy(
        organizationId,
        { clQuota: Math.floor(cl), elQuota: Math.floor(el), slQuota: Math.floor(sl), olQuota: Math.floor(ol) },
        req.user!.userId
      );

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      return next(error);
    }
  }

  // Employee / Self / Admin cancellation of leave request
  static async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;
      const { reason } = req.body || {};

      const cancelled = await LeaveRepository.cancelLeaveRequest(
        organizationId,
        req.user!.userId,
        req.user!.employeeId || null,
        req.user!.role,
        id,
        reason || 'Cancelled by user'
      );

      return res.status(200).json({
        success: true,
        data: { leaveRequest: cancelled, message: 'Leave request cancelled successfully.' }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Create Leave Entitlement Adjustment
  static async createAdjustment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { employeeId, leaveTypeId, periodYear, adjustmentType, adjustmentValue, reason } = req.body;

      if (!employeeId || !leaveTypeId || adjustmentValue === undefined || !reason) {
        return res.status(400).json({ success: false, error: 'employeeId, leaveTypeId, adjustmentValue, and reason are required.', code: 'VALIDATION_ERROR' });
      }

      const adjustment = await LeaveRepository.createLeaveAdjustment(
        organizationId,
        req.user!.userId,
        {
          employeeId,
          leaveTypeId,
          periodYear: periodYear ? parseInt(periodYear, 10) : new Date().getFullYear(),
          adjustmentType: adjustmentType || 'INCREMENT',
          adjustmentValue: Number(adjustmentValue),
          reason
        }
      );

      return res.status(201).json({
        success: true,
        data: { adjustment, message: 'Leave entitlement adjusted successfully.' }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Get Employee Leave Adjustments
  static async getAdjustments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { employeeId } = req.params;
      const { year } = req.query;

      const adjustments = await LeaveRepository.findLeaveAdjustments(
        organizationId,
        employeeId,
        year ? parseInt(year as string, 10) : new Date().getFullYear()
      );

      return res.status(200).json({
        success: true,
        data: { adjustments }
      });
    } catch (error) {
      return next(error);
    }
  }
}
