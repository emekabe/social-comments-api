import { prisma } from '../db/client.js';
import { ConflictError } from '../errors/index.js';
import { config } from '../config/index.js';

export interface IdempotencyCheckResult {
  cached: boolean;
  statusCode?: number;
  responseBody?: unknown;
}

export class IdempotencyService {
  /**
   * Check if a request with this idempotency key was previously processed
   */
  async checkKey(key: string, path: string, bodyHash: string): Promise<IdempotencyCheckResult> {
    const record = await prisma.idempotencyRecord.findUnique({
      where: { key },
    });

    if (!record) {
      return { cached: false };
    }

    // Check if key has expired
    if (new Date() > record.expiresAt) {
      await prisma.idempotencyRecord.delete({ where: { key } }).catch(() => {});
      return { cached: false };
    }

    // Verify request payload fingerprint matches
    if (record.requestBodyHash !== bodyHash || record.requestPath !== path) {
      throw new ConflictError(
        `Idempotency-Key '${key}' was previously used with a different request path or payload.`
      );
    }

    return {
      cached: true,
      statusCode: record.statusCode,
      responseBody: JSON.parse(record.responseBody),
    };
  }

  /**
   * Store the result of an idempotency key execution
   */
  async storeKey(
    key: string,
    path: string,
    bodyHash: string,
    statusCode: number,
    responseBody: unknown
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + config.idempotency.ttlSeconds * 1000);

    await prisma.idempotencyRecord.upsert({
      where: { key },
      create: {
        key,
        requestPath: path,
        requestBodyHash: bodyHash,
        statusCode,
        responseBody: JSON.stringify(responseBody),
        expiresAt,
      },
      update: {
        statusCode,
        responseBody: JSON.stringify(responseBody),
        expiresAt,
      },
    });
  }
}

export const idempotencyService = new IdempotencyService();
