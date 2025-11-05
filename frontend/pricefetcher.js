// pricefetcher.js
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function scrapeUniversalPrice(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    const $ = cheerio.load(html);

    let priceText = '';

    if (url.includes('amazon')) priceText = $('span.a-offscreen').first().text();
    else if (url.includes('flipkart')) priceText = $('div._30jeq3._16Jk6d').first().text();

    await browser.close();

    if (!priceText) throw new Error('Price not found');

    const cleaned = priceText.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned);
}

async function scrapeAmazonPrice(url) {
    // For now, same as scrapeUniversalPrice
    return scrapeUniversalPrice(url);
}

module.exports = { scrapeUniversalPrice, scrapeAmazonPrice };
