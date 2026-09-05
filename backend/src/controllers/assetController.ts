import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { AssetRepository } from '../repositories/assetRepository';
import { z } from 'zod';

const createAssetSchema = z.object({
  assetCode: z.string().optional(),
  assetName: z.string().min(1, 'Asset Name is required.'),
  assetType: z.string().min(1, 'Asset Type is required.'),
  serialNumber: z.string().optional().nullable(),
  price: z.number().min(0).optional().nullable(),
  purchasePrice: z.number().min(0).optional().nullable(),
  currentValue: z.number().min(0).optional().nullable(),
  brand: z.string().optional(),
  model: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyStartDate: z.string().optional(),
  warrantyEndDate: z.string().optional(),
  vendor: z.string().optional(),
  invoiceNumber: z.string().optional(),
  condition: z.enum(['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED']).optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  assignmentStatus: z.enum(['IN_STOCK', 'ASSIGNED']).optional().default('IN_STOCK'),
  assignedEmployeeId: z.string().optional().nullable(),
  assignedDate: z.string().optional(),
  expectedReturnDate: z.string().optional(),
  assignmentCondition: z.string().optional(),
  assignmentNotes: z.string().optional()
});

const assignAssetSchema = z.object({
  employeeId: z.string().uuid('Valid employee ID is required'),
  assignedDate: z.string().min(1, 'Assigned date is required'),
  expectedReturnDate: z.string().optional(),
  condition: z.string().optional(),
  notes: z.string().optional()
});

const returnAssetSchema = z.object({
  returnedDate: z.string().min(1, 'Returned date is required'),
  condition: z.string().optional(),
  notes: z.string().optional()
});

const createAssetRequestSchema = z.object({
  categoryId: z.string().uuid().optional().nullable(),
  reason: z.string().min(1, 'Reason for asset request is required.'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional().default('NORMAL'),
  requiredDate: z.string().optional().nullable()
});

export class AssetController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { search, status, categoryId, assignedEmployeeId, condition, limit, offset } = req.query;

      let finalEmpId = assignedEmployeeId as string | undefined;
      if (req.user!.role === 'EMPLOYEE') {
        finalEmpId = req.user!.employeeId || 'none';
      }

      const data = await AssetRepository.findAll(organizationId, {
        search: search as string,
        status: status as string,
        categoryId: categoryId as string,
        assignedEmployeeId: finalEmpId,
        condition: condition as string,
        limit: limit ? parseInt(limit as string, 10) : 100,
        offset: offset ? parseInt(offset as string, 10) : 0
      });

      return res.status(200).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;
      const asset = await AssetRepository.findById(id, organizationId);
      if (!asset) return res.status(404).json({ success: false, error: 'Asset not found.' });

      return res.status(200).json({ success: true, data: asset });
    } catch (error) {
      return next(error);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const userId = req.user!.userId;

      const validated = createAssetSchema.parse(req.body);
      const asset = await AssetRepository.create(organizationId, userId, validated);

      return res.status(201).json({ success: true, data: asset, message: 'Asset created successfully.' });
    } catch (error) {
      return next(error);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const userId = req.user!.userId;
      const { id } = req.params;

      const asset = await AssetRepository.update(id, organizationId, userId, req.body);
      return res.status(200).json({ success: true, data: asset, message: 'Asset updated successfully.' });
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const userId = req.user!.userId;
      const { id } = req.params;

      await AssetRepository.softDelete(id, organizationId, userId);
      return res.status(200).json({ success: true, message: 'Asset deleted successfully.' });
    } catch (error) {
      return next(error);
    }
  }

  static async permanentDelete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const userId = req.user!.userId;
      const { id } = req.params;

      await AssetRepository.permanentDelete(id, organizationId, userId);
      return res.status(200).json({ success: true, message: 'Asset permanently deleted from the system.' });
    } catch (error) {
      return next(error);
    }
  }

  static async assign(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const userId = req.user!.userId;
      const { id } = req.params;

      const validated = assignAssetSchema.parse(req.body);
      const asset = await AssetRepository.assignAsset(id, organizationId, userId, validated);

      return res.status(200).json({ success: true, data: asset, message: 'Asset assigned successfully.' });
    } catch (error) {
      return next(error);
    }
  }

  static async returnAsset(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const userId = req.user!.userId;
      const { id } = req.params;

      const validated = returnAssetSchema.parse(req.body);
      const asset = await AssetRepository.returnAsset(id, organizationId, userId, validated);

      return res.status(200).json({ success: true, data: asset, message: 'Asset returned successfully.' });
    } catch (error) {
      return next(error);
    }
  }

  static async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const userId = req.user!.userId;
      const { id } = req.params;
      const { status, notes } = req.body;

      if (!status) return res.status(400).json({ success: false, error: 'Status is required.' });

      const asset = await AssetRepository.updateStatus(id, organizationId, userId, status, notes);
      return res.status(200).json({ success: true, data: asset, message: 'Asset status updated.' });
    } catch (error) {
      return next(error);
    }
  }

  static async getHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;

      const history = await AssetRepository.getHistory(id, organizationId);
      return res.status(200).json({ success: true, data: history });
    } catch (error) {
      return next(error);
    }
  }

  static async getCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const categories = await AssetRepository.getCategories(organizationId);
      return res.status(200).json({ success: true, data: categories });
    } catch (error) {
      return next(error);
    }
  }

  static async createCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { name, code, description } = req.body;
      if (!name || !code) return res.status(400).json({ success: false, error: 'Category name and code are required.' });

      const category = await AssetRepository.createCategory(organizationId, { name, code, description });
      return res.status(201).json({ success: true, data: category, message: 'Category created.' });
    } catch (error) {
      return next(error);
    }
  }

  static async getSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const summary = await AssetRepository.getSummaryMetrics(organizationId);
      return res.status(200).json({ success: true, data: summary });
    } catch (error) {
      return next(error);
    }
  }

  static async getMaintenance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;
      const maintenance = await AssetRepository.getMaintenance(id, organizationId);
      return res.status(200).json({ success: true, data: maintenance });
    } catch (error) {
      return next(error);
    }
  }

  static async createMaintenance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const userId = req.user!.userId;
      const { id } = req.params;
      const { maintenanceType, vendor, startDate, endDate, cost, description } = req.body;

      if (!startDate || !description) {
        return res.status(400).json({ success: false, error: 'Start date and description are required.' });
      }

      const log = await AssetRepository.createMaintenance(organizationId, userId, {
        assetId: id,
        maintenanceType,
        vendor,
        startDate,
        endDate,
        cost,
        description
      });
      return res.status(201).json({ success: true, data: log, message: 'Maintenance record created.' });
    } catch (error) {
      return next(error);
    }
  }

  // ============================================================
  // ASSET REQUEST CONTROLLERS (PHASE 4)
  // ============================================================

  static async createRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;
      const userId = req.user!.userId;

      if (!employeeId) {
        return res.status(400).json({
          success: false,
          error: 'A linked employee profile is required to request an asset.',
          code: 'EMPLOYEE_PROFILE_REQUIRED'
        });
      }

      const validated = createAssetRequestSchema.parse(req.body);
      const request = await AssetRepository.createRequest(organizationId, employeeId, userId, {
        categoryId: validated.categoryId || undefined,
        reason: validated.reason,
        priority: validated.priority,
        requiredDate: validated.requiredDate || undefined
      });

      return res.status(201).json({
        success: true,
        data: { request, message: 'Asset request submitted successfully.' }
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;
      const userId = req.user!.userId;
      const { id } = req.params;

      if (!employeeId) {
        return res.status(400).json({ success: false, error: 'Employee profile required.', code: 'EMPLOYEE_PROFILE_REQUIRED' });
      }

      const validated = createAssetRequestSchema.parse(req.body);
      const updated = await AssetRepository.updateRequestByEmployee(
        organizationId,
        employeeId,
        id,
        {
          categoryId: validated.categoryId || undefined,
          reason: validated.reason,
          priority: validated.priority,
          requiredDate: validated.requiredDate || undefined
        },
        userId
      );

      return res.status(200).json({
        success: true,
        data: { request: updated, message: 'Asset request updated successfully.' }
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ success: false, code: 'REQUEST_NOT_FOUND', error: error.message });
      }
      if (error.message?.includes('not authorized') || error.message?.includes('cannot be edited')) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', error: error.message });
      }
      return next(error);
    }
  }

  static async deleteRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const employeeId = req.user!.employeeId;
      const userId = req.user!.userId;
      const { id } = req.params;

      if (!employeeId) {
        return res.status(400).json({ success: false, error: 'Employee profile required.', code: 'EMPLOYEE_PROFILE_REQUIRED' });
      }

      const withdrawn = await AssetRepository.deleteRequestByEmployee(
        organizationId,
        employeeId,
        id,
        userId
      );

      return res.status(200).json({
        success: true,
        data: { request: withdrawn, message: 'Asset request withdrawn successfully.' }
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ success: false, code: 'REQUEST_NOT_FOUND', error: error.message });
      }
      if (error.message?.includes('not authorized') || error.message?.includes('cannot be withdrawn')) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', error: error.message });
      }
      return next(error);
    }
  }

  static async getRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const userRole = req.user!.role;
      const userEmpId = req.user!.employeeId;

      const isManager = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(userRole);
      const filterEmployeeId = isManager
        ? (req.query.employeeId as string) || undefined
        : (userEmpId || undefined);
      const statusFilter = req.query.status ? (req.query.status as string) : undefined;

      const requests = await AssetRepository.getRequests(organizationId, {
        employeeId: filterEmployeeId,
        status: statusFilter
      });

      return res.status(200).json({
        success: true,
        data: { requests }
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getRequestById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;

      const request = await AssetRepository.getRequestById(organizationId, id);
      if (!request) return res.status(404).json({ success: false, error: 'Asset request not found.' });

      return res.status(200).json({ success: true, data: { request } });
    } catch (error) {
      return next(error);
    }
  }

  static async approveRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const reviewerEmployeeId = req.user!.employeeId || req.user!.userId;
      const reviewerUserId = req.user!.userId;
      const { id } = req.params;

      const request = await AssetRepository.approveRequest(organizationId, id, reviewerEmployeeId, reviewerUserId);
      return res.status(200).json({
        success: true,
        data: { request, message: 'Asset request approved successfully.' }
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message || 'Approving request failed.',
        code: 'APPROVE_REQUEST_FAILED'
      });
    }
  }

  static async rejectRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const reviewerEmployeeId = req.user!.employeeId || req.user!.userId;
      const reviewerUserId = req.user!.userId;
      const { id } = req.params;
      const { rejectionReason } = req.body;

      if (!rejectionReason || rejectionReason.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required.',
          code: 'REJECTION_REASON_REQUIRED'
        });
      }

      const request = await AssetRepository.rejectRequest(organizationId, id, reviewerEmployeeId, reviewerUserId, rejectionReason);
      return res.status(200).json({
        success: true,
        data: { request, message: 'Asset request rejected.' }
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message || 'Rejecting request failed.',
        code: 'REJECT_REQUEST_FAILED'
      });
    }
  }

  static async fulfillRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const reviewerUserId = req.user!.userId;
      const { id } = req.params;
      const { assetId } = req.body;

      if (!assetId) {
        return res.status(400).json({
          success: false,
          error: 'Asset ID to assign is required for fulfillment.',
          code: 'ASSET_ID_REQUIRED'
        });
      }

      const result = await AssetRepository.fulfillRequest(organizationId, id, assetId, reviewerUserId);
      return res.status(200).json({
        success: true,
        data: { ...result, message: 'Asset assigned and request fulfilled successfully.' }
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message || 'Fulfilling request failed.',
        code: 'FULFILL_REQUEST_FAILED'
      });
    }
  }
}
