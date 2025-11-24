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


// ---------------- AMAZON BARCODE SEARCH (NO OPENFOODFACTS) ----------------

app.get("/api/product/barcode/:code", async (req, res) => {
  const code = req.params.code;
  console.log("Scanning barcode:", code);

  try {
    // 1) Query UPCITEM DB
    const upcUrl = `https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`;
    const upcRes = await axios.get(upcUrl);
    const items = upcRes.data.items;

    if (!items || items.length === 0) {
      return res.status(404).json({ error: "Barcode not found in UPC database." });
    }

    const item = items[0];
    const name = item.title || "";
    const brand = item.brand || "Unknown Brand";

    // 2) Search Amazon with product title
    const searchQuery = encodeURIComponent(`${brand} ${name}`);
    const amazonUrl = `https://www.amazon.in/s?k=${searchQuery}`;

    const searchRes = await axios.get(amazonUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-IN,en;q=0.9"
      }
    });

    const $ = cheerio.load(searchRes.data);
    const first = $("div.s-result-item[data-component-type='s-search-result']").first();

    if (!first.html()) {
      return res.status(404).json({ error: "Amazon has no matching product." });
    }

    // Extract price and image
    const title = first.find("h2 span").text().trim();
    const priceWhole = first.find(".a-price-whole").text().trim();
    const priceFrac = first.find(".a-price-fraction").text().trim();
    const price = priceWhole ? `₹${priceWhole}${priceFrac ? "." + priceFrac : ""}` : "N/A";

    let relative = first.find("a.a-link-normal.s-no-outline").attr("href")
      || first.find("h2 a").attr("href")
      || "";

    const url = relative.startsWith("http") ? relative : `https://www.amazon.in${relative}`;

    let img = first.find("img").attr("src") || "";

    return res.json({
      product: {
        name: title || name,
        brand,
        price,
        image_url: img,
        url
      }
    });

  } catch (err) {
    console.error("Barcode API Error:", err.message);
    return res.status(500).json({ error: "Failed to match barcode." });
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

cron.schedule("0 9 * * *", () => {
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

// ---------------- TEST EMAIL ROUTE ----------------
app.get("/test-email", async (req, res) => {
  try {
    const testTo = SMTP_USER || process.env.SMTP_USER;
    if (!testTo) return res.status(400).json({ success:false, error: "SMTP_USER not configured in .env" });

    const subject = "✔ Price Tracker SMTP Test";
    const text = "SMTP is working successfully!";
    const html = `<h2>SMTP Test Successful</h2><p>Your Gmail SMTP is working correctly 🎉</p>`;

    await transporter.sendMail({ from: NOTIFICATION_FROM, to: testTo, subject, text, html });
    console.log("Test email sent to:", testTo);
    res.json({ success: true, message: "Test email sent. Check your inbox." });
  } catch (err) {
    console.error("Test email error:", err?.message || err);
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log(`🔥 Server running on http://localhost:${PORT}`);
});