import { Response, NextFunction } from 'express';
import exceljs from 'exceljs';
import { query } from '../db';
import { AuthenticatedRequest } from '../types';
import { normalizeRole } from '../config/permissions';
import { AttendanceStatusService, AttendanceSessionRecord } from '../services/attendanceStatusService';
import { AttendanceRepository } from '../repositories/attendanceRepository';

export class AttendanceExportController {
  static async exportEmployeeAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const actor = req.user!;
      const actorRole = normalizeRole(actor.role);
      const targetEmployeeId = req.params.employeeId;
      const { startDate: qStart, endDate: qEnd } = req.query as { startDate?: string; endDate?: string };

      if (!targetEmployeeId) {
        return res.status(400).json({ success: false, error: 'Employee ID is required for export.' });
      }

      // Fetch Target Employee Profile
      const empRes = await query(`
        SELECT 
          e.id, 
          e.employee_code, 
          e.first_name, 
          e.last_name, 
          e.organization_id, 
          e.user_id,
          e.department_id,
          d.name as department_name,
          des.name as designation_name
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN designations des ON des.id = e.designation_id
        WHERE e.id = $1 AND e.organization_id = $2
      `, [targetEmployeeId, actor.organizationId]);

      if (empRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Employee not found.' });
      }

      const targetEmp = empRes.rows[0];

      // Authorization check
      if (actorRole === 'EMPLOYEE' && actor.employeeId !== targetEmployeeId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Employees cannot export attendance for other employees.',
          code: 'FORBIDDEN'
        });
      }

      const tz = await AttendanceRepository.getOrganizationTimeZone(actor.organizationId);
      const todayStr = AttendanceRepository.getOrgDateStr(new Date(), tz);

      // Determine Date Range for Export Grid
      let startDateStr = qStart;
      let endDateStr = qEnd;

      if (!startDateStr || !endDateStr) {
        // Default to current month
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
        startDateStr = `${y}-${m}-01`;
        endDateStr = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
      }

      // Fetch Attendance Sessions in Date Range
      const attendanceRes = await query(`
        SELECT 
          a.id,
          a.organization_id,
          a.employee_id,
          a.date::text as date,
          a.check_in,
          a.check_out,
          a.punch_in_lat,
          a.punch_in_lng,
          a.punch_in_accuracy,
          a.punch_in_location_name,
          a.punch_out_lat,
          a.punch_out_lng,
          a.punch_out_accuracy,
          a.punch_out_location_name,
          a.break_duration_mins,
          a.shift_name,
          a.status,
          a.session_state,
          a.working_hours
        FROM attendance a
        WHERE a.employee_id = $1 AND a.organization_id = $2
          AND a.date BETWEEN $3 AND $4
        ORDER BY a.date ASC, a.check_in ASC
      `, [targetEmployeeId, actor.organizationId, startDateStr, endDateStr]);

      // Fetch Approved Leaves in Date Range
      const leaveRes = await query(`
        SELECT 
          l.start_date::text as start_date,
          l.end_date::text as end_date,
          lt.name as leave_type_name,
          l.reason
        FROM leave_requests l
        LEFT JOIN leave_types lt ON lt.id = l.leave_type_id
        WHERE l.employee_id = $1 AND l.organization_id = $2 AND l.status = 'APPROVED'
          AND (l.start_date <= $4 AND l.end_date >= $3)
      `, [targetEmployeeId, actor.organizationId, startDateStr, endDateStr]);

      // Fetch Configured Company/National Holidays
      const holidayRes = await query(`
        SELECT title, date::text as date, holiday_type
        FROM holidays
        WHERE organization_id = $1 AND date BETWEEN $2 AND $3
      `, [actor.organizationId, startDateStr, endDateStr]);

      // Map Data by Date
      const sessionsByDate = new Map<string, AttendanceSessionRecord[]>();
      for (const att of attendanceRes.rows) {
        const dKey = att.date;
        if (!sessionsByDate.has(dKey)) sessionsByDate.set(dKey, []);
        sessionsByDate.get(dKey)!.push(att);
      }

      const holidaysByDate = new Map<string, { title: string; holiday_type?: string }>();
      for (const h of holidayRes.rows) {
        holidaysByDate.set(h.date, { title: h.title, holiday_type: h.holiday_type });
      }

      const leavesByDate = new Map<string, { leave_type_name: string }>();
      for (const l of leaveRes.rows) {
        const [sY, sM, sD] = l.start_date.split('-').map(Number);
        const [eY, eM, eD] = l.end_date.split('-').map(Number);
        let curr = new Date(Date.UTC(sY, sM - 1, sD));
        const end = new Date(Date.UTC(eY, eM - 1, eD));
        while (curr <= end) {
          const dStr = curr.toISOString().split('T')[0];
          leavesByDate.set(dStr, { leave_type_name: l.leave_type_name || 'APPROVED LEAVE' });
          curr.setUTCDate(curr.getUTCDate() + 1);
        }
      }

      // Build Export Grid Rows
      const gridRows: any[] = [];
      const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number);
      const [eYear, eMonth, eDay] = endDateStr.split('-').map(Number);

      let currDate = new Date(Date.UTC(sYear, sMonth - 1, sDay));
      const endDateObj = new Date(Date.UTC(eYear, eMonth - 1, eDay));

      const formatLocation = (name?: string | null, lat?: any, lng?: any) => {
        const parts: string[] = [];
        if (name && name.trim() !== '') parts.push(name.trim());
        if (lat !== null && lat !== undefined && lng !== null && lng !== undefined) {
          const numLat = Number(lat);
          const numLng = Number(lng);
          if (!isNaN(numLat) && !isNaN(numLng)) {
            parts.push(`${numLat.toFixed(4)}, ${numLng.toFixed(4)}`);
          }
        }
        return parts.length > 0 ? parts.join('\n') : '—';
      };

      while (currDate <= endDateObj) {
        const dStr = currDate.toISOString().split('T')[0];
        const daySessions = sessionsByDate.get(dStr) || [];
        const dayHoliday = holidaysByDate.get(dStr) || null;
        const dayLeave = leavesByDate.get(dStr) || null;

        const dayResult = AttendanceStatusService.resolveDayStatus({
          dateStr: dStr,
          todayStr,
          sessions: daySessions,
          holiday: dayHoliday,
          leave: dayLeave,
          timeZone: tz
        });

        if (daySessions.length === 0) {
          gridRows.push({
            date: dStr,
            day: dayResult.dayName,
            checkInTime: '—',
            checkInLocation: '—',
            checkOutTime: '—',
            checkOutLocation: '—',
            totalHours: dayResult.totalWorkingHoursFormatted,
            status: dayResult.displayStatus,
            leaveOrHoliday: dayResult.holidayTitle || dayResult.leaveTypeName || '—',
            attendanceSession: '—'
          });
        } else {
          // Multiple / Single Attendance Session Rows
          daySessions.forEach((s, idx) => {
            const inTimeStr = s.check_in ? AttendanceStatusService.formatTime(s.check_in, tz) : '—';
            const outTimeStr = s.check_out ? AttendanceStatusService.formatTime(s.check_out, tz) : '—';
            const inLocStr = formatLocation(s.punch_in_location_name, s.punch_in_lat, s.punch_in_lng);
            const outLocStr = formatLocation(s.punch_out_location_name, s.punch_out_lat, s.punch_out_lng);
            const sessionLabel = daySessions.length > 1 ? `Session ${idx + 1}` : 'Session 1';

            gridRows.push({
              date: dStr,
              day: dayResult.dayName,
              checkInTime: inTimeStr,
              checkInLocation: inLocStr,
              checkOutTime: outTimeStr,
              checkOutLocation: outLocStr,
              totalHours: dayResult.totalWorkingHoursFormatted,
              status: dayResult.displayStatus,
              leaveOrHoliday: dayResult.holidayTitle || dayResult.leaveTypeName || '—',
              attendanceSession: sessionLabel
            });
          });
        }

        currDate.setUTCDate(currDate.getUTCDate() + 1);
      }

      // Build Excel Workbook
      const workbook = new exceljs.Workbook();
      workbook.creator = 'THEIAKSHI HRMS';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Attendance Record');

      // Title & Employee Metadata Header Block
      worksheet.addRow(['THEIAKSHI HRMS — EMPLOYEE ATTENDANCE REPORT']);
      worksheet.addRow([`Employee Name: ${targetEmp.first_name} ${targetEmp.last_name}`]);
      worksheet.addRow([`Employee Code: ${targetEmp.employee_code} | Department: ${targetEmp.department_name || 'N/A'} | Designation: ${targetEmp.designation_name || 'N/A'}`]);
      worksheet.addRow([`Export Date: ${new Date().toLocaleDateString()} | Period: ${startDateStr} to ${endDateStr}`]);
      worksheet.addRow([]);

      // Data Headers — Strictly 10 Columns
      const headerRow = worksheet.addRow([
        'Date',
        'Day',
        'Check In (Time)',
        'Check In (Location)',
        'Check Out (Time)',
        'Check Out (Location)',
        'Total Hours',
        'Status',
        'Leave Type / Holiday',
        'Attendance Session'
      ]);

      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '0F172A' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // Data Rows
      for (const rec of gridRows) {
        const row = worksheet.addRow([
          rec.date,
          rec.day,
          rec.checkInTime,
          rec.checkInLocation,
          rec.checkOutTime,
          rec.checkOutLocation,
          rec.totalHours,
          rec.status,
          rec.leaveOrHoliday,
          rec.attendanceSession
        ]);

        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', wrapText: true };
        });

        const statusCell = row.getCell(8);
        if (rec.status.includes('PRESENT')) {
          statusCell.font = { color: { argb: '16A34A' }, bold: true };
        } else if (rec.status.includes('ABSENT')) {
          statusCell.font = { color: { argb: 'DC2626' }, bold: true };
        } else if (rec.status.includes('HOLIDAY')) {
          statusCell.font = { color: { argb: '2563EB' }, bold: true };
        } else if (rec.status.includes('LEAVE')) {
          statusCell.font = { color: { argb: '0284C7' }, bold: true };
        } else if (rec.status.includes('EARLY CHECKOUT')) {
          statusCell.font = { color: { argb: 'EA580C' }, bold: true };
        } else {
          statusCell.font = { color: { argb: '475569' }, bold: true };
        }
      }

      // Column widths
      worksheet.getColumn(1).width = 14; // Date
      worksheet.getColumn(2).width = 12; // Day
      worksheet.getColumn(3).width = 14; // Check In (Time)
      worksheet.getColumn(4).width = 28; // Check In (Location)
      worksheet.getColumn(5).width = 14; // Check Out (Time)
      worksheet.getColumn(6).width = 28; // Check Out (Location)
      worksheet.getColumn(7).width = 14; // Total Hours
      worksheet.getColumn(8).width = 24; // Status
      worksheet.getColumn(9).width = 22; // Leave Type / Holiday
      worksheet.getColumn(10).width = 18; // Attendance Session

      // Response Headers
      const fileName = `Attendance_${targetEmp.employee_code}_${startDateStr}_to_${endDateStr}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      await workbook.xlsx.write(res);
      return res.end();

    } catch (err) {
      return next(err);
    }
  }
}
