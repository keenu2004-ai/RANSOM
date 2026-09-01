import { Response, NextFunction } from 'express';
import exceljs from 'exceljs';
import { query } from '../db';
import { AuthenticatedRequest } from '../types';
import { normalizeRole } from '../config/permissions';

const formatWorkingHours = (decimalHours: number | string | null | undefined): string => {
  const value = Number(decimalHours || 0);
  if (!Number.isFinite(value)) return '0h 00m';

  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
};

const formatTimeIST = (timestamp: string | Date | null | undefined): string => {
  if (!timestamp) return '—';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch {
    return '—';
  }
};

export class AttendanceExportController {
  static async exportEmployeeAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const actor = req.user!;
      const actorRole = normalizeRole(actor.role);
      const targetEmployeeId = req.params.employeeId;
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

      if (!targetEmployeeId) {
        return res.status(400).json({ success: false, error: 'Employee ID is required for export.' });
      }

      // Fetch Target Employee Profile & Linked User
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

      // Authorization Rules Check
      if (actorRole === 'EMPLOYEE') {
        if (actor.employeeId !== targetEmployeeId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied: Employees cannot export attendance for other employees.',
            code: 'FORBIDDEN'
          });
        }
      } else if (actorRole === 'OPERATIONAL_MANAGER') {
        // If operational manager, check if target is in team/department scope or self
        if (actor.employeeId !== targetEmployeeId) {
          // Additional organizational scope check can be enforced here if required
        }
      }

      // Build date filters if provided
      let dateWhere = `WHERE a.employee_id = $1 AND a.organization_id = $2`;
      let leaveWhere = `WHERE l.employee_id = $1 AND l.organization_id = $2 AND l.status = 'APPROVED'`;
      const dateParams: any[] = [targetEmployeeId, actor.organizationId];

      if (startDate && endDate) {
        dateWhere += ` AND a.date BETWEEN $3 AND $4`;
        leaveWhere += ` AND (l.start_date <= $4 AND l.end_date >= $3)`;
        dateParams.push(startDate, endDate);
      }

      // Fetch Attendance Sessions
      const attendanceRes = await query(`
        SELECT 
          a.date::text as date,
          a.check_in,
          a.check_out,
          a.working_hours,
          a.status
        FROM attendance a
        ${dateWhere}
        ORDER BY a.date ASC, a.check_in ASC
      `, dateParams);

      // Fetch Approved Leaves
      const leaveRes = await query(`
        SELECT 
          l.start_date::text as start_date,
          l.end_date::text as end_date,
          lt.name as leave_type_name,
          l.reason
        FROM leave_requests l
        LEFT JOIN leave_types lt ON lt.id = l.leave_type_id
        ${leaveWhere}
      `, dateParams);

      const records: any[] = [];
      const attendanceDates = new Set<string>();

      // 1. Process EVERY Attendance Session (preserve multiple sessions on same date)
      for (const att of attendanceRes.rows) {
        attendanceDates.add(att.date);
        records.push({
          date: att.date,
          checkIn: formatTimeIST(att.check_in),
          checkOut: formatTimeIST(att.check_out),
          totalHours: formatWorkingHours(att.working_hours),
          status: att.status || 'PRESENT',
          attendanceType: 'REGULAR',
          leaveType: '—',
          rawTime: att.check_in ? new Date(att.check_in).getTime() : new Date(att.date).getTime()
        });
      }

      // 2. Reconcile Approved Leaves for dates WITHOUT attendance sessions
      for (const leave of leaveRes.rows) {
        // Parse date string (YYYY-MM-DD) directly using UTC parts to avoid local timezone boundary shifts
        const [sY, sM, sD] = leave.start_date.split('-').map(Number);
        const [eY, eM, eD] = leave.end_date.split('-').map(Number);

        let curr = new Date(Date.UTC(sY, sM - 1, sD));
        const end = new Date(Date.UTC(eY, eM - 1, eD));

        while (curr <= end) {
          const dStr = curr.toISOString().split('T')[0];
          if (!startDate || !endDate || (dStr >= startDate && dStr <= endDate)) {
            // Only add ON_LEAVE row if no attendance session exists for this date
            if (!attendanceDates.has(dStr)) {
              records.push({
                date: dStr,
                checkIn: '—',
                checkOut: '—',
                totalHours: '0h 00m',
                status: 'ON_LEAVE',
                attendanceType: 'LEAVE',
                leaveType: leave.leave_type_name || 'APPROVED LEAVE',
                rawTime: curr.getTime()
              });
            }
          }
          curr.setUTCDate(curr.getUTCDate() + 1);
        }
      }

      // Sort all records chronologically by date and session check_in time
      const sortedRecords = records.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.rawTime - b.rawTime;
      });

      // Build Excel Workbook using exceljs
      const workbook = new exceljs.Workbook();
      workbook.creator = 'THEIAKSHI HRMS';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Attendance Record');

      // Title & Employee Metadata Header Block
      worksheet.addRow(['THEIAKSHI HRMS — EMPLOYEE ATTENDANCE REPORT']);
      worksheet.addRow([`Employee Name: ${targetEmp.first_name} ${targetEmp.last_name}`]);
      worksheet.addRow([`Employee Code: ${targetEmp.employee_code} | Department: ${targetEmp.department_name || 'N/A'} | Designation: ${targetEmp.designation_name || 'N/A'}`]);
      worksheet.addRow([`Export Date: ${new Date().toLocaleDateString()} | Date Range: ${startDate && endDate ? `${startDate} to ${endDate}` : 'Full Available History'}`]);
      worksheet.addRow([]);

      // Data Headers
      const headerRow = worksheet.addRow([
        'Date',
        'Check In',
        'Check Out',
        'Total Hours',
        'Status',
        'Attendance Type',
        'Leave Type'
      ]);

      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '0F172A' } // Dark cyan/slate background
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // Data Rows
      for (const rec of sortedRecords) {
        const row = worksheet.addRow([
          rec.date,
          rec.checkIn,
          rec.checkOut,
          rec.totalHours,
          rec.status,
          rec.attendanceType,
          rec.leaveType
        ]);

        if (rec.status === 'ON_LEAVE') {
          row.getCell(5).font = { color: { argb: '38BDF8' }, bold: true }; // Cyan
        } else if (rec.status === 'ABSENT') {
          row.getCell(5).font = { color: { argb: 'F87171' }, bold: true }; // Red
        } else {
          row.getCell(5).font = { color: { argb: '4ADE80' }, bold: true }; // Green
        }
      }

      // Auto-fit column widths
      worksheet.columns.forEach((column) => {
        column.width = 20;
      });

      // Set Response Headers for XLSX Download
      const fileName = `Attendance_${targetEmp.employee_code}_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      await workbook.xlsx.write(res);
      return res.end();

    } catch (err) {
      return next(err);
    }
  }
}
