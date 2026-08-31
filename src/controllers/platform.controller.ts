import { Request, Response, NextFunction } from 'express';
import { platformRegistry } from '../adapters/registry.js';
import { ApiResponse } from '../types/index.js';

export async function listPlatforms(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const providers = platformRegistry.getAllProviders();

    const platformsData = await Promise.all(
      providers.map(async (provider) => {
        const health = provider.healthCheck ? await provider.healthCheck() : { healthy: true };
        return {
          platform: provider.getPlatformName(),
          capabilities: provider.getCapabilities(),
          status: health.healthy ? 'operational' : 'degraded',
          health,
        };
      })
    );

    const response: ApiResponse<typeof platformsData> = {
      success: true,
      data: platformsData,
      meta: {
        total: platformsData.length,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
