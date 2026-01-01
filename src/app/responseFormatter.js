/**
 * Sets up a custom response formatter middleware that wraps all JSON responses
 * with a standardized format including status codes, timestamps, and attribution
 * @function setupResponseFormatter
 * @param {express.Application} app - The Express application instance
 * @returns {void}
 * 
 * @example
 * // Usage in main server file:
 * import setupResponseFormatter from './responseFormatter.js';
 * const app = express();
 * setupResponseFormatter(app);
 * 
 * @description
 * This middleware intercepts all JSON responses and wraps them in a consistent format.
 * It adds status codes, timestamps for successful responses, and attribution information.
 * The middleware modifies the res.json() method to automatically format responses.
 * 
 * @middleware
 * @order Should be applied after route handlers but before error handling middleware
 * 
 * @responseFormat
 * For successful responses (200-299):
 * {
 *   statusCode: number,
 *   timestamp: string,
 *   attribution: string,
 *   ...originalData
 * }
 * 
 * For error responses (300+):
 * {
 *   statusCode: number,
 *   ...originalData
 * }
 */
export default function setupResponseFormatter(app) {
  app.use((req, res, next) => {
    /**
     * Store the original res.json method for later invocation
     * @type {Function}
     */
    const originalJson = res.json;
    
    /**
     * Override the res.json method to format responses consistently
     * @function res.json
     * @param {*} data - The data to be sent as JSON response
     * @returns {express.Response} The modified response object
     * 
     * @override
     * @description
     * Wraps the response data in a standardized format that includes:
     * - statusCode: The HTTP status code from the response
     * - timestamp: ISO timestamp (only for successful responses)
     * - attribution: Developer attribution (only for successful responses)
     * - Original response data is spread into the response object
     */
    res.json = function (data) {
      // Only format if data is an object (not null, array, or primitive)
      if (data && typeof data === "object") {
        /**
         * Get the current status code or default to 200
         * @type {number}
         */
        const statusCode = res.statusCode || 200;
        
        /**
         * Base response object with status code and original data
         * @type {Object}
         */
        const responseData = {
          statusCode,
          ...data,
        };

        // Add additional fields only for successful responses (2xx status codes)
        if (statusCode >= 200 && statusCode < 300) {
          /**
           * ISO timestamp of when the response was generated
           * @type {string}
           */
          responseData.timestamp = new Date().toISOString();
          
          /**
           * Developer attribution credit
           * @type {string}
           */
          responseData.creator = "•@NvLabs";
        }

        // Call the original json method with the formatted data
        return originalJson.call(this, responseData);
      }
      
      // For non-object data, use the original json method unchanged
      return originalJson.call(this, data);
    };
    
    // Proceed to the next middleware
    next();
  });
}
