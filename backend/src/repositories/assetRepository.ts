import { query, withTransaction } from '../db';

export class AssetRepository {
  // Find all assets with optional filtering, search, pagination
  static async findAll(organizationId: string, filters: {
    search?: string;
    status?: string;
    categoryId?: string;
    assignedEmployeeId?: string;
    condition?: string;
    limit?: number;
    offset?: number;
  }) {
    let sql = `
      SELECT 
        a.*,
        c.name as category_name,
        c.code as category_code,
        e.employee_code,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        e.email as employee_email
      FROM assets a
      JOIN asset_categories c ON a.category_id = c.id
      LEFT JOIN employees e ON a.assigned_employee_id = e.id
      WHERE a.organization_id = $1 AND a.deleted_at IS NULL
    `;
    const params: any[] = [organizationId];

    if (filters.status) {
      params.push(filters.status);
      sql += ` AND a.status = $${params.length}`;
    }

    if (filters.categoryId) {
      params.push(filters.categoryId);
      sql += ` AND a.category_id = $${params.length}`;
    }

    if (filters.assignedEmployeeId) {
      params.push(filters.assignedEmployeeId);
      sql += ` AND a.assigned_employee_id = $${params.length}`;
    }

    if (filters.condition) {
      params.push(filters.condition);
      sql += ` AND a.condition = $${params.length}`;
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      const searchIdx = params.length;
      sql += ` AND (
        a.asset_code ILIKE $${searchIdx} OR 
        a.asset_name ILIKE $${searchIdx} OR 
        a.brand ILIKE $${searchIdx} OR 
        a.model ILIKE $${searchIdx} OR 
        a.serial_number ILIKE $${searchIdx} OR
        a.location ILIKE $${searchIdx}
      )`;
    }

    sql += ` ORDER BY a.created_at DESC`;

    if (filters.limit) {
      params.push(filters.limit);
      sql += ` LIMIT $${params.length}`;
    }

    if (filters.offset) {
      params.push(filters.offset);
      sql += ` OFFSET $${params.length}`;
    }

    const result = await query(sql, params);

    // Total count for pagination
    let countSql = `SELECT COUNT(*)::int as total FROM assets a WHERE a.organization_id = $1 AND a.deleted_at IS NULL`;
    const countParams: any[] = [organizationId];
    if (filters.status) {
      countParams.push(filters.status);
      countSql += ` AND a.status = $${countParams.length}`;
    }
    if (filters.categoryId) {
      countParams.push(filters.categoryId);
      countSql += ` AND a.category_id = $${countParams.length}`;
    }
    if (filters.assignedEmployeeId) {
      countParams.push(filters.assignedEmployeeId);
      countSql += ` AND a.assigned_employee_id = $${countParams.length}`;
    }
    const countRes = await query(countSql, countParams);

    return {
      assets: result.rows,
      total: countRes.rows[0]?.total || 0
    };
  }

  // Find asset by ID
  static async findById(id: string, organizationId: string) {
    const res = await query(`
      SELECT 
        a.*,
        c.name as category_name,
        c.code as category_code,
        e.employee_code,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        e.email as employee_email,
        cb.email as created_by_email,
        ub.email as updated_by_email
      FROM assets a
      JOIN asset_categories c ON a.category_id = c.id
      LEFT JOIN employees e ON a.assigned_employee_id = e.id
      LEFT JOIN users cb ON a.created_by = cb.id
      LEFT JOIN users ub ON a.updated_by = ub.id
      WHERE a.id = $1 AND a.organization_id = $2 AND a.deleted_at IS NULL
    `, [id, organizationId]);
    return res.rows[0] || null;
  }

  // Create asset with initial history & audit log
  static async create(organizationId: string, userId: string, data: any) {
    return withTransaction(async (client) => {
      // Auto-generate Asset Code if not provided
      let assetCode = data.assetCode ? data.assetCode.trim() : '';
      if (!assetCode) {
        const countRes = await client.query(`SELECT COUNT(*)::int as count FROM assets WHERE organization_id = $1`, [organizationId]);
        const seq = (countRes.rows[0]?.count || 0) + 1;
        assetCode = `TE-AST-${String(seq).padStart(4, '0')}`;
        let checkSeq = await client.query(`SELECT id FROM assets WHERE organization_id = $1 AND asset_code = $2 AND deleted_at IS NULL`, [organizationId, assetCode]);
        while (checkSeq.rows.length > 0) {
          assetCode = `TE-AST-${Math.floor(1000 + Math.random() * 9000)}`;
          checkSeq = await client.query(`SELECT id FROM assets WHERE organization_id = $1 AND asset_code = $2 AND deleted_at IS NULL`, [organizationId, assetCode]);
        }
      } else {
        // Check unique asset_code
        const checkCode = await client.query(
          `SELECT id FROM assets WHERE organization_id = $1 AND asset_code = $2 AND deleted_at IS NULL`,
          [organizationId, assetCode]
        );
        if (checkCode.rows.length > 0) {
          throw new Error(`Asset code '${assetCode}' already exists.`);
        }
      }

      // Validate or auto-assign Category
      let categoryId = data.categoryId;
      if (!categoryId || categoryId.trim() === '') {
        const defaultCat = await client.query(
          `SELECT id FROM asset_categories WHERE organization_id = $1 ORDER BY name ASC LIMIT 1`,
          [organizationId]
        );
        if (defaultCat.rows.length > 0) {
          categoryId = defaultCat.rows[0].id;
        } else {
          throw new Error('Please select a valid asset category.');
        }
      } else {
        const checkCat = await client.query(
          `SELECT id FROM asset_categories WHERE id = $1 AND organization_id = $2`,
          [categoryId, organizationId]
        );
        if (checkCat.rows.length === 0) {
          throw new Error('Please select a valid asset category.');
        }
      }

      if (data.serialNumber && data.serialNumber.trim() !== '') {
        const checkSerial = await client.query(
          `SELECT id FROM assets WHERE organization_id = $1 AND serial_number = $2 AND deleted_at IS NULL`,
          [organizationId, data.serialNumber.trim()]
        );
        if (checkSerial.rows.length > 0) {
          throw new Error(`Serial number '${data.serialNumber.trim()}' already exists.`);
        }
      }

      const isAssigned = data.assignmentStatus === 'ASSIGNED' && data.assignedEmployeeId;
      let assignedEmp: any = null;

      if (isAssigned) {
        const empRes = await client.query(
          `SELECT id, first_name, last_name, employee_code, status FROM employees WHERE id = $1 AND organization_id = $2`,
          [data.assignedEmployeeId, organizationId]
        );
        if (empRes.rows.length === 0 || empRes.rows[0].status !== 'ACTIVE') {
          throw new Error('Please select a valid active employee for assignment.');
        }
        assignedEmp = empRes.rows[0];
      }

      const status = isAssigned ? 'ASSIGNED' : 'AVAILABLE';
      const assignedEmployeeId = isAssigned ? data.assignedEmployeeId : null;
      const assignedDate = isAssigned ? (data.assignedDate || new Date().toISOString().split('T')[0]) : null;
      const expectedReturnDate = isAssigned ? (data.expectedReturnDate || null) : null;
      const condition = isAssigned && data.assignmentCondition ? data.assignmentCondition : (data.condition || 'NEW');
      const priceVal = data.price !== undefined ? Number(data.price) : (data.purchasePrice !== undefined ? Number(data.purchasePrice) : 0);

      const res = await client.query(`
        INSERT INTO assets (
          organization_id, asset_code, asset_name, category_id, asset_type,
          brand, model, serial_number, purchase_date, purchase_price,
          current_value, warranty_start_date, warranty_end_date, vendor,
          invoice_number, condition, status, location, description,
          assigned_employee_id, assigned_date, expected_return_date, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
        ) RETURNING *
      `, [
        organizationId,
        assetCode,
        data.assetName,
        categoryId,
        data.assetType || 'HARDWARE',
        data.brand || null,
        data.model || null,
        data.serialNumber ? data.serialNumber.trim() : null,
        data.purchaseDate || null,
        priceVal,
        data.currentValue !== undefined ? Number(data.currentValue) : priceVal,
        data.warrantyStartDate || null,
        data.warrantyEndDate || null,
        data.vendor || null,
        data.invoiceNumber || null,
        condition,
        status,
        data.location || 'HQ Main Office',
        data.description || null,
        assignedEmployeeId,
        assignedDate,
        expectedReturnDate,
        userId
      ]);

      const newAsset = res.rows[0];

      // Record Initial Creation History
      await client.query(`
        INSERT INTO asset_history (
          organization_id, asset_id, action, previous_status, new_status, performed_by, notes
        ) VALUES ($1, $2, 'CREATED', NULL, $3, $4, 'Asset registered into inventory')
      `, [organizationId, newAsset.id, status, userId]);

      // If created as assigned directly, log assignment history
      if (isAssigned && assignedEmp) {
        await client.query(`
          INSERT INTO asset_history (
            organization_id, asset_id, action, previous_status, new_status, employee_id, performed_by, notes, metadata
          ) VALUES ($1, $2, 'ASSIGNED', 'AVAILABLE', 'ASSIGNED', $3, $4, $5, $6)
        `, [
          organizationId,
          newAsset.id,
          assignedEmp.id,
          userId,
          data.assignmentNotes || `Assigned to ${assignedEmp.first_name} ${assignedEmp.last_name} (${assignedEmp.employee_code}) upon registration`,
          JSON.stringify({ assignedDate, expectedReturnDate })
        ]);
      }

      // Record System Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          organization_id, user_id, action, module, entity_name, entity_id, new_values
        ) VALUES ($1, $2, 'CREATE_ASSET', 'assets', 'Asset', $3, $4)
      `, [organizationId, userId, newAsset.id, JSON.stringify(newAsset)]);

      return newAsset;
    });
  }

  // Update asset
  static async update(id: string, organizationId: string, userId: string, data: any) {
    return withTransaction(async (client) => {
      const existing = await client.query(
        `SELECT * FROM assets WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
        [id, organizationId]
      );
      if (existing.rows.length === 0) {
        throw new Error('Asset not found.');
      }
      const prev = existing.rows[0];

      const res = await client.query(`
        UPDATE assets SET
          asset_name = COALESCE($1, asset_name),
          category_id = COALESCE($2, category_id),
          asset_type = COALESCE($3, asset_type),
          brand = COALESCE($4, brand),
          model = COALESCE($5, model),
          serial_number = COALESCE($6, serial_number),
          purchase_date = COALESCE($7, purchase_date),
          purchase_price = COALESCE($8, purchase_price),
          current_value = COALESCE($9, current_value),
          warranty_start_date = COALESCE($10, warranty_start_date),
          warranty_end_date = COALESCE($11, warranty_end_date),
          vendor = COALESCE($12, vendor),
          invoice_number = COALESCE($13, invoice_number),
          condition = COALESCE($14, condition),
          location = COALESCE($15, location),
          description = COALESCE($16, description),
          updated_by = $17,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $18 AND organization_id = $19
        RETURNING *
      `, [
        data.assetName, data.categoryId, data.assetType, data.brand, data.model,
        data.serialNumber, data.purchaseDate, data.purchasePrice, data.currentValue,
        data.warrantyStartDate, data.warrantyEndDate, data.vendor, data.invoiceNumber,
        data.condition, data.location, data.description, userId, id, organizationId
      ]);

      const updated = res.rows[0];

      // History & Audit Log
      await client.query(`
        INSERT INTO asset_history (
          organization_id, asset_id, action, previous_status, new_status, performed_by, notes
        ) VALUES ($1, $2, 'UPDATED', $3, $4, $5, 'Asset metadata details updated')
      `, [organizationId, id, prev.status, updated.status, userId]);

      await client.query(`
        INSERT INTO audit_logs (
          organization_id, user_id, action, module, entity_name, entity_id, old_values, new_values
        ) VALUES ($1, $2, 'UPDATE_ASSET', 'assets', 'Asset', $3, $4, $5)
      `, [organizationId, userId, id, JSON.stringify(prev), JSON.stringify(updated)]);

      return updated;
    });
  }

  // Assign asset to employee
  static async assign(id: string, organizationId: string, userId: string, data: {
    employeeId: string;
    assignedDate: string;
    expectedReturnDate?: string;
    condition?: string;
    notes?: string;
  }) {
    return withTransaction(async (client) => {
      const assetRes = await client.query(
        `SELECT * FROM assets WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [id, organizationId]
      );
      if (assetRes.rows.length === 0) throw new Error('Asset not found.');
      const asset = assetRes.rows[0];

      if (['ASSIGNED', 'LOST', 'RETIRED', 'DISPOSED'].includes(asset.status)) {
        throw new Error(`Cannot assign asset in state '${asset.status}'. Asset must be AVAILABLE or UNDER_MAINTENANCE.`);
      }

      const empRes = await client.query(
        `SELECT id, first_name, last_name, employee_code, status FROM employees WHERE id = $1 AND organization_id = $2`,
        [data.employeeId, organizationId]
      );
      if (empRes.rows.length === 0 || empRes.rows[0].status !== 'ACTIVE') {
        throw new Error('Selected employee is inactive or does not exist.');
      }
      const emp = empRes.rows[0];

      const res = await client.query(`
        UPDATE assets SET
          status = 'ASSIGNED',
          assigned_employee_id = $1,
          assigned_date = $2,
          expected_return_date = $3,
          returned_date = NULL,
          condition = COALESCE($4, condition),
          updated_by = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6 AND organization_id = $7
        RETURNING *
      `, [
        data.employeeId,
        data.assignedDate,
        data.expectedReturnDate || null,
        data.condition || null,
        userId,
        id,
        organizationId
      ]);

      const updatedAsset = res.rows[0];

      // History Record
      await client.query(`
        INSERT INTO asset_history (
          organization_id, asset_id, action, previous_status, new_status, employee_id, performed_by, notes, metadata
        ) VALUES ($1, $2, 'ASSIGNED', $3, 'ASSIGNED', $4, $5, $6, $7)
      `, [
        organizationId,
        id,
        asset.status,
        data.employeeId,
        userId,
        data.notes || `Assigned to ${emp.first_name} ${emp.last_name} (${emp.employee_code})`,
        JSON.stringify({ assignedDate: data.assignedDate, expectedReturnDate: data.expectedReturnDate })
      ]);

      // Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          organization_id, user_id, action, module, entity_name, entity_id, old_values, new_values
        ) VALUES ($1, $2, 'ASSIGN_ASSET', 'assets', 'Asset', $3, $4, $5)
      `, [organizationId, userId, id, JSON.stringify({ status: asset.status }), JSON.stringify({ status: 'ASSIGNED', employeeId: data.employeeId })]);

      return updatedAsset;
    });
  }

  // Return asset from employee
  static async returnAsset(id: string, organizationId: string, userId: string, data: {
    returnedDate: string;
    condition?: string;
    notes?: string;
  }) {
    return withTransaction(async (client) => {
      const assetRes = await client.query(
        `SELECT * FROM assets WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [id, organizationId]
      );
      if (assetRes.rows.length === 0) throw new Error('Asset not found.');
      const asset = assetRes.rows[0];

      if (asset.status !== 'ASSIGNED') {
        throw new Error(`Cannot return asset with status '${asset.status}'. Asset is not currently assigned.`);
      }

      const prevEmpId = asset.assigned_employee_id;

      const res = await client.query(`
        UPDATE assets SET
          status = 'AVAILABLE',
          assigned_employee_id = NULL,
          returned_date = $1,
          condition = COALESCE($2, condition),
          updated_by = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND organization_id = $5
        RETURNING *
      `, [
        data.returnedDate,
        data.condition || null,
        userId,
        id,
        organizationId
      ]);

      const updatedAsset = res.rows[0];

      // Immutable History Record
      await client.query(`
        INSERT INTO asset_history (
          organization_id, asset_id, action, previous_status, new_status, employee_id, performed_by, notes, metadata
        ) VALUES ($1, $2, 'RETURNED', 'ASSIGNED', 'AVAILABLE', $3, $4, $5, $6)
      `, [
        organizationId,
        id,
        prevEmpId,
        userId,
        data.notes || 'Asset returned from employee to available inventory pool',
        JSON.stringify({ returnedDate: data.returnedDate, returnCondition: data.condition })
      ]);

      // Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          organization_id, user_id, action, module, entity_name, entity_id, old_values, new_values
        ) VALUES ($1, $2, 'RETURN_ASSET', 'assets', 'Asset', $3, $4, $5)
      `, [organizationId, userId, id, JSON.stringify({ status: 'ASSIGNED', employeeId: prevEmpId }), JSON.stringify({ status: 'AVAILABLE' })]);

      return updatedAsset;
    });
  }

  // Update status (e.g., MAINTENANCE, LOST, DAMAGED, RETIRED, DISPOSED)
  static async updateStatus(id: string, organizationId: string, userId: string, newStatus: string, notes?: string) {
    const validStatuses = ['AVAILABLE', 'ASSIGNED', 'UNDER_MAINTENANCE', 'LOST', 'DAMAGED', 'RETIRED', 'DISPOSED'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status '${newStatus}'. Must be one of: ${validStatuses.join(', ')}`);
    }

    return withTransaction(async (client) => {
      const assetRes = await client.query(
        `SELECT * FROM assets WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [id, organizationId]
      );
      if (assetRes.rows.length === 0) throw new Error('Asset not found.');
      const asset = assetRes.rows[0];

      const res = await client.query(`
        UPDATE assets SET
          status = $1,
          updated_by = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND organization_id = $4
        RETURNING *
      `, [newStatus, userId, id, organizationId]);

      const updatedAsset = res.rows[0];

      await client.query(`
        INSERT INTO asset_history (
          organization_id, asset_id, action, previous_status, new_status, performed_by, notes
        ) VALUES ($1, $2, 'STATUS_CHANGED', $3, $4, $5, $6)
      `, [organizationId, id, asset.status, newStatus, userId, notes || `Status changed from ${asset.status} to ${newStatus}`]);

      return updatedAsset;
    });
  }

  // Soft delete asset
  static async softDelete(id: string, organizationId: string, userId: string) {
    return withTransaction(async (client) => {
      const assetRes = await client.query(
        `SELECT * FROM assets WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
        [id, organizationId]
      );
      if (assetRes.rows.length === 0) throw new Error('Asset not found.');

      await client.query(`
        UPDATE assets SET
          deleted_at = CURRENT_TIMESTAMP,
          deleted_by = $1
        WHERE id = $2 AND organization_id = $3
      `, [userId, id, organizationId]);

      await client.query(`
        INSERT INTO asset_history (
          organization_id, asset_id, action, previous_status, new_status, performed_by, notes
        ) VALUES ($1, $2, 'DELETED', $3, 'DELETED', $4, 'Asset record soft-deleted')
      `, [organizationId, id, assetRes.rows[0].status, userId]);

      return true;
    });
  }

  // Get asset history timeline
  static async getHistory(assetId: string, organizationId: string) {
    const res = await query(`
      SELECT 
        h.*,
        u.email as performed_by_email,
        e.employee_code,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name
      FROM asset_history h
      LEFT JOIN users u ON h.performed_by = u.id
      LEFT JOIN employees e ON h.employee_id = e.id
      WHERE h.asset_id = $1 AND h.organization_id = $2
      ORDER BY h.created_at DESC
    `, [assetId, organizationId]);
    return res.rows;
  }

  // Asset Maintenance CRUD
  static async getMaintenance(assetId: string, organizationId: string) {
    const res = await query(`
      SELECT m.*, u.email as performed_by_email
      FROM asset_maintenance m
      LEFT JOIN users u ON m.performed_by = u.id
      WHERE m.asset_id = $1 AND m.organization_id = $2
      ORDER BY m.created_at DESC
    `, [assetId, organizationId]);
    return res.rows;
  }

  static async createMaintenance(organizationId: string, userId: string, data: {
    assetId: string;
    maintenanceType?: string;
    vendor?: string;
    startDate: string;
    endDate?: string;
    cost?: number;
    description: string;
  }) {
    return withTransaction(async (client) => {
      const assetRes = await client.query(
        `SELECT id, status FROM assets WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
        [data.assetId, organizationId]
      );
      if (assetRes.rows.length === 0) throw new Error('Asset not found.');

      const res = await client.query(`
        INSERT INTO asset_maintenance (
          organization_id, asset_id, maintenance_type, vendor, start_date, end_date, cost, description, status, performed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN', $9)
        RETURNING *
      `, [
        organizationId,
        data.assetId,
        data.maintenanceType || 'REPAIR',
        data.vendor || null,
        data.startDate,
        data.endDate || null,
        data.cost || 0,
        data.description,
        userId
      ]);

      // Move asset status to UNDER_MAINTENANCE
      await client.query(`
        UPDATE assets SET status = 'UNDER_MAINTENANCE', updated_by = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND organization_id = $3
      `, [userId, data.assetId, organizationId]);

      await client.query(`
        INSERT INTO asset_history (
          organization_id, asset_id, action, previous_status, new_status, performed_by, notes
        ) VALUES ($1, $2, 'MAINTENANCE_STARTED', $3, 'UNDER_MAINTENANCE', $4, $5)
      `, [organizationId, data.assetId, assetRes.rows[0].status, userId, data.description]);

      return res.rows[0];
    });
  }

  // Categories CRUD
  static async getCategories(organizationId: string) {
    const res = await query(`
      SELECT c.*, COUNT(a.id)::int as total_assets
      FROM asset_categories c
      LEFT JOIN assets a ON c.id = a.category_id AND a.deleted_at IS NULL
      WHERE c.organization_id = $1
      GROUP BY c.id
      ORDER BY c.name ASC
    `, [organizationId]);
    return res.rows;
  }

  static async createCategory(organizationId: string, data: { name: string; code: string; description?: string }) {
    const check = await query(`SELECT id FROM asset_categories WHERE organization_id = $1 AND code = $2`, [organizationId, data.code]);
    if (check.rows.length > 0) throw new Error(`Category code '${data.code}' already exists.`);

    const res = await query(`
      INSERT INTO asset_categories (organization_id, name, code, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [organizationId, data.name, data.code, data.description || null]);
    return res.rows[0];
  }

  // Summary Metrics & Reports
  static async getSummaryMetrics(organizationId: string) {
    const res = await query(`
      SELECT 
        COUNT(id)::int as total_assets,
        COUNT(CASE WHEN status = 'AVAILABLE' THEN 1 END)::int as available_count,
        COUNT(CASE WHEN assigned_employee_id IS NULL AND status = 'AVAILABLE' THEN 1 END)::int as in_stock_count,
        COUNT(CASE WHEN status = 'ASSIGNED' THEN 1 END)::int as assigned_count,
        COUNT(CASE WHEN status = 'UNDER_MAINTENANCE' THEN 1 END)::int as maintenance_count,
        COUNT(CASE WHEN status = 'DAMAGED' THEN 1 END)::int as damaged_count,
        COUNT(CASE WHEN status = 'LOST' THEN 1 END)::int as lost_count,
        COUNT(CASE WHEN status = 'RETIRED' THEN 1 END)::int as retired_count,
        COUNT(CASE WHEN status = 'DISPOSED' THEN 1 END)::int as disposed_count,
        COALESCE(SUM(purchase_price), 0)::numeric(12, 2) as total_purchase_value,
        COALESCE(SUM(current_value), 0)::numeric(12, 2) as total_current_value,
        COALESCE(SUM(CASE WHEN status = 'ASSIGNED' THEN current_value END), 0)::numeric(12, 2) as assigned_current_value
      FROM assets
      WHERE organization_id = $1 AND deleted_at IS NULL
    `, [organizationId]);
    return res.rows[0];
  }
}
