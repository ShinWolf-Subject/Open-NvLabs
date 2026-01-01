import { createCanvas, loadImage } from '@napi-rs/canvas';
import axios from 'axios';
import multer from 'multer';

/**
 * Middleware multer untuk menangani upload file gambar
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB maksimal
    files: 1 // Maksimal 1 file
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    allowedMimes.includes(file.mimetype) 
      ? cb(null, true)
      : cb(new Error('Hanya file gambar yang diizinkan (JPEG, PNG, GIF, WebP)'));
  }
});

export default {
  name: "Fake Call (Belum sempurna sorry)",
  description: "Generate fake call screenshot with custom profile picture",
  category: "Canvas",
  methods: ["POST"],
  params: ["nama", "time", "pp"],
  paramsSchema: {
    nama: {
      type: "string",
      required: true,
      description: "Nama yang ditampilkan pada layar panggilan"
    },
    time: {
      type: "string",
      required: true,
      description: "Durasi panggilan (format: HH:MM atau MM:SS)"
    },
    pp: {
      type: "file",
      required: true,
      description: "Foto profil (JPEG, PNG, GIF, WebP)",
      maxSize: "5MB"
    }
  },

  /**
   * Handler utama untuk generator Fake Call
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   */
  async run(req, res) {
    try {
      await this._handleFileUpload(req, res);
      const { nama, time } = this._extractRequestData(req);
      this._validateInput(nama, time);
      
      const canvasBuffer = await this._generateFakeCall(nama, time, req.file);
      return this._sendImageResponse(res, canvasBuffer, nama);
      
    } catch (error) {
      return this._handleError(res, error);
    }
  },

  /**
   * Menangani upload file menggunakan multer
   * @private
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async _handleFileUpload(req, res) {
    return new Promise((resolve, reject) => {
      upload.single("pp")(req, res, (err) => {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return reject({
              status: 400,
              message: 'File terlalu besar. Maksimal 5MB',
              error: 'Ukuran file melebihi batas maksimal'
            });
          }
          if (err.message && err.message.includes('Hanya file gambar')) {
            return reject({
              status: 400,
              message: err.message,
              error: 'Format file tidak didukung'
            });
          }
          return reject(err);
        }
        resolve();
      });
    });
  },

  /**
   * Mengekstrak data dari request
   * @private
   * @param {Object} req - HTTP request object
   * @returns {Object} - Data yang diekstrak
   */
  _extractRequestData(req) {
    return {
      nama: req.body.nama || req.body.name,
      time: req.body.time || req.body.waktu
    };
  },

  /**
   * Validasi input parameter
   * @private
   * @param {string} nama - Nama pemanggil
   * @param {string} time - Durasi panggilan
   */
  _validateInput(nama, time) {
    if (!nama || nama.trim() === '') {
      throw {
        status: 400,
        message: "Nama diperlukan",
        error: "Harap berikan nama untuk layar panggilan"
      };
    }

    if (nama.length > 20) {
      throw {
        status: 400,
        message: "Nama terlalu panjang",
        error: "Panjang nama maksimal 20 karakter",
        current_length: nama.length,
        max_length: 20
      };
    }

    if (!time || time.trim() === '') {
      throw {
        status: 400,
        message: "Waktu diperlukan",
        error: "Harap berikan durasi panggilan"
      };
    }

    // Validasi format waktu (HH:MM atau MM:SS)
    const timeRegex = /^([0-9]{1,2}):([0-9]{2})$/;
    if (!timeRegex.test(time)) {
      throw {
        status: 400,
        message: "Format waktu tidak valid",
        error: "Waktu harus dalam format HH:MM atau MM:SS",
        examples: ["00:17", "01:30", "12:45"]
      };
    }
  },

  /**
   * Membuat gambar fake call screenshot
   * @private
   * @param {string} nama - Nama pemanggil
   * @param {string} time - Durasi panggilan
   * @param {Object} file - File object dari multer
   * @returns {Promise<Buffer>} - Buffer gambar yang dihasilkan
   */
  async _generateFakeCall(nama, time, file) {
    try {
      const canvas = createCanvas(1080, 1920);
      const ctx = canvas.getContext('2d');

      // Load background image
      const bgUrl = 'https://img1.pixhost.to/images/11295/677498293_jarroffc.png';
      const bg = await loadImage(bgUrl);
      ctx.drawImage(bg, 0, 0, 1080, 1920);

      // Load profile picture dari buffer
      const ppBuffer = file.buffer;
      const pp = await loadImage(ppBuffer);

      // Gambar foto profil lingkaran
      const ppSize = 440;
      const centerX = 540;
      const centerY = 1040;

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, ppSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        pp,
        centerX - ppSize / 2,
        centerY - ppSize / 2,
        ppSize,
        ppSize
      );
      ctx.restore();

      // Tambahkan teks nama
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';

      // Hitung ukuran font berdasarkan panjang nama
      const nameFontSize = Math.min(72, 800 / nama.length);
      ctx.font = `bold ${nameFontSize}px Arial`;
      ctx.fillText(nama, 540, 260);

      // Tambahkan teks waktu
      ctx.font = '40px Arial';
      ctx.fillText(time, 540, 320);

      return canvas.toBuffer('image/png');
      
    } catch (error) {
      throw new Error(`Gagal membuat fake call: ${error.message}`);
    }
  },

  /**
   * Mengirim gambar sebagai response
   * @private
   * @param {Object} res - HTTP response object
   * @param {Buffer} imageBuffer - Buffer gambar yang dihasilkan
   * @param {string} nama - Nama pemanggil untuk nama file
   */
  _sendImageResponse(res, imageBuffer, nama) {
    // Bersihkan nama file dari karakter khusus
    const cleanName = nama.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const filename = `fakecall_${cleanName}_${Date.now()}.png`;

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.end(imageBuffer);
  },

  /**
   * Menangani error dan mengirim response error
   * @private
   * @param {Object} res - HTTP response object
   * @param {Error|Object} error - Error object
   */
  _handleError(res, error) {
    // Handle error yang sudah diformat
    if (error.status === 400) {
      const errorResponse = {
        success: false,
        message: error.message,
        error: error.error,
        timestamp: new Date().toISOString()
      };

      // Tambahkan detail validasi spesifik
      if (error.examples) errorResponse.examples = error.examples;
      if (error.current_length) errorResponse.current_length = error.current_length;
      if (error.max_length) errorResponse.max_length = error.max_length;

      return res.status(400).json(errorResponse);
    }

    const { statusCode, userMessage, tips } = this._classifyError(error);
    
    const errorResponse = {
      success: false,
      message: userMessage,
      error: error.message || "Unknown error",
      timestamp: new Date().toISOString(),
      tips: tips.length > 0 ? tips : ["Coba lagi nanti", "Periksa input anda"]
    };

    res.status(statusCode).json(errorResponse);
  },

  /**
   * Mengklasifikasikan error berdasarkan type
   * @private
   * @param {Error|Object} error - Error object
   * @returns {Object} - Klasifikasi error
   */
  _classifyError(error) {
    let statusCode = 500;
    let userMessage = "Terjadi kesalahan saat membuat fake call";
    let tips = [];

    if (error.message.includes('Gagal membuat fake call')) {
      statusCode = 500;
      userMessage = "Gagal membuat screenshot panggilan";
      tips = ["Gambar background mungkin tidak tersedia", "Coba gambar profil yang berbeda"];
    }
    else if (error.message.includes('loadImage') || error.message.includes('@napi-rs/canvas')) {
      statusCode = 500;
      userMessage = "Gagal memproses gambar";
      tips = ["Format gambar mungkin tidak didukung", "Coba gambar dengan format yang berbeda"];
    }
    else if (error.message.includes('buffer') || error.message.includes('Buffer')) {
      statusCode = 400;
      userMessage = "Gagal memproses file gambar";
      tips = ["File gambar mungkin rusak", "Upload ulang file gambar"];
    }
    else if (error.request && error.message.includes('http')) {
      statusCode = 502;
      userMessage = "Tidak dapat memuat gambar background";
      tips = ["Service background mungkin down", "Coba lagi nanti"];
    }

    return { statusCode, userMessage, tips };
  }
};
