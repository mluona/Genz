import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import dotenv from "dotenv";
import * as cheerio from "cheerio";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy for auto-import (example: fetching RSS or scraping)
  app.get("/api/import/rss", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });
    try {
      const response = await axios.get(url as string);
      res.send(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch RSS" });
    }
  });

  app.get("/api/scrape/images", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      const response = await axios.get(url as string, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const $ = cheerio.load(response.data);
      const images: string[] = [];

      $('img').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
        if (src) {
          // Resolve relative URLs
          try {
            const absoluteUrl = new URL(src, url as string).href;
            if (absoluteUrl.match(/\.(jpg|jpeg|png|webp|gif|avif)/i) || absoluteUrl.includes('googleusercontent')) {
              images.push(absoluteUrl);
            }
          } catch (e) {
            // Skip invalid URLs
          }
        }
      });

      // Filter out small icons/avatars if possible, or just return all
      res.json({ images: [...new Set(images)] });
    } catch (error) {
      console.error("Scraping failed:", error);
      res.status(500).json({ error: "Failed to scrape images" });
    }
  });

  // Translation Proxy (Example using Google Translate or similar)
  app.post("/api/translate", async (req, res) => {
    const { text, target } = req.body;
    // This is a placeholder for actual translation logic
    // In a real app, you'd call Google Translate API or Gemini
    res.json({ translatedText: `[Translated to ${target}]: ${text}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
