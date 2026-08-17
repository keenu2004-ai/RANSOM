import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { AssetRepository } from '../repositories/assetRepository';
import { z } from 'zod';

const createAssetSchema = z.object({
  assetCode: z.string().optional(),
  assetName: z.string().min(1, 'Asset Name is required.'),
  assetType: z.string().min(1, 'Asset Type is required.'),
  categoryId: z.string().optional().nullable(),
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

export class AssetController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { search, status, categoryId, assignedEmployeeId, condition, limit, offset } = req.query;

      // If EMPLOYEE role, restrict assignedEmployeeId filter to own employee ID unless explicitly requesting public list
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
      if (!asset) {
        return res.status(404).json({ success: false, error: 'Asset not found.' });
      }

      // Employee access check
      if (req.user!.role === 'EMPLOYEE' && asset.assigned_employee_id !== req.user!.employeeId) {
        return res.status(403).json({ success: false, error: 'You do not have permission to view this asset.' });
      }

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

  static async assign(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const userId = req.user!.userId;
      const { id } = req.params;
      const validated = assignAssetSchema.parse(req.body);

      const asset = await AssetRepository.assign(id, organizationId, userId, validated);
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
}
