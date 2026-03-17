import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function autoScroll(page: any) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const maxScrolls = 100;
      let scrolls = 0;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        scrolls++;
        if (totalHeight >= scrollHeight || scrolls >= maxScrolls) {
          clearInterval(timer);
          resolve(true);
        }
      }, 150);
    });
  });
}

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

  app.get("/api/scrape/auto", async (req, res) => {
    const { url, cookies, userAgent } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const urlString = url as string;

    // Check if it's a direct image URL first
    if (/\.(jpe?g|png|gif|webp|avif|bmp|tiff?|jfif|svg)(\?.*)?$/i.test(urlString)) {
      return res.json({
        type: 'chapter',
        url: urlString,
        images: [urlString],
        title: urlString.split('/').pop()?.split('?')[0] || 'Image'
      });
    }

    let browser;
    try {
      // Small random delay to mimic human behavior
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox", 
          "--disable-setuid-sandbox",
          "--disable-web-security",
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-blink-features=AutomationControlled",
          "--ignore-certificate-errors"
        ]
      });

      const page = await browser.newPage();
      
      // Set User Agent
      const sanitizedUserAgent = (userAgent as string || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
        .replace(/[^\x20-\x7E]/g, '')
        .trim();
      await page.setUserAgent(sanitizedUserAgent);

      // Set Referer and other headers
      try {
        const origin = new URL(urlString).origin;
        await page.setExtraHTTPHeaders({
          'Referer': origin,
          'Accept-Language': 'en-US,en;q=0.9'
        });
      } catch (e) { /* ignore invalid URL */ }

      // Set Cookies if provided
      if (cookies) {
        const cookieList = (cookies as string).split(';').map(pair => {
          const [name, ...value] = pair.trim().split('=');
          return {
            name,
            value: value.join('='),
            url: url as string
          };
        }).filter(c => c.name && c.value);
        
        if (cookieList.length > 0) {
          await page.setCookie(...cookieList);
        }
      }

      // Navigate to URL with retry logic for aborted requests
      try {
        const response = await page.goto(urlString, {
          waitUntil: "domcontentloaded",
          timeout: 45000
        });

        if (response && !response.ok() && response.status() !== 304) {
          console.warn(`[Scraper] Initial navigation returned status ${response.status()}`);
        }
      } catch (e: any) {
        console.warn(`[Scraper] Initial navigation failed: ${e.message}. Retrying with minimal wait...`);
        try {
          await page.goto(urlString, {
            waitUntil: "load",
            timeout: 30000
          });
        } catch (retryError: any) {
          // If it's still aborted, it might be a direct file or a very aggressive block
          if (!retryError.message.includes('ERR_ABORTED')) {
            throw retryError;
          }
          console.warn(`[Scraper] Retry also aborted. Continuing to see if content loaded anyway.`);
        }
      }

      // Check for Cloudflare challenge
      const isCloudflare = await page.evaluate(() => {
        return document.title.includes('Cloudflare') || 
               document.body.innerHTML.includes('checking your browser') ||
               document.body.innerHTML.includes('DDoS protection');
      });

      if (isCloudflare) {
        console.log("Cloudflare detected, waiting for challenge to resolve...");
        // Wait longer for the challenge to resolve automatically if possible
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Try to click the "I am human" checkbox if it exists (very basic attempt)
        try {
          const frames = page.frames();
          for (const frame of frames) {
            if (frame.url().includes('cloudflare')) {
              const checkbox = await frame.$('input[type="checkbox"]');
              if (checkbox) {
                await checkbox.click();
                await new Promise(resolve => setTimeout(resolve, 5000));
              }
            }
          }
        } catch (e) {
          console.log("Failed to interact with Cloudflare checkbox:", e);
        }
      }

      // Wait for network to settle
      try {
        await page.waitForNetworkIdle({ timeout: 15000 });
      } catch (e) {
        console.log("Network idle timeout, continuing anyway...");
      }

      // Wait a bit more for dynamic content
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Auto scroll to trigger lazy loading
      await autoScroll(page);
      
      // Wait another 2s after scroll for images to actually load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get HTML content after scrolling
      const html = await page.content();
      
      // Check if we are still on a Cloudflare page
      if (html.includes('cf-browser-verification') || html.includes('cf-challenge-running')) {
        throw new Error("Failed to bypass Cloudflare protection. Please try providing fresh cookies from your browser.");
      }

      const $ = cheerio.load(html);
      
      // Try to detect page type with more aggressive selectors
      let type = 'unknown';
      const seriesSelectors = [
        '.chapter-list', '.list-chapter', '#chapterlist', '.wp-manga-chapter', 
        '.list-chapters', '.chapters', '.chapter-name', '.listing-chapters_wrap',
        '.manga-info-chapters', '.series-chapter-list'
      ];
      const chapterSelectors = [
        '.chapter-content', '.read-content', '.vung-doc', '.page-break', 
        '.reading-content', '.reader-area', '.wp-manga-chapter-img',
        '.entry-content', '#readerarea', '.manga-reading-content'
      ];
      const listSelectors = [
        '.list-story', '.item-list', '.series-list', '.manga-item', 
        '.list-manga', '.grid-manga', '.manga-box', '.manga-list-wrapper',
        '.latest-updates', '.manga-grid'
      ];

      if ($(seriesSelectors.join(', ')).length > 0) type = 'series';
      else if ($(chapterSelectors.join(', ')).length > 0) type = 'chapter';
      else if ($(listSelectors.join(', ')).length > 0) type = 'list';
      
      // Fallback detection based on common elements
      if (type === 'unknown') {
        if ($('a[href*="chapter"]').length > 8) type = 'series';
        else if ($('img[src*="chapter"], img[data-src*="chapter"]').length > 3) type = 'chapter';
        else if ($('a[href*="manga/"]').length > 8 || $('a[href*="series/"]').length > 8) type = 'list';
      }

      const data: any = { type, url };

      if (type === 'series' || $('h1').length > 0) {
        data.title = $('h1').first().text().trim() || 
                     $('.story-info-right h1, .post-title, .entry-title, .title, .manga-title').first().text().trim();
        data.description = $('.story-info-right-description, .description, .summary, .post-content, .synopsis, .manga-excerpt, .manga-summary').text().trim();
        
        const coverSelectors = [
          '.info-image img', '.cover img', '.manga-info-pic img', 
          '.post-thumbnail img', '.thumb img', '.manga-poster img',
          '.summary_image img', '.manga-thumb img'
        ];
        
        const coverEl = $(coverSelectors.join(', ')).first();
        data.coverImage = coverEl.attr('data-src') || coverEl.attr('data-lazy-src') || coverEl.attr('src');
        
        // Resolve cover image
        if (data.coverImage) {
          try {
            data.coverImage = new URL(data.coverImage.trim(), url as string).href;
          } catch (e) { /* ignore */ }
        }

        // Chapters - handle multiple common structures
        const chapters: any[] = [];
        const chLinkSelectors = [
          '.chapter-list a', '.list-chapter a', '#chapterlist a', 
          '.wp-manga-chapter a', '.list-chapters a', '.chapters a',
          '.chapter-name a', '.ch-link', '.chapter-link', '.manga-chapters a'
        ];

        $(chLinkSelectors.join(', ')).each((i, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().trim() || $(el).attr('title');
          if (href && (href.includes('chapter') || href.includes('read') || href.includes('ep-') || /chapter|chap|ep|episode/i.test(href))) {
            try {
              const absoluteUrl = new URL(href, url as string).href;
              // Avoid duplicates
              if (!chapters.find(c => c.url === absoluteUrl)) {
                chapters.push({
                  title: text || `Chapter ${chapters.length + 1}`,
                  url: absoluteUrl,
                  chapterNumber: 0
                });
              }
            } catch (e) { /* ignore */ }
          }
        });
        
        if (chapters.length > 0) {
          data.type = 'series';
          // Try to extract chapter number from title if possible, otherwise use index
          data.chapters = chapters.reverse().map((ch, idx) => {
            const numMatch = ch.title.match(/(\d+(\.\d+)?)/);
            return { 
              ...ch, 
              chapterNumber: numMatch ? parseFloat(numMatch[1]) : idx + 1 
            };
          });
        }
      }

      if (type === 'list' || $(listSelectors.join(', ')).length > 0) {
        const series: any[] = [];
        const itemSelectors = [
          '.list-story .item', '.item-list .item', '.series-list .item', 
          '.manga-item', '.list-manga .item', '.grid-manga .item',
          '.manga-box', '.entry-item', '.manga-card', '.manga-item-wrapper'
        ];

        $(itemSelectors.join(', ')).each((i, el) => {
          const link = $(el).find('a').filter((i, a) => $(a).text().trim().length > 0).first();
          const title = link.text().trim() || $(el).find('h3, h2, .title').first().text().trim();
          const href = link.attr('href') || $(el).find('a').first().attr('href');
          const cover = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
          
          if (href && title && !href.includes('category') && !href.includes('tag')) {
            try {
              const absoluteUrl = new URL(href, url as string).href;
              if (!series.find(s => s.url === absoluteUrl)) {
                series.push({
                  title,
                  url: absoluteUrl,
                  coverImage: cover ? new URL(cover.trim(), url as string).href : null
                });
              }
            } catch (e) { /* ignore */ }
          }
        });
        if (series.length > 0) {
          data.type = 'list';
          data.series = series;
        }
      }

      if (type === 'chapter' || $(chapterSelectors.join(', ')).length > 0) {
        const images: string[] = [];
        // Prioritize high-quality attributes often used for lazy loading
        const imgSelectors = [
          '.chapter-content img', '.read-content img', '.vung-doc img', 
          '.page-break img', '.reading-content img', '.wp-manga-chapter-img img',
          '.reader-area img', '.entry-content img', '#readerarea img',
          '.manga-reading-content img', '.canvas-container img', '.chapter-video-frame img',
          '.rd-cnt img', '.reader-main img', '.chapter-img img'
        ];
        
        console.log(`[Scraper] Attempting to find images for chapter. Selectors: ${imgSelectors.length}`);
        
        $(imgSelectors.join(', ')).each((i, el) => {
          // Priority list for attributes that usually contain the high-res image
          const src = $(el).attr('data-original') || 
                      $(el).attr('data-src') || 
                      $(el).attr('data-lazy-src') || 
                      $(el).attr('data-src-img') ||
                      $(el).attr('data-full-url') ||
                      $(el).attr('data-srcset') ||
                      $(el).attr('src');

          if (src && !src.includes('logo') && !src.includes('banner') && !src.includes('avatar') && !src.includes('icon') && !src.includes('ads')) {
            try {
              // Handle srcset (take the first URL)
              const cleanSrc = src.split(' ')[0].trim();
              const absoluteUrl = new URL(cleanSrc, url as string).href;
              // Filter out common tracking pixels or tiny icons
              if (!absoluteUrl.includes('pixel') && !absoluteUrl.includes('analytics') && !absoluteUrl.includes('doubleclick') && !absoluteUrl.includes('google-analytics')) {
                images.push(absoluteUrl);
              }
            } catch (e) { /* ignore */ }
          }
        });
        
        // If still no images, try a broader search for all images in the body
        if (images.length === 0) {
          console.log(`[Scraper] No images found with specific selectors. Trying broad search...`);
          $('img').each((i, el) => {
            const src = $(el).attr('data-original') || $(el).attr('data-src') || $(el).attr('src');
            if (src && !src.includes('logo') && !src.includes('banner') && !src.includes('avatar') && !src.includes('icon') && !src.includes('ads')) {
              try {
                const absoluteUrl = new URL(src.trim(), url as string).href;
                if (!absoluteUrl.includes('pixel') && !absoluteUrl.includes('analytics')) {
                  images.push(absoluteUrl);
                }
              } catch (e) { /* ignore */ }
            }
          });
        }
        
        console.log(`[Scraper] Found ${images.length} images for chapter.`);
        
        if (images.length > 0) {
          data.type = 'chapter';
          data.images = [...new Set(images)];
        }
      }

      res.json(data);
    } catch (error: any) {
      console.error("Auto scraping failed:", error.message);
      res.status(500).json({ 
        error: "Failed to scrape website", 
        details: error.message,
        code: error.code
      });
    } finally {
      if (browser) await browser.close();
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
