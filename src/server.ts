import { createApp } from './app.js';
import { config } from './config/index.js';
import { prisma } from './db/client.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`🚀 Social Comments API server running on port ${config.port} [${config.nodeEnv}]`);
  console.log(`📡 Health Check: http://localhost:${config.port}/api/v1/health`);
  console.log(`🌐 Platforms: http://localhost:${config.port}/api/v1/platforms`);
});

// Graceful shutdown handlers
async function handleShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Gracefully shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Database connections closed. Process exited cleanly.');
    process.exit(0);
  });

  // Force close after timeout if shutdown hangs
  setTimeout(() => {
    console.error('Shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
