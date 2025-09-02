import dotenv from 'dotenv';
import { createGateCApp } from './app-gate-c';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = createGateCApp();

app.listen(PORT, () => {
  logger.info(`Portal API server (GATE C) started`, {
    port: PORT,
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0-alpha'
  });
  
  console.log(`
╔════════════════════════════════════════╗
║      Portal API Server (GATE C)        ║
║                                        ║
║  Status: Running                       ║
║  Port: ${PORT}                            ║
║  Environment: ${NODE_ENV}              ║
║  Version: 1.0.0-alpha                  ║
║  RPC: Enabled                          ║
║  Files: Signed URLs + Rate Limiting    ║
║                                        ║
║  Health check:                         ║
║  http://localhost:${PORT}/v1/health        ║
║                                        ║
║  Gate C: Files with signed URLs ready  ║
╚════════════════════════════════════════╝
  `);
});