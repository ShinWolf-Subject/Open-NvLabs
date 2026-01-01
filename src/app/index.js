import 'dotenv/config';
import express from "express";
import crypto from "crypto";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import logger from "../utils/logger.js";
import logApiRequest from "../utils/logApiRequest.js";
import loadEndpoints from "../utils/loader.js";
import setupMiddleware from "../middleware/index.js";
import setupResponseFormatter from "./responseFormatter.js";
import rateLimiter from '../middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(process.cwd(), "files");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// use multer to handle upload buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * Express application instance
 * @type {express.Application}
 */
const app = express();

// Configure application settings
app.set("trust proxy", true); 
app.set("json spaces", 3);

// Initialize middleware and response formatter
setupMiddleware(app);
setupResponseFormatter(app);

/**
 * Array to store all loaded API endpoints
 * @type {Array<Object>}
 */
let allEndpoints = [];

/**
 * Initializes the API server by loading endpoints and setting up routes
 * @async
 * @function initializeAPI
 * @returns {Promise<void>}
 */
(async function initializeAPI() {
  logger.info("Starting server initialization...");
  logger.info("Loading API endpoints...");

  allEndpoints = (await loadEndpoints(path.join(process.cwd(), "api"), app)) || [];

  logger.ready(`Loaded ${allEndpoints.length} endpoints`);

  setupRoutes(app, allEndpoints);
})();

/**
 * Sets up all routes for the Express application including API documentation and error handling
 * @function setupRoutes
 * @param {express.Application} app - The Express application instance
 * @param {Array<Object>} endpoints - Array of endpoint objects containing route information
 */
function setupRoutes(app, endpoints) {
  /**
   * GET /adm/nvrapi
   * @name GET /adm/nvrapi
   * @description Returns OpenAPI specification with all available endpoints
   * @route {GET} /adm/nvrapi
   * @param {express.Request} req - Express request object
   * @param {express.Response} res - Express response object
   * @returns {Object} JSON response containing API documentation
   * @returns {string} returns.title - API title
   * @returns {string} returns.description - API description
   * @returns {string} returns.baseURL - Base URL of the API
   * @returns {Array<Object>} returns.endpoints - Array of endpoint objects with enriched URL information
   */
  app.get("/adm/nvrapi", (req, res) => {
    const baseURL = `${req.protocol}://${req.get("host")}`;

    /**
     * Enriches endpoints with full URL information including query parameters
     * @type {Array<Object>}
     */
    const enrichedEndpoints = endpoints.map((ep) => {
      let url = baseURL + ep.route;
      if (ep.params && ep.params.length > 1) {
        const query = (ep.params || [])
          .map((p) => {
            // kalau p object, ambil field "name"
            const key = typeof p === "string" ? p : (p && p.name ? p.name : String(p));
            return `${key}=YOUR_${key.toUpperCase()}`;
          })
          .join("&");
        url += "?" + query;
      }
      return { ...ep, url };
    });

    res.status(201).json({
      title: "NvLabs API's.",
      creator: "NineTwelve",
      contributors: ["Nine", "Hiyeru", "Cony", "Kiyo"],
      description: "Comprehensive API documentation for developers with interactive testing",
      baseURL,
      contacts: {
        owner: ["https://wa.me/6282250423697", "banianjay004@gmail.com"],
        admin: ["https://t.me/Nine13fq", "allenwolfordftftkaoru@gmail.com"],
        github: "https://github.com/ShinWolf-Subject"
      },
      endpoints: enrichedEndpoints,
    });
  });

  /**
   * POST /admin/unban
   * @name POST /admin/unban
   * @description Unbans a previously blocked IP address. Requires valid admin key.
   * @route {POST} /admin/unban
   * @param {express.Request} req - Express request object containing `ip` in body or query
   * @param {express.Response} res - Express response object
   * @bodyParam {string} ip - The IP address to unban (required)
   * @header {string} X-Admin-Key - Admin key for authentication
   * @returns {Object} JSON response indicating success or failure
   * @example
   * // Request body
   * {
   *   "ip": "2.2.3.4"
   * }
   * 
   * // Response
   * {
   *   "success": true,
   *   "message": "IP 2.2.3.4 unbanned."
   * }
   */
  app.post("/admin/unban", express.json(), rateLimiter.adminUnbanHandler);

  /**
   * GET /
   * @name GET /
   * @description Serves the main index.html page
   * @route {GET} /
   * @param {express.Request} req - Express request object
   * @param {express.Response} res - Express response object
   * @returns {file} Sends the index.html file
   */
  app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
  });

  /**
   * GET /stats 
   * @name GET /stats 
   * @description Server Statistics
   * @route {GET} /stats 
   * @returns {file} JSON
   */
  app.get('/stats', (req, res) => {
    res.json({
      success: true,
      name: "NvLabs API",
      desc: "A free RESTful API Service",
      tips: "Jika ada masalah atau IP kena banned silahkan hubungi Owner",
      contacts: {
        whatsapp: "https://wa.me/6282250423697",
        telegram: "https://t.me/Nine13fq",
        email: "nvlabsoffc@gmail.com",
        github: "https://github.com/ShinWolf-Subject"
      },
      data: {
        endpoint: {
          total: `${allEndpoints.length}`,
          avaible: 61,
          error: 3,
          inProgres: 5
        }
      }
    })
  });

  /**
   * POST /files/upload
   * @description Upload file ke server (disimpan sementara di folder "files")
   * @route {POST} /files/upload
   * @param {Buffer} file - File binary dikirim lewat form-data field "file"
   * @returns {Object} JSON berisi URL akses file
   */
  app.post("/files/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(401).json({ success: false, message: "No file uploaded" });
    }
    // create random hex name
    const randomName = crypto.randomBytes(17).toString("hex") + path.extname(req.file.originalname);
    const filePath = path.join(uploadDir, randomName);
    // save file
    fs.writeFileSync(filePath, req.file.buffer);
    const fileUrl = `${req.protocol}://${req.get("host")}/files/${randomName}`;
    res.json({ url: fileUrl });
    // auto delete after 6 minutes
    setTimeout(() => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }, 6 * 60 * 1000);
  });

  /**
   * GET /files/:filename
   * @description Access uploaded files
   * @route {GET} /files/:filename
   * @returns {file} Sending the requested files
   */
  app.get("/files/:filename", (req, res) => {
    const filePath = path.join(uploadDir, req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(405).json({ message: "File not found or expired" });
    }
    res.sendFile(filePath);
  });
}

export default app;
