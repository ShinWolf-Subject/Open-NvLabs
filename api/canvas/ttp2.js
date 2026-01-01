import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import axios from 'axios';
import FormData from 'form-data';
import path from "path";
import fs from "fs";

export default {                                    
  name: "Text to Image (White BG, Black Stroke)",
  description: "Create white background image with text using LemonMilk font",
  category: "Canvas",
  methods: ["GET"],
  params: ["text"],
  paramsSchema: { text: { type: "string", required: true, minLength: 1 } },
  async run(req, res) {
    try {
      const text = req.method === "GET" ? req.query.text : req.body.text;
      if (!text) return res.status(400).json({ error: 'Parameter "text" is required' });

      console.log(`Generating image with text: "${text}"`);

      // Load font
      const fontPath = path.join(process.cwd(), "src", "services", "canvas", "font", "LEMONMILK-Bold.otf");
      if (!fs.existsSync(fontPath)) return res.status(500).json({ error: "Font not found" });
      GlobalFonts.registerFromPath(fontPath, "LEMONMILK");

      // Create canvas
      const size = 400;
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);

      // Text styling
      ctx.font = "bold 42px LEMONMILK";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;

      // Draw text
      const x = size / 2;
      const y = size / 2;
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);

      // Convert to buffer
      const buffer = canvas.toBuffer("image/png");
      
      // Upload to NvCloud directly
      const formData = new FormData();
      formData.append('file', buffer, {
        filename: `text-image-${Date.now()}.png`,
        contentType: 'image/png'
      });
      
      const uploadResponse = await axios.post('https://ncxdnt.vercel.app/upload', formData, {
        headers: {
          'nv-token': 'ncxdn',
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      if (!uploadResponse.data.success) {
        throw new Error(uploadResponse.data.message || 'Upload failed');
      }

      const uploadData = uploadResponse.data.data;
      
      res.json({
        results: { 
          url: uploadData.url || uploadData.access_url, 
          id: uploadData.id,
          filename: uploadData.filename || uploadData.originalName,
          mimetype: uploadData.mimeType || "image/png",
          size: uploadData.size
        },
        text,
        message: "Text image created and uploaded to NvCloud successfully!"
      });

    } catch (err) {
      console.error("Text image error:", err);
      res.status(500).json({ error: err.message });
    }
  }
};
