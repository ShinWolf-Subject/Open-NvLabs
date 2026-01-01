import express from "express";
import logApiRequest from "../utils/logApiRequest.js";
import rateLimiter from "./rateLimiter.js";

/**
 * Configures and applies all middleware for the Express application
 * @function setupMiddleware
 * @param {express.Application} app - The Express application instance to configure
 * @returns {void}
 * 
 * @example
 * // Usage in main server file:
 * import setupMiddleware from './middleware.js';
 * const app = express();
 * setupMiddleware(app);
 * 
 * @description
 * This function sets up essential middleware for handling JSON parsing, 
 * URL-encoded data, API request logging, and static file serving.
 * The middleware is applied in the following order:
 * 1. express.json() - Parses incoming JSON requests
 * 2. express.urlencoded() - Parses URL-encoded data
 * 3. logApiRequest - Custom API request logging middleware
 * 4. express.static - Serves static files from 'public' directory
 */
export default function setupMiddleware(app) {
  /**
   * JSON parsing middleware
   * @middleware express.json
   * @description Parses incoming requests with JSON payloads
   * @see {@link https://expressjs.com/en/api.html#express.json}
   */
  app.use(express.json());
  
  /**
   * URL-encoded data parsing middleware
   * @middleware express.urlencoded
   * @param {Object} options - Configuration options
   * @param {boolean} options.extended - Use querystring library when false, qs library when true
   * @description Parses incoming requests with URL-encoded payloads
   * @see {@link https://expressjs.com/en/api.html#express.urlencoded}
   */
  app.use(express.urlencoded({ extended: true }));
  
  /**
   * Custom API request logging middleware
   * @middleware logApiRequest
   * @description Logs details of incoming API requests including method, path, IP, etc.
   */
  app.use(logApiRequest);
  
  /**
   * RateLimiter API request logging middleware
   * @middleware rateLimiter
   * @description Logs details of incoming API requests including IP.
   */
  app.use(rateLimiter.middleware);
  
  /**
   * Static file serving middleware
   * @middleware express.static
   * @param {string} 'public' - Directory from which to serve static files
   * @description Serves static files (HTML, CSS, JS, images) from the 'public' directory
   * @see {@link https://expressjs.com/en/starter/static-files.html}
   */
  app.use(express.static('public'));
}
