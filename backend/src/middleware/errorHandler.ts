import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError | ZodError | any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred on the server.';

  if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.errors.map(e => e.message).join('. ');
  }

  // Internal log keeps full diagnostic message
  console.error(`[ERROR ${code} ${statusCode}] ${req.method} ${req.url}:`, message);

  // Harden: Do not expose raw error messages for 5xx exceptions
  let clientMessage = message;
  if (statusCode >= 500) {
    clientMessage = 'An unexpected error occurred on the server.';
  }

  return res.status(statusCode).json({
    success: false,
    error: clientMessage,
    code
  });
}
