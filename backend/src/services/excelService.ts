import ExcelJS from 'exceljs';

export interface ExportUserContext {
  email: string;
  role: string;
  organizationId: string;
}

export async function generateWeeklyPlanXlsx(
  tasks: any[],
  pendingCarryForwardTasks: any[],
  user: ExportUserContext,
  startDateStr: string,
  endDateStr: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'THEIAKSHI ENTERPRISE HRMS';
  workbook.lastModifiedBy = user.email;
  workbook.created = new Date();
  workbook.modified = new Date();

  // Color Palette Constants
  const NAVY_HEADER_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1E293B' }
  };
  const BLUE_SUBHEADER_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '0F172A' }
  };
  const CARD_BG_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F8FAFC' }
  };

  const HEADER_FONT: Partial<ExcelJS.Font> = {
    name: 'Segoe UI',
    size: 10,
    bold: true,
    color: { argb: 'FFFFFF' }
  };

  const TITLE_FONT: Partial<ExcelJS.Font> = {
    name: 'Segoe UI',
    size: 14,
    bold: true,
    color: { argb: '0F172A' }
  };

  const SUBTITLE_FONT: Partial<ExcelJS.Font> = {
    name: 'Segoe UI',
    size: 9,
    italic: true,
    color: { argb: '475569' }
  };

  const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'E2E8F0' } },
    left: { style: 'thin', color: { argb: 'E2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
    right: { style: 'thin', color: { argb: 'E2E8F0' } }
  };

  // Helper function to set column auto width
  const autoFitColumns = (sheet: ExcelJS.Worksheet, minWidth = 12) => {
    sheet.columns.forEach(column => {
      let maxLen = minWidth;
      column.eachCell?.({ includeEmpty: false }, cell => {
        const valStr = cell.value ? cell.value.toString() : '';
        if (valStr.length > maxLen) {
          maxLen = Math.min(valStr.length + 3, 50);
        }
      });
      column.width = maxLen;
    });
  };

  // =========================================================================
  // SHEET 1: Weekly Plan
  // =========================================================================
  const planSheet = workbook.addWorksheet('Weekly Plan', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }]
  });

  // Title Block
  planSheet.mergeCells('A1:AD1');
  const titleCell = planSheet.getCell('A1');
  titleCell.value = 'THEIAKSHI ENTERPRISE - WEEKLY WORK & FIELD VISIT PLANNER';
  titleCell.font = TITLE_FONT;
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

  planSheet.mergeCells('A2:AD2');
  const subCell = planSheet.getCell('A2');
  subCell.value = `Period: ${startDateStr} to ${endDateStr} | Exported By: ${user.email} (${user.role}) | Organization ID: ${user.organizationId} | Exported: ${new Date().toLocaleString()}`;
  subCell.font = SUBTITLE_FONT;

  planSheet.addRow([]); // Row 3 empty spacer

  // Table Headers at Row 4
  const planHeaders = [
    'Employee', 'Employee Code', 'Week Starting', 'Day', 'Date',
    'Customer / Account Name', 'Contact Person', 'Contact Details', 'Visit Location', 'Visit Type',
    'Time Slot', 'Products / Solutions', 'Visit Objective', 'Task Title', 'Description',
    'Planned Hours', 'Status', 'Priority', 'Opportunity Stage', 'Estimated Value (₹)',
    'Outcome / Discussion Summary', 'Next Action', 'Follow-up Date', 'Created By', 'Created At',
    'Completed At', 'Rescheduled From', 'Rescheduled To', 'Reschedule Count', 'Cancellation Reason'
  ];

  const headerRow = planSheet.addRow(planHeaders);
  headerRow.height = 24;
  headerRow.eachCell(cell => {
    cell.fill = NAVY_HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER;
  });

  // Add Rows
  tasks.forEach(t => {
    const dObj = new Date(t.date);
    const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short' });
    const row = planSheet.addRow([
      t.assigned_employee_name || 'Unassigned',
      t.assigned_employee_code || '-',
      startDateStr,
      dayName,
      t.date ? t.date.split('T')[0] : '',
      t.customer_name || '-',
      t.contact_person || '-',
      t.contact_details || '-',
      t.visit_location || '-',
      t.visit_type || 'General Task',
      t.time_slot || 'Full Day',
      t.products_to_present || '-',
      t.visit_objective || '-',
      t.title || '-',
      t.description || '',
      Number(t.hours || 1.0),
      t.status || 'PLANNED',
      t.priority || 'MEDIUM',
      t.opportunity_stage || '-',
      Number(t.estimated_value || 0),
      t.outcome_summary || '-',
      t.next_action || '-',
      t.follow_up_date ? t.follow_up_date.split('T')[0] : '-',
      t.created_by_email || 'System',
      t.created_at ? new Date(t.created_at).toLocaleString() : '-',
      t.status === 'COMPLETED' ? (t.updated_at ? new Date(t.updated_at).toLocaleString() : '-') : '-',
      t.rescheduled_from_task_id || '-',
      t.rescheduled_to_task_id || '-',
      Number(t.reschedule_count || 0),
      t.cancellation_reason || '-'
    ]);

    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.border = THIN_BORDER;
      cell.font = { name: 'Segoe UI', size: 9 };
      cell.alignment = { vertical: 'middle', wrapText: true };

      // Number formatting for Estimated Value (Column 20)
      if (colNumber === 20) {
        cell.numFmt = '₹#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
      // Hours formatting (Column 16)
      if (colNumber === 16) {
        cell.numFmt = '0.0';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
  });

  planSheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: planHeaders.length }
  };
  autoFitColumns(planSheet, 14);

  // =========================================================================
  // SHEET 2: Weekly Summary
  // =========================================================================
  const summarySheet = workbook.addWorksheet('Weekly Summary');

  summarySheet.mergeCells('A1:K1');
  const sumTitle = summarySheet.getCell('A1');
  sumTitle.value = 'THEIAKSHI ENTERPRISE - WEEKLY EXECUTIVE KPI SUMMARY';
  sumTitle.font = TITLE_FONT;

  summarySheet.mergeCells('A2:K2');
  summarySheet.getCell('A2').value = `Week Range: ${startDateStr} to ${endDateStr} | Scope: ${user.role}`;
  summarySheet.getCell('A2').font = SUBTITLE_FONT;

  summarySheet.addRow([]);

  // Calculate Metrics
  const totalPlanned = tasks.filter(t => t.status === 'PLANNED').length;
  const totalInProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const totalCompleted = tasks.filter(t => t.status === 'COMPLETED').length;
  const totalCancelled = tasks.filter(t => t.status === 'CANCELLED').length;
  const totalRescheduled = tasks.filter(t => t.rescheduled_to_task_id || t.reschedule_count > 0).length;
  const totalCarryForward = pendingCarryForwardTasks.length;
  const totalPlannedHours = tasks.reduce((sum, t) => sum + Number(t.hours || 0), 0);
  const totalCompletedHours = tasks.filter(t => t.status === 'COMPLETED').reduce((sum, t) => sum + Number(t.hours || 0), 0);
  const totalPipelineValue = tasks.reduce((sum, t) => sum + Number(t.estimated_value || 0), 0);

  // Executive Metric Cards Table
  const cardHeaders = ['Metric Description', 'Value'];
  const cardHeaderRow = summarySheet.addRow(cardHeaders);
  cardHeaderRow.eachCell(c => {
    c.fill = NAVY_HEADER_FILL;
    c.font = HEADER_FONT;
    c.border = THIN_BORDER;
  });

  const metricsData = [
    ['Total Planned Tasks', totalPlanned],
    ['Total In Progress Tasks', totalInProgress],
    ['Total Completed Tasks', totalCompleted],
    ['Total Cancelled Tasks', totalCancelled],
    ['Total Rescheduled Tasks', totalRescheduled],
    ['Pending Carry-Forward Tasks', totalCarryForward],
    ['Total Planned Hours', totalPlannedHours],
    ['Total Completed Hours', totalCompletedHours],
    ['Total Pipeline Value (INR)', totalPipelineValue]
  ];

  metricsData.forEach(([label, val], idx) => {
    const r = summarySheet.addRow([label, val]);
    r.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true };
    r.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true };
    if (label === 'Total Pipeline Value (INR)') {
      r.getCell(2).numFmt = '₹#,##0';
    }
  });

  summarySheet.addRow([]);

  // Employee Breakdown Table Header
  const empHeaders = [
    'Employee Name', 'Employee Code', 'Planned', 'In Progress', 'Completed',
    'Cancelled', 'Rescheduled', 'Pending Carry-Forward', 'Planned Hours', 'Completed Hours', 'Pipeline Value (₹)'
  ];
  const empHeaderRow = summarySheet.addRow(empHeaders);
  empHeaderRow.eachCell(c => {
    c.fill = NAVY_HEADER_FILL;
    c.font = HEADER_FONT;
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = THIN_BORDER;
  });

  // Group tasks by Employee
  const empMap = new Map<string, any>();
  tasks.forEach(t => {
    const empKey = t.assigned_employee_id || 'UNKNOWN';
    if (!empMap.has(empKey)) {
      empMap.set(empKey, {
        name: t.assigned_employee_name || 'Unassigned',
        code: t.assigned_employee_code || '-',
        planned: 0,
        inProgress: 0,
        completed: 0,
        cancelled: 0,
        rescheduled: 0,
        pending: 0,
        plannedHours: 0,
        completedHours: 0,
        pipelineValue: 0
      });
    }
    const eStats = empMap.get(empKey)!;
    if (t.status === 'PLANNED') eStats.planned++;
    if (t.status === 'IN_PROGRESS') eStats.inProgress++;
    if (t.status === 'COMPLETED') eStats.completed++;
    if (t.status === 'CANCELLED') eStats.cancelled++;
    if (t.rescheduled_to_task_id || t.reschedule_count > 0) eStats.rescheduled++;
    eStats.plannedHours += Number(t.hours || 0);
    if (t.status === 'COMPLETED') eStats.completedHours += Number(t.hours || 0);
    eStats.pipelineValue += Number(t.estimated_value || 0);
  });

  // Include pending carry forward in employee map
  pendingCarryForwardTasks.forEach(pt => {
    const empKey = pt.assigned_employee_id || 'UNKNOWN';
    if (!empMap.has(empKey)) {
      empMap.set(empKey, {
        name: pt.assigned_employee_name || 'Unassigned',
        code: pt.assigned_employee_code || '-',
        planned: 0, inProgress: 0, completed: 0, cancelled: 0, rescheduled: 0, pending: 0, plannedHours: 0, completedHours: 0, pipelineValue: 0
      });
    }
    empMap.get(empKey)!.pending++;
  });

  empMap.forEach(eStats => {
    const er = summarySheet.addRow([
      eStats.name,
      eStats.code,
      eStats.planned,
      eStats.inProgress,
      eStats.completed,
      eStats.cancelled,
      eStats.rescheduled,
      eStats.pending,
      eStats.plannedHours,
      eStats.completedHours,
      eStats.pipelineValue
    ]);
    er.eachCell((c, colIdx) => {
      c.border = THIN_BORDER;
      if (colIdx === 11) c.numFmt = '₹#,##0';
    });
  });

  autoFitColumns(summarySheet, 14);

  // =========================================================================
  // SHEET 3: Pending / Carry Forward
  // =========================================================================
  const pendingSheet = workbook.addWorksheet('Pending Carry Forward', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }]
  });

  pendingSheet.mergeCells('A1:K1');
  pendingSheet.getCell('A1').value = 'THEIAKSHI ENTERPRISE - PENDING & CARRIED FORWARD WORK TASKS';
  pendingSheet.getCell('A1').font = TITLE_FONT;

  pendingSheet.mergeCells('A2:K2');
  pendingSheet.getCell('A2').value = `Tasks pending from dates prior to ${startDateStr}`;
  pendingSheet.getCell('A2').font = SUBTITLE_FONT;

  pendingSheet.addRow([]);

  const pendingHeaders = [
    'Employee', 'Original Date', 'Customer Name', 'Contact Person', 'Location',
    'Task Title / Objective', 'Original Status', 'New Planned Date', 'Reschedule Reason', 'Original Task ID', 'New Task ID'
  ];
  const pHeaderRow = pendingSheet.addRow(pendingHeaders);
  pHeaderRow.eachCell(c => {
    c.fill = NAVY_HEADER_FILL;
    c.font = HEADER_FONT;
    c.border = THIN_BORDER;
  });

  pendingCarryForwardTasks.forEach(pt => {
    const pr = pendingSheet.addRow([
      pt.assigned_employee_name || 'Unassigned',
      pt.date ? pt.date.split('T')[0] : '',
      pt.customer_name || '-',
      pt.contact_person || '-',
      pt.visit_location || '-',
      pt.title || '-',
      pt.status || 'PLANNED',
      pt.follow_up_date ? pt.follow_up_date.split('T')[0] : '-',
      pt.reschedule_reason || pt.cancellation_reason || '-',
      pt.id,
      pt.rescheduled_to_task_id || '-'
    ]);
    pr.eachCell(c => {
      c.border = THIN_BORDER;
      c.font = { name: 'Segoe UI', size: 9 };
    });
  });

  autoFitColumns(pendingSheet, 14);

  // =========================================================================
  // SHEET 4: Visit / Opportunity Summary
  // =========================================================================
  const visitSheet = workbook.addWorksheet('Visit Opportunity Summary', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }]
  });

  visitSheet.mergeCells('A1:N1');
  visitSheet.getCell('A1').value = 'THEIAKSHI ENTERPRISE - CUSTOMER VISIT & SALES OPPORTUNITY PIPELINE';
  visitSheet.getCell('A1').font = TITLE_FONT;

  visitSheet.mergeCells('A2:N2');
  visitSheet.getCell('A2').value = `Customer Account Breakdown | Export Period: ${startDateStr} to ${endDateStr}`;
  visitSheet.getCell('A2').font = SUBTITLE_FONT;

  visitSheet.addRow([]);

  const visitHeaders = [
    'Customer / Account Name', 'Contact Person', 'Contact Details', 'Location', 'Visit Type',
    'Total Visits', 'Opportunity Stage', 'Estimated Value (₹)', 'Current Status', 'Last Visit Date',
    'Next Follow-up Date', 'Next Action', 'Priority', 'Assigned Employee'
  ];
  const vHeaderRow = visitSheet.addRow(visitHeaders);
  vHeaderRow.eachCell(c => {
    c.fill = NAVY_HEADER_FILL;
    c.font = HEADER_FONT;
    c.border = THIN_BORDER;
  });

  // Group by Customer Name
  const customerMap = new Map<string, any>();
  tasks.forEach(t => {
    const custKey = (t.customer_name && t.customer_name.trim() !== '') ? t.customer_name.trim() : (t.title || 'General Activity');
    if (!customerMap.has(custKey)) {
      customerMap.set(custKey, {
        customer: custKey,
        contact: t.contact_person || '-',
        details: t.contact_details || '-',
        location: t.visit_location || '-',
        visitType: t.visit_type || 'General',
        visitCount: 0,
        stage: t.opportunity_stage || 'Lead',
        estimatedValue: 0,
        status: t.status,
        lastVisit: t.date ? t.date.split('T')[0] : '-',
        nextFollowUp: t.follow_up_date ? t.follow_up_date.split('T')[0] : '-',
        nextAction: t.next_action || '-',
        priority: t.priority || 'MEDIUM',
        assignedEmployee: t.assigned_employee_name || 'Unassigned'
      });
    }
    const cObj = customerMap.get(custKey)!;
    cObj.visitCount++;
    cObj.estimatedValue += Number(t.estimated_value || 0);
  });

  customerMap.forEach(cObj => {
    const vr = visitSheet.addRow([
      cObj.customer,
      cObj.contact,
      cObj.details,
      cObj.location,
      cObj.visitType,
      cObj.visitCount,
      cObj.stage,
      cObj.estimatedValue,
      cObj.status,
      cObj.lastVisit,
      cObj.nextFollowUp,
      cObj.nextAction,
      cObj.priority,
      cObj.assignedEmployee
    ]);
    vr.eachCell((c, colIdx) => {
      c.border = THIN_BORDER;
      if (colIdx === 8) c.numFmt = '₹#,##0';
    });
  });

  autoFitColumns(visitSheet, 14);

  // =========================================================================
  // SHEET 5: Week History
  // =========================================================================
  const historySheet = workbook.addWorksheet('Week History', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }]
  });

  historySheet.mergeCells('A1:L1');
  historySheet.getCell('A1').value = 'THEIAKSHI ENTERPRISE - HISTORICAL WEEKLY PERFORMANCE AUDIT';
  historySheet.getCell('A1').font = TITLE_FONT;

  historySheet.mergeCells('A2:L2');
  historySheet.getCell('A2').value = `Historical performance metrics log for ${startDateStr} to ${endDateStr}`;
  historySheet.getCell('A2').font = SUBTITLE_FONT;

  historySheet.addRow([]);

  const historyHeaders = [
    'Week Starting Date', 'Employee', 'Planned Tasks', 'Completed Tasks', 'In Progress Tasks',
    'Cancelled Tasks', 'Rescheduled Tasks', 'Pending Tasks', 'Planned Hours', 'Completed Hours',
    'Pipeline Value (₹)', 'Key Performance Notes'
  ];
  const hHeaderRow = historySheet.addRow(historyHeaders);
  hHeaderRow.eachCell(c => {
    c.fill = NAVY_HEADER_FILL;
    c.font = HEADER_FONT;
    c.border = THIN_BORDER;
  });

  // Group historical week row
  empMap.forEach(eStats => {
    const hr = historySheet.addRow([
      startDateStr,
      eStats.name,
      eStats.planned,
      eStats.completed,
      eStats.inProgress,
      eStats.cancelled,
      eStats.rescheduled,
      eStats.pending,
      eStats.plannedHours,
      eStats.completedHours,
      eStats.pipelineValue,
      `Completed ${eStats.completed} of ${eStats.planned + eStats.inProgress + eStats.completed} planned activities.`
    ]);
    hr.eachCell((c, colIdx) => {
      c.border = THIN_BORDER;
      if (colIdx === 11) c.numFmt = '₹#,##0';
    });
  });

  autoFitColumns(historySheet, 14);

  // =========================================================================
  // SHEET 6: Monthly Tracker
  // =========================================================================
  const monthlySheet = workbook.addWorksheet('Monthly Tracker', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }]
  });

  monthlySheet.mergeCells('A1:O1');
  monthlySheet.getCell('A1').value = 'THEIAKSHI ENTERPRISE - MONTHLY WORK & FIELD VISIT METRICS TRACKER';
  monthlySheet.getCell('A1').font = TITLE_FONT;

  monthlySheet.mergeCells('A2:O2');
  monthlySheet.getCell('A2').value = `Month: ${new Date(startDateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  monthlySheet.getCell('A2').font = SUBTITLE_FONT;

  monthlySheet.addRow([]);

  const monthlyHeaders = [
    'Month', 'Employee', 'Total Visits', 'Completed Visits', 'Pending Visits',
    'Cancelled Visits', 'Rescheduled Visits', 'New Prospects', 'Follow-Ups', 'Demos',
    'Technical Support', 'Order Closure', 'Won Opportunities', 'Lost Opportunities', 'Pipeline Value (₹)'
  ];
  const mHeaderRow = monthlySheet.addRow(monthlyHeaders);
  mHeaderRow.eachCell(c => {
    c.fill = NAVY_HEADER_FILL;
    c.font = HEADER_FONT;
    c.border = THIN_BORDER;
  });

  const currentMonthStr = new Date(startDateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  empMap.forEach(eStats => {
    // Count visit types for employee
    const empTasks = tasks.filter(t => (t.assigned_employee_id || 'UNKNOWN') === (eStats.code === '-' ? 'UNKNOWN' : t.assigned_employee_id));
    const newProspects = empTasks.filter(t => t.visit_type === 'New Prospect').length;
    const followUps = empTasks.filter(t => t.visit_type === 'Follow-Up').length;
    const demos = empTasks.filter(t => t.visit_type === 'Demo / Presentation').length;
    const techSupport = empTasks.filter(t => t.visit_type === 'Technical Support').length;
    const orderClosures = empTasks.filter(t => t.visit_type === 'Order Closure').length;
    const wonStage = empTasks.filter(t => t.opportunity_stage === 'Won').length;
    const lostStage = empTasks.filter(t => t.opportunity_stage === 'Lost').length;

    const mr = monthlySheet.addRow([
      currentMonthStr,
      eStats.name,
      empTasks.length,
      eStats.completed,
      eStats.planned + eStats.inProgress + eStats.pending,
      eStats.cancelled,
      eStats.rescheduled,
      newProspects,
      followUps,
      demos,
      techSupport,
      orderClosures,
      wonStage,
      lostStage,
      eStats.pipelineValue
    ]);
    mr.eachCell((c, colIdx) => {
      c.border = THIN_BORDER;
      if (colIdx === 15) c.numFmt = '₹#,##0';
    });
  });

  autoFitColumns(monthlySheet, 14);

  // Generate ArrayBuffer and return Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
