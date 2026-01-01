export default {
  name: "HTML Getter",
  description: "Fetch raw HTML directly from target website",
  category: "Tools",
  methods: ["POST"],
  params: ["url"],
  paramsSchema: {
    url: {
      type: "string",
      required: true,
      minLength: 2
    }
  },

  async run(req, res) {
    try {
      const url = req.body?.url;

      if (!url) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'The parameter "url" is required'
        });
      }

      let response;
      try {
        response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept":
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          redirect: "follow"
        });
      } catch {
        return res.status(400).json({
          status: 400,
          success: false,
          message: "Failed to fetch target URL"
        });
      }

      const html = await response.text();
      const contentType =
        response.headers.get("content-type") || null;

      return res.status(response.status).json({
        status: response.status,
        success: response.ok,
        html,
        contentType
      });

    } catch (err) {
      console.error("HTML Getter error:", err);
      return res.status(500).json({
        status: 500,
        success: false,
        message: err.message || "Internal server error"
      });
    }
  }
};
