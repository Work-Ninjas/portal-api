import dotenv from 'dotenv';
import { createRealApp } from './app-real';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = createRealApp();

app.listen(PORT, () => {
  logger.info(`Portal API server (REAL) started`, {
    port: PORT,
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0-alpha'
  });
  
  console.log(`
╔════════════════════════════════════════╗
║      Portal API Server (REAL)          ║
║                                        ║
║  Status: Running                       ║
║  Port: ${PORT}                            ║
║  Environment: ${NODE_ENV}              ║
║  Version: 1.0.0-alpha                  ║
║  RPC: Enabled                          ║
║                                        ║
║  Health check:                         ║
║  http://localhost:${PORT}/v1/health        ║
║                                        ║
║  Gate B: Real endpoints active         ║
╚════════════════════════════════════════╝
  `);
});