import { Response, NextFunction } from 'express';
import { CalendarRepository } from '../repositories/calendarRepository';
import { AuthenticatedRequest } from '../types';

export class CalendarController {
  static async getEvents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const userRole = req.user!.role;
      const userEmpId = req.user!.employeeId;

      // Default date range: current month 1st to last day
      const now = new Date();
      const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const startDate = (req.query.startDate as string) || defaultStart;
      const endDate = (req.query.endDate as string) || defaultEnd;

      const isManager = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(userRole);
      const filterEmployeeId = isManager
        ? (req.query.employeeId as string) || undefined
        : (userEmpId || undefined);

      const events = await CalendarRepository.getEvents(organizationId, startDate, endDate, filterEmployeeId);

      return res.status(200).json({
        success: true,
        data: {
          events,
          startDate,
          endDate,
          count: events.length
        }
      });
    } catch (error) {
      return next(error);
    }
  }
}
