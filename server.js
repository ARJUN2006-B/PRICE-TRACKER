// THIS IS YOUR NEW, COMPLETE server.js FILE (Hybrid + Clean Title Fix)
require('dotenv').config(); // MUST be at the top

// --- Main Tools ---
const express = require('express');
const axios = require('axios'); // Still need for barcode API
const cors = require('cors');
const cheerio = require('cheerio'); // For parsing HTML

// --- Firebase Admin ---
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// --- Google Shopping API ---
const { getJson } = require("serpapi"); // This is the new tool

// --- Notifier Tools ---
const sgMail = require('@sendgrid/mail');
const cron = require('node-cron');

// =================================================================
// --- 1. INITIALIZE ALL SERVICES ---
// =================================================================
const app = express();
const port = 3000;

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// =================================================================
// --- 2. HELPER FUNCTIONS ---
// =================================================================

// --- ScraperAPI URL ---
// We use render=true and country_code=in to get the best results
const scraperApiUrl = `http://api.scraperapi.com?api_key=${process.env.SCRAPERAPI_KEY}&render=true&country_code=in`;

/**
 * Cleans a messy product title for better searching.
 */
function cleanProductTitle(title) {
    // Get text before a | or a \
    let cleaned = title.split('|')[0].split('\\')[0].trim();
    console.log(`Cleaned title for search: ${cleaned}`);
    return cleaned;
}

/**
 * Cleans an Amazon URL to its basic /dp/ASIN form.
 */
function cleanAmazonUrl(url) {
    try {
        const match = url.match(/\/dp\/([A-Z0-9]{10})/);
        if (match && match[1]) {
            const asin = match[1];
            return `https://www.amazon.in/dp/${asin}`;
        }
        return url; // Return original if pattern not found
    } catch (e) {
        return url; // Return original on error
    }
}


// --- SCRAPERS (Get data from a specific product URL) ---
// These use ScraperAPI to get the initial title

async function getAmazonData(url) {
    console.log(`Scraping Amazon URL with ScraperAPI: ${url}`);
    const cleanUrl = cleanAmazonUrl(url); // Clean the URL first
    const html = await axios.get(`${scraperApiUrl}&url=${cleanUrl}`);
    const $ = cheerio.load(html.data);
    const title = $('#productTitle').text().trim();
    const priceString = $('span.a-offscreen').first().text();
    let price = null;
    if (priceString) {
        const priceMatch = priceString.match(/[\d,.]+/);
        if (priceMatch) price = parseFloat(priceMatch[0].replace(/,/g, ''));
    }
    return { title, price, link: cleanUrl };
}

async function getFlipkartData(url) {
    console.log(`Scraping Flipkart URL with ScraperAPI: ${url}`);
    const html = await axios.get(`${scraperApiUrl}&url=${url}`);
    const $ = cheerio.load(html.data);
    const title = $('span.B_NuCI').first().text().trim();
    const priceString = $('._30jeq3._16Jk6d').first().text();
    let price = null;
    if (priceString) {
        const priceMatch = priceString.match(/[\d,.]+/);
        if (priceMatch) price = parseFloat(priceMatch[0].replace(/,/g, ''));
    }
    return { title, price, link: url };
}

async function getMeeshoData(url) {
    console.log(`Scraping Meesho URL with ScraperAPI: ${url}`);
    const html = await axios.get(`${scraperApiUrl}&url=${url}`);
    const $ = cheerio.load(html.data);
    const title = $('span.Text__StyledText-sc-oo0kvp-0').first().text().trim();
    const priceString = $('h5.Text__StyledText-sc-oo0kvp-0').first().text();
    let price = null;
    if (priceString) {
        const priceMatch = priceString.match(/[\d,.]+/);
        if (priceMatch) price = parseFloat(priceMatch[0].replace(/,/g, ''));
    }
    return { title, price, link: url };
}

// --- SEARCHER (Search Google Shopping for a title) ---
async function searchAllSites(productTitle) {
    console.log(`Searching Google Shopping for: ${productTitle}`);
    const params = {
        api_key: process.env.SERPAPI_KEY, // Get key from .env
        engine: "google_shopping",
        q: productTitle,
        google_domain: "google.co.in",
        gl: "in",
        hl: "en",
        num: 10 // Get top 10 results
    };

    try {
        const data = await getJson(params);
        const shoppingResults = data.shopping_results || [];

        let amazon = { platform: 'Amazon', price: null, link: '#' };
        let flipkart = { platform: 'Flipkart', price: null, link: '#' };
        let meesho = { platform: 'Meesho', price: null, link: '#' };
        
        // "Smart" filter to ignore accessories
        const accessoryKeywords = ['case', 'cover', 'charger', 'cable', 'screen protector', 'tempered glass', 'holder'];

        for (const item of shoppingResults) {
            const source = item.source ? item.source.toLowerCase() : "";
            const title = item.title ? item.title.toLowerCase() : "";
            const price = item.extracted_price;
            const link = item.link;

            let isAccessory = false;
            for (const keyword of accessoryKeywords) {
                if (title.includes(keyword)) {
                    isAccessory = true;
                    break; 
                }
            }
            if (isAccessory) {
                console.log(`Ignoring accessory: ${title}`);
                continue; // Skip this item
            }

            if (source.includes("amazon.in") && !amazon.price) {
                amazon = { platform: 'Amazon', price: price, link: link };
            }
            if (source.includes("flipkart.com") && !flipkart.price) {
                flipkart = { platform: 'Flipkart', price: price, link: link };
            }
            if (source.includes("meesho.com") && !meesho.price) {
                meesho = { platform: 'Meesho', price: price, link: link };
            }
        }
        return [amazon, flipkart, meesho];
    } catch (e) {
        console.error("SerpApi search failed:", e.message);
        throw new Error("Failed to search Google Shopping.");
    }
}

// =================================================================
// --- 3. API ROUTES ---
// =================================================================

// --- SMART API ROUTE FOR PRICE COMPARISON ---
app.post('/api/compare-prices', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ message: 'URL is required' });
    }

    let initialData;
    let productTitle;
    let initialPlatform;

    try {
        // Step 1: Detect link and scrape initial product data
        if (url.includes('amazon.in')) {
            initialData = await getAmazonData(url);
            initialPlatform = "Amazon";
        } else if (url.includes('flipkart.com')) {
            initialData = await getFlipkartData(url);
            initialPlatform = "Flipkart";
        } else if (url.includes('meesho.com')) {
            initialData = await getMeeshoData(url);
            initialPlatform = "Meesho";
        } else {
            return res.status(400).json({ message: 'URL must be from Amazon, Flipkart, or Meesho.' });
        }
        
        productTitle = initialData.title;
        if (!productTitle) {
             return res.status(500).json({ message: 'Could not get product title from link. ScraperAPI may be blocked.' });
        }

        const cleanedTitle = cleanProductTitle(productTitle);

        // Step 2: Search all sites using SerpApi with the CLEAN title
        const searchResults = await searchAllSites(cleanedTitle);
        
        // Step 3: Bundle results
        const finalResults = searchResults.map(result => {
            // Use the price from the *original link* because it's most accurate
            if (result.platform === initialPlatform) {
                return { platform: initialPlatform, price: initialData.price, link: url };
            }
            return result;
        });

        res.json({ results: finalResults });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
});


// --- BARCODE SCANNER ROUTE ---
app.get('/api/product/barcode/:barcodeNumber', async (req, res) => {
    const { barcodeNumber } = req.params;
    try {
        const productsRef = db.collection('products');
        let productSnapshot = await productsRef.where('barcode', '==', barcodeNumber).get();
        let productData, productId;

        if (productSnapshot.empty) {
            console.log('Product not in DB. Calling RapidAPI...');
            const options = {
              method: 'GET',
              url: 'https://barcodes1.p.rapidapi.com/',
              params: { barcode: barcodeNumber },
              headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'barcodes1.p.rapidapi.com'
              }
            };
            
            const response = await axios.request(options);
            if (!response.data || !response.data.product || response.data.product.length === 0) {
                throw new Error('Barcode not found in RapidAPI database');
            }
            const product = response.data.product[0] || response.data.product; 

            productData = {
                name: product.title || "N/A",
                brand: product.brand || "N/A",
                image_url: product.images ? product.images[0] : "",
                barcode: barcodeNumber
            };
            const docRef = await db.collection('products').add(productData);
            productId = docRef.id;
        } else {
            console.log('Found product in our DB!');
            const productDoc = productSnapshot.docs[0];
            productId = productDoc.id;
            productData = productDoc.data();
        }

        const cleanedTitle = cleanProductTitle(productData.name);
        const searchResults = await searchAllSites(cleanedTitle);

        let lowestPrice = null;
        for (const result of searchResults) {
            if (result.price && (lowestPrice === null || result.price < lowestPrice)) {
                lowestPrice = result.price;
            }
        }

        if (lowestPrice) {
            const priceData = { price: lowestPrice, date: new Date() };
            await db.collection('products').doc(productId).collection('prices').add(priceData);
            console.log(`Saved new real price ${lowestPrice} for product ${productId}`);
        }
        
        res.json({
            product: productData,
            prices: searchResults // Send the full comparison
        });

    } catch (error) {
        console.error("Error in barcode route:", error.message);
        res.status(500).json({ message: "Error fetching product details" });
    }
});

// --- PRICE HISTORY/GRAPH ROUTE ---
app.get('/api/product/history/:barcode', async (req, res) => {
    const { barcode } = req.params;
    try {
        const productsRef = db.collection('products');
        const productSnapshot = await productsRef.where('barcode', '==', barcode).get();

        if (productSnapshot.empty) {
            return res.status(404).json({ message: "Product not found" });
        }
        const productDoc = productSnapshot.docs[0];

        const pricesSnapshot = await db.collection('products').doc(productDoc.id)
                                     .collection('prices')
                                     .orderBy('date', 'asc')
                                     .get();
        const history = [];
        pricesSnapshot.forEach(doc => {
            const data = doc.data();
            history.push({
                price: data.price,
                date: data.date.toDate()
            });
        });
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
// --- 4. PRICE TRACKER & NOTIFIER LOGIC ---
// =================================================================

// --- This is the route your "Track Price" button calls ---
app.post('/api/track', async (req, res) => {
    const { url, targetPrice, email } = req.body;
    if (!url || !targetPrice || !email) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    try {
        const trackRef = await db.collection('tracks').add({
            url: url,
            targetPrice: parseFloat(targetPrice),
            email: email,
            lastCheckedPrice: null, 
            isActive: true 
        });
        console.log(`New track request saved with ID: ${trackRef.id}`);
        res.status(201).json({ message: 'Tracking started successfully!' });
    } catch (error) {
        console.error('Error saving track request:', error);
        res.status(500).json({ message: 'Failed to start tracking' });
    }
});

// --- Email Notifier Function ---
async function sendNotificationEmail(toEmail, productUrl, targetPrice, currentPrice) {
    const msg = {
        to: toEmail,
        from: 'your-verified-email@example.com', // ❗️ Must be a "Verified Sender" in SendGrid
        subject: 'Price Drop Alert!',
        html: `<strong>Great news!</strong>
               <p>The product you are tracking is now on sale!</p>
               <p>The price is now <strong>₹${currentPrice}</strong>, which is below your target of ₹${targetPrice}.</p>
               <a href="${productUrl}">Buy it now!</a>`,
    };
    try {
        await sgMail.send(msg);
        console.log(`Successfully sent email to ${toEmail}`);
    } catch (error) {
        console.error('Error sending email:', error.response ? error.response.body : error);
    }
}

// --- Main Automated Checker Function (This is updated to use ScraperAPI) ---
async function checkAllPrices() {
    console.log('--- Running hourly price check ---');
    const tracksRef = db.collection('tracks');
    const snapshot = await tracksRef.where('isActive', '==', true).get();
    if (snapshot.empty) {
        console.log('No active products to track.');
        return;
    }

    for (const doc of snapshot.docs) {
        const track = doc.data();
        console.log(`Checking price for: ${track.url}`);
        
        try {
            // --- 🚀 NEW RELIABLE SCRAPING 🚀 ---
            // We use ScraperAPI to get the single-page price
            let currentPrice = null;
            let data;
            
            if (track.url.includes('amazon.in')) {
                data = await getAmazonData(track.url);
                currentPrice = data.price;
            } else if (track.url.includes('flipkart.com')) {
                data = await getFlipkartData(track.url);
                currentPrice = data.price;
            } else if (track.url.includes('meesho.com')) {
                data = await getMeeshoData(track.url);
                currentPrice = data.price;
            } else {
                console.error(`Skipping unknown URL: ${track.url}`);
                continue;
            }
            
            console.log(`Current price is: ${currentPrice}`);
            // --- END NEW SCRAPING ---

            if (currentPrice && currentPrice <= track.targetPrice) {
                console.log(`PRICE DROP DETECTED for ${track.email}!`);
                await sendNotificationEmail(track.email, track.url, track.targetPrice, currentPrice);
                await db.collection('tracks').doc(doc.id).update({
                    isActive: false,
                    lastCheckedPrice: currentPrice
                });
            } else if (currentPrice) {
                await db.collection('tracks').doc(doc.id).update({
                    lastCheckedPrice: currentPrice
                });
            }
        } catch (error) {
            console.error(`Failed to check price for ${track.url}:`, error.message);
        }
    }
    console.log('--- Hourly price check finished ---');
}

// --- Scheduler (runs once every hour) ---
// For testing, change to '*/1 * * * *' to run every 1 minute
cron.schedule('0 * * * *', () => {
    checkAllPrices();
});


// =================================================================
// --- 5. START THE SERVER ---
// =================================================================
app.listen(port, () => {
    console.log(`Backend server listening on http://localhost:${port}`);
});