import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { EmployeeService } from '../services/employeeService';
import { AuthenticatedRequest } from '../types';

const createEmployeeSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email address is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  joining_date: z.string().optional(),
  employment_type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).optional(),
  department_id: z.string().uuid().optional(),
  designation_id: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  team_id: z.string().uuid().optional(),
  manager_id: z.string().uuid().optional()
});

export class EmployeeController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { search, departmentId, designationId, branchId, teamId, status, page, limit } = req.query;

      const filters = {
        search: search as string,
        departmentId: departmentId as string,
        designationId: designationId as string,
        branchId: branchId as string,
        teamId: teamId as string,
        status: status as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
      };

      const result = await EmployeeService.getEmployees(organizationId, filters);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;

      const employee = await EmployeeService.getEmployeeById(id, organizationId);
      return res.status(200).json({
        success: true,
        data: { employee }
      });
    } catch (error) {
      return next(error);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const parseResult = createEmployeeSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: parseResult.error.errors[0].message,
          code: 'VALIDATION_ERROR'
        });
      }

      const employee = await EmployeeService.createEmployee(organizationId, parseResult.data);
      return res.status(201).json({
        success: true,
        data: { employee }
      });
    } catch (error) {
      return next(error);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;

      const updated = await EmployeeService.updateEmployee(id, organizationId, req.body);
      return res.status(200).json({
        success: true,
        data: { employee: updated }
      });
    } catch (error) {
      return next(error);
    }
  }

  static async deactivate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;

      const deactivated = await EmployeeService.deactivateEmployee(id, organizationId, req.user!.userId);
      return res.status(200).json({
        success: true,
        data: { employee: deactivated }
      });
    } catch (error) {
      return next(error);
    }
  }

  static async restore(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;

      const restored = await EmployeeService.restoreEmployee(id, organizationId, req.user!.userId);
      return res.status(200).json({
        success: true,
        data: { employee: restored }
      });
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;

      await EmployeeService.deleteEmployee(id, organizationId, req.user!.userId);
      return res.status(200).json({
        success: true,
        message: 'Employee deleted successfully. Historical records preserved.'
      });
    } catch (error) {
      return next(error);
    }
  }

  static async orgChart(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const chart = await EmployeeService.getOrgChart(organizationId);
      return res.status(200).json({
        success: true,
        data: { orgChart: chart }
      });
    } catch (error) {
      return next(error);
    }
  }
}
