import { query } from '../db';

export class TimesheetRepository {
  static async findProjects(organizationId: string) {
    const res = await query('SELECT id, name, code, description, status FROM projects WHERE organization_id = $1 ORDER BY name ASC', [organizationId]);
    return res.rows;
  }

  static async createTask(
    organizationId: string,
    actorUserId: string,
    actorRole: string,
    actorEmployeeId: string | null,
    data: {
      assignedEmployeeId?: string;
      employeeId?: string;
      projectId?: string;
      date: string;
      title: string;
      description?: string;
      hours?: number;
      status?: string;
      customerName?: string;
      contactPerson?: string;
      contactDetails?: string;
      visitLocation?: string;
      visitType?: string;
      timeSlot?: string;
      productsToPresent?: string;
      visitObjective?: string;
      outcomeSummary?: string;
      nextAction?: string;
      followUpDate?: string;
      opportunityStage?: string;
      estimatedValue?: number;
      priority?: string;
    }
  ) {
    const isManagement = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(actorRole);
    const targetEmpInput = (data.assignedEmployeeId || data.employeeId || '').trim();

    let finalAssignedEmpId: string | null = null;

    if (isManagement) {
      if (targetEmpInput) {
        const empCheck = await query(
          'SELECT id, user_id, status, organization_id FROM employees WHERE id = $1',
          [targetEmpInput]
        );
        if (empCheck.rows.length === 0) {
          throw new Error('Selected assigned employee does not exist.');
        }
        if (empCheck.rows[0].organization_id !== organizationId) {
          throw new Error('Unauthorized to assign tasks to employees outside your organization.');
        }
        if (empCheck.rows[0].status !== 'ACTIVE') {
          throw new Error('Cannot assign task to an inactive employee.');
        }
        finalAssignedEmpId = targetEmpInput;
      } else if (actorEmployeeId) {
        finalAssignedEmpId = actorEmployeeId;
      } else {
        throw new Error('Please select an active employee to assign this task.');
      }
    } else {
      // Self-task rule for normal employee
      if (!actorEmployeeId) {
        throw new Error('Your account is not linked to an employee profile.');
      }
      finalAssignedEmpId = actorEmployeeId;
    }

    const title = data.title && data.title.trim() !== '' ? data.title.trim() : 'Daily Work Task';
    const description = (data.description !== undefined && data.description !== null)
      ? String(data.description).trim()
      : ((data as any).taskDescription !== undefined && (data as any).taskDescription !== null ? String((data as any).taskDescription).trim() : '');
    const hours = data.hours !== undefined ? Number(data.hours) : 1.0;
    const status = data.status || 'PLANNED';
    const projectId = data.projectId && data.projectId.trim() !== '' ? data.projectId.trim() : null;

    const insertSql = `
      INSERT INTO timesheets (
        organization_id, employee_id, project_id, title, date, hours, description, status, created_by,
        customer_name, contact_person, contact_details, visit_location, visit_type, time_slot,
        products_to_present, visit_objective, outcome_summary, next_action, follow_up_date,
        opportunity_stage, estimated_value, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `;

    const res = await query(insertSql, [
      organizationId,
      finalAssignedEmpId,
      projectId,
      title,
      data.date,
      hours,
      description,
      status,
      actorUserId,
      (data as any).customerName || (data as any).customer_name || null,
      (data as any).contactPerson || (data as any).contact_person || null,
      (data as any).contactDetails || (data as any).contact_details || null,
      (data as any).visitLocation || (data as any).visit_location || null,
      (data as any).visitType || (data as any).visit_type || null,
      (data as any).timeSlot || (data as any).time_slot || null,
      (data as any).productsToPresent || (data as any).products_to_present || null,
      (data as any).visitObjective || (data as any).visit_objective || null,
      (data as any).outcomeSummary || (data as any).outcome_summary || null,
      (data as any).nextAction || (data as any).next_action || null,
      (data as any).followUpDate || (data as any).follow_up_date || null,
      (data as any).opportunityStage || (data as any).opportunity_stage || null,
      ((data as any).estimatedValue ?? (data as any).estimated_value) !== undefined ? Number((data as any).estimatedValue ?? (data as any).estimated_value) : null,
      (data as any).priority || 'MEDIUM'
    ]);

    const newTask = res.rows[0];

    // Notification for Management Assignment
    if (finalAssignedEmpId !== actorEmployeeId) {
      const targetEmp = await query('SELECT user_id FROM employees WHERE id = $1', [finalAssignedEmpId]);
      if (targetEmp.rows.length > 0 && targetEmp.rows[0].user_id) {
        await query(`
          INSERT INTO notifications (organization_id, user_id, title, message)
          VALUES ($1, $2, 'New Task Assigned', $3)
        `, [organizationId, targetEmp.rows[0].user_id, `New task assigned: ${title} — ${data.date}`]).catch(() => null);
      }
    }

    // Audit Log
    const auditAction = finalAssignedEmpId !== actorEmployeeId ? 'TASK_ASSIGNED' : 'TASK_CREATED';
    await query(`
      INSERT INTO audit_logs (
        organization_id, user_id, action, module, entity_name, entity_id, new_values
      ) VALUES ($1, $2, $3, 'tasks', 'DailyTask', $4, $5)
    `, [organizationId, actorUserId, auditAction, newTask.id, JSON.stringify({ title, date: data.date, assignedEmployeeId: finalAssignedEmpId })]);

    return newTask;
  }

  static async findTasks(
    organizationId: string,
    actorUserId: string,
    actorRole: string,
    actorEmployeeId: string | null,
    filters: {
      startDate?: string;
      endDate?: string;
      assignedEmployeeId?: string;
      status?: string;
      visitType?: string;
      priority?: string;
      opportunityStage?: string;
    }
  ) {
    const conditions: string[] = ['t.organization_id = $1', 't.deleted_at IS NULL'];
    const params: any[] = [organizationId];

    // RBAC Isolation
    if (actorRole === 'EMPLOYEE') {
      if (!actorEmployeeId) {
        return [];
      }
      params.push(actorEmployeeId, actorUserId);
      conditions.push(`(t.employee_id = $${params.length - 1} OR t.created_by = $${params.length})`);
    } else if (filters.assignedEmployeeId) {
      params.push(filters.assignedEmployeeId);
      conditions.push(`t.employee_id = $${params.length}`);
    }

    if (filters.startDate) {
      params.push(filters.startDate);
      conditions.push(`t.date >= $${params.length}`);
    }

    if (filters.endDate) {
      params.push(filters.endDate);
      conditions.push(`t.date <= $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`t.status = $${params.length}`);
    }

    if (filters.visitType) {
      params.push(filters.visitType);
      conditions.push(`t.visit_type = $${params.length}`);
    }

    if (filters.priority) {
      params.push(filters.priority);
      conditions.push(`t.priority = $${params.length}`);
    }

    if (filters.opportunityStage) {
      params.push(filters.opportunityStage);
      conditions.push(`t.opportunity_stage = $${params.length}`);
    }

    const dataSql = `
      SELECT 
        t.id, t.date, t.hours, t.title, t.description, t.status, t.project_id,
        t.customer_name, t.contact_person, t.contact_details, t.visit_location,
        t.visit_type, t.time_slot, t.products_to_present, t.visit_objective,
        t.outcome_summary, t.next_action, t.follow_up_date, t.opportunity_stage,
        t.estimated_value, t.priority, t.cancelled_at, t.cancelled_by, t.cancellation_reason,
        t.rescheduled_from_task_id, t.rescheduled_to_task_id, t.reschedule_count, t.reschedule_reason,
        t.employee_id as assigned_employee_id,
        CONCAT(e.first_name, ' ', e.last_name) as assigned_employee_name,
        e.employee_code as assigned_employee_code,
        t.created_by as created_by_user_id,
        u.email as created_by_email,
        p.name as project_name
      FROM timesheets t
      LEFT JOIN employees e ON t.employee_id = e.id
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY t.date ASC, t.created_at ASC
    `;

    const res = await query(dataSql, params);
    return res.rows;
  }

  static async updateTask(
    organizationId: string,
    taskId: string,
    actorUserId: string,
    actorRole: string,
    actorEmployeeId: string | null,
    data: {
      title?: string;
      description?: string;
      hours?: number;
      status?: string;
      date?: string;
      customerName?: string;
      contactPerson?: string;
      contactDetails?: string;
      visitLocation?: string;
      visitType?: string;
      timeSlot?: string;
      productsToPresent?: string;
      visitObjective?: string;
      outcomeSummary?: string;
      nextAction?: string;
      followUpDate?: string;
      opportunityStage?: string;
      estimatedValue?: number;
      priority?: string;
      cancellationReason?: string;
    }
  ) {
    const existing = await query('SELECT * FROM timesheets WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL', [taskId, organizationId]);
    if (existing.rows.length === 0) {
      throw new Error('Task not found.');
    }
    const task = existing.rows[0];

    // RBAC check
    if (actorRole === 'EMPLOYEE' && task.employee_id !== actorEmployeeId && task.created_by !== actorUserId) {
      throw new Error('Unauthorized to modify this task.');
    }

    const title = data.title !== undefined ? data.title : task.title;
    const description = data.description !== undefined
      ? (data.description !== null ? String(data.description).trim() : '')
      : task.description;
    const hours = data.hours !== undefined ? Number(data.hours) : task.hours;
    const status = data.status !== undefined ? data.status : task.status;
    const date = data.date !== undefined ? data.date : task.date;

    const customerName = (data as any).customerName ?? (data as any).customer_name ?? task.customer_name;
    const contactPerson = (data as any).contactPerson ?? (data as any).contact_person ?? task.contact_person;
    const contactDetails = (data as any).contactDetails ?? (data as any).contact_details ?? task.contact_details;
    const visitLocation = (data as any).visitLocation ?? (data as any).visit_location ?? task.visit_location;
    const visitType = (data as any).visitType ?? (data as any).visit_type ?? task.visit_type;
    const timeSlot = (data as any).timeSlot ?? (data as any).time_slot ?? task.time_slot;
    const productsToPresent = (data as any).productsToPresent ?? (data as any).products_to_present ?? task.products_to_present;
    const visitObjective = (data as any).visitObjective ?? (data as any).visit_objective ?? task.visit_objective;
    const outcomeSummary = (data as any).outcomeSummary ?? (data as any).outcome_summary ?? task.outcome_summary;
    const nextAction = (data as any).nextAction ?? (data as any).next_action ?? task.next_action;
    const followUpDate = (data as any).followUpDate ?? (data as any).follow_up_date ?? task.follow_up_date;
    const opportunityStage = (data as any).opportunityStage ?? (data as any).opportunity_stage ?? task.opportunity_stage;
    const estimatedValue = ((data as any).estimatedValue ?? (data as any).estimated_value) !== undefined ? Number((data as any).estimatedValue ?? (data as any).estimated_value) : task.estimated_value;
    const priority = (data as any).priority ?? task.priority;

    let cancelledAt = task.cancelled_at;
    let cancelledBy = task.cancelled_by;
    let cancellationReason = task.cancellation_reason;

    if (status === 'CANCELLED' && task.status !== 'CANCELLED') {
      cancelledAt = new Date().toISOString();
      cancelledBy = actorUserId;
      cancellationReason = data.cancellationReason || 'Task cancelled by user';
    }

    const res = await query(`
      UPDATE timesheets SET
        title = $1,
        description = $2,
        hours = $3,
        status = $4,
        date = $5,
        customer_name = $6,
        contact_person = $7,
        contact_details = $8,
        visit_location = $9,
        visit_type = $10,
        time_slot = $11,
        products_to_present = $12,
        visit_objective = $13,
        outcome_summary = $14,
        next_action = $15,
        follow_up_date = $16,
        opportunity_stage = $17,
        estimated_value = $18,
        priority = $19,
        cancelled_at = $20,
        cancelled_by = $21,
        cancellation_reason = $22,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $23 AND organization_id = $24
      RETURNING *
    `, [
      title, description, hours, status, date,
      customerName, contactPerson, contactDetails, visitLocation, visitType,
      timeSlot, productsToPresent, visitObjective, outcomeSummary, nextAction,
      followUpDate, opportunityStage, estimatedValue, priority,
      cancelledAt, cancelledBy, cancellationReason,
      taskId, organizationId
    ]);

    const updatedTask = res.rows[0];

    await query(`
      INSERT INTO audit_logs (
        organization_id, user_id, action, module, entity_name, entity_id, new_values
      ) VALUES ($1, $2, 'TASK_UPDATED', 'tasks', 'DailyTask', $3, $4)
    `, [organizationId, actorUserId, taskId, JSON.stringify({ title, status, hours, outcomeSummary })]);

    return updatedTask;
  }

  static async rescheduleTask(
    organizationId: string,
    taskId: string,
    actorUserId: string,
    actorRole: string,
    actorEmployeeId: string | null,
    newDate: string,
    reason?: string
  ) {
    const existing = await query('SELECT * FROM timesheets WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL', [taskId, organizationId]);
    if (existing.rows.length === 0) {
      throw new Error('Task not found.');
    }
    const orig = existing.rows[0];

    if (actorRole === 'EMPLOYEE' && orig.employee_id !== actorEmployeeId && orig.created_by !== actorUserId) {
      throw new Error('Unauthorized to reschedule this task.');
    }

    const newRescheduleCount = (orig.reschedule_count || 0) + 1;

    // Create new task on newDate linked to original
    const newInsertSql = `
      INSERT INTO timesheets (
        organization_id, employee_id, project_id, title, date, hours, description, status, created_by,
        customer_name, contact_person, contact_details, visit_location, visit_type, time_slot,
        products_to_present, visit_objective, opportunity_stage, estimated_value, priority,
        rescheduled_from_task_id, reschedule_count, reschedule_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PLANNED', $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *
    `;

    const newRes = await query(newInsertSql, [
      organizationId,
      orig.employee_id,
      orig.project_id,
      orig.title,
      newDate,
      orig.hours,
      orig.description,
      actorUserId,
      orig.customer_name,
      orig.contact_person,
      orig.contact_details,
      orig.visit_location,
      orig.visit_type,
      orig.time_slot,
      orig.products_to_present,
      orig.visit_objective,
      orig.opportunity_stage,
      orig.estimated_value,
      orig.priority || 'MEDIUM',
      taskId,
      newRescheduleCount,
      reason || 'Rescheduled to next week'
    ]);

    const newTask = newRes.rows[0];

    // Update original task link to new task
    await query(`
      UPDATE timesheets
      SET rescheduled_to_task_id = $1, reschedule_reason = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND organization_id = $4
    `, [newTask.id, reason || 'Rescheduled to next week', taskId, organizationId]);

    // Audit Log
    await query(`
      INSERT INTO audit_logs (
        organization_id, user_id, action, module, entity_name, entity_id, old_values, new_values
      ) VALUES ($1, $2, 'TASK_RESCHEDULED', 'tasks', 'DailyTask', $3, $4, $5)
    `, [
      organizationId,
      actorUserId,
      taskId,
      JSON.stringify({ date: orig.date, title: orig.title }),
      JSON.stringify({ newTaskId: newTask.id, newDate, reason })
    ]);

    return { originalTask: orig, newTask };
  }

  static async findPendingCarryForward(
    organizationId: string,
    actorUserId: string,
    actorRole: string,
    actorEmployeeId: string | null,
    beforeDate?: string
  ) {
    const cutoffDate = beforeDate || new Date().toISOString().split('T')[0];
    const conditions: string[] = [
      't.organization_id = $1',
      't.deleted_at IS NULL',
      't.date < $2',
      "t.status IN ('PLANNED', 'IN_PROGRESS')",
      't.rescheduled_to_task_id IS NULL'
    ];
    const params: any[] = [organizationId, cutoffDate];

    if (actorRole === 'EMPLOYEE') {
      if (!actorEmployeeId) return [];
      params.push(actorEmployeeId, actorUserId);
      conditions.push(`(t.employee_id = $3 OR t.created_by = $4)`);
    }

    const dataSql = `
      SELECT 
        t.id, t.date, t.hours, t.title, t.description, t.status, t.project_id,
        t.customer_name, t.contact_person, t.contact_details, t.visit_location,
        t.visit_type, t.time_slot, t.products_to_present, t.visit_objective,
        t.outcome_summary, t.next_action, t.follow_up_date, t.opportunity_stage,
        t.estimated_value, t.priority, t.rescheduled_from_task_id, t.rescheduled_to_task_id, t.reschedule_count,
        t.employee_id as assigned_employee_id,
        CONCAT(e.first_name, ' ', e.last_name) as assigned_employee_name,
        e.employee_code as assigned_employee_code
      FROM timesheets t
      LEFT JOIN employees e ON t.employee_id = e.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY t.date DESC
    `;

    const res = await query(dataSql, params);
    return res.rows;
  }

  static async deleteTask(organizationId: string, taskId: string, actorUserId: string, actorRole: string, actorEmployeeId: string | null) {
    const existing = await query('SELECT * FROM timesheets WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL', [taskId, organizationId]);
    if (existing.rows.length === 0) {
      throw new Error('Task not found.');
    }
    const task = existing.rows[0];

    if (actorRole === 'EMPLOYEE' && task.employee_id !== actorEmployeeId && task.created_by !== actorUserId) {
      throw new Error('Unauthorized to delete this task.');
    }

    await query(`UPDATE timesheets SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2`, [taskId, organizationId]);

    await query(`
      INSERT INTO audit_logs (
        organization_id, user_id, action, module, entity_name, entity_id, old_values
      ) VALUES ($1, $2, 'TASK_DELETED', 'tasks', 'DailyTask', $3, $4)
    `, [organizationId, actorUserId, taskId, JSON.stringify({ title: task.title, date: task.date })]);

    return true;
  }

  // Legacy compatibility methods
  static async create(organizationId: string, employeeId: string, data: { projectId?: string; date: string; hours: number; description: string; title?: string }) {
    return this.createTask(organizationId, '00000000-0000-0000-0000-000000000000', 'EMPLOYEE', employeeId, {
      assignedEmployeeId: employeeId,
      projectId: data.projectId,
      date: data.date,
      title: data.title || data.description || 'Daily Task',
      description: data.description,
      hours: data.hours
    });
  }

  static async findByEmployee(organizationId: string, employeeId: string) {
    return this.findTasks(organizationId, '00000000-0000-0000-0000-000000000000', 'SUPER_ADMIN', employeeId, { assignedEmployeeId: employeeId });
  }

  static async findAll(organizationId: string, filters: { page?: number; limit?: number }) {
    const tasks = await this.findTasks(organizationId, '00000000-0000-0000-0000-000000000000', 'SUPER_ADMIN', null, {});
    return {
      timesheets: tasks,
      pagination: { total: tasks.length, page: 1, limit: 500, totalPages: 1 }
    };
  }
}
