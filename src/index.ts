import dotenv from 'dotenv';
import { createApp } from './app';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = createApp(); // Trigger reload

app.listen(PORT, () => {
  logger.info(`Portal API server started`, {
    port: PORT,
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0-alpha'
  });
  
  console.log(`
╔════════════════════════════════════════╗
║         Portal API Server              ║
║                                        ║
║  Status: Running                       ║
║  Port: ${PORT}                            ║
║  Environment: ${NODE_ENV}              ║
║  Version: 1.0.0-alpha                  ║
║                                        ║
║  Health check:                         ║
║  http://localhost:${PORT}/v1/health        ║
╚════════════════════════════════════════╝
  `);
});