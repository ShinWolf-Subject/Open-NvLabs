import multer from "multer";

/**
 * Multer (memory)
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

export default {
  name: "What Anime Is This",
  description: "Identify anime scene using trace.moe",
  category: "Tools",
  methods: ["POST"],
  params: ["file"],
  paramsSchema: {
    file: {
      type: "file",
      required: true,
      accept: "image/*"
    }
  },

  async run(req, res) {
    try {
      // === HANDLE FILE ===
      await new Promise((resolve, reject) => {
        upload.single("file")(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (!req.file) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'The parameter "file" is required'
        });
      }

      const { buffer } = req.file;

      // === KIRIM KE TRACE.MOE ===
      const form = new FormData();
      form.append("image", new Blob([buffer]), "image.jpg");

      const traceRes = await fetch("https://api.trace.moe/search", {
        method: "POST",
        body: form
      });

      if (!traceRes.ok) {
        return res.status(traceRes.status).json({
          status: traceRes.status,
          success: false,
          message: "trace.moe request failed"
        });
      }

      const data = await traceRes.json();
      const result = data.result?.[0];

      if (!result) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: "Anime not found"
        });
      }

      // === RESPONSE TERSTRUKTUR (SATU-SATU) ===
      return res.status(200).json({
        status: 200,
        success: true,

        similarity: result.similarity,
        isAdult: result.is_adult,

        anime: {
          title: result.anilist?.title?.romaji || null,
          title_native: result.anilist?.title?.native || null,
          title_english: result.anilist?.title?.english || null,
          episode: result.episode,
          season: result.season,
          year: result.year
        },

        timestamp: {
          at: result.from,
          to: result.to
        },

        preview: {
          image: result.image,
          video: result.video
        }
      });

    } catch (err) {
      console.error("whatanime error:", err);

      return res.status(500).json({
        status: 500,
        success: false,
        message: err.message || "Internal server error"
      });
    }
  }
};
