import { EmployeeRepository, EmployeeFilter } from '../repositories/employeeRepository';

export class EmployeeService {
  static async getEmployees(organizationId: string, filters: EmployeeFilter) {
    return await EmployeeRepository.findAll(organizationId, filters);
  }

  static async getEmployeeById(id: string, organizationId: string) {
    const emp = await EmployeeRepository.findById(id, organizationId);
    if (!emp) {
      const err: any = new Error('Employee record not found.');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    return emp;
  }

  static async createEmployee(organizationId: string, data: any) {
    data.organization_id = organizationId;
    return await EmployeeRepository.create(data);
  }

  static async updateEmployee(id: string, organizationId: string, data: any) {
    const updated = await EmployeeRepository.update(id, organizationId, data);
    if (!updated) {
      const err: any = new Error('Employee record not found.');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    return updated;
  }

  static async deactivateEmployee(id: string, organizationId: string, actorUserId?: string) {
    return await EmployeeRepository.setStatus(id, organizationId, 'INACTIVE', actorUserId);
  }

  static async restoreEmployee(id: string, organizationId: string, actorUserId?: string) {
    return await EmployeeRepository.setStatus(id, organizationId, 'ACTIVE', actorUserId);
  }

  static async getOrgChart(organizationId: string) {
    return await EmployeeRepository.getOrgChart(organizationId);
  }
}
