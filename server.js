// server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import admin from "firebase-admin";
import { fileURLToPath } from "url";
import cron from "node-cron";
import axios from "axios";
import * as cheerio from "cheerio";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ---------------- FIREBASE ----------------
const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  console.error("Missing serviceAccountKey.json in project root.");
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();
const fcm = admin.messaging();

// ---------------- EXPRESS ----------------
const app  = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "frontend")));

const PORT = process.env.PORT || 3000;

// ---------------- EMAIL (nodemailer) ----------------
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const NOTIFICATION_FROM = process.env.NOTIFICATION_FROM || `Price Tracker <no-reply@localhost>`;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

// ---------------- HELPERS ----------------
function extractASIN(url) {
  if (!url) return null;
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /\/([A-Z0-9]{10})(?:[/?]|$)/i,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function priceTextToNumber(txt) {
  if (!txt) return null;
  const n = Number(String(txt).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Puppeteer scrape (returns {title, priceText, image})
async function scrapeAmazon(url) {
  console.log("Launching Puppeteer for", url);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();

    // full user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

    // IMPORTANT: wait for price to appear
    await page.waitForSelector(".a-price .a-offscreen", { timeout: 15000 });

    const data = await page.evaluate(() => {
      const title = document.querySelector("#productTitle")?.innerText?.trim() || null;

      const price =
        document.querySelector(".a-price .a-offscreen")?.innerText?.trim() ||
        null;

      const image =
        document.querySelector("#landingImage")?.src ||
        document.querySelector("#imgTagWrapperId img")?.src ||
        null;

      return { title, price, image };
    });

    if (!data.title || !data.price) {
      throw new Error("Missing title or price");
    }

    return {
      title: data.title,
      priceText: data.price,
      image: data.image
    };

  } finally {
    await browser.close();
  }
}

// Email + Push helpers
async function sendEmail(to, subject, html, text) {
  if (!to || !transporter.options.auth) return;
  try {
    await transporter.sendMail({ from: NOTIFICATION_FROM, to, subject, text, html });
    console.log("Email sent to", to);
  } catch (err) {
    console.error("Email error:", err?.message || err);
  }
}

async function sendPush(token, title, body, data = {}) {
  if (!token) return;
  try {
    await fcm.send({
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k,v])=>[k, String(v)]))
    });
    console.log("Push sent to token");
  } catch (err) {
    console.error("Push error:", err?.message || err);
  }
}

// ---------------- API: Manual fetch (scrape & save) ----------------
app.post("/api/fetch", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.includes("amazon.")) return res.status(400).json({ error: "Invalid Amazon URL" });

    const asin = extractASIN(url);
    if (!asin) return res.status(400).json({ error: "ASIN not found in URL" });

    const { title, priceText, image } = await scrapeAmazon(url);

    if (!priceText || !title) return res.status(500).json({ error: "Failed to extract product or price" });

    const price = priceTextToNumber(priceText);
    if (price === null) return res.status(500).json({ error: "Could not parse price" });

    const ref = db.collection("products").doc(asin);
    await ref.set({
      asin,
      url,
      title,
      image,
      last_price: price,
      last_price_text: priceText,
      updated_at: new Date()
    }, { merge: true });

    await ref.collection("history").add({ price, price_text: priceText, timestamp: new Date() });

    return res.json({ success: true, asin, title, price, image });
  } catch (err) {
    console.error("Manual fetch error:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Fetch failed" });
  }
});

// ---------------- API: Get price history ----------------
app.get("/api/prices/:asin", async (req, res) => {
  try {
    const { asin } = req.params;
    const snap = await db.collection("products").doc(asin).collection("history").orderBy("timestamp", "asc").get();
    const history = snap.docs.map(d => {
      const data = d.data();
      return {
        price: data.price,
        price_text: data.price_text || null,
        timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : null
      };
    });
    res.json(history);
  } catch (err) {
    console.error("Prices error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to load history" });
  }
});

// ---------------- API: Watchers (add / delete) ----------------
app.post("/api/watch", async (req, res) => {
  try {
    const { asin, email, fcmToken, target_price } = req.body;
    if (!asin || typeof target_price !== "number") return res.status(400).json({ error: "asin & numeric target_price required" });

    const ref = db.collection("products").doc(asin).collection("watchers").doc();
    await ref.set({ email: email || null, fcmToken: fcmToken || null, target_price, notified: false, created_at: new Date() });
    res.json({ success: true, watcherId: ref.id });
  } catch (err) {
    console.error("Watch add error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to add watcher" });
  }
});

app.delete("/api/watch/:asin/:watcherId", async (req, res) => {
  try {
    const { asin, watcherId } = req.params;
    await db.collection("products").doc(asin).collection("watchers").doc(watcherId).delete();
    res.json({ success: true });
  } catch (err) {
    console.error("Watch delete error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to delete watcher" });
  }
});
// Get all alerts with product info
app.get("/api/user/alerts", async (req, res) => {
  try {
    const productsSnapshot = await db.collection("products").get();
    const alerts = [];

    for (const doc of productsSnapshot.docs) {
      const asin = doc.id;
      const product = doc.data();
      const watchersSnap = await doc.ref.collection("watchers").get();

      watchersSnap.forEach(w => {
        alerts.push({
          watcherId: w.id,
          asin,
          title: product.title,
          image: product.image,
          url: product.url,
          target_price: w.data().target_price,
        });
      });
    }

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: "Failed to load alerts" });
  }
});


// ---------------- Barcode route (OpenFoodFacts -> Amazon search) ----------------
function makeKeywords(name) {
  if (!name) return [];
  return name.toLowerCase().split(/[\s\-_,()]+/).filter(w => w.length > 2 && !["the","for","and","with","from","pack","size"].includes(w));
}

app.get("/api/product/barcode/:barcodeNumber", async (req, res) => {
  const { barcodeNumber } = req.params;
  console.log("Scanning barcode:", barcodeNumber);

  try {
    const offUrl = `https://world.openfoodfacts.org/api/v0/product/${barcodeNumber}.json`;
    const offRes = await axios.get(offUrl).catch(()=>null);
    const offData = offRes?.data;

    if (!offData || offData.status !== 1) {
      return res.status(404).json({ error: "Product not found in OpenFoodFacts." });
    }

    const p = offData.product;
    const productName = p.product_name || "";
    const brand       = (p.brands || "").split(",")[0].trim() || "Unknown Brand";
    const baseImage   = p.image_front_url || p.image_url || p.image_thumb_url || "";

    // Amazon best-match (search + cheerio)
    let amazonPrice = "N/A";
    let amazonUrl = "";
    let amazonImage = "";

    const brandLower = brand.toLowerCase();
    const nameKeywords = makeKeywords(productName);

    if (productName) {
      try {
        const searchQuery = `${brand} ${productName}`.trim();
        const searchUrl   = `https://www.amazon.in/s?k=${encodeURIComponent(searchQuery)}`;

        const searchResp = await axios.get(searchUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept-Language": "en-IN,en;q=0.9"
          },
        });

        const $ = cheerio.load(searchResp.data);
        const results = $("div.s-result-item[data-component-type='s-search-result']");

        let bestMatchEl = null, bestScore = -1, bestText = "";

        results.each((i, el) => {
          const title = $(el).find("h2 span").text().trim().toLowerCase();
          if (!title) return;
          if (brandLower && !title.includes(brandLower)) return;

          let score = 0;
          nameKeywords.forEach(k => { if (title.includes(k)) score += 2; });
          if (score === 0 && brandLower && title.includes(brandLower)) score = 1;

          if (score > bestScore) {
            bestScore = score;
            bestMatchEl = el;
            bestText = title;
          }
        });

        if (bestMatchEl && bestScore >= 2) {
          const el = cheerio.load(bestMatchEl);
          const priceWhole = el(".a-price-whole").first().text().trim();
          const priceFrac  = el(".a-price-fraction").first().text().trim();
          if (priceWhole) amazonPrice = "₹" + priceWhole + (priceFrac ? "." + priceFrac : "");
          let relative = el("a.a-link-normal.s-no-outline").attr("href") || el("h2 a").attr("href") || "";
          if (relative) {
            amazonUrl = relative.startsWith("http") ? relative : "https://www.amazon.in" + relative;
            try {
              const productHtml = (await axios.get(amazonUrl, { headers: { "User-Agent":"Mozilla/5.0", "Accept-Language":"en-IN,en;q=0.9" } })).data;
              const $$ = cheerio.load(productHtml);
              amazonImage = $$("#landingImage").attr("src") || $$("#imgTagWrapperId img").attr("src") || "";
            } catch (err) {
              console.log("Failed to fetch product page image:", err?.message || err);
            }
          }
        } else {
          console.log("No strong Amazon match (score:", bestScore, ")");
        }
      } catch (err) {
        console.log("Amazon search error:", err?.message || err);
      }
    }

    res.json({
      product: {
        name: productName || "Unknown",
        brand,
        price: amazonPrice,
        image_url: amazonImage || baseImage,
        url: amazonUrl || `https://www.amazon.in/s?k=${encodeURIComponent(`${brand} ${productName}`.trim())}`,
        barcode: barcodeNumber
      }
    });
  } catch (err) {
    console.error("Barcode error:", err?.message || err);
    res.status(500).json({ error: "Failed to fetch product details." });
  }
});

// ---------------- DAILY CRON (9 AM IST) ----------------
async function runDailyUpdate() {
  console.log("⏰ Running daily price update...");
  try {
    const productsSnapshot = await db.collection("products").get();
    console.log("Products count:", productsSnapshot.size);

    for (const doc of productsSnapshot.docs) {
      const item = doc.data();
      const asin = item.asin;
      const url = item.url;
      if (!asin || !url) {
        console.log("Skipping product missing asin/url:", doc.id);
        continue;
      }

      console.log("Updating:", asin);
      let scraped;
      try {
        scraped = await scrapeAmazon(url);
      } catch (err) {
        console.error("Scrape failed for", asin, err?.message || err);
        continue;
      }

      if (!scraped || !scraped.priceText) {
        console.log("No price for", asin);
        continue;
      }

      const newPrice = priceTextToNumber(scraped.priceText);
      if (newPrice === null) {
        console.log("Cannot parse price for", asin, "text:", scraped.priceText);
        continue;
      }

      const ref = db.collection("products").doc(asin);
      await ref.set({ last_price: newPrice, last_price_text: scraped.priceText, updated_at: new Date(), title: scraped.title || item.title, image: scraped.image || item.image }, { merge: true });
      await ref.collection("history").add({ price: newPrice, price_text: scraped.priceText, timestamp: new Date() });
      console.log(`Updated ${asin}: ₹${newPrice}`);

      // notify watchers
      const watchersSnap = await ref.collection("watchers").get();
      if (!watchersSnap.empty) {
        for (const wdoc of watchersSnap.docs) {
          const w = wdoc.data();
          const wref = wdoc.ref;
          if (typeof w.target_price !== "number") continue;

          const alreadyNotifiedPrice = w.last_notified_price;
          const shouldNotify = newPrice <= w.target_price && (alreadyNotifiedPrice === undefined || newPrice < alreadyNotifiedPrice);

          if (!shouldNotify) continue;

          const title = `Price alert: ${scraped.title || asin}`;
          const body = `Now ₹${newPrice} (target ₹${w.target_price}).`;

          if (w.email) {
            const html = `<p>Product <strong>${scraped.title || asin}</strong> is now <strong>₹${newPrice}</strong>.</p><p>Target: ₹${w.target_price}</p><p><a href="${url}">View</a></p>`;
            await sendEmail(w.email, title, html, body);
          }

          if (w.fcmToken) {
            await sendPush(w.fcmToken, title, body, { asin, newPrice: String(newPrice) });
          }

          await wref.set({ notified: true, last_notified_price: newPrice, last_notified_at: new Date() }, { merge: true });
          console.log("Notified watcher", wdoc.id, "for", asin);
        }
      }
    }
    console.log("Daily update finished.");
  } catch (err) {
    console.error("Daily updater error:", err?.message || err);
  }
}

cron.schedule("0 0 * * *", () => {
  runDailyUpdate();
}, { timezone: "Asia/Kolkata" });

// Manual trigger (testing)
app.get("/run-daily-now", async (req, res) => {
  runDailyUpdate().then(()=>res.json({ success: true })).catch(e=>res.status(500).json({ error: e?.message || e }));
});
// Serve Alerts Page
app.get("/alerts", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "alerts.html"));
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log(`🔥 Server running on http://localhost:${PORT}`);
});
