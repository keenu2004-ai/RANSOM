import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred on the server.';

  console.error(`[ERROR ${code} ${statusCode}] ${req.method} ${req.url}:`, err.stack || err.message);

  return res.status(statusCode).json({
    success: false,
    error: message,
    code
  });
}
