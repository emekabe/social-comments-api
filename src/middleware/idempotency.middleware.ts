import { Request, Response, NextFunction } from 'express';
import { idempotencyService } from '../services/idempotency.service.js';
import { hashPayload } from '../utils/hash.js';

/**
 * Idempotency Middleware for mutating HTTP methods (POST, PUT, PATCH)
 * 
 * Inspects `Idempotency-Key` HTTP header. If present, ensures requests with the same key
 * return the original cached response without re-executing business operations.
 */
export function idempotencyMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const idempotencyKey = req.header('Idempotency-Key') || req.header('X-Idempotency-Key');

    if (!idempotencyKey) {
      return next();
    }

    const path = req.originalUrl || req.url;
    const bodyHash = hashPayload(req.body);

    try {
      const checkResult = await idempotencyService.checkKey(idempotencyKey, path, bodyHash);

      if (checkResult.cached && checkResult.statusCode) {
        res.setHeader('X-Cache-Lookup', 'HIT');
        res.setHeader('Idempotency-Key', idempotencyKey);
        res.status(checkResult.statusCode).json(checkResult.responseBody);
        return;
      }

      // Intercept res.json to capture and persist successful response
      const originalJson = res.json.bind(res);

      res.json = function (body: unknown): Response {
        const statusCode = res.statusCode;

        // Persist only successful responses (2xx)
        if (statusCode >= 200 && statusCode < 300) {
          idempotencyService
            .storeKey(idempotencyKey, path, bodyHash, statusCode, body)
            .catch((err) => {
              console.error('Failed to store idempotency record:', err);
            });
        }

        res.setHeader('X-Cache-Lookup', 'MISS');
        res.setHeader('Idempotency-Key', idempotencyKey);
        return originalJson(body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}
