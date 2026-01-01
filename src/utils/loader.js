import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import logger from "./logger.js";

/**
 * Recursively loads and registers API endpoints from a directory structure
 * @async
 * @function loadEndpoints
 * @param {string} dir - The directory path to scan for endpoint files
 * @param {express.Application} app - Express application instance to register routes
 * @returns {Promise<Array<Object>>} Array of loaded endpoint metadata objects
 * 
 * @description
 * This function recursively scans a directory for JavaScript files that export endpoint modules.
 * Each endpoint file should export a default object with a `run` function and optional metadata.
 * Discovered endpoints are automatically registered with the Express application.
 * 
 * @example
 * // Load endpoints from the api directory
 * const endpoints = await loadEndpoints(path.join(process.cwd(), "api"), app);
 * console.log(`Loaded ${endpoints.length} endpoints`);
 * 
 * @fileStructure
 * api/
 * ├── users/
 * │   ├── get.js          // GET /nv/users/get
 * │   └── create.js       // POST /nv/users/create
 * └── products/
 *     └── list.js         // GET /nv/products/list
 * 
 * @endpointModuleFormat
 * // Example endpoint file (nv/users/get.js)
 * export default {
 *   name: "Get User",
 *   description: "Retrieves user information by ID",
 *   category: "Users",
 *   methods: ["GET"],
 *   params: ["userId"],
 *   run: async (req, res) => {
 *     // Endpoint logic here
 *   }
 * }
 */
export default async function loadEndpoints(dir, app) {
  /**
   * Read directory contents synchronously
   * @type {Array<fs.Dirent>}
   */
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  /**
   * Array to collect endpoint metadata
   * @type {Array<Object>}
   */
  const endpoints = [];

  // Process each file/directory in the current directory
  for (const file of files) {
    /**
     * Full path to the current file/directory
     * @type {string}
     */
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      /**
       * Recursively load endpoints from subdirectory
       * @type {Array<Object>}
       */
      const subEndpoints = await loadEndpoints(fullPath, app);
      endpoints.push(...subEndpoints);
    } else if (file.isFile() && file.name.endsWith(".js")) {
      try {
        /**
         * Dynamically import the endpoint module
         * @type {Object}
         */
        const module = (await import(pathToFileURL(fullPath))).default;

        // Check if the module has the required run function
        if (typeof module.run === "function" || Array.isArray(module.run)) {
          /**
           * Generate the route path from the file system structure
           * @type {string}
           * @example
           * // File: /project/nv/users/get.js
           * // Route: /nv/users/get
           */
          const routePath = "/nv" + fullPath
            .replace(path.join(process.cwd(), "api"), "")
            .replace(/\.js$/, "")
            .replace(/\\/g, "/");

          /**
           * Supported HTTP methods for this endpoint
           * @type {Array<string>}
           * @default ["GET"]
           */
          const methods = module.methods || ["GET"];

          // Register each HTTP method with Express
          for (const method of methods) {
            /**
             * Register the route with Express
             * @param {string} routePath - The URL path for the endpoint
             * @param {Function} handler - The endpoint handler function
             */
            if (Array.isArray(module.run)) {
              app[method.toLowerCase()](routePath, ...module.run);
            } else {
              app[method.toLowerCase()](routePath, (req, res) => module.run(req, res));
            }
          }

          // Log successful endpoint loading
          // console.log(`●  Endpoint loaded: ${routePath} [${methods.join(", ")}]`);
          logger.endpoint(`${routePath} [${methods.join(", ")}]`)

          /**
           * Endpoint metadata object for documentation
           * @type {Object}
           */
          const endpointInfo = {
            name: module.name || path.basename(file.name, '.js'),
            description: module.description || "",
            category: module.category || "General",
            route: routePath,
            methods,
            params: module.params || [],
            paramsSchema: module.paramsSchema || {},
          };

          endpoints.push(endpointInfo);
        }
      } catch (error) {
        console.error(`Error loading endpoint ${fullPath}:`, error);
      }
    }
  }

  return endpoints;
}
