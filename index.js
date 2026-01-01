import 'dotenv/config';
import os from "os";
import app from './src/app/index.js';
import logger from './src/utils/logger.js';

/**
 * Server port number from environment variables or default fallback
 * @constant {number}
 * @default 3000
 */
const PORT = process.env.PORT || 7860;

/**
 * Starts the Express server and logs startup information including network interfaces
 * @function
 * @listens Express.Application#listen
 * 
 * @description
 * This module is the main entry point that starts the Express server.
 * It performs the following operations on startup:
 * 1. Starts the server on the specified PORT
 * 2. Logs successful server initialization
 * 3. Displays local and network access URLs
 * 4. Handles network interface detection gracefully
 * 
 * @example
 * // Server startup output example:
 * // 
 * // [READY] Server started successfully
 * // [INFO] Local: http://localhost:3000
 * // [INFO] Network: http://192.168.1.100:3000
 * // [INFO] Ready for connections
 * // 
 */
app.listen(PORT, "0.0.0.0", () => {
  console.log(""); // Empty line for better readability

  /**
   * Log server startup success message
   * @event logger#ready
   */
  logger.ready(`Server started successfully`);

  /**
   * Log local access URL
   * @event logger#info
   */
  logger.info(`Local: http://localhost:${PORT}`);

  try {
    /**
     * Retrieve network interface information from the operating system
     * @type {Object.<string, os.NetworkInterfaceInfo[]>}
     */
    const nets = os.networkInterfaces();

    /**
     * Object to store filtered IPv4 network addresses
     * @type {Object.<string, string[]>}
     */
    const results = {};

    /**
     * Iterate through all network interfaces to find external IPv4 addresses
     * @loop
     * @description Filters out internal interfaces and IPv6 addresses
     */
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        // Filter for IPv4 addresses that are not internal (loopback, etc.)
        if (net.family === "IPv4" && !net.internal) {
          if (!results[name]) results[name] = [];
          results[name].push(net.address);
        }
      }
    }

    /**
     * Log all detected external network addresses for remote access
     * @loop
     * @description Logs each network interface address that can be used for remote access
     */
    for (const [, addresses] of Object.entries(results)) {
      for (const addr of addresses) {
        /**
         * Log network access URL for each external IP address
         * @event logger#info
         */
        logger.info(`Network: http://${addr}:${PORT}`);
      }
    }
  } catch (error) {
    /**
     * Handle errors during network interface detection gracefully
     * @event logger#warn
     * @param {Error} error - The error encountered during network detection
     */
    logger.warn(`Cannot detect network interfaces: ${error.message}`);
  }

  /**
   * Log server readiness for accepting connections
   * @event logger#info
   */
  logger.info("Ready for connections");

  console.log(""); // Empty line for better readability
});

/**
 * Export the Express application instance for testing or module reuse
 * @type {express.Application}
 */
export default app;
