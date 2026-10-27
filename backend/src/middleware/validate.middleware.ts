// ==============================================================================
// AssetVault: Request Payload Validation & Mass-Assignment Defense Middleware
// Course: BCSE307L Database Systems (Fall 2026-27)
// Parses with Zod, strips unknown fields (blocks role_id/tenant_id injection), and delegates to errorHandler returning 400 (VALIDATION_ERROR)
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';

export interface RequestValidationSchema {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export const validate = (schema: RequestValidationSchema | ZodTypeAny) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if ('safeParseAsync' in schema && typeof (schema as any).safeParseAsync === 'function') {
        // Direct body schema passed
        req.body = await (schema as ZodTypeAny).parseAsync(req.body);
      } else {
        const compositeSchema = schema as RequestValidationSchema;
        if (compositeSchema.body) {
          req.body = await compositeSchema.body.parseAsync(req.body);
        }
        if (compositeSchema.query) {
          req.query = (await compositeSchema.query.parseAsync(req.query)) as Request['query'];
        }
        if (compositeSchema.params) {
          req.params = (await compositeSchema.params.parseAsync(req.params)) as Request['params'];
        }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
      } else {
        next(error);
      }
    }
  };
};
