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
    const hours = data.hours !== undefined ? Number(data.hours) : 1.0;
    const status = data.status || 'PLANNED';
    const projectId = data.projectId && data.projectId.trim() !== '' ? data.projectId.trim() : null;

    const insertSql = `
      INSERT INTO timesheets (
        organization_id, employee_id, project_id, title, date, hours, description, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const res = await query(insertSql, [
      organizationId,
      finalAssignedEmpId,
      projectId,
      title,
      data.date,
      hours,
      data.description || null,
      status,
      actorUserId
    ]);

    const newTask = res.rows[0];

    // Notification for Management Assignment
    if (finalAssignedEmpId !== actorEmployeeId) {
      const targetEmp = await query('SELECT user_id FROM employees WHERE id = $1', [finalAssignedEmpId]);
      if (targetEmp.rows.length > 0 && targetEmp.rows[0].user_id) {
        await query(`
          INSERT INTO notifications (organization_id, user_id, title, message, type)
          VALUES ($1, $2, 'New Task Assigned', $3, 'TASK_ASSIGNMENT')
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

    const dataSql = `
      SELECT 
        t.id, t.date, t.hours, t.title, t.description, t.status, t.project_id,
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
    const description = data.description !== undefined ? data.description : task.description;
    const hours = data.hours !== undefined ? Number(data.hours) : task.hours;
    const status = data.status !== undefined ? data.status : task.status;
    const date = data.date !== undefined ? data.date : task.date;

    const res = await query(`
      UPDATE timesheets SET
        title = $1,
        description = $2,
        hours = $3,
        status = $4,
        date = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND organization_id = $7
      RETURNING *
    `, [title, description, hours, status, date, taskId, organizationId]);

    const updatedTask = res.rows[0];

    await query(`
      INSERT INTO audit_logs (
        organization_id, user_id, action, module, entity_name, entity_id, new_values
      ) VALUES ($1, $2, 'TASK_UPDATED', 'tasks', 'DailyTask', $3, $4)
    `, [organizationId, actorUserId, taskId, JSON.stringify({ title, status, hours })]);

    return updatedTask;
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
