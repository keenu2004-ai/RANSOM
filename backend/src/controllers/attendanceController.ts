import { Response, NextFunction } from 'express';
import { AttendanceRepository } from '../repositories/attendanceRepository';
import { AuthenticatedRequest } from '../types';

export class AttendanceController {
  // Personal self-service: Requires employeeId
  static async getToday(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;

      if (!employeeId) {
        return res.status(400).json({
          success: false,
          error: 'A linked employee profile is required for personal attendance.',
          code: 'EMPLOYEE_PROFILE_REQUIRED'
        });
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const todayRecord = await AttendanceRepository.findTodayByEmployee(employeeId, organizationId, dateStr);

      return res.status(200).json({
        success: true,
        data: { attendance: todayRecord }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Personal self-service: Requires employeeId
  static async checkIn(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;
      const { latitude, longitude, shiftName, locationId } = req.body;
      const ipAddress = req.ip;

      const dateStr = new Date().toISOString().split('T')[0];
      const record = await AttendanceRepository.checkIn(
        organizationId,
        employeeId!,
        dateStr,
        latitude ? parseFloat(latitude) : undefined,
        longitude ? parseFloat(longitude) : undefined,
        shiftName || 'General Shift',
        locationId,
        ipAddress
      );

      return res.status(200).json({
        success: true,
        data: { attendance: record, message: 'Checked in successfully.' }
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message || 'Check-in failed.',
        code: 'CHECK_IN_FAILED'
      });
    }
  }

  // Personal self-service: Requires employeeId
  static async checkOut(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;
      const { latitude, longitude } = req.body;

      const dateStr = new Date().toISOString().split('T')[0];
      const record = await AttendanceRepository.checkOut(
        organizationId,
        employeeId!,
        dateStr,
        latitude ? parseFloat(latitude) : undefined,
        longitude ? parseFloat(longitude) : undefined
      );

      return res.status(200).json({
        success: true,
        data: { attendance: record, message: 'Checked out successfully.' }
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message || 'Check-out failed.',
        code: 'CHECK_OUT_FAILED'
      });
    }
  }

  // Break duration recording
  static async updateBreak(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;
      const { breakMinutes } = req.body;

      const mins = parseInt(breakMinutes, 10) || 15;
      const dateStr = new Date().toISOString().split('T')[0];
      const record = await AttendanceRepository.updateBreak(organizationId, employeeId!, dateStr, mins);

      return res.status(200).json({
        success: true,
        data: { attendance: record, message: `Recorded break (+${mins} mins).` }
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to record break.',
        code: 'BREAK_UPDATE_FAILED'
      });
    }
  }

  // Regularization Self-Service Request
  static async applyRegularization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;
      const { attendanceDate, requestedPunchIn, requestedPunchOut, reason } = req.body;

      if (!attendanceDate || !reason || reason.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Attendance date and reason are required for regularization.',
          code: 'INVALID_REGULARIZATION_INPUT'
        });
      }

      const regularization = await AttendanceRepository.applyRegularization(
        organizationId,
        employeeId!,
        attendanceDate,
        requestedPunchIn || null,
        requestedPunchOut || null,
        reason.trim()
      );

      return res.status(201).json({
        success: true,
        data: { regularization, message: 'Attendance regularization request submitted successfully.' }
      });
    } catch (error: any) {
      return next(error);
    }
  }

  // List Regularization Requests
  static async getRegularizations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const userRole = req.user!.role;
      const userEmpId = req.user!.employeeId;

      const isManager = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(userRole);
      const targetEmpId = isManager && req.query.employeeId ? (req.query.employeeId as string) : (isManager ? undefined : (userEmpId || undefined));
      const statusFilter = req.query.status ? (req.query.status as string) : undefined;

      const regularizations = await AttendanceRepository.getRegularizations(organizationId, {
        employeeId: targetEmpId,
        status: statusFilter
      });

      return res.status(200).json({
        success: true,
        data: { regularizations }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Manager Approve / Reject Regularization
  static async processRegularization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const approverId = req.user!.employeeId;
      const { id } = req.params;
      const { action, rejectionReason } = req.body;

      if (!action || !['APPROVE', 'REJECT'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: 'Valid action (APPROVE or REJECT) is required.',
          code: 'INVALID_ACTION'
        });
      }

      if (action === 'APPROVE') {
        const result = await AttendanceRepository.approveRegularization(organizationId, id, approverId!);
        return res.status(200).json({
          success: true,
          data: { ...result, message: 'Attendance regularization approved and applied.' }
        });
      } else {
        const regularization = await AttendanceRepository.rejectRegularization(organizationId, id, approverId!, rejectionReason);
        return res.status(200).json({
          success: true,
          data: { regularization, message: 'Attendance regularization rejected.' }
        });
      }
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message || 'Processing regularization failed.',
        code: 'REGULARIZATION_PROCESSING_FAILED'
      });
    }
  }

  // Administrative / Workforce View: Does NOT require employeeId
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { date, startDate, endDate, employeeId, departmentId, page, limit } = req.query;

      const result = await AttendanceRepository.findAll(organizationId, {
        date: date as string,
        startDate: startDate as string,
        endDate: endDate as string,
        employeeId: employeeId as string,
        departmentId: departmentId as string,
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

  // Administrative Summary: Does NOT require employeeId
  static async workforceSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

      const summary = await AttendanceRepository.getWorkforceSummary(organizationId, dateStr);
      return res.status(200).json({
        success: true,
        data: { summary }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Locations list for geofenced check-in
  static async locations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const locations = await AttendanceRepository.getLocations(organizationId);
      return res.status(200).json({
        success: true,
        data: { locations }
      });
    } catch (error) {
      return next(error);
    }
  }
}
