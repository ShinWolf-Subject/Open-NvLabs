import axios from "axios";

export default {
  name: "Pinterest",
  description: "Download image or video from Pinterest",
  category: "Downloader",
  methods: ["POST"],
  params: ["url"],
  paramsSchema: {
    url: { type: "string", required: true, minLength: 1 },
  },

  async run(req, res) {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'The parameter "url" is required',
        });
      }

      const response = await axios.post(
        "https://pin-dl.vercel.app/",
        { url },
        {
          headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      const r = response.data;

      // mapping urls satu-satu
      const urls = Array.isArray(r.data?.urls)
        ? r.data.urls.map((item) => ({
            url: item.url,
            type: item.type,
            alt: item.alt || "",
          }))
        : [];

      return res.status(200).json({
        status: response.status,

        success: r.status === "success",
        message: r.message,

        data: {
          type: r.data.type,
          urls,
          downloadLink: r.data.downloadLink,
          metadata: {
            title: r.data.metadata.title,
            source: r.data.metadata.source,
          },
          timestamp: r.data.timestamp,
        },

        timestamp: r.timestamp,
      });
    } catch (error) {
      return res.status(500).json({
        status: error.response?.status || 500,
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          "Internal Server Error",
      });
    }
  },
};
