import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import axios from 'axios';
import FormData from 'form-data';
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { promisify } from "util";

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const existsAsync = promisify(fs.exists);

export default {
  name: "ATT&P Video Generator",
  description: "Create animated text video with color changing effect using FFmpeg",
  category: "Canvas",
  methods: ["GET"],
  params: ["text"],
  paramsSchema: {
    text: { type: "string", required: true, minLength: 1 },
  },
  async run(req, res) {
    let tempDir = '';
    let frameFiles = [];

    try {
      const text = req.method === "GET" ? req.query.text : req.body.text;
      if (!text) return res.status(400).json({ error: 'Parameter "text" is required' });

      console.log(`Generating ATT&P video with text: "${text}"`);

      const width = 400, height = 400;
      const frames = 30, duration = 3;
      const fps = frames / duration;

      const fontPath = path.join(process.cwd(), "src", "services", "canvas", "font", "LEMONMILK-Bold.otf");
      if (!fs.existsSync(fontPath)) return res.status(500).json({ error: "Font not found" });
      GlobalFonts.registerFromPath(fontPath, "LEMONMILK");

      const fontSize = 48;
      const colors = ["#FF0000","#00FF00","#0000FF","#FFFF00","#00FFFF","#FF00FF",
                      "#FFA500","#800080","#008080","#FFC0CB","#FFD700","#00BFFF",
                      "#8A2BE2","#FF69B4","#B22222"];

      tempDir = path.join(process.cwd(), "files", Date.now().toString());
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      for (let i = 0; i < frames; i++) {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = colors[i % colors.length];
        ctx.font = `bold ${fontSize}px LEMONMILK`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const words = text.split(" ");
        let line = "", lines = [];
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + " ";
          const testWidth = ctx.measureText(testLine).width;
          if (testWidth > width - 40 && n > 0) {
            lines.push(line.trim());
            line = words[n] + " ";
          } else {
            line = testLine;
          }
        }
        lines.push(line.trim());

        const x = width / 2;
        let y = height / 2 - ((lines.length - 1) * fontSize) / 2;

        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;

        lines.forEach(l => {
          ctx.strokeText(l, x, y);
          ctx.fillText(l, x, y);
          y += fontSize;
        });

        const framePath = path.join(tempDir, `frame_${i.toString().padStart(4, "0")}.png`);
        await writeFileAsync(framePath, canvas.toBuffer("image/png"));
        frameFiles.push(framePath);
      }

      console.log(`Generated ${frames} frames, creating video...`);

      return new Promise((resolve, reject) => {
        const outputFileName = `attp_${Date.now()}.mp4`;
        const outputPath = path.join(tempDir, outputFileName);

        const ffmpegArgs = [
          "-y", "-framerate", fps.toString(),
          "-i", path.join(tempDir, "frame_%04d.png"),
          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-preset", "fast",
          outputPath
        ];

        const ffmpeg = spawn("ffmpeg", ffmpegArgs);
        let stderr = "";

        ffmpeg.stderr.on("data", data => stderr += data.toString());
        ffmpeg.on("close", async code => {
          // Clean up frame files
          try {
            for (const frame of frameFiles) {
              if (await existsAsync(frame)) {
                await unlinkAsync(frame);
              }
            }
            frameFiles = [];
          } catch (cleanupErr) {
            console.warn("Warning cleaning up frames:", cleanupErr.message);
          }

          if (code === 0) {
            if (!fs.existsSync(outputPath)) {
              if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
              }
              reject(new Error(`Video file not created: ${outputPath}`));
              return;
            }

            const fileStats = fs.statSync(outputPath);
            console.log(`Video created: ${fileStats.size} bytes`);
            
            // Upload ke endpoint lokal /nv/upldr/videy
            try {
              console.log(`📤 Uploading to videy.co via local endpoint...`);
              
              const formData = new FormData();
              formData.append('file', fs.createReadStream(outputPath), {
                filename: outputFileName,
                contentType: 'video/mp4'
              });

              // Gunakan host yang sama dengan server ini
              const baseUrl = `${req.protocol}://${req.get("host")}`;
              const uploadUrl = `${baseUrl}/nv/upldr/videy`;
              
              console.log(`Upload URL: ${uploadUrl}`);
              
              const uploadResponse = await axios.post(uploadUrl, formData, {
                headers: {
                  ...formData.getHeaders()
                },
                timeout: 120000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
              });

              // Clean up video file and temp directory
              try {
                if (fs.existsSync(outputPath)) {
                  await unlinkAsync(outputPath);
                }
                if (fs.existsSync(tempDir)) {
                  fs.rmSync(tempDir, { recursive: true, force: true });
                }
              } catch (cleanupErr) {
                console.warn("Warning cleaning up temp dir:", cleanupErr.message);
              }

              // Cek response dari endpoint videy
              if (uploadResponse.data && uploadResponse.data.success === true) {
                const videoData = uploadResponse.data.data;
                
                // Ambil data penting dari response
                return res.json({
                  results: { 
                    url: videoData.direct_url || videoData.url,
                    share_url: videoData.share_url,
                    thumbnail: videoData.thumbnail,
                    id: videoData.id,
                    filename: videoData.filename,
                    mimetype: videoData.mimetype,
                    size: videoData.size,
                    size_formatted: videoData.size_formatted,
                    storage: "videy.co"
                  },
                  text,
                  duration: `${duration}s`,
                  message: "ATT&P video created and uploaded to videy.co successfully!"
                });
              } else {
                throw new Error(uploadResponse.data?.message || 'Invalid response from videy endpoint');
              }
              
            } catch (uploadErr) {
              console.error("Upload error:", uploadErr.message);
              
              // Clean up on upload error
              try {
                if (fs.existsSync(tempDir)) {
                  fs.rmSync(tempDir, { recursive: true, force: true });
                }
              } catch (cleanupErr) {
                console.warn("Warning cleaning up on upload error:", cleanupErr.message);
              }
              
              // Fallback ke local storage jika upload gagal
              console.warn("Upload failed, falling back to local storage");
              
              const uploadDir = path.join(process.cwd(), "files");
              if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
              }

              const localFileName = `attp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
              const localFilePath = path.join(uploadDir, localFileName);
              fs.copyFileSync(outputPath, localFilePath);

              // Clean up temp file setelah copy
              if (fs.existsSync(outputPath)) {
                await unlinkAsync(outputPath);
              }
              if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
              }

              const fileUrl = `${req.protocol}://${req.get("host")}/files/${localFileName}`;

              // Auto delete after 5 minutes
              setTimeout(() => {
                if (fs.existsSync(localFilePath)) {
                  try {
                    fs.unlinkSync(localFilePath);
                  } catch (err) {
                    console.error("Error deleting file:", err);
                  }
                }
              }, 5 * 60 * 1000);

              return res.json({
                results: { 
                  url: fileUrl,
                  filename: localFileName,
                  mimetype: "video/mp4",
                  size: fileStats.size,
                  storage: "local",
                  note: `videy.co upload failed: ${uploadErr.message}`
                },
                text,
                duration: `${duration}s`,
                message: "ATT&P video created successfully (using local storage)"
              });
            }
          } else {
            if (fs.existsSync(tempDir)) {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
            reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
          }
        });

        ffmpeg.on("error", (err) => {
          reject(new Error(`FFmpeg process error: ${err.message}`));
        });
      });

    } catch (err) {
      console.error("ATT&P video error:", err);
      
      try {
        for (const frame of frameFiles) {
          if (fs.existsSync(frame)) {
            fs.unlinkSync(frame);
          }
        }
        if (tempDir && fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupErr) {
        console.warn("Warning cleaning up in catch block:", cleanupErr.message);
      }
      
      res.status(500).json({ 
        error: "Video generation failed",
        details: err.message 
      });
    }
  },
};
