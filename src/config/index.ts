import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  
  // Platform feature flags (simulate enabling/disabling platform integrations)
  platforms: {
    twitter: {
      enabled: process.env.TWITTER_API_ENABLED !== 'false',
    },
    instagram: {
      enabled: process.env.INSTAGRAM_GRAPH_API_ENABLED !== 'false',
    },
    linkedin: {
      enabled: process.env.LINKEDIN_REST_API_ENABLED !== 'false',
    },
    facebook: {
      enabled: process.env.FACEBOOK_GRAPH_API_ENABLED !== 'false',
    },
  },

  // Default pagination and idempotency TTL
  pagination: {
    defaultLimit: 50,
    maxLimit: 100,
  },
  idempotency: {
    ttlSeconds: 86400, // 24 hours
  },
};
