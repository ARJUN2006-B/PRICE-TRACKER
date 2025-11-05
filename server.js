const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
const puppeteer = require('puppeteer'); // <-- NEW
const cheerio = require('cheerio');   // <-- NEW
const cron = require('node-cron');
require('dotenv').config();
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY); // <-- ❗️ PASTE YOUR KEY



// --- 1. FIREBASE SETUP ---
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
// ------------------------

const app = express();
const port = 3000;

// --- 2. MIDDLEWARE ---
app.use(cors());
app.use(express.json()); // This is new, for reading POST requests

// =================================================================
// --- 3. YOUR OLD BARCODE SCANNER ROUTE ---
// =================================================================
app.get('/api/product/barcode/:barcodeNumber', async (req, res) => {
    
    const { barcodeNumber } = req.params;

    try {
        // Check if we ALREADY have this product in our database
        const productsRef = db.collection('products');
        const snapshot = await productsRef.where('barcode', '==', barcodeNumber).get();

        if (!snapshot.empty) {
            // PRODUCT WAS FOUND in our database
            console.log('Found product in our DB!');
            const productDoc = snapshot.docs[0];
            
            await saveCurrentPrice(productDoc.id); // Save a new (random) price
            
            return res.json({ id: productDoc.id, ...productDoc.data() });
        }

        // PRODUCT WAS NOT FOUND in our database
        console.log('Product not in DB. Calling RapidAPI...');

        const options = {
          method: 'GET',
          url: 'https://barcodes1.p.rapidapi.com/',
          params: {
            barcode: barcodeNumber
          },
          headers: {
            'X-RapidAPI-Key': '74202f4b6dmsh366cac642ff34f3p1b5cafjsn4adef7992b20', // <-- ❗️ PUT YOUR KEY HERE
            'X-RapidAPI-Host': 'barcodes1.p.rapidapi.com'
          }
        };
        
        const response = await axios.request(options);
        const product = response.data.product;

        // SAVE this new product to our Firebase database
        const newProduct = {
            name: product.title,
            brand: product.brand,
            image_url: product.images[0],
            barcode: barcodeNumber
        };

        const docRef = await db.collection('products').add(newProduct);
        
        await saveCurrentPrice(docRef.id); // Save the first (random) price

        console.log('Saved new product to DB with ID:', docRef.id);
        res.status(201).json({ id: docRef.id, ...newProduct });

    } catch (error) {
        console.error("Error in barcode route:", error.response ? error.response.data : error.message);
        res.status(500).json({ message: "Error fetching product details" });
    }
});

// =================================================================
// --- 4. YOUR OLD PRICE HISTORY ROUTE ---
// =================================================================
app.get('/api/product/history/:barcode', async (req, res) => {
    const { barcode } = req.params;

    try {
        // 1. Find the product by its barcode
        const productsRef = db.collection('products');
        const productSnapshot = await productsRef.where('barcode', '==', barcode).get();

        if (productSnapshot.empty) {
            return res.status(404).json({ message: "Product not found" });
        }

        const productDoc = productSnapshot.docs[0];

        // 2. Get all prices from its subcollection
        const pricesSnapshot = await db.collection('products').doc(productDoc.id)
                                     .collection('prices')
                                     .orderBy('date', 'asc')
                                     .get();

        // 3. Format the data for the graph
        const history = [];
        pricesSnapshot.forEach(doc => {
            const data = doc.data();
            history.push({
                price: data.price,
                date: data.date.toDate()
            });
        });

        // 4. Send the product details and its history
        res.json({
            product: productDoc.data(),
            history: history
        });

    } catch (error) {
        console.error("Error getting history:", error);
        res.status(500).json({ message: "Could not get history" });
    }
});

// =================================================================
// --- 5. YOUR OLD HELPER FUNCTION ---
// =================================================================
async function saveCurrentPrice(productId) {
    const randomPrice = (Math.random() * 10 + 2).toFixed(2);
    const priceData = {
        price: parseFloat(randomPrice),
        date: new Date()
    };
    await db.collection('products').doc(productId).collection('prices').add(priceData);
    console.log(`Saved new price ${randomPrice} for product ${productId}`);
}

// =================================================================
// --- 🚀 6. UNIVERSAL WEB SCRAPER CODE (Amazon, Flipkart, etc.) 🚀 ---
// =================================================================

async function scrapeUniversalPrice(url) {
    console.log(`Scraping URL: ${url}`);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    );

    await page.goto(url, { timeout: 60000, waitUntil: 'domcontentloaded' });
    const html = await page.content();
    const $ = cheerio.load(html);

    let priceText = '';

    if (url.includes('amazon')) {
        priceText = $('span.a-offscreen').first().text();
    } 
    else if (url.includes('flipkart')) {
        // Flipkart uses span elements with these classes
        priceText = $('div._30jeq3._16Jk6d').first().text();
    } 
    else if (url.includes('snapdeal')) {
        priceText = $('span.payBlkBig').first().text();
    } 
    else if (url.includes('croma')) {
        priceText = $('span.pdp-price').first().text();
    } 
    else if (url.includes('reliancedigital')) {
        priceText = $('span.pdp__offerPrice').first().text();
    }

    await browser.close();

    if (!priceText) throw new Error('Price not found. Site structure may have changed.');

    // Extract only numbers and decimal points, remove commas or ₹ symbols
    const match = priceText.match(/[\d,.]+/);
    if (!match) throw new Error('Could not parse price text: ' + priceText);

    const cleaned = match[0].replace(/,/g, '');
    return parseFloat(cleaned);
}

// --- API route to handle scraping ---
app.post('/api/scrape-price', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'URL is required' });

    try {
        const price = await scrapeUniversalPrice(url);
        res.json({ price });
    } catch (error) {
        console.error('Scrape error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// =================================================================
// --- 🚀 6B. API ROUTE — Compare Prices Across Platforms ---
// =================================================================
app.post('/api/compare-prices', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ message: "URL required" });

  try {
    // Define supported platforms
    const platforms = [
      { platform: "Amazon", link: url.replace(/flipkart|meesho|jiomart/gi, "amazon") },
      { platform: "Flipkart", link: url.replace(/amazon|meesho|jiomart/gi, "flipkart") },
      { platform: "Meesho", link: url.replace(/amazon|flipkart|jiomart/gi, "meesho") }
    ];

    const results = [];

    // Loop through each platform and scrape the price
    for (const p of platforms) {
      try {
        const price = await scrapeUniversalPrice(p.link);
        results.push({ platform: p.platform, price, link: p.link });
      } catch (err) {
        results.push({ platform: p.platform, price: null, link: p.link });
      }
    }

    res.json({ results });
  } catch (err) {
    console.error("Error in /api/compare-prices:", err.message);
    res.status(500).json({ message: "Failed to fetch comparison prices" });
  }
});


// =================================================================
// --- 7. START THE SERVER ---
// =================================================================
// 🚀 NEW ROUTE TO SAVE A TRACK REQUEST 🚀
app.post('/api/track', async (req, res) => {
    const { url, targetPrice, email } = req.body;

    if (!url || !targetPrice || !email) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        // Save this request to our new 'tracks' collection in Firebase
        const trackRef = await db.collection('tracks').add({
            url: url,
            targetPrice: parseFloat(targetPrice),
            email: email,
            lastCheckedPrice: null, // We'll update this later
            isActive: true // We'll set this to false after notifying
        });

        console.log(`New track request saved with ID: ${trackRef.id}`);
        res.status(201).json({ message: 'Tracking started successfully!' });
    } catch (error) {
        console.error('Error saving track request:', error);
        res.status(500).json({ message: 'Failed to start tracking' });
    }
});
// 🚀 NEW - THE AUTOMATED CHECKER & NOTIFIER 🚀

// This function sends the actual email
async function sendNotificationEmail(toEmail, productUrl, targetPrice, currentPrice) {
    const msg = {
        to: toEmail,
        from: 'your-verified-email@example.com', // ❗️ Must be a "Verified Sender" in SendGrid
        subject: 'Price Drop Alert!',
        html: `
            <strong>Great news!</strong>
            <p>The product you are tracking is now on sale!</p>
            <p>It dropped from ${currentPrice} to below your target of ${targetPrice}.</p>
            <a href="${productUrl}">Buy it now!</a>
        `,
    };

    try {
        await sgMail.send(msg);
        console.log(`Successfully sent email to ${toEmail}`);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

// This is the main function that checks all products
async function checkAllPrices() {
    console.log('--- Running daily price check ---');
    const tracksRef = db.collection('tracks');
    // Get all "active" track requests
    const snapshot = await tracksRef.where('isActive', '==', true).get();

    if (snapshot.empty) {
        console.log('No active products to track.');
        return;
    }

    // Loop over every single track request in our database
    for (const doc of snapshot.docs) {
        const track = doc.data();
        console.log(`Checking price for: ${track.url}`);

        try {
            // 1. Scrape the current price
            const currentPrice = await scrapeAmazonPrice(track.url);
            console.log(`Current price is: ${currentPrice}`);

            // 2. Compare prices
            if (currentPrice <= track.targetPrice) {
                // 3. PRICE DROP! Send the email
                console.log(`PRICE DROP DETECTED for ${track.email}!`);
                await sendNotificationEmail(track.email, track.url, track.targetPrice, currentPrice);

                // 4. Deactivate this track so we don't spam them
                await db.collection('tracks').doc(doc.id).update({
                    isActive: false,
                    lastCheckedPrice: currentPrice
                });
            } else {
                // No price drop, just update the last checked price
                 await db.collection('tracks').doc(doc.id).update({
                    lastCheckedPrice: currentPrice
                });
            }
        } catch (error) {
            console.error(`Failed to check price for ${track.url}:`, error.message);
        }
    }
    console.log('--- Daily price check finished ---');
}

// This schedules the 'checkAllPrices' function to run.
// This example runs every 4 hours.
// For testing, you can change it to '*/2 * * * *' to run every 2 minutes.
cron.schedule('* * * * *', () => {
    checkAllPrices();
});
app.listen(port, () => {
    console.log(`Backend server listening on http://localhost:${port}`);
});