// server.js

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import puppeteer from "puppeteer";
import admin from "firebase-admin";
import { fileURLToPath } from "url";
import cron from "node-cron";

// Fix __dirname (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------- FIREBASE ----------------
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, "serviceAccountKey.json"), "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ---------------- EXPRESS ----------------
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

// Extract ASIN
function extractASIN(url) {
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

// ---------- SCRAPE AMAZON USING PUPPETEER ----------
async function scrapeAmazon(url) {
  console.log("Launching Puppeteer…");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

  console.log("Opening:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 });

  const data = await page.evaluate(() => {
    const title =
      document.querySelector("#productTitle")?.innerText?.trim() || null;

    const price =
      document.querySelector(".a-price .a-offscreen")?.innerText ||
      document.querySelector("#priceblock_ourprice")?.innerText ||
      document.querySelector("#priceblock_dealprice")?.innerText ||
      null;

    const image =
      document.querySelector("#landingImage")?.src ||
      document.querySelector("#imgTagWrapperId img")?.src ||
      null;

    return { title, price, image };
  });

  await browser.close();
  return data;
}

// ---------------- /api/fetch (manual add) ----------------
app.post("/api/fetch", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url.includes("amazon.")) {
      return res.status(400).json({ error: "Invalid Amazon URL" });
    }

    const asin = extractASIN(url);
    if (!asin) return res.status(400).json({ error: "ASIN not found" });

    console.log("Scraping Amazon Product…");

    const product = await scrapeAmazon(url);

    console.log("Scraped Data:", product);

    if (!product.title || !product.price) {
      return res.status(500).json({ error: "Failed to extract product" });
    }

    const cleanPrice = Number(product.price.replace(/[₹,]/g, ""));

    const ref = db.collection("products").doc(asin);

    await ref.set(
      {
        asin,
        url,
        title: product.title,
        image: product.image,
        last_price: cleanPrice,
        updated_at: new Date()
      },
      { merge: true }
    );

    await ref.collection("history").add({
      price: cleanPrice,
      timestamp: new Date()
    });

    return res.json({
      success: true,
      asin,
      title: product.title,
      price: cleanPrice,
      image: product.image
    });

  } catch (err) {
    console.error("Scrape Error:", err);
    return res.status(500).json({ error: "Scraping failed", details: err.message });
  }
});

// ---------------- PRICE HISTORY ----------------
app.get("/api/prices/:asin", async (req, res) => {
  try {
    const asin = req.params.asin;

    const snap = await db
      .collection("products")
      .doc(asin)
      .collection("history")
      .orderBy("timestamp", "asc")
      .get();

    const history = snap.docs.map((doc) => ({
      price: doc.data().price,
      timestamp: doc.data().timestamp.toDate()
    }));

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------
// 🔥 DAILY PRICE UPDATER (9AM IST) — USING PUPPETEER
// ------------------------------------------------------------
cron.schedule("55 10 * * *", async () => {
  console.log("⏰ DAILY CRON STARTED at 9AM IST");

  try {
    const productsSnapshot = await db.collection("products").get();
    console.log("🟢 Total products:", productsSnapshot.size);

    for (const doc of productsSnapshot.docs) {
      const item = doc.data();
      const asin = item.asin;
      const url = item.url;

      console.log(`🔍 Updating: ${asin}`);

      const product = await scrapeAmazon(url);

      if (!product || !product.price) {
        console.log("❌ Failed to extract price for", asin);
        continue;
      }

      const newPrice = Number(product.price.replace(/[₹,]/g, ""));

      const ref = db.collection("products").doc(asin);

      await ref.set(
        {
          last_price: newPrice,
          updated_at: new Date()
        },
        { merge: true }
      );

      await ref.collection("history").add({
        price: newPrice,
        timestamp: new Date()
      });

      console.log(`✅ Updated ${asin}: ₹${newPrice}`);
    }

    console.log("🎉 Daily update completed!");

  } catch (err) {
    console.error("🔥 Daily updater crashed:", err);
  }
}, {
  timezone: "Asia/Kolkata"
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log(`🔥 Server running on http://localhost:${PORT}`);
});
