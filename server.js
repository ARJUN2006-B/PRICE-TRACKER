// server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer"; // kept from your old file (not used right now)
import admin from "firebase-admin";
import { fileURLToPath } from "url";
import cron from "node-cron";
import axios from "axios";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ---------------- FIREBASE ----------------
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, "serviceAccountKey.json"), "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// ---------------- EXPRESS ----------------
const app  = express();
app.use(cors());
app.use(express.json());
const PORT = 3000;

// ---------------------------------------------------------------------
// Helper: turn name into useful keywords (for ALL product types)
// ---------------------------------------------------------------------
function makeKeywords(name) {
  if (!name) return [];
  return name
    .toLowerCase()
    .split(/[\s\-_,()]+/)
    .filter(w => w.length > 2 && !["the","for","and","with","from","pack","size"].includes(w));
}

// ---------------------------------------------------------------------
// Dummy teammate routes (kept minimal, not touched)
// ---------------------------------------------------------------------
app.post("/api/fetch", async (req, res) => {
  res.json({ message: "Teammate's fetch route is active" });
});

app.get("/api/prices/:asin", async (req, res) => {
  res.json({ message: "History route active" });
});

// ---------------------------------------------------------------------
// 🚀 BARCODE ROUTE: OpenFoodFacts + Amazon (strict match, all products)
// ---------------------------------------------------------------------
app.get("/api/product/barcode/:barcodeNumber", async (req, res) => {
  const { barcodeNumber } = req.params;
  console.log("Scanning barcode:", barcodeNumber);

  try {
    // 1️⃣ Get product from OpenFoodFacts (no key, global DB)
    const offUrl = `https://world.openfoodfacts.org/api/v0/product/${barcodeNumber}.json`;
    const offRes = await axios.get(offUrl);
    const offData = offRes.data;

    if (!offData || offData.status !== 1) {
      return res.status(404).json({ error: "Product not found." });
    }

    const p = offData.product;

    const productName = p.product_name || "";
    const brand       = (p.brands || "").split(",")[0].trim() || "Unknown Brand";

    const baseImage =
      p.image_front_url || p.image_url || p.image_thumb_url || "";

    // 2️⃣ Try to get Amazon price + image + link (strict best match)
    let amazonPrice = "N/A";
    let amazonUrl   = "";
    let amazonImage = "";

    const brandLower = brand.toLowerCase();
    const nameKeywords = makeKeywords(productName);

    if (productName) {
      try {
        // Search Amazon using "Brand + Product name"
        const searchQuery = `${brand} ${productName}`.trim();
        const searchUrl   = `https://www.amazon.in/s?k=${encodeURIComponent(searchQuery)}`;

        const { data: searchHtml } = await axios.get(searchUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
            "Accept-Language": "en-IN,en;q=0.9",
          },
        });

        const $search = cheerio.load(searchHtml);
        const results = $search(
          "div.s-result-item[data-component-type='s-search-result']"
        );

        let bestMatchEl   = null;
        let bestScore     = -1;
        let bestMatchText = "";

        results.each((i, el) => {
          const title = $search(el).find("h2 span").text().trim().toLowerCase();
          if (!title) return;

          // MUST contain brand if we know it
          if (brandLower && !title.includes(brandLower)) return;

          // Scoring based on keywords
          let score = 0;
          nameKeywords.forEach(k => {
            if (title.includes(k)) score += 2; // weight higher
          });

          // Fallback: if very generic name, at least brand present
          if (score === 0 && brandLower && title.includes(brandLower)) {
            score = 1;
          }

          // Keep best match
          if (score > bestScore) {
            bestScore     = score;
            bestMatchEl   = el;
            bestMatchText = title;
          }
        });

        // Require a decent score to accept match
        if (bestMatchEl && bestScore >= 2) {
          console.log("Best Amazon title:", bestMatchText, "(score:", bestScore, ")");

          const best = $search(bestMatchEl);

          const priceWhole = best.find(".a-price-whole").first().text().trim();
          const priceFrac  = best.find(".a-price-fraction").first().text().trim();

          if (priceWhole) {
            amazonPrice = "₹" + priceWhole + (priceFrac ? "." + priceFrac : "");
          }

          let relativeLink =
            best.find("a.a-link-normal.s-no-outline").attr("href") ||
            best.find("h2 a").attr("href") ||
            "";

          if (relativeLink) {
            amazonUrl = relativeLink.startsWith("http")
              ? relativeLink
              : "https://www.amazon.in" + relativeLink;

            // Fetch product page for image
            try {
              const { data: productHtml } = await axios.get(amazonUrl, {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
                  "Accept-Language": "en-IN,en;q=0.9",
                },
              });

              const $product = cheerio.load(productHtml);
              amazonImage =
                $product("#landingImage").attr("src") ||
                $product("#imgTagWrapperId img").attr("src") ||
                "";
            } catch (imgErr) {
              console.log("Amazon product image scrape failed:", imgErr.message);
            }
          }
        } else {
          console.log("No strong Amazon match found (score:", bestScore, ")");
        }
      } catch (searchErr) {
        console.log("Amazon price scrape failed:", searchErr.message);
      }
    }

    // 3️⃣ Respond to frontend
    res.json({
      product: {
        name: productName || "Unknown Product",
        brand: brand,
        price: amazonPrice,
        image_url: amazonImage || baseImage,
        url:
          amazonUrl ||
          `https://www.amazon.in/s?k=${encodeURIComponent(
            `${brand} ${productName}`.trim()
          )}`,
        barcode: barcodeNumber,
      },
    });
  } catch (error) {
    console.error("Barcode Route Error:", error.message);
    res.status(500).json({ error: "Failed to fetch product details." });
  }
});

// --- Cron (kept as in your file) ---
cron.schedule("0 0 * * *", () => {
  console.log("Daily cron...");
});

app.listen(PORT, () => {
  console.log(`🔥 Server running on http://localhost:${PORT}`);
});

