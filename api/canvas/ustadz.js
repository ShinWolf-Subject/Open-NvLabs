import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import FormData from 'form-data'
import fetch from 'node-fetch'
import { Readable } from 'stream'

const FONT_NAME = "Inter"
const FONT_FILE = "Inter-Regular.ttf"
const fontPath = path.join(process.cwd(), "src", "services", "canvas", "font", FONT_FILE);

if (fs.existsSync(fontPath)) {
  GlobalFonts.registerFromPath(fontPath, FONT_NAME);
} else {
  console.warn(`Font file not found at: ${fontPath}. Using fallback font.`);
}

const templatePath = path.join(process.cwd(), 'src', 'services', 'canvas', 'ustadz.png')

const BOX = {
  x: 60,
  y: 55,
  width: 430,
  height: 120
}

const FONT_SIZE = 26
const LINE_HEIGHT = 32
const MAX_WORDS = 20
const MAX_LINES = 4

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let line = ''

  for (let word of words) {
    const testLine = line + word + ' '
    const testWidth = ctx.measureText(testLine).width

    if (testWidth > maxWidth && line !== '') {
      lines.push(line.trim())
      line = word + ' '
    } else {
      line = testLine
    }
  }

  if (line.trim()) lines.push(line.trim())
  return lines
}

async function generateUstadzImage(text) {
  const words = text.trim().split(/\s+/)
  if (words.length > MAX_WORDS) throw new Error(`Teks terlalu panjang! Maksimum ${MAX_WORDS} kata.`)

  if (!fs.existsSync(templatePath)) throw new Error(`Template image not found at: ${templatePath}`)
  const img = await loadImage(templatePath)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')

  ctx.drawImage(img, 0, 0)
  ctx.font = `${FONT_SIZE}px ${FONT_NAME}, sans-serif`
  ctx.fillStyle = 'black'
  ctx.textBaseline = 'top'

  const lines = wrapText(ctx, text, BOX.width)

  if (lines.length > MAX_LINES) {
    lines.length = MAX_LINES
    const last = lines[MAX_LINES - 1]
    lines[MAX_LINES - 1] = last.length > 3 ? last.slice(0, last.length - 3).trim() + '...' : last + '...'
  }

  const totalTextHeight = lines.length * LINE_HEIGHT
  const startY = BOX.y + (BOX.height - totalTextHeight) / 2 + 27 

  lines.forEach((line, i) => {
    const lineWidth = ctx.measureText(line).width
    const x = BOX.x + (BOX.width - lineWidth) / 2
    const y = startY + i * LINE_HEIGHT
    ctx.fillText(line, x, y)
  })

  return canvas.toBuffer('image/jpeg')
}

export default {
  name: "Ustadz Quote (Meme😂)",
  description: "Create Ustadz quote images based on image templates with automatically wrapped text.",
  category: "Canvas",
  methods: ["GET"],
  params: ["text"],
  paramsSchema: {
    text: { type: "string", required: true, minLength: 1 },
  },
  async run(req, res) {
    try {
      const text = req.method === "GET" ? req.query.text : req.body.text;
      if (!text) {
        return res.status(400).json({ error: 'Parameter "text" is required' });
      }

      console.log(`Generating Ustadz image with text: "${text.substring(0, 30)}..."`);
      
      const words = text.trim().split(/\s+/)
      if (words.length > MAX_WORDS) {
        return res.status(400).json({ error: `Text too long! Maximum ${MAX_WORDS} words, you entered ${words.length} words.` });
      }

      const imageBuffer = await generateUstadzImage(text);

      // Buat readable stream dari buffer
      const bufferStream = new Readable();
      bufferStream.push(imageBuffer);
      bufferStream.push(null);

      // Upload langsung ke NvCDN tanpa file temporary
      const formData = new FormData();
      const fileName = `ustadz_${crypto.randomBytes(8).toString("hex")}.jpeg`;
      
      formData.append("file", bufferStream, {
        filename: fileName,
        contentType: "image/jpeg",
        knownLength: imageBuffer.length
      });

      const uploadResponse = await fetch("https://nvcdn.vercel.app/upload", {
        method: "POST",
        body: formData,
        headers: formData.getHeaders(),
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`NvCDN upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();

      res.json({
        success: true,
        results: { 
          url: uploadResult.data.accessUrl,
          filename: uploadResult.data.originalName,
          mimetype: uploadResult.data.mimeType,
          size: uploadResult.data.size,
          formattedSize: uploadResult.data.formattedSize,
          expiresAt: uploadResult.data.expiresAt,
          deleteUrl: uploadResult.data.deleteUrl,
          infoUrl: uploadResult.data.infoUrl
        },
        text,
        lines: wrapText({ measureText: () => ({ width: 0 }) }, text, BOX.width).length,
        message: "Ustadz quote image created and uploaded to CDN successfully!"
      });

    } catch (err) {
      console.error("Ustadz image generator/upload error:", err);
      const statusCode = err.message.includes('too long') || err.message.includes('not found') || err.message.includes('NvCDN') ? 400 : 500;
      res.status(statusCode).json({ 
        success: false,
        error: err.message 
      });
    }
  }
};
