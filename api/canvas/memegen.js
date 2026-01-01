import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";
import axios from "axios";
import FormData from "form-data";

// Register font berdasarkan struktur folder proyek Anda
const fontPath = path.join(process.cwd(), "src", "services", "canvas", "font", "LEMONMILK-Bold.otf");

if (fs.existsSync(fontPath)) {
  GlobalFonts.registerFromPath(fontPath, "LEMONMILK");
}

function wrapText(context, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = context.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

function drawTextWithOutline(ctx, text, x, y, fillStyle = "white", strokeStyle = "black", lineWidth = 4) {
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);
  
  ctx.fillStyle = fillStyle;
  ctx.fillText(text, x, y);
}

export default {
  name: "Meme Generator",
  description: "Generate meme with top and bottom text and upload to Uguu.se",
  category: "Canvas",
  methods: ["GET", "POST"],
  params: ["imageUrl", "topText", "bottomText"],
  paramsSchema: {
    imageUrl: { type: "string", required: true, minLength: 1 },
    topText: { type: "string", required: false, default: "" },
    bottomText: { type: "string",  required: false, default: "" }
  },

  async run(req, res) {
    try {
      const imageUrl = req.method === "GET" ? req.query.imageUrl : req.body.imageUrl;
      const topText = req.method === "GET" ? req.query.topText : req.body.topText;
      const bottomText = req.method === "GET" ? req.query.bottomText : req.body.bottomText;

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          error: 'Parameter "imageUrl" is required'
        });
      }

      // 1. Download Background Image
      const imageResponse = await axios.get(imageUrl, { 
        responseType: "arraybuffer",
        timeout: 20000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });

      const imageBuffer = Buffer.from(imageResponse.data);
      const image = await loadImage(imageBuffer);

      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext("2d");

      ctx.drawImage(image, 0, 0, image.width, image.height);

      // 2. Styling Font
      const baseFontSize = Math.max(image.width * 0.08, 32);
      const fontFamily = GlobalFonts.families.some(f => f.family === "LEMONMILK") 
        ? "LEMONMILK" 
        : "Arial, sans-serif";
      
      ctx.font = `bold ${baseFontSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      const margin = image.width * 0.05;
      const maxWidth = image.width - (margin * 2);

      // Render Top Text
      if (topText && topText.trim()) {
        const topLines = wrapText(ctx, topText.toUpperCase(), maxWidth);
        const lineHeight = baseFontSize * 1.2;
        topLines.forEach((line, index) => {
          drawTextWithOutline(ctx, line, image.width / 2, margin + (index * lineHeight), "white", "black", baseFontSize * 0.08);
        });
      }

      // Render Bottom Text
      if (bottomText && bottomText.trim()) {
        const bottomLines = wrapText(ctx, bottomText.toUpperCase(), maxWidth);
        const lineHeight = baseFontSize * 1.2;
        const totalTextHeight = (bottomLines.length - 1) * lineHeight + baseFontSize;
        let startY = image.height - margin - totalTextHeight;

        bottomLines.forEach((line, index) => {
          drawTextWithOutline(ctx, line, image.width / 2, startY + (index * lineHeight), "white", "black", baseFontSize * 0.08);
        });
      }

      // 3. Convert to Buffer
      const buffer = canvas.toBuffer("image/png");

      // 4. Upload ke Uguu.se
      const formData = new FormData();
      formData.append('files[]', buffer, {
        filename: `meme_${Date.now()}.png`,
        contentType: 'image/png'
      });

      const uploadResponse = await axios.post('https://uguu.se/upload.php', formData, {
        headers: {
          ...formData.getHeaders()
        }
      });

      // Uguu.se mengembalikan data dalam array files[]
      if (uploadResponse.data && uploadResponse.data.success) {
        const fileInfo = uploadResponse.data.files[0];
        
        res.json({
          results: {
            url: fileInfo.url,
            name: fileInfo.name,
            hash: fileInfo.hash,
            size: fileInfo.size,
            mimetype: "image/png"
          },
          dimensions: {
            width: canvas.width,
            height: canvas.height
          },
          message: "Meme generated and uploaded to Uguu.se successfully!"
        });
      } else {
        throw new Error("Failed to upload to Uguu.se");
      }

    } catch (err) {
      console.error("Meme generation/upload error:", err.message);
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
        details: err.message
      });
    }
  },
};

