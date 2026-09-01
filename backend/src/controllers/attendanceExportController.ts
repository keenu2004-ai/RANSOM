import { Response, NextFunction } from 'express';
import exceljs from 'exceljs';
import { query } from '../db';
import { AuthenticatedRequest } from '../types';
import { normalizeRole } from '../config/permissions';

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
        ORDER BY a.date ASC
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

      // Map Date Range Reconciliation
      const dateMap = new Map<string, any>();

      // 1. Process Attendance Sessions
      for (const att of attendanceRes.rows) {
        dateMap.set(att.date, {
          date: att.date,
          checkIn: att.check_in ? new Date(att.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—',
          checkOut: att.check_out ? new Date(att.check_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—',
          totalHours: att.working_hours ? parseFloat(att.working_hours).toFixed(2) : '0.00',
          status: att.status || 'PRESENT',
          attendanceType: 'REGULAR',
          leaveType: '—'
        });
      }

      // 2. Override with Approved Leaves (Approved Leave -> ON_LEAVE)
      for (const leave of leaveRes.rows) {
        let curr = new Date(leave.start_date);
        const end = new Date(leave.end_date);

        while (curr <= end) {
          const dStr = curr.toISOString().split('T')[0];
          if (!startDate || !endDate || (dStr >= startDate && dStr <= endDate)) {
            const existing = dateMap.get(dStr);
            dateMap.set(dStr, {
              date: dStr,
              checkIn: existing?.checkIn || '—',
              checkOut: existing?.checkOut || '—',
              totalHours: existing?.totalHours || '0.00',
              status: 'ON_LEAVE',
              attendanceType: 'LEAVE',
              leaveType: leave.leave_type_name || 'APPROVED LEAVE'
            });
          }
          curr.setDate(curr.getDate() + 1);
        }
      }

      // Sort all records chronologically
      const sortedRecords = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

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
