import WebMusicScraper from "../../src/services/class/webmusicscraper.js";

export default {
  name: "Web Music",
  description: "Download special media from the website webmusic.co.in",
  category: "Downloader",
  methods: ["GET"],
  params: ["url"],
  paramsSchema: {
    url: { type: "string", required: true, minLength: 1 },
  },
  async run(req, res) {
    try {
      const url = req.method === "GET" ? req.query.url : req.body.url;

      if (!url) {
        return res
          .status(400)
          .json({ error: 'The parameter "url" is required' });
      }

      const scraper = new WebMusicScraper()
      const results = await scraper.download(url);

      return res.status(200).json({
        results,
      });
    } catch (error) {
      return res.status(500).json({
        error: `${error.message}`,
      });
    }
  },
};