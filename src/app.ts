import express, { Express } from 'express';
import cors from 'cors';
import v1Router from './routes/v1/index.js';
import { errorHandler } from './middleware/error.middleware.js';
import { NotFoundError } from './errors/index.js';
import { initializePlatformAdapters } from './adapters/index.js';

export function createApp(): Express {
  const app = express();

  // Initialize and register platform adapters
  initializePlatformAdapters();

  // Core Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Root redirect/status
  app.get('/', (_req, res) => {
    res.json({
      name: 'Social Comments API',
      version: '1.0.0',
      status: 'active',
      docs: '/api/v1/platforms',
    });
  });

  // Mount API v1 Routes
  app.use('/api/v1', v1Router);

  // 404 Fallback Handler
  app.use((req, _res, next) => {
    next(new NotFoundError('Route', req.originalUrl));
  });

  // Global Error Handling Middleware
  app.use(errorHandler);

  return app;
}
