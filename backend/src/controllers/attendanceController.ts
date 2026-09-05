import { Response, NextFunction } from 'express';
import { AttendanceRepository } from '../repositories/attendanceRepository';
import { AuthenticatedRequest } from '../types';

export class AttendanceController {
  // Personal self-service: Returns multi-session summary & active status
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
      const summary = await AttendanceRepository.getTodaySummary(employeeId, organizationId, dateStr);

      return res.status(200).json({
        success: true,
        data: { 
          summary, 
          attendance: summary.activeSession || summary.sessions[summary.sessions.length - 1] || null,
          activeSession: summary.activeSession,
          canCheckIn: summary.canCheckIn,
          canCheckOut: summary.canCheckOut
        }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Personal self-service: Check-in new session
  static async checkIn(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;
      const { latitude, longitude, accuracy, shiftName, locationId } = req.body;
      const ipAddress = req.ip;

      const dateStr = new Date().toISOString().split('T')[0];
      const record = await AttendanceRepository.checkIn(
        organizationId,
        employeeId!,
        dateStr,
        latitude ? parseFloat(latitude) : undefined,
        longitude ? parseFloat(longitude) : undefined,
        accuracy ? parseFloat(accuracy) : undefined,
        shiftName || 'General Shift',
        locationId,
        ipAddress
      );

      return res.status(200).json({
        success: true,
        data: { attendance: record, message: 'Checked in successfully.' }
      });
    } catch (error: any) {
      if (error.code === 'ACTIVE_SESSION_EXISTS' || error.message?.includes('active check-in session') || error.message?.includes('active attendance session')) {
        return res.status(409).json({
          success: false,
          code: 'ACTIVE_SESSION_EXISTS',
          message: 'You already have an active attendance session in progress.',
          error: 'You already have an active attendance session in progress.',
          data: { activeSession: error.activeSession || null }
        });
      }

      return res.status(400).json({
        success: false,
        error: error.message || 'Check-in failed.',
        code: 'CHECK_IN_FAILED'
      });
    }
  }

  // Personal self-service: Check-out active session
  static async checkOut(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;
      const { latitude, longitude, accuracy } = req.body;

      const record = await AttendanceRepository.checkOut(
        organizationId,
        employeeId!,
        latitude ? parseFloat(latitude) : undefined,
        longitude ? parseFloat(longitude) : undefined,
        accuracy ? parseFloat(accuracy) : undefined
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

  // Break duration recording for active session
  static async updateBreak(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;
      const { breakMinutes } = req.body;

      const mins = parseInt(breakMinutes, 10) || 15;
      const record = await AttendanceRepository.updateBreak(organizationId, employeeId!, mins);

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
      const { attendanceDate, requestedPunchIn, requestedPunchOut, reason, attendanceType } = req.body;

      if (!attendanceDate || !reason || typeof reason !== 'string' || reason.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Attendance date and a valid reason are required for regularization.',
          code: 'INVALID_REGULARIZATION_INPUT'
        });
      }

      const regularization = await AttendanceRepository.applyRegularization(
        organizationId,
        employeeId!,
        attendanceDate,
        requestedPunchIn || null,
        requestedPunchOut || null,
        reason.trim(),
        attendanceType || 'PRESENT',
        employeeId!
      );

      return res.status(201).json({
        success: true,
        data: { regularization, message: 'Attendance regularization request submitted successfully.' }
      });
    } catch (error: any) {
      return next(error);
    }
  }

  // Personal self-service: Update pending regularization
  static async updateRegularization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;
      const { id } = req.params;
      const { requestedPunchIn, requestedPunchOut, reason } = req.body;

      if (!employeeId) {
        return res.status(400).json({ success: false, error: 'Employee profile required.', code: 'EMPLOYEE_PROFILE_REQUIRED' });
      }

      if (!reason || typeof reason !== 'string' || reason.trim() === '') {
        return res.status(400).json({ success: false, error: 'Reason is required for regularization update.', code: 'INVALID_REGULARIZATION_INPUT' });
      }

      const updated = await AttendanceRepository.updateRegularization(
        organizationId,
        employeeId,
        id,
        { requestedPunchIn, requestedPunchOut, reason },
        req.user!.userId
      );

      return res.status(200).json({
        success: true,
        data: { regularization: updated, message: 'Attendance regularization request updated successfully.' }
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ success: false, code: 'REGULARIZATION_NOT_FOUND', error: error.message });
      }
      if (error.message?.includes('not authorized') || error.message?.includes('Only pending')) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', error: error.message });
      }
      return next(error);
    }
  }

  // Personal self-service: Withdraw / delete pending regularization
  static async withdrawRegularization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;
      const { id } = req.params;

      if (!employeeId) {
        return res.status(400).json({ success: false, error: 'Employee profile required.', code: 'EMPLOYEE_PROFILE_REQUIRED' });
      }

      const withdrawn = await AttendanceRepository.deleteRegularization(
        organizationId,
        employeeId,
        id,
        req.user!.userId
      );

      return res.status(200).json({
        success: true,
        data: { regularization: withdrawn, message: 'Attendance regularization request withdrawn successfully.' }
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ success: false, code: 'REGULARIZATION_NOT_FOUND', error: error.message });
      }
      if (error.message?.includes('not authorized') || error.message?.includes('Only pending')) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', error: error.message });
      }
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

  // Administrative / Workforce View
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { year, month, date, startDate, endDate, employeeId, departmentId, page, limit } = req.query;

      const result = await AttendanceRepository.findAll(organizationId, {
        year: year ? parseInt(year as string, 10) : undefined,
        month: month ? parseInt(month as string, 10) : undefined,
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
        data: result,
        summary: result.summary,
        attendance: result.attendance
      });
    } catch (error) {
      return next(error);
    }
  }

  // Administrative Summary
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
