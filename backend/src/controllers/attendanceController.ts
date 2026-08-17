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
      const { locationId } = req.body;
      const ipAddress = req.ip;

      const dateStr = new Date().toISOString().split('T')[0];
      const record = await AttendanceRepository.checkIn(organizationId, employeeId!, dateStr, locationId, ipAddress);

      return res.status(200).json({
        success: true,
        data: { attendance: record, message: 'Checked in successfully.' }
      });
    } catch (error) {
      return next(error);
    }
  }

  // Personal self-service: Requires employeeId
  static async checkOut(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;

      const dateStr = new Date().toISOString().split('T')[0];
      const record = await AttendanceRepository.checkOut(organizationId, employeeId!, dateStr);

      if (!record) {
        return res.status(400).json({
          success: false,
          error: 'No active check-in found for today or already checked out.',
          code: 'INVALID_ATTENDANCE_ACTION'
        });
      }

      return res.status(200).json({
        success: true,
        data: { attendance: record, message: 'Checked out successfully.' }
      });
    } catch (error) {
      return next(error);
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
