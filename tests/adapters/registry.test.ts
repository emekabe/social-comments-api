import { describe, it, expect, beforeEach } from 'vitest';
import { PlatformRegistry } from '../../src/adapters/registry.js';
import { TwitterCommentAdapter } from '../../src/adapters/twitter/twitter.adapter.js';
import { InstagramCommentAdapter } from '../../src/adapters/instagram/instagram.adapter.js';
import { PlatformError } from '../../src/errors/index.js';

describe('PlatformRegistry', () => {
  let registry: PlatformRegistry;

  beforeEach(() => {
    registry = PlatformRegistry.getInstance();
    registry.clear();
  });

  it('should register and resolve adapters by name', () => {
    const twitterAdapter = new TwitterCommentAdapter();
    registry.register(twitterAdapter);

    expect(registry.has('twitter')).toBe(true);
    expect(registry.get('twitter')).toBe(twitterAdapter);
    expect(registry.getSupportedPlatforms()).toEqual(['twitter']);
  });

  it('should throw PlatformError when requesting unregistered platform', () => {
    expect(() => registry.get('tiktok')).toThrow(PlatformError);
  });

  it('should list all registered providers', () => {
    registry.register(new TwitterCommentAdapter());
    registry.register(new InstagramCommentAdapter());

    const all = registry.getAllProviders();
    expect(all).toHaveLength(2);
    expect(registry.getSupportedPlatforms()).toContain('twitter');
    expect(registry.getSupportedPlatforms()).toContain('instagram');
  });
});
