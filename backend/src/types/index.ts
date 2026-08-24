import { Request } from 'express';

export interface AuthUser {
  userId: string;
  organizationId: string;
  email: string;
  role: string;
  employeeId: string | null;
  name?: string;
  displayName?: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
