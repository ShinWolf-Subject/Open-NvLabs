/**
 * @file Rate limiting middleware with IP banning capabilities
 * @module rateLimiter
 * @description Provides rate limiting functionality with persistent IP banning, 
 * request logging, and admin management features.
 */
import 'dotenv/config';
import fs from "fs";
import path from "path";

/**
 * Directory path for data storage
 * @constant {string}
 */
const DATA_DIR = path.join(process.cwd(), "data");

/**
 * Directory path for log files
 * @constant {string}
 */
const LOG_DIR = path.join(process.cwd(), "logs");

/**
 * File path for banned IPs storage
 * @constant {string}
 */
const BANNED_FILE = path.join(DATA_DIR, "banned-ips.json");

/**
 * File path for request logs
 * @constant {string}
 */
const REQUEST_LOG = path.join(LOG_DIR, "requests.log");

/**
 * Time window for rate limiting in milliseconds (default: 10 seconds)
 * @constant {number}
 */
const WINDOW_MS = 10 * 1000;

/**
 * Maximum number of requests allowed per time window (default: 25)
 * @constant {number}
 */
const MAX_REQUESTS = 25;

/**
 * Interval for cleaning up old timestamps in milliseconds (default: 60 seconds)
 * @constant {number}
 */
const CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * Map storing IP addresses and their request timestamps
 * @type {Map<string, number[]>}
 */
const ipTimestamps = new Map();

/**
 * Object storing banned IP information loaded from file
 * @type {Object}
 * @property {string} bannedAt - ISO timestamp when IP was banned
 * @property {string} reason - Reason for banning
 * @property {string} by - Entity that performed the ban
 */
let banned = {};

/**
 * Ensures required directories and files exist
 * @function ensureFiles
 */
function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);
  if (!fs.existsSync(BANNED_FILE)) fs.writeFileSync(BANNED_FILE, JSON.stringify({}, null, 2));
  if (!fs.existsSync(REQUEST_LOG)) fs.writeFileSync(REQUEST_LOG, "");
}
ensureFiles();

/**
 * Loads banned IP list from disk storage
 * @function loadBanned
 */
function loadBanned() {
  try {
    const raw = fs.readFileSync(BANNED_FILE, "utf8");
    banned = raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Failed to load banned ips file:", err);
    banned = {};
  }
}
loadBanned();

/**
 * Saves banned IP list to disk storage
 * @function saveBanned
 */
function saveBanned() {
  try {
    fs.writeFileSync(BANNED_FILE, JSON.stringify(banned, null, 2));
  } catch (err) {
    console.error("Failed to save banned ips file:", err);
  }
}

/**
 * Appends a log entry to the request log file
 * @function appendLog
 * @param {string} line - The log line to append
 */
function appendLog(line) {
  try {
    fs.appendFileSync(REQUEST_LOG, line + "\n");
  } catch (err) {
    console.error("Failed to append request log:", err);
  }
}

/**
 * Bans an IP address permanently with specified reason
 * @function banIp
 * @param {string} ip - IP address to ban
 * @param {string} [reason="rate_limit_exceeded"] - Reason for banning
 */
function banIp(ip, reason = "rate_limit_exceeded") {
  const now = new Date().toISOString();
  banned[ip] = {
    bannedAt: now,
    reason,
    by: "rateLimiter",
  };
  saveBanned();
  appendLog(`[BAN] ${now} ${ip} reason=${reason}`);
}

/**
 * Removes an IP address from the banned list
 * @function unbanIp
 * @param {string} ip - IP address to unban
 * @returns {boolean} True if IP was unbanned, false if IP wasn't found
 */
function unbanIp(ip) {
  if (banned[ip]) {
    const now = new Date().toISOString();
    delete banned[ip];
    saveBanned();
    appendLog(`[UNBAN] ${now} ${ip}`);
    return true;
  }
  return false;
}

/**
 * Cleans up old timestamps beyond the current time window
 * @function cleanup
 */
function cleanup() {
  const now = Date.now();
  for (const [ip, arr] of ipTimestamps.entries()) {
    const filtered = arr.filter((t) => now - t <= WINDOW_MS);
    if (filtered.length === 0) ipTimestamps.delete(ip);
    else ipTimestamps.set(ip, filtered);
  }
}

// Run periodic cleanup
setInterval(cleanup, CLEANUP_INTERVAL_MS);

/**
 * Mendapatkan alamat IP asli dari client yang melakukan request.
 *
 * Fungsi ini mencoba mengambil IP publik pengguna dengan urutan prioritas:
 * 1. Header `X-Forwarded-For` → biasanya diisi oleh proxy/CDN (Nginx, Vercel, Cloudflare, dll).
 *    - Bisa berisi banyak IP (proxy chain), maka diambil IP pertama sebagai IP asli client.
 * 2. Properti `req.ip` → IP yang dikenali Express (butuh `app.set("trust proxy", true)` agar valid).
 * 3. Properti `req.socket.remoteAddress` → fallback dari Node.js jika tidak ada header proxy.
 * 4. Jika semua gagal, return string `"unknown"`.
 *
 * Catatan:
 * - Pastikan `trust proxy` diaktifkan pada konfigurasi Express agar header `X-Forwarded-For` dipercaya.
 * - IP yang didapat bisa berupa IPv4 (contoh: 103.46.5.45) atau IPv6 (::1).
 * - Fungsi ini berguna untuk logging, rate limiting, dan fitur ban IP agar tidak hanya membaca `127.0.0.1`.
 *
 * @param {import("express").Request} req - Objek request dari Express.
 * @returns {string} IP asli client (publik atau lokal).
 */
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Rate limiter middleware factory function
 * @function rateLimiterMiddleware
 * @param {Object} [options={}] - Configuration options
 * @param {number} [options.maxRequests=MAX_REQUESTS] - Maximum requests per window
 * @param {number} [options.windowMs=WINDOW_MS] - Time window in milliseconds
 * @returns {Function} Express middleware function
 */
function rateLimiterMiddleware(options = {}) {
  const maxReq = options.maxRequests || MAX_REQUESTS;
  const windowMs = options.windowMs || WINDOW_MS;

  return (req, res, next) => {
    // Dapatkan IP (Express menggunakan trust proxy jika dikonfig sebelumnya di index.js)
     const ip = getClientIp(req);

    // Kalau sudah dibanned -> langsung blokir
    if (banned[ip]) {
      const info = banned[ip];
      res.status(403).json({
        success: false,
        error: "Your IP has been blocked due to abuse or rate limit violations.",
        note: "Contact the owner to request unblocking.",
        bannedAt: info.bannedAt,
        reason: info.reason,
        owner: ["https://wa.me/6282250423696", "https://t.me/Nine12fq", "banianjay004@gmail.com"],
      });
      appendLog(`[BLOCKED_REQ] ${new Date().toISOString()} ${ip} path=${req.path} method=${req.method} - blocked`);
      return;
    }

    // Simpan timestamp
    const now = Date.now();
    const arr = ipTimestamps.get(ip) || [];
    arr.push(now);

    // Buang timestamp yang lebih tua dari window
    const recent = arr.filter((t) => now - t <= windowMs);
    ipTimestamps.set(ip, recent);

    // Logging minimal (append)
    appendLog(`[REQ] ${new Date().toISOString()} ${ip} ${req.method} ${req.path} count=${recent.length}`);

    if (recent.length > maxReq) {
      // Langsung ban IP
      banIp(ip, `exceeded_${maxReq}_per_${windowMs}ms`);
      res.status(429).json({
        success: false,
        error: `Rate limit exceeded - your IP has been blocked. Max ${maxReq} requests per ${windowMs/1000}s.`,
        note: "Contact the owner to request unblocking.",
        owner: ["https://wa.me/6282250423696", "https://t.me/Nine12fq", "banianjay004@gmail.com"],
      });
      return;
    }

    next();
  };
}

/**
 * Admin handler for unbanning IP addresses
 * @function adminUnbanHandler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {void}
 */
function adminUnbanHandler(req, res) {
  const adminKey = process.env.ADMIN_KEY || null;
  const provided = req.headers["x-admin-key"] || req.body?.adminKey || req.query?.adminKey;

  if (!adminKey) {
    return res.status(500).json({ success: false, error: "ADMIN_KEY not configured on server." });
  }

  if (!provided || provided !== adminKey) {
    return res.status(401).json({ success: false, error: "Unauthorized. Provide valid admin key in X-Admin-Key header." });
  }

  const { ip } = req.body;
  if (!ip) return res.status(400).json({ success: false, error: "Provide ip in request body to unban." });

  const ok = unbanIp(ip);
  if (ok) return res.json({ success: true, message: `IP ${ip} unbanned.` });
  return res.status(404).json({ success: false, error: `IP ${ip} not found in ban list.` });
}

/**
 * Returns the current banned IP list
 * @function getBannedList
 * @returns {Object} Object containing banned IP information
 */
function getBannedList() {
  return banned;
}

/**
 * Returns statistics about active IPs and banned count
 * @function getStats
 * @returns {Object} Statistics object
 * @returns {number} returns.activeIps - Number of active IPs being tracked
 * @returns {number} returns.bannedCount - Number of banned IPs
 */
function getStats() {
  return {
    activeIps: ipTimestamps.size,
    bannedCount: Object.keys(banned).length,
  };
}

/**
 * @namespace rateLimiter
 * @description Main rate limiter module exports
 */
export default {
  /**
   * Pre-configured rate limiter middleware instance
   * @member {Function}
   */
  middleware: rateLimiterMiddleware(),
  
  /**
   * Admin handler for unbanning IP addresses
   * @member {Function}
   */
  adminUnbanHandler,
  
  /**
   * Function to get banned IP list
   * @member {Function}
   */
  getBannedList,
  
  /**
   * Function to get rate limiter statistics
   * @member {Function}
   */
  getStats,
  
  /**
   * Function to ban an IP programmatically
   * @member {Function}
   */
  banIp,
  
  /**
   * Function to unban an IP programmatically
   * @member {Function}
   */
  unbanIp,
};
