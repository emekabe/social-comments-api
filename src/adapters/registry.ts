import { PlatformCommentProvider } from './base.provider.js';
import { PlatformType } from '../types/index.js';
import { PlatformError } from '../errors/index.js';

/**
 * Central Registry for Social Platform Adapters (Registry Pattern)
 * 
 * Manages active platform providers and resolves appropriate adapters at runtime.
 * Enables adding new platforms (e.g. TikTok, YouTube, Threads) with zero modification
 * to core services or API routes (Open-Closed Principle).
 */
export class PlatformRegistry {
  private static instance: PlatformRegistry;
  private readonly providers = new Map<string, PlatformCommentProvider>();

  private constructor() {}

  public static getInstance(): PlatformRegistry {
    if (!PlatformRegistry.instance) {
      PlatformRegistry.instance = new PlatformRegistry();
    }
    return PlatformRegistry.instance;
  }

  /**
   * Register a new platform comment provider adapter
   */
  public register(provider: PlatformCommentProvider): void {
    const name = provider.getPlatformName().toLowerCase();
    this.providers.set(name, provider);
  }

  /**
   * Retrieve a registered platform provider by platform identifier
   */
  public get(platform: PlatformType): PlatformCommentProvider {
    const provider = this.providers.get(platform.toLowerCase());
    if (!provider) {
      throw new PlatformError(
        platform,
        `No adapter registered for platform '${platform}'. Supported platforms: [${this.getSupportedPlatforms().join(', ')}]`,
        400
      );
    }
    return provider;
  }

  /**
   * Check if an adapter is registered for the specified platform
   */
  public has(platform: PlatformType): boolean {
    return this.providers.has(platform.toLowerCase());
  }

  /**
   * List all registered platform names
   */
  public getSupportedPlatforms(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Return all registered provider instances
   */
  public getAllProviders(): PlatformCommentProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Reset registry (mainly for testing)
   */
  public clear(): void {
    this.providers.clear();
  }
}

export const platformRegistry = PlatformRegistry.getInstance();
