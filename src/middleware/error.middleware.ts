import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/index.js';
import { ApiErrorResponse } from '../types/index.js';

/**
 * Global Express Error Handling Middleware
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        timestamp: new Date().toISOString(),
      },
    };

    res.status(err.statusCode).json(errorResponse);
    return;
  }

  // Unhandled internal server error
  console.error('Unhandled Server Error:', err);

  const serverErrorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
      timestamp: new Date().toISOString(),
    },
  };

  res.status(500).json(serverErrorResponse);
}
