import { query, withTransaction } from '../db';
import { reverseGeocode } from '../utils/geocoding';

export class AttendanceRepository {
  /**
   * Helper: Get Organization Timezone from settings (default 'Asia/Kolkata')
   */
  static async getOrganizationTimeZone(organizationId: string, client?: any): Promise<string> {
    const db = client || { query };
    const res = await db.query(
      `SELECT time_zone FROM organization_settings WHERE organization_id = $1 LIMIT 1`,
      [organizationId]
    );
    return res.rows[0]?.time_zone || 'Asia/Kolkata';
  }

  /**
   * Helper: Format Date string YYYY-MM-DD in Organization Timezone
   */
  static getOrgDateStr(dateInput: Date | string = new Date(), timeZone: string = 'Asia/Kolkata'): string {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d);
  }

  /**
   * Internal helper: Perform calendar-day session rollover for older open sessions
   */
  static async performRolloverCheck(client: any, organizationId: string, employeeId: string, todayOrgDateStr: string) {
    const openRes = await client.query(
      `SELECT id, date, check_in, check_out, employee_id, organization_id, status, session_state
       FROM attendance
       WHERE employee_id = $1 AND organization_id = $2 AND check_out IS NULL
       FOR UPDATE`,
      [employeeId, organizationId]
    );

    for (const session of openRes.rows) {
      const sessionDateStr = session.date ? (typeof session.date === 'string' ? session.date.split('T')[0] : new Date(session.date).toISOString().split('T')[0]) : null;
      if (sessionDateStr && sessionDateStr < todayOrgDateStr) {
        // Old open session from an earlier calendar date -> ROLLOVER_TERMINATED
        // DO NOT set check_out time! check_out remains NULL
        await client.query(
          `UPDATE attendance
           SET session_state = 'ROLLOVER_TERMINATED',
               status = 'ROLLOVER_TERMINATED',
               system_terminated_at = CURRENT_TIMESTAMP,
               termination_reason = 'CALENDAR_DAY_ROLLOVER',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [session.id]
        );

        const empRes = await client.query(`SELECT employee_code, first_name, last_name FROM employees WHERE id = $1`, [employeeId]);
        const emp = empRes.rows[0];
        const empCode = emp?.employee_code || 'EMP';

        // Write Audit Log for automatic rollover
        await client.query(
          `INSERT INTO audit_logs (
            organization_id, user_id, action, module, entity_name, entity_id, new_values, employee_name_snapshot
          ) VALUES ($1, NULL, 'ATTENDANCE_SESSION_ROLLOVER_TERMINATED', 'attendance', 'AttendanceSession', $2, $3, $4)`,
          [
            organizationId,
            session.id,
            JSON.stringify({
              organizationId,
              employeeId,
              employeeCode: empCode,
              attendanceSessionId: session.id,
              attendanceDate: sessionDateStr,
              originalInTime: session.check_in,
              originalOutTime: null,
              systemTerminatedAt: new Date().toISOString(),
              terminationReason: 'CALENDAR_DAY_ROLLOVER',
              actor: 'SYSTEM'
            }),
            emp ? `${emp.first_name} ${emp.last_name}` : 'Employee'
          ]
        );
      }
    }
  }

  /**
   * Find current open active session for an employee
   */
  static async findActiveSession(employeeId: string, organizationId: string) {
    return withTransaction(async (client) => {
      const tz = await this.getOrganizationTimeZone(organizationId, client);
      const todayStr = this.getOrgDateStr(new Date(), tz);
      await this.performRolloverCheck(client, organizationId, employeeId, todayStr);

      const text = `
        SELECT 
          a.id, a.organization_id, a.employee_id, a.date, a.check_in, a.check_out,
          a.punch_in_lat, a.punch_in_lng, a.punch_in_accuracy, a.punch_in_location_name,
          a.punch_out_lat, a.punch_out_lng, a.punch_out_accuracy, a.punch_out_location_name,
          a.break_duration_mins, a.shift_name, a.status, a.session_state, a.working_hours, a.location_id
        FROM attendance a
        WHERE a.employee_id = $1 AND a.organization_id = $2 
          AND a.check_out IS NULL 
          AND (a.session_state IS NULL OR a.session_state = 'ACTIVE')
        ORDER BY a.check_in DESC
        LIMIT 1
      `;
      const res = await client.query(text, [employeeId, organizationId]);
      return res.rows[0] || null;
    });
  }

  /**
   * Find all attendance sessions for an employee on a given date
   */
  static async findTodaySessions(employeeId: string, organizationId: string, dateStr: string) {
    const text = `
      SELECT 
        a.id, a.organization_id, a.employee_id, a.date, a.check_in, a.check_out,
        a.punch_in_lat, a.punch_in_lng, a.punch_in_accuracy, a.punch_in_location_name,
        a.punch_out_lat, a.punch_out_lng, a.punch_out_accuracy, a.punch_out_location_name,
        a.break_duration_mins, a.shift_name, a.status, a.session_state, a.working_hours, a.location_id
      FROM attendance a
      WHERE a.employee_id = $1 AND a.organization_id = $2 AND a.date = $3
      ORDER BY a.check_in ASC
    `;
    const res = await query(text, [employeeId, organizationId, dateStr]);
    return res.rows;
  }

  /**
   * Aggregate daily summary across all sessions for an employee on a date
   */
  static async getTodaySummary(employeeId: string, organizationId: string, dateStr?: string) {
    return withTransaction(async (client) => {
      const tz = await this.getOrganizationTimeZone(organizationId, client);
      const targetDateStr = dateStr || this.getOrgDateStr(new Date(), tz);
      const todayStr = this.getOrgDateStr(new Date(), tz);

      if (targetDateStr === todayStr) {
        await this.performRolloverCheck(client, organizationId, employeeId, todayStr);
      }

      const sessionsRes = await client.query(
        `SELECT 
          a.id, a.organization_id, a.employee_id, a.date, a.check_in, a.check_out,
          a.punch_in_lat, a.punch_in_lng, a.punch_in_accuracy, a.punch_in_location_name,
          a.punch_out_lat, a.punch_out_lng, a.punch_out_accuracy, a.punch_out_location_name,
          a.break_duration_mins, a.shift_name, a.status, a.session_state, a.working_hours, a.location_id
        FROM attendance a
        WHERE a.employee_id = $1 AND a.organization_id = $2 AND a.date = $3
        ORDER BY a.check_in ASC`,
        [employeeId, organizationId, targetDateStr]
      );
      const sessions = sessionsRes.rows;

      // Authoritative global active session for employee (check_out IS NULL AND ACTIVE)
      const globalActiveRes = await client.query(
        `SELECT 
          a.id, a.organization_id, a.employee_id, a.date, a.check_in, a.check_out,
          a.punch_in_lat, a.punch_in_lng, a.punch_in_accuracy, a.punch_in_location_name,
          a.punch_out_lat, a.punch_out_lng, a.punch_out_accuracy, a.punch_out_location_name,
          a.break_duration_mins, a.shift_name, a.status, a.session_state, a.working_hours, a.location_id
        FROM attendance a
        WHERE a.employee_id = $1 AND a.organization_id = $2 
          AND a.check_out IS NULL 
          AND (a.session_state IS NULL OR a.session_state = 'ACTIVE')
        ORDER BY a.check_in DESC LIMIT 1`,
        [employeeId, organizationId]
      );
      const activeSession = globalActiveRes.rows[0] || null;

      const completedSessions = sessions.filter((s: any) => s.check_out !== null && s.session_state !== 'ROLLOVER_TERMINATED');

      let totalWorkingHours = 0;
      let totalBreakMins = 0;
      let firstCheckIn: string | null = null;
      let lastCheckOut: string | null = null;

      sessions.forEach((s: any) => {
        totalWorkingHours += Number(s.working_hours || 0);
        totalBreakMins += Number(s.break_duration_mins || 0);
        if (s.check_in && (!firstCheckIn || new Date(s.check_in) < new Date(firstCheckIn))) {
          firstCheckIn = s.check_in;
        }
        if (s.check_out && (!lastCheckOut || new Date(s.check_out) > new Date(lastCheckOut))) {
          lastCheckOut = s.check_out;
        }
      });

      // Check Leave status for date
      const leaveRes = await client.query(
        `SELECT lr.id, lr.status, lt.name as leave_type_name, lt.code as leave_type_code
         FROM leave_requests lr
         JOIN leave_types lt ON lr.leave_type_id = lt.id
         WHERE lr.employee_id = $1 AND lr.organization_id = $2 
           AND lr.status = 'APPROVED'
           AND $3 BETWEEN lr.start_date AND lr.end_date
         LIMIT 1`,
        [employeeId, organizationId, targetDateStr]
      );
      const approvedLeave = leaveRes.rows[0] || null;

      // Check Holiday status for date
      const holidayRes = await client.query(
        `SELECT title, holiday_type FROM holidays WHERE organization_id = $1 AND date = $2 LIMIT 1`,
        [organizationId, targetDateStr]
      );
      const holiday = holidayRes.rows[0] || null;

      // Check Pending Regularization
      const regRes = await client.query(
        `SELECT id, status, attendance_type, reason, requested_punch_in, requested_punch_out FROM attendance_regularizations 
         WHERE employee_id = $1 AND organization_id = $2 AND attendance_date = $3 AND status = 'PENDING' LIMIT 1`,
        [employeeId, organizationId, targetDateStr]
      );
      const pendingReg = regRes.rows[0] || null;

      let dayStatus = 'NOT_CHECKED_IN';
      if (approvedLeave) {
        dayStatus = 'LEAVE';
      } else if (holiday) {
        dayStatus = 'HOLIDAY';
      } else if (activeSession) {
        dayStatus = 'ACTIVE';
      } else if (sessions.length > 0) {
        dayStatus = 'COMPLETED';
      } else if (pendingReg) {
        dayStatus = 'PENDING_REGULARIZATION';
      }

      const canCheckIn = activeSession == null && !approvedLeave;
      const canCheckOut = activeSession != null;

      return {
        date: targetDateStr,
        sessions,
        activeSession,
        totalSessions: sessions.length,
        totalSessionCount: sessions.length,
        completedSessionCount: completedSessions.length,
        canCheckIn,
        canCheckOut,
        totalWorkingHours: Number(totalWorkingHours.toFixed(2)),
        totalBreakMins,
        firstCheckIn,
        lastCheckOut,
        status: dayStatus,
        leave: approvedLeave,
        holiday,
        pendingRegularization: pendingReg
      };
    });
  }

  /**
   * Create a new attendance check-in session (concurrency and transaction safe)
   */
  static async checkIn(
    organizationId: string,
    employeeId: string,
    dateStr?: string,
    latitude?: number,
    longitude?: number,
    accuracy?: number,
    shiftName: string = 'General Shift',
    locationId?: string,
    ipAddress?: string
  ) {
    return withTransaction(async (client) => {
      const tz = await this.getOrganizationTimeZone(organizationId, client);
      const todayStr = dateStr || this.getOrgDateStr(new Date(), tz);

      // 1. Perform rollover check to terminate yesterday's open session if any
      await this.performRolloverCheck(client, organizationId, employeeId, todayStr);

      // 2. Lock & check active session for employee across ALL dates
      const activeRes = await client.query(
        `SELECT id, check_in, date, status, session_state FROM attendance 
         WHERE employee_id = $1 AND organization_id = $2 
           AND check_out IS NULL 
           AND (session_state IS NULL OR session_state = 'ACTIVE')
         FOR UPDATE`,
        [employeeId, organizationId]
      );

      if (activeRes.rows.length > 0) {
        const err: any = new Error('You already have an active attendance session in progress.');
        err.code = 'ACTIVE_SESSION_EXISTS';
        err.activeSession = activeRes.rows[0];
        throw err;
      }

      const locationName = await reverseGeocode(latitude, longitude);

      try {
        const text = `
          INSERT INTO attendance (
            organization_id, employee_id, date, check_in, status, session_state,
            punch_in_lat, punch_in_lng, punch_in_accuracy, punch_in_location_name, shift_name, location_id, ip_address
          ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'PRESENT', 'ACTIVE', $4, $5, $6, $7, $8, $9, $10)
          RETURNING id, employee_id, date, check_in, status, session_state, punch_in_lat, punch_in_lng, punch_in_accuracy, punch_in_location_name, shift_name
        `;
        const res = await client.query(text, [
          organizationId, employeeId, todayStr,
          latitude || null, longitude || null, accuracy || null, locationName, shiftName, locationId || null, ipAddress || null
        ]);

        return res.rows[0];
      } catch (insertErr: any) {
        if (insertErr.code === '23505' || insertErr.message?.includes('idx_attendance_active_session')) {
          const err: any = new Error('You already have an active attendance session in progress.');
          err.code = 'ACTIVE_SESSION_EXISTS';
          throw err;
        }
        throw insertErr;
      }
    });
  }

  /**
   * Complete active check-in session for today
   */
  static async checkOut(
    organizationId: string,
    employeeId: string,
    latitude?: number,
    longitude?: number,
    accuracy?: number
  ) {
    return withTransaction(async (client) => {
      const tz = await this.getOrganizationTimeZone(organizationId, client);
      const todayStr = this.getOrgDateStr(new Date(), tz);

      await this.performRolloverCheck(client, organizationId, employeeId, todayStr);

      const activeRes = await client.query(
        `SELECT id, check_in FROM attendance
         WHERE employee_id = $1 AND organization_id = $2 
           AND check_out IS NULL 
           AND (session_state IS NULL OR session_state = 'ACTIVE')
           AND date = $3
         FOR UPDATE`,
        [employeeId, organizationId, todayStr]
      );

      const active = activeRes.rows[0];
      if (!active) {
        throw new Error('No active check-in session found.');
      }

      const locationName = await reverseGeocode(latitude, longitude);

      const text = `
        UPDATE attendance
        SET 
          check_out = CURRENT_TIMESTAMP,
          session_state = 'COMPLETED',
          punch_out_lat = $1,
          punch_out_lng = $2,
          punch_out_accuracy = $3,
          punch_out_location_name = $4,
          working_hours = ROUND(GREATEST(0, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - check_in)) / 3600.0 - (COALESCE(break_duration_mins, 0) / 60.0))::numeric, 2),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5 AND organization_id = $6
        RETURNING id, employee_id, date, check_in, check_out, session_state, punch_in_lat, punch_in_lng, punch_in_accuracy, punch_in_location_name, punch_out_lat, punch_out_lng, punch_out_accuracy, punch_out_location_name, working_hours, break_duration_mins, status
      `;
      const res = await client.query(text, [latitude || null, longitude || null, accuracy || null, locationName, active.id, organizationId]);
      return res.rows[0];
    });
  }

  /**
   * Record break duration for the currently active session
   */
  static async updateBreak(organizationId: string, employeeId: string, breakMinutes: number) {
    const active = await this.findActiveSession(employeeId, organizationId);
    if (!active) {
      throw new Error('Must have an active check-in session to record a break.');
    }

    const text = `
      UPDATE attendance
      SET 
        break_duration_mins = COALESCE(break_duration_mins, 0) + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND organization_id = $3 AND check_out IS NULL
      RETURNING id, employee_id, date, break_duration_mins
    `;
    const res = await query(text, [breakMinutes, active.id, organizationId]);
    return res.rows[0];
  }

  // Attendance Regularization Queries
  static async applyRegularization(
    organizationId: string,
    employeeId: string,
    attendanceDate: string,
    requestedPunchIn: string | null,
    requestedPunchOut: string | null,
    reason: string,
    attendanceType: string = 'PRESENT',
    submittedBy?: string
  ) {
    if (!reason || reason.trim() === '') {
      throw new Error('Reason is required for attendance regularization.');
    }

    return withTransaction(async (client) => {
      const attRes = await client.query(
        `SELECT id, check_in, check_out FROM attendance 
         WHERE employee_id = $1 AND organization_id = $2 AND date = $3 
         ORDER BY check_in ASC LIMIT 1`,
        [employeeId, organizationId, attendanceDate]
      );
      const existingAtt = attRes.rows[0] || null;

      const origIn = existingAtt ? existingAtt.check_in : null;
      const origOut = existingAtt ? existingAtt.check_out : null;
      const attSessionId = existingAtt ? existingAtt.id : null;

      const text = `
        INSERT INTO attendance_regularizations (
          organization_id, employee_id, attendance_date, 
          attendance_session_id, attendance_type,
          original_in_time, original_out_time,
          requested_punch_in, requested_punch_out, 
          reason, status, submitted_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', $11)
        RETURNING *
      `;
      const res = await client.query(text, [
        organizationId, employeeId, attendanceDate,
        attSessionId, attendanceType,
        origIn, origOut,
        requestedPunchIn ? new Date(requestedPunchIn).toISOString() : null,
        requestedPunchOut ? new Date(requestedPunchOut).toISOString() : null,
        reason.trim(),
        submittedBy || employeeId
      ]);
      const reg = res.rows[0];

      const empRes = await client.query(`SELECT employee_code, first_name, last_name FROM employees WHERE id = $1`, [employeeId]);
      const emp = empRes.rows[0];
      const fullName = emp ? `${emp.first_name} ${emp.last_name}` : 'Employee';

      await client.query(
        `INSERT INTO audit_logs (
          organization_id, user_id, action, module, entity_name, entity_id, new_values, employee_name_snapshot
        ) VALUES ($1, NULL, 'ATTENDANCE_REGULARIZATION_SUBMITTED', 'attendance', 'AttendanceRegularization', $2, $3, $4)`,
        [
          organizationId,
          reg.id,
          JSON.stringify({
            employeeId,
            attendanceDate,
            attendanceType,
            requestedPunchIn,
            requestedPunchOut,
            reason: reason.trim()
          }),
          fullName
        ]
      );

      const hrUsersRes = await client.query(
        `SELECT u.id FROM users u
         JOIN user_roles ur ON u.id = ur.user_id
         JOIN roles r ON ur.role_id = r.id
         WHERE u.organization_id = $1 AND r.name IN ('HR_MANAGER', 'ADMIN', 'SUPER_ADMIN')`,
        [organizationId]
      );

      for (const hrUser of hrUsersRes.rows) {
        await client.query(
          `INSERT INTO notifications (organization_id, user_id, title, message, link)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            organizationId,
            hrUser.id,
            'Attendance Regularization Request',
            `${fullName} submitted an attendance regularization request for ${attendanceDate}.`,
            '/attendance'
          ]
        );
      }

      return reg;
    });
  }

  static async getRegularizations(organizationId: string, filters: { employeeId?: string; status?: string }) {
    let whereClause = `WHERE r.organization_id = $1`;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filters.employeeId) {
      whereClause += ` AND r.employee_id = $${paramIndex}`;
      params.push(filters.employeeId);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND r.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    const sql = `
      SELECT 
        r.id, r.organization_id, r.employee_id,
        COALESCE(CONCAT(e.first_name, ' ', e.last_name), r.employee_name_snapshot, 'Deleted Employee') as employee_name,
        COALESCE(e.employee_code, r.employee_code_snapshot, 'EMP') as employee_code,
        r.attendance_date, r.attendance_type, r.original_in_time, r.original_out_time,
        r.requested_punch_in, r.requested_punch_out, r.reason,
        r.status, r.approved_by, r.approved_at, r.rejection_reason, r.created_at
      FROM attendance_regularizations r
      LEFT JOIN employees e ON r.employee_id = e.id
      ${whereClause}
      ORDER BY r.created_at DESC
    `;
    const res = await query(sql, params);
    return res.rows;
  }

  static async approveRegularization(organizationId: string, regularizationId: string, approverId: string) {
    return withTransaction(async (client) => {
      const regRes = await client.query(
        `SELECT * FROM attendance_regularizations 
         WHERE id = $1 AND organization_id = $2 AND status = 'PENDING' 
         FOR UPDATE`,
        [regularizationId, organizationId]
      );
      const reg = regRes.rows[0];
      if (!reg) {
        throw new Error('Pending regularization request not found or already processed.');
      }

      await client.query(
        `UPDATE attendance_regularizations 
         SET status = 'APPROVED', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [approverId, regularizationId]
      );

      const dateStr = typeof reg.attendance_date === 'string' 
        ? reg.attendance_date.split('T')[0] 
        : new Date(reg.attendance_date).toISOString().split('T')[0];

      const checkInTime = reg.requested_punch_in ? new Date(reg.requested_punch_in) : null;
      const checkOutTime = reg.requested_punch_out ? new Date(reg.requested_punch_out) : null;

      let workingHours = 0;
      if (checkInTime && checkOutTime) {
        workingHours = Math.max(0, Number(((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)).toFixed(2)));
      }

      const attType = reg.attendance_type || 'PRESENT';

      let attRecord: any = null;

      if (reg.attendance_session_id) {
        const updateSql = `
          UPDATE attendance
          SET check_in = COALESCE($1, check_in),
              check_out = COALESCE($2, check_out),
              working_hours = CASE WHEN $1 IS NOT NULL AND $2 IS NOT NULL THEN $3 ELSE working_hours END,
              status = $4,
              session_state = 'COMPLETED',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $5 AND organization_id = $6
          RETURNING *
        `;
        const res = await client.query(updateSql, [checkInTime, checkOutTime, workingHours, attType, reg.attendance_session_id, organizationId]);
        attRecord = res.rows[0];
      }

      if (!attRecord) {
        const existingAtt = await client.query(
          `SELECT id FROM attendance WHERE employee_id = $1 AND organization_id = $2 AND date = $3 LIMIT 1`,
          [reg.employee_id, organizationId, dateStr]
        );

        if (existingAtt.rows.length > 0) {
          const updateSql = `
            UPDATE attendance
            SET check_in = COALESCE($1, check_in),
                check_out = COALESCE($2, check_out),
                working_hours = CASE WHEN $1 IS NOT NULL AND $2 IS NOT NULL THEN $3 ELSE working_hours END,
                status = $4,
                session_state = 'COMPLETED',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5 AND organization_id = $6
            RETURNING *
          `;
          const res = await client.query(updateSql, [checkInTime, checkOutTime, workingHours, attType, existingAtt.rows[0].id, organizationId]);
          attRecord = res.rows[0];
        } else {
          const insertSql = `
            INSERT INTO attendance (
              organization_id, employee_id, date, check_in, check_out, working_hours, status, session_state
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'COMPLETED')
            RETURNING *
          `;
          const res = await client.query(insertSql, [organizationId, reg.employee_id, dateStr, checkInTime, checkOutTime, workingHours, attType]);
          attRecord = res.rows[0];
        }
      }

      const empRes = await client.query(`SELECT user_id, employee_code, first_name, last_name FROM employees WHERE id = $1`, [reg.employee_id]);
      const emp = empRes.rows[0];
      const fullName = emp ? `${emp.first_name} ${emp.last_name}` : 'Employee';

      await client.query(
        `INSERT INTO audit_logs (
          organization_id, user_id, action, module, entity_name, entity_id, new_values, employee_name_snapshot
        ) VALUES ($1, NULL, 'ATTENDANCE_REGULARIZATION_APPROVED', 'attendance', 'AttendanceRegularization', $2, $3, $4)`,
        [
          organizationId,
          regularizationId,
          JSON.stringify({
            regularizationId,
            employeeId: reg.employee_id,
            attendanceDate: dateStr,
            attendanceType: attType,
            requestedPunchIn: reg.requested_punch_in,
            requestedPunchOut: reg.requested_punch_out,
            approvedBy: approverId
          }),
          fullName
        ]
      );

      if (emp?.user_id) {
        await client.query(
          `INSERT INTO notifications (organization_id, user_id, title, message, link)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            organizationId,
            emp.user_id,
            'Attendance Regularization Approved',
            `Your attendance regularization request for ${dateStr} has been approved.`,
            '/attendance'
          ]
        );
      }

      return { regularization: { ...reg, status: 'APPROVED' }, attendance: attRecord };
    });
  }

  static async rejectRegularization(organizationId: string, regularizationId: string, approverId: string, rejectionReason?: string) {
    return withTransaction(async (client) => {
      const regRes = await client.query(
        `SELECT * FROM attendance_regularizations 
         WHERE id = $1 AND organization_id = $2 AND status = 'PENDING' 
         FOR UPDATE`,
        [regularizationId, organizationId]
      );
      const reg = regRes.rows[0];
      if (!reg) {
        throw new Error('Pending regularization request not found or already processed.');
      }

      const res = await client.query(
        `UPDATE attendance_regularizations 
         SET status = 'REJECTED', approved_by = $1, approved_at = CURRENT_TIMESTAMP, rejection_reason = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3 AND organization_id = $4 
         RETURNING *`,
        [approverId, rejectionReason || 'Rejected by manager', regularizationId, organizationId]
      );

      const dateStr = typeof reg.attendance_date === 'string' 
        ? reg.attendance_date.split('T')[0] 
        : new Date(reg.attendance_date).toISOString().split('T')[0];

      const empRes = await client.query(`SELECT user_id, employee_code, first_name, last_name FROM employees WHERE id = $1`, [reg.employee_id]);
      const emp = empRes.rows[0];
      const fullName = emp ? `${emp.first_name} ${emp.last_name}` : 'Employee';

      await client.query(
        `INSERT INTO audit_logs (
          organization_id, user_id, action, module, entity_name, entity_id, new_values, employee_name_snapshot
        ) VALUES ($1, NULL, 'ATTENDANCE_REGULARIZATION_REJECTED', 'attendance', 'AttendanceRegularization', $2, $3, $4)`,
        [
          organizationId,
          regularizationId,
          JSON.stringify({
            regularizationId,
            employeeId: reg.employee_id,
            attendanceDate: dateStr,
            rejectedBy: approverId,
            rejectionReason
          }),
          fullName
        ]
      );

      if (emp?.user_id) {
        await client.query(
          `INSERT INTO notifications (organization_id, user_id, title, message, link)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            organizationId,
            emp.user_id,
            'Attendance Regularization Rejected',
            `Your attendance regularization request for ${dateStr} was rejected. Reason: ${rejectionReason || 'Rejected by manager'}.`,
            '/attendance'
          ]
        );
      }

      return res.rows[0];
    });
  }

  static async findAll(organizationId: string, filters: { date?: string; startDate?: string; endDate?: string; employeeId?: string; departmentId?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 500;
    const offset = (page - 1) * limit;

    let whereClause = `WHERE a.organization_id = $1`;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filters.date) {
      whereClause += ` AND a.date = $${paramIndex}`;
      params.push(filters.date);
      paramIndex++;
    }

    if (filters.startDate) {
      whereClause += ` AND a.date >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      whereClause += ` AND a.date <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters.employeeId) {
      whereClause += ` AND a.employee_id = $${paramIndex}`;
      params.push(filters.employeeId);
      paramIndex++;
    }

    if (filters.departmentId) {
      whereClause += ` AND e.department_id = $${paramIndex}`;
      params.push(filters.departmentId);
      paramIndex++;
    }

    const countSql = `
      SELECT COUNT(*)::int as total
      FROM attendance a
      LEFT JOIN employees e ON a.employee_id = e.id
      ${whereClause}
    `;
    const countRes = await query<{ total: number }>(countSql, params);

    const dataSql = `
      SELECT 
        a.id, a.organization_id, a.employee_id,
        COALESCE(CONCAT(e.first_name, ' ', e.last_name), a.employee_name_snapshot, 'Deleted Employee') as employee_name,
        COALESCE(e.employee_code, a.employee_code_snapshot, 'EMP') as employee_code,
        d.name as department_name,
        a.date, a.check_in, a.check_out, 
        a.punch_in_lat, a.punch_in_lng, a.punch_in_accuracy, a.punch_in_location_name,
        a.punch_out_lat, a.punch_out_lng, a.punch_out_accuracy, a.punch_out_location_name,
        a.break_duration_mins, a.shift_name, a.status, a.session_state, a.working_hours
      FROM attendance a
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      ${whereClause}
      ORDER BY a.date DESC, a.check_in DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const dataRes = await query(dataSql, params);

    return {
      attendance: dataRes.rows,
      pagination: {
        total: countRes.rows[0].total,
        page,
        limit,
        totalPages: Math.ceil(countRes.rows[0].total / limit)
      }
    };
  }

  static async getWorkforceSummary(organizationId: string, dateStr?: string) {
    const tz = await this.getOrganizationTimeZone(organizationId);
    const targetDateStr = dateStr || this.getOrgDateStr(new Date(), tz);

    const text = `
      SELECT 
        (SELECT COUNT(*)::int FROM employees WHERE organization_id = $1 AND status = 'ACTIVE') as total_employees,
        (SELECT COUNT(DISTINCT employee_id)::int FROM attendance WHERE organization_id = $1 AND date = $2 AND status IN ('PRESENT', 'LATE', 'FIELD_VISIT', 'ON_DUTY', 'WORK_FROM_HOME')) as present_today,
        (SELECT COUNT(DISTINCT employee_id)::int FROM attendance WHERE organization_id = $1 AND date = $2 AND status = 'LATE') as late_today,
        (SELECT COUNT(*)::int FROM leave_requests WHERE organization_id = $1 AND $2 BETWEEN start_date AND end_date AND status = 'APPROVED') as on_leave_today
    `;
    const res = await query(text, [organizationId, targetDateStr]);
    const row = res.rows[0] || { total_employees: 0, present_today: 0, late_today: 0, on_leave_today: 0 };
    const absent_today = Math.max(0, row.total_employees - (row.present_today + row.on_leave_today));

    return {
      totalEmployees: row.total_employees,
      presentToday: row.present_today,
      lateToday: row.late_today,
      onLeaveToday: row.on_leave_today,
      absentToday: absent_today
    };
  }

  static async getLocations(organizationId: string) {
    const text = `
      SELECT id, name, latitude, longitude, radius_meters, is_active
      FROM attendance_locations
      WHERE organization_id = $1
      ORDER BY name ASC
    `;
    const res = await query(text, [organizationId]);
    return res.rows;
  }
}
