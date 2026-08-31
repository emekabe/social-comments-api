import { platformRegistry } from './registry.js';
import { TwitterCommentAdapter } from './twitter/twitter.adapter.js';
import { InstagramCommentAdapter } from './instagram/instagram.adapter.js';
import { LinkedInCommentAdapter } from './linkedin/linkedin.adapter.js';
import { FacebookCommentAdapter } from './facebook/facebook.adapter.js';
import { config } from '../config/index.js';

/**
 * Initializes and registers active platform adapters based on application configuration.
 */
export function initializePlatformAdapters(): void {
  if (config.platforms.twitter.enabled) {
    platformRegistry.register(new TwitterCommentAdapter());
  }

  if (config.platforms.instagram.enabled) {
    platformRegistry.register(new InstagramCommentAdapter());
  }

  if (config.platforms.linkedin.enabled) {
    platformRegistry.register(new LinkedInCommentAdapter());
  }

  if (config.platforms.facebook.enabled) {
    platformRegistry.register(new FacebookCommentAdapter());
  }
}

export * from './base.provider.js';
export * from './registry.js';
export * from './twitter/twitter.adapter.js';
export * from './instagram/instagram.adapter.js';
export * from './linkedin/linkedin.adapter.js';
export * from './facebook/facebook.adapter.js';
