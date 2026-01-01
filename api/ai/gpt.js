import GptService from "../../src/services/ai/gptService.js";

export default {
  name: "GPT Chat",
  description: "Endpoint for chat with GPT",
  category: "AI",
  methods: ["GET", "POST"],
  params: ["question", "prompt"],
  paramsSchema: {
    question: { type: "string", required: true, minLength: 1 },
    prompt: { type: "string", required: true, minLength: 1 },
  },
  async run(req, res) {
    try {
      const { question, prompt } = req.method === "GET" ? req.query : req.body;

      if (!question || typeof question !== "string") {
        return res.status(400).json({
          success: false,
          error: "Parameter 'question' wajib diisi.",
        });
      }

      const results = await GptService.process(question, { prompt: prompt || "gpt-4" });

      res.json({ results });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  },
};