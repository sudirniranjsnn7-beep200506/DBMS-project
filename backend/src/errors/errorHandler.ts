// ==============================================================================
// AssetVault: Centralized Error Handler
// Course: BCSE307L Database Systems (Fall 2026-27)
// Maps Prisma and PostgreSQL trigger/procedure exceptions to clean REST responses
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from './AppError';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. Handled AppError instances
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    res.status(400).json({
      status: 'error',
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input payload',
        details: err.flatten(),
      },
    });
    return;
  }

  // 3. Prisma Known Request Errors
  const prismaErr = err as any;
  const errCode = prismaErr.code || '';

  // Prisma Unique Constraint
  if (errCode === 'P2002') {
    const target = (prismaErr.meta?.target as string[]) || [];
    res.status(409).json({
      status: 'error',
      error: {
        code: 'CONFLICT',
        message: `Unique constraint violated on field(s): ${target.join(', ')}`,
        details: { fields: target },
      },
    });
    return;
  }

  // Prisma Record Not Found
  if (errCode === 'P2025') {
    res.status(404).json({
      status: 'error',
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
    return;
  }

  // Prisma Foreign Key Constraint
  if (errCode === 'P2003') {
    res.status(409).json({
      status: 'error',
      error: {
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'Referenced foreign relation constraint failed or entity does not exist.',
        details: { field: prismaErr.meta?.field_name },
      },
    });
    return;
  }

  // 4. PostgreSQL Trigger / Procedure Exceptions (ConnectorError / PostgresError)
  const fullMessage = err.message || '';
  
  // Extract custom RAISE EXCEPTION message from PostgreSQL error strings
  const postgresMatch = fullMessage.match(/message:\s*"([^"]+)"/) ||
                        fullMessage.match(/ERROR:\s*([^\n\r]+)/) ||
                        fullMessage.match(/Error occurred during query execution:[^\n]*\n(.*)/);
  const friendlyDbMessage = postgresMatch && postgresMatch[1] ? postgresMatch[1].trim() : null;

  // Check for Postgres Check Violation (code 23514) or over-allocation / quota triggers
  if (
    fullMessage.includes('23514') ||
    fullMessage.includes('exceeded for current subscription plan') ||
    fullMessage.includes('No seats available for allocation') ||
    fullMessage.includes('Cross-tenant violation') ||
    fullMessage.includes('is append-only') ||
    fullMessage.includes('check_violation')
  ) {
    res.status(409).json({
      status: 'error',
      error: {
        code: 'BUSINESS_RULE_VIOLATION',
        message: friendlyDbMessage || 'The operation violated a database integrity constraint or quota limit.',
      },
    });
    return;
  }

  // Check for Postgres Unique Violation (code 23505)
  if (fullMessage.includes('23505')) {
    res.status(409).json({
      status: 'error',
      error: {
        code: 'CONFLICT',
        message: friendlyDbMessage || 'A record with the specified unique values already exists.',
      },
    });
    return;
  }

  // Check for Postgres Foreign Key Violation (code 23503)
  if (fullMessage.includes('23503')) {
    res.status(409).json({
      status: 'error',
      error: {
        code: 'FOREIGN_KEY_VIOLATION',
        message: friendlyDbMessage || 'Foreign key constraint violated.',
      },
    });
    return;
  }

  // Check for Postgres custom exceptions (code P0001)
  if (fullMessage.includes('P0001') && friendlyDbMessage) {
    res.status(422).json({
      status: 'error',
      error: {
        code: 'UNPROCESSABLE_ENTITY',
        message: friendlyDbMessage,
      },
    });
    return;
  }

  // 5. Default Unhandled Server Error
  console.error('Unhandled Application Error:', err);
  res.status(500).json({
    status: 'error',
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected internal server error occurred.' : err.message,
    },
  });
};
