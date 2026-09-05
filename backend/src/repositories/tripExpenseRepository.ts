import { query, withTransaction } from '../db';
import { StorageService } from '../services/storageService';
import { processDataUrlToDrive } from '../scripts/migrate_legacy_attachments';

export interface CreateTripDTO {
  purpose: string;
  startPoint: string;
  endPoint: string;
  startDate: string;
  endDate: string;
  currency?: string;
}

export interface CreateTravelExpenseDTO {
  startDate: string;
  endDate: string;
  transportMode: string;
  purpose: string;
  merchant?: string;
  startLocation: string;
  endLocation: string;
  distanceKm?: number;
  currency?: string;
  amount: number;
  attachmentName?: string;
  receiptUrl?: string;
}

export interface CreateAccommodationExpenseDTO {
  startDate: string;
  endDate: string;
  currency?: string;
  amount: number;
  accommodationDetails: string;
  attachmentName?: string;
  receiptUrl?: string;
}

export interface CreateOtherExpenseDTO {
  transactionDate: string;
  category: string;
  merchant?: string;
  currency?: string;
  amount: number;
  purpose: string;
  attachmentName?: string;
  receiptUrl?: string;
}

export class TripExpenseRepository {
  // Recalculates total_amount for parent trip_expenses server-side
  private static async recalculateTripTotal(client: any, tripId: string) {
    const travelSumRes = await client.query('SELECT COALESCE(SUM(amount), 0)::numeric as total FROM trip_travel_expenses WHERE trip_expense_id = $1', [tripId]);
    const accomSumRes = await client.query('SELECT COALESCE(SUM(amount), 0)::numeric as total FROM trip_accommodation_expenses WHERE trip_expense_id = $1', [tripId]);
    const otherSumRes = await client.query('SELECT COALESCE(SUM(amount), 0)::numeric as total FROM trip_other_expenses WHERE trip_expense_id = $1', [tripId]);

    const travelTotal = Number(travelSumRes.rows[0].total || 0);
    const accomTotal = Number(accomSumRes.rows[0].total || 0);
    const otherTotal = Number(otherSumRes.rows[0].total || 0);
    const grandTotal = travelTotal + accomTotal + otherTotal;

    await client.query('UPDATE trip_expenses SET total_amount = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [grandTotal, tripId]);
    return grandTotal;
  }

  // Create parent Trip Draft
  static async createTrip(organizationId: string, employeeId: string, data: CreateTripDTO) {
    const currency = data.currency || 'INR';
    const text = `
      INSERT INTO trip_expenses (
        organization_id, employee_id, purpose, start_point, end_point, start_date, end_date, currency, status, total_amount
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', 0.00
      )
      RETURNING *
    `;
    const params = [organizationId, employeeId, data.purpose, data.startPoint, data.endPoint, data.startDate, data.endDate, currency];
    const res = await query(text, params);
    return res.rows[0];
  }

  // Get Trip Details with all child expenses
  static async getTripById(id: string, organizationId: string) {
    const tripRes = await query(`
      SELECT 
        te.*,
        CONCAT(emp.first_name, ' ', emp.last_name) as employee_name,
        emp.employee_code,
        emp.email as employee_email
      FROM trip_expenses te
      INNER JOIN employees emp ON te.employee_id = emp.id
      WHERE te.id = $1 AND te.organization_id = $2
    `, [id, organizationId]);

    if (tripRes.rows.length === 0) return null;
    const trip = tripRes.rows[0];

    const travelRes = await query('SELECT * FROM trip_travel_expenses WHERE trip_expense_id = $1 ORDER BY start_date ASC', [id]);
    const accomRes = await query('SELECT * FROM trip_accommodation_expenses WHERE trip_expense_id = $1 ORDER BY start_date ASC', [id]);
    const otherRes = await query('SELECT * FROM trip_other_expenses WHERE trip_expense_id = $1 ORDER BY transaction_date ASC', [id]);

    trip.travelExpenses = travelRes.rows;
    trip.accommodationExpenses = accomRes.rows;
    trip.otherExpenses = otherRes.rows;

    return trip;
  }

  // Add Travel Expense
  static async addTravelExpense(organizationId: string, employeeId: string, tripId: string, data: CreateTravelExpenseDTO) {
    return withTransaction(async (client) => {
      const tripRes = await client.query('SELECT status FROM trip_expenses WHERE id = $1 AND organization_id = $2 AND employee_id = $3', [tripId, organizationId, employeeId]);
      if (tripRes.rows.length === 0) throw new Error('Trip Expense not found.');
      if (tripRes.rows[0].status !== 'DRAFT') throw new Error('Cannot add travel expense to a non-draft trip.');

      let receiptUrl = data.receiptUrl || null;
      let attachmentName = data.attachmentName || null;

      if (receiptUrl && (receiptUrl.startsWith('blob:') || receiptUrl.includes('/blob:'))) {
        console.warn('[STORAGE] Rejected invalid blob: URL in TripExpenseRepository.addTravelExpense:', receiptUrl);
        receiptUrl = null;
      } else if (receiptUrl && receiptUrl.startsWith('data:')) {
        try {
          const driveRes = await processDataUrlToDrive(
            organizationId,
            'TRIP_TRAVEL_EXPENSE',
            tripId,
            employeeId,
            attachmentName || 'travel_receipt.jpg',
            receiptUrl
          );
          receiptUrl = driveRes.viewUrl;
          attachmentName = attachmentName || 'travel_receipt.jpg';
        } catch (err: any) {
          console.warn('[STORAGE] Auto-convert travel receipt to Google Drive failed:', err.message);
        }
      }

      const text = `
        INSERT INTO trip_travel_expenses (
          trip_expense_id, organization_id, employee_id, start_date, end_date, transport_mode, purpose, merchant,
          start_location, end_location, distance_km, currency, amount, attachment_name, receipt_url
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        RETURNING *
      `;
      const params = [
        tripId, organizationId, employeeId, data.startDate, data.endDate, data.transportMode, data.purpose,
        data.merchant || null, data.startLocation, data.endLocation, data.distanceKm || 0, data.currency || 'INR',
        data.amount, attachmentName, receiptUrl
      ];
      const res = await client.query(text, params);
      await this.recalculateTripTotal(client, tripId);
      return res.rows[0];
    });
  }

  // Update Travel Expense
  static async updateTravelExpense(id: string, tripId: string, organizationId: string, employeeId: string, data: Partial<CreateTravelExpenseDTO>) {
    return withTransaction(async (client) => {
      const tripRes = await client.query('SELECT status FROM trip_expenses WHERE id = $1 AND organization_id = $2 AND employee_id = $3', [tripId, organizationId, employeeId]);
      if (tripRes.rows.length === 0 || tripRes.rows[0].status !== 'DRAFT') throw new Error('Trip is not in DRAFT status.');

      const text = `
        UPDATE trip_travel_expenses SET
          start_date = COALESCE($1, start_date),
          end_date = COALESCE($2, end_date),
          transport_mode = COALESCE($3, transport_mode),
          purpose = COALESCE($4, purpose),
          merchant = COALESCE($5, merchant),
          start_location = COALESCE($6, start_location),
          end_location = COALESCE($7, end_location),
          distance_km = COALESCE($8, distance_km),
          currency = COALESCE($9, currency),
          amount = COALESCE($10, amount),
          attachment_name = COALESCE($11, attachment_name),
          receipt_url = COALESCE($12, receipt_url),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $13 AND trip_expense_id = $14 AND organization_id = $15 AND employee_id = $16
        RETURNING *
      `;
      const params = [
        data.startDate || null, data.endDate || null, data.transportMode || null, data.purpose || null,
        data.merchant || null, data.startLocation || null, data.endLocation || null, data.distanceKm ?? null,
        data.currency || null, data.amount || null, data.attachmentName || null, data.receiptUrl || null,
        id, tripId, organizationId, employeeId
      ];
      const res = await client.query(text, params);
      await this.recalculateTripTotal(client, tripId);
      return res.rows[0] || null;
    });
  }

  // Delete Travel Expense
  static async deleteTravelExpense(id: string, tripId: string, organizationId: string, employeeId: string) {
    return withTransaction(async (client) => {
      const tripRes = await client.query('SELECT status FROM trip_expenses WHERE id = $1 AND organization_id = $2 AND employee_id = $3', [tripId, organizationId, employeeId]);
      if (tripRes.rows.length === 0 || tripRes.rows[0].status !== 'DRAFT') throw new Error('Trip is not in DRAFT status.');

      await client.query('DELETE FROM trip_travel_expenses WHERE id = $1 AND trip_expense_id = $2 AND organization_id = $3 AND employee_id = $4', [id, tripId, organizationId, employeeId]);
      await this.recalculateTripTotal(client, tripId);
      return true;
    });
  }

  // Add Accommodation Expense
  static async addAccommodationExpense(organizationId: string, employeeId: string, tripId: string, data: CreateAccommodationExpenseDTO) {
    return withTransaction(async (client) => {
      const tripRes = await client.query('SELECT status FROM trip_expenses WHERE id = $1 AND organization_id = $2 AND employee_id = $3', [tripId, organizationId, employeeId]);
      if (tripRes.rows.length === 0) throw new Error('Trip Expense not found.');
      if (tripRes.rows[0].status !== 'DRAFT') throw new Error('Cannot add accommodation expense to a non-draft trip.');

      let receiptUrl = data.receiptUrl || null;
      let attachmentName = data.attachmentName || null;

      if (receiptUrl && (receiptUrl.startsWith('blob:') || receiptUrl.includes('/blob:'))) {
        console.warn('[STORAGE] Rejected invalid blob: URL in TripExpenseRepository.addAccommodationExpense:', receiptUrl);
        receiptUrl = null;
      } else if (receiptUrl && receiptUrl.startsWith('data:')) {
        try {
          const driveRes = await processDataUrlToDrive(
            organizationId,
            'TRIP_ACCOMMODATION_EXPENSE',
            tripId,
            employeeId,
            attachmentName || 'hotel_receipt.jpg',
            receiptUrl
          );
          receiptUrl = driveRes.viewUrl;
          attachmentName = attachmentName || 'hotel_receipt.jpg';
        } catch (err: any) {
          console.warn('[STORAGE] Auto-convert accommodation receipt to Google Drive failed:', err.message);
        }
      }

      const text = `
        INSERT INTO trip_accommodation_expenses (
          trip_expense_id, organization_id, employee_id, start_date, end_date, currency, amount, accommodation_details, attachment_name, receipt_url
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
        RETURNING *
      `;
      const params = [
        tripId, organizationId, employeeId, data.startDate, data.endDate, data.currency || 'INR',
        data.amount, data.accommodationDetails, attachmentName, receiptUrl
      ];
      const res = await client.query(text, params);
      await this.recalculateTripTotal(client, tripId);
      return res.rows[0];
    });
  }

  // Update Accommodation Expense
  static async updateAccommodationExpense(id: string, tripId: string, organizationId: string, employeeId: string, data: Partial<CreateAccommodationExpenseDTO>) {
    return withTransaction(async (client) => {
      const tripRes = await client.query('SELECT status FROM trip_expenses WHERE id = $1 AND organization_id = $2 AND employee_id = $3', [tripId, organizationId, employeeId]);
      if (tripRes.rows.length === 0 || tripRes.rows[0].status !== 'DRAFT') throw new Error('Trip is not in DRAFT status.');

      const text = `
        UPDATE trip_accommodation_expenses SET
          start_date = COALESCE($1, start_date),
          end_date = COALESCE($2, end_date),
          currency = COALESCE($3, currency),
          amount = COALESCE($4, amount),
          accommodation_details = COALESCE($5, accommodation_details),
          attachment_name = COALESCE($6, attachment_name),
          receipt_url = COALESCE($7, receipt_url),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $8 AND trip_expense_id = $9 AND organization_id = $10 AND employee_id = $11
        RETURNING *
      `;
      const params = [
        data.startDate || null, data.endDate || null, data.currency || null, data.amount || null,
        data.accommodationDetails || null, data.attachmentName || null, data.receiptUrl || null,
        id, tripId, organizationId, employeeId
      ];
      const res = await client.query(text, params);
      await this.recalculateTripTotal(client, tripId);
      return res.rows[0] || null;
    });
  }

  // Delete Accommodation Expense
  static async deleteAccommodationExpense(id: string, tripId: string, organizationId: string, employeeId: string) {
    return withTransaction(async (client) => {
      const tripRes = await client.query('SELECT status FROM trip_expenses WHERE id = $1 AND organization_id = $2 AND employee_id = $3', [tripId, organizationId, employeeId]);
      if (tripRes.rows.length === 0 || tripRes.rows[0].status !== 'DRAFT') throw new Error('Trip is not in DRAFT status.');

      await client.query('DELETE FROM trip_accommodation_expenses WHERE id = $1 AND trip_expense_id = $2 AND organization_id = $3 AND employee_id = $4', [id, tripId, organizationId, employeeId]);
      await this.recalculateTripTotal(client, tripId);
      return true;
    });
  }

  // Add Other Expense
  static async addOtherExpense(organizationId: string, employeeId: string, tripId: string, data: CreateOtherExpenseDTO) {
    return withTransaction(async (client) => {
      const tripRes = await client.query('SELECT status FROM trip_expenses WHERE id = $1 AND organization_id = $2 AND employee_id = $3', [tripId, organizationId, employeeId]);
      if (tripRes.rows.length === 0) throw new Error('Trip Expense not found.');
      if (tripRes.rows[0].status !== 'DRAFT') throw new Error('Cannot add other expense to a non-draft trip.');

      let receiptUrl = data.receiptUrl || null;
      let attachmentName = data.attachmentName || null;

      if (receiptUrl && (receiptUrl.startsWith('blob:') || receiptUrl.includes('/blob:'))) {
        console.warn('[STORAGE] Rejected invalid blob: URL in TripExpenseRepository.addOtherExpense:', receiptUrl);
        receiptUrl = null;
      } else if (receiptUrl && receiptUrl.startsWith('data:')) {
        try {
          const driveRes = await processDataUrlToDrive(
            organizationId,
            'TRIP_OTHER_EXPENSE',
            tripId,
            employeeId,
            attachmentName || 'other_receipt.jpg',
            receiptUrl
          );
          receiptUrl = driveRes.viewUrl;
          attachmentName = attachmentName || 'other_receipt.jpg';
        } catch (err: any) {
          console.warn('[STORAGE] Auto-convert other receipt to Google Drive failed:', err.message);
        }
      }

      const text = `
        INSERT INTO trip_other_expenses (
          trip_expense_id, organization_id, employee_id, transaction_date, category, merchant, currency, amount, purpose, attachment_name, receipt_url
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
        RETURNING *
      `;
      const params = [
        tripId, organizationId, employeeId, data.transactionDate, data.category, data.merchant || null,
        data.currency || 'INR', data.amount, data.purpose, attachmentName, receiptUrl
      ];
      const res = await client.query(text, params);
      await this.recalculateTripTotal(client, tripId);
      return res.rows[0];
    });
  }

  // Update Other Expense
  static async updateOtherExpense(id: string, tripId: string, organizationId: string, employeeId: string, data: Partial<CreateOtherExpenseDTO>) {
    return withTransaction(async (client) => {
      const tripRes = await client.query('SELECT status FROM trip_expenses WHERE id = $1 AND organization_id = $2 AND employee_id = $3', [tripId, organizationId, employeeId]);
      if (tripRes.rows.length === 0 || tripRes.rows[0].status !== 'DRAFT') throw new Error('Trip is not in DRAFT status.');

      const text = `
        UPDATE trip_other_expenses SET
          transaction_date = COALESCE($1, transaction_date),
          category = COALESCE($2, category),
          merchant = COALESCE($3, merchant),
          currency = COALESCE($4, currency),
          amount = COALESCE($5, amount),
          purpose = COALESCE($6, purpose),
          attachment_name = COALESCE($7, attachment_name),
          receipt_url = COALESCE($8, receipt_url),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $9 AND trip_expense_id = $10 AND organization_id = $11 AND employee_id = $12
        RETURNING *
      `;
      const params = [
        data.transactionDate || null, data.category || null, data.merchant || null, data.currency || null,
        data.amount || null, data.purpose || null, data.attachmentName || null, data.receiptUrl || null,
        id, tripId, organizationId, employeeId
      ];
      const res = await client.query(text, params);
      await this.recalculateTripTotal(client, tripId);
      return res.rows[0] || null;
    });
  }

  // Delete Other Expense
  static async deleteOtherExpense(id: string, tripId: string, organizationId: string, employeeId: string) {
    return withTransaction(async (client) => {
      const tripRes = await client.query('SELECT status FROM trip_expenses WHERE id = $1 AND organization_id = $2 AND employee_id = $3', [tripId, organizationId, employeeId]);
      if (tripRes.rows.length === 0 || tripRes.rows[0].status !== 'DRAFT') throw new Error('Trip is not in DRAFT status.');

      await client.query('DELETE FROM trip_other_expenses WHERE id = $1 AND trip_expense_id = $2 AND organization_id = $3 AND employee_id = $4', [id, tripId, organizationId, employeeId]);
      await this.recalculateTripTotal(client, tripId);
      return true;
    });
  }

  // Update Parent Trip Details (pre-approval)
  static async updateTripDraft(id: string, organizationId: string, employeeId: string, data: Partial<CreateTripDTO>) {
    const text = `
      UPDATE trip_expenses SET
        purpose = COALESCE($1, purpose),
        start_point = COALESCE($2, start_point),
        end_point = COALESCE($3, end_point),
        start_date = COALESCE($4, start_date),
        end_date = COALESCE($5, end_date),
        currency = COALESCE($6, currency),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND organization_id = $8 AND employee_id = $9 AND status IN ('DRAFT', 'SUBMITTED', 'PENDING')
      RETURNING *
    `;
    const params = [data.purpose || null, data.startPoint || null, data.endPoint || null, data.startDate || null, data.endDate || null, data.currency || null, id, organizationId, employeeId];
    const res = await query(text, params);
    return res.rows[0] || null;
  }

  // Delete Parent Trip Expense (pre-approval, cascades children)
  static async deleteTripDraft(id: string, organizationId: string, employeeId: string) {
    const res = await query("DELETE FROM trip_expenses WHERE id = $1 AND organization_id = $2 AND employee_id = $3 AND status IN ('DRAFT', 'SUBMITTED', 'PENDING') RETURNING id", [id, organizationId, employeeId]);
    return res.rows.length > 0;
  }

  // Submit Parent Trip Expense (Atomic & Enforces >= 1 child expense requirement)
  static async submitTrip(id: string, organizationId: string, employeeId: string) {
    return withTransaction(async (client) => {
      const tripRes = await client.query('SELECT * FROM trip_expenses WHERE id = $1 AND organization_id = $2 AND employee_id = $3', [id, organizationId, employeeId]);
      if (tripRes.rows.length === 0) throw new Error('Trip Expense not found.');
      const trip = tripRes.rows[0];

      if (trip.status !== 'DRAFT') throw new Error('Trip Expense is already submitted.');

      // Check that at least ONE child expense exists across travel, accommodation, or other
      const travelCountRes = await client.query('SELECT COUNT(*)::int as count FROM trip_travel_expenses WHERE trip_expense_id = $1', [id]);
      const accomCountRes = await client.query('SELECT COUNT(*)::int as count FROM trip_accommodation_expenses WHERE trip_expense_id = $1', [id]);
      const otherCountRes = await client.query('SELECT COUNT(*)::int as count FROM trip_other_expenses WHERE trip_expense_id = $1', [id]);

      const totalChildren = (travelCountRes.rows[0].count || 0) + (accomCountRes.rows[0].count || 0) + (otherCountRes.rows[0].count || 0);

      if (totalChildren === 0) {
        throw new Error('Add at least one travel, accommodation, or other expense before submitting the trip.');
      }

      const grandTotal = await this.recalculateTripTotal(client, id);

      const submitRes = await client.query(`
        UPDATE trip_expenses
        SET status = 'PENDING', total_amount = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [grandTotal, id]);

      return submitRes.rows[0];
    });
  }

  // Find My Trips
  static async findByEmployee(organizationId: string, employeeId: string, filters: { status?: string } = {}) {
    let whereClause = `WHERE te.organization_id = $1 AND te.employee_id = $2`;
    const params: any[] = [organizationId, employeeId];

    if (filters.status) {
      whereClause += ` AND te.status = $3`;
      params.push(filters.status);
    }

    const text = `
      SELECT 
        te.*,
        (SELECT COUNT(*)::int FROM trip_travel_expenses WHERE trip_expense_id = te.id) as travel_count,
        (SELECT COUNT(*)::int FROM trip_accommodation_expenses WHERE trip_expense_id = te.id) as accom_count,
        (SELECT COUNT(*)::int FROM trip_other_expenses WHERE trip_expense_id = te.id) as other_count
      FROM trip_expenses te
      ${whereClause}
      ORDER BY te.created_at DESC
    `;
    const res = await query(text, params);
    return res.rows;
  }

  // Find All Workforce Trips (Approvers)
  static async findAll(organizationId: string, filters: { status?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    let whereClause = `WHERE te.organization_id = $1`;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filters.status) {
      whereClause += ` AND te.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    const countSql = `SELECT COUNT(*)::int as total FROM trip_expenses te ${whereClause}`;
    const countRes = await query<{ total: number }>(countSql, params);

    const dataSql = `
      SELECT 
        te.*,
        CONCAT(emp.first_name, ' ', emp.last_name) as employee_name, emp.employee_code,
        (SELECT COUNT(*)::int FROM trip_travel_expenses WHERE trip_expense_id = te.id) as travel_count,
        (SELECT COUNT(*)::int FROM trip_accommodation_expenses WHERE trip_expense_id = te.id) as accom_count,
        (SELECT COUNT(*)::int FROM trip_other_expenses WHERE trip_expense_id = te.id) as other_count
      FROM trip_expenses te
      LEFT JOIN employees emp ON te.employee_id = emp.id
      ${whereClause}
      ORDER BY te.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const dataRes = await query(dataSql, params);

    return {
      trips: dataRes.rows,
      pagination: { total: countRes.rows[0].total, page, limit, totalPages: Math.ceil(countRes.rows[0].total / limit) }
    };
  }

  // Update Trip Status (Approve/Reject)
  static async updateStatus(id: string, organizationId: string, status: 'APPROVED' | 'REJECTED', reviewerEmployeeId?: string, rejectionReason?: string) {
    const text = `
      UPDATE trip_expenses
      SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND organization_id = $5 AND status IN ('PENDING', 'SUBMITTED', 'DRAFT')
      RETURNING id, employee_id, purpose, total_amount, currency, status, updated_at
    `;
    const res = await query(text, [status, reviewerEmployeeId || null, rejectionReason || null, id, organizationId]);
    const row = res.rows[0];

    if (row) {
      try {
        const action = status === 'APPROVED' ? 'TRIP_EXPENSE_APPROVED' : 'TRIP_EXPENSE_REJECTED';
        await query(`
          INSERT INTO audit_logs (organization_id, user_id, action, module, entity_name, entity_id, new_values)
          VALUES ($1, $2::text, $3, 'expenses', 'TripExpense', $4::text, $5)
        `, [organizationId, reviewerEmployeeId ? String(reviewerEmployeeId) : null, action, id, JSON.stringify({ status, rejectionReason })]);

        const empUserRes = await query('SELECT user_id FROM employees WHERE id = $1', [row.employee_id]);
        if (empUserRes.rows.length > 0) {
          await query(`
            INSERT INTO notifications (organization_id, employee_id, user_id, title, message)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            organizationId,
            row.employee_id,
            empUserRes.rows[0].user_id || null,
            `Trip Expense ${status}`,
            status === 'APPROVED'
              ? `Your trip claim "${row.purpose}" (₹${row.total_amount}) has been approved.`
              : `Your trip claim "${row.purpose}" (₹${row.total_amount}) was rejected: ${rejectionReason || 'No reason specified'}.`
          ]);
        }
      } catch (auditErr) {
        console.warn('Audit log write failed for trip updateStatus:', auditErr);
      }
    }

    return row || null;
  }

  // SUPER_ADMIN Permanent Delete for Trip Claim & All Child Records
  static async deleteSuperAdmin(id: string, organizationId: string, userId: string) {
    return withTransaction(async (client) => {
      // 1. Fetch parent trip row with lock
      const tripRes = await client.query(`
        SELECT 
          te.*,
          CONCAT(emp.first_name, ' ', emp.last_name) as employee_name,
          emp.employee_code,
          (SELECT COUNT(*)::int FROM trip_travel_expenses WHERE trip_expense_id = te.id) as travel_count,
          (SELECT COUNT(*)::int FROM trip_accommodation_expenses WHERE trip_expense_id = te.id) as accom_count,
          (SELECT COUNT(*)::int FROM trip_other_expenses WHERE trip_expense_id = te.id) as other_count
        FROM trip_expenses te
        LEFT JOIN employees emp ON te.employee_id = emp.id
        WHERE te.id = $1 AND te.organization_id = $2
        FOR UPDATE OF te
      `, [id, organizationId]);

      if (tripRes.rows.length === 0) return null;
      const trip = tripRes.rows[0];

      // 2. Fetch all child rows
      const travelRes = await client.query('SELECT * FROM trip_travel_expenses WHERE trip_expense_id = $1', [id]);
      const accomRes = await client.query('SELECT * FROM trip_accommodation_expenses WHERE trip_expense_id = $1', [id]);
      const otherRes = await client.query('SELECT * FROM trip_other_expenses WHERE trip_expense_id = $1', [id]);

      const travelChildIds = travelRes.rows.map(r => r.id);
      const accomChildIds = accomRes.rows.map(r => r.id);
      const otherChildIds = otherRes.rows.map(r => r.id);
      const allChildIds = [...travelChildIds, ...accomChildIds, ...otherChildIds].map(String);

      // 3. Find attachments in attachments table
      const attQuery = `
        SELECT * FROM attachments 
        WHERE organization_id = $1 
        AND (
          (entity_type = 'TRIP_EXPENSE' AND entity_id = $2)
          OR (entity_type IN ('TRIP_TRAVEL_EXPENSE', 'TRIP_ACCOMMODATION_EXPENSE', 'TRIP_OTHER_EXPENSE') AND entity_id = ANY($3))
        )
      `;
      const attRes = await client.query(attQuery, [organizationId, String(id), allChildIds.length > 0 ? allChildIds : ['0']]);

      for (const att of attRes.rows) {
        try {
          await StorageService.deleteObject(att.storage_file_id, att.object_path);
        } catch (stgErr) {
          console.warn('StorageService deleteObject failed for attachment:', att.object_path, stgErr);
        }
      }

      // Also clean up inline receipt_url files if stored on child expense rows
      const inlineReceipts = [
        ...travelRes.rows.map(r => r.receipt_url),
        ...accomRes.rows.map(r => r.receipt_url),
        ...otherRes.rows.map(r => r.receipt_url)
      ].filter(Boolean);

      for (const receiptPath of inlineReceipts) {
        if (typeof receiptPath === 'string' && (receiptPath.startsWith('organizations/') || receiptPath.includes('/trips/'))) {
          try {
            await StorageService.deleteObject(receiptPath);
          } catch (_) {}
        }
      }

      // 4. Delete attachment metadata rows
      await client.query(`
        DELETE FROM attachments 
        WHERE organization_id = $1 
        AND (
          (entity_type = 'TRIP_EXPENSE' AND entity_id = $2)
          OR (entity_type IN ('TRIP_TRAVEL_EXPENSE', 'TRIP_ACCOMMODATION_EXPENSE', 'TRIP_OTHER_EXPENSE') AND entity_id = ANY($3))
        )
      `, [organizationId, String(id), allChildIds.length > 0 ? allChildIds : ['0']]);

      // 5. Delete child expenses
      await client.query('DELETE FROM trip_travel_expenses WHERE trip_expense_id = $1', [id]);
      await client.query('DELETE FROM trip_accommodation_expenses WHERE trip_expense_id = $1', [id]);
      await client.query('DELETE FROM trip_other_expenses WHERE trip_expense_id = $1', [id]);

      // 6. Delete parent trip record
      await client.query('DELETE FROM trip_expenses WHERE id = $1 AND organization_id = $2', [id, organizationId]);

      // 7. Write immutable audit event
      const oldValuesSnapshot = {
        tripId: id,
        purpose: trip.purpose,
        startPoint: trip.start_point,
        endPoint: trip.end_point,
        startDate: trip.start_date,
        endDate: trip.end_date,
        currency: trip.currency,
        totalAmount: Number(trip.total_amount || 0),
        status: trip.status,
        employeeId: trip.employee_id || null,
        employeeName: trip.employee_name || trip.employee_name_snapshot || 'Historical Employee',
        employeeCode: trip.employee_code || trip.employee_code_snapshot || null,
        childCounts: {
          travel: Number(trip.travel_count || 0),
          accom: Number(trip.accom_count || 0),
          other: Number(trip.other_count || 0)
        },
        deletedBy: userId,
        deletedAt: new Date().toISOString()
      };

      await client.query(`
        INSERT INTO audit_logs (organization_id, user_id, action, module, entity_name, entity_id, old_values)
        VALUES ($1, $2, 'TRIP_EXPENSE_DELETED', 'expenses', 'TripExpense', $3::text, $4)
      `, [organizationId, userId, id, JSON.stringify(oldValuesSnapshot)]);

      return {
        ...trip,
        oldValuesSnapshot
      };
    });
  }
}
