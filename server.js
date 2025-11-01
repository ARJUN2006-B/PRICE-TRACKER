const express = require('express');
const axios = require('axios');
const cors = require('cors'); // Import cors

const app = express();
const port = 3000;

// Use CORS to allow your frontend to make requests
app.use(cors());

// This is your new API route
app.get('/api/product/barcode/:barcodeNumber', async (req, res) => {
    
    // Get the barcode number from the URL
    const { barcodeNumber } = req.params;

    // These are the options for the RapidAPI call
    const options = {
      method: 'GET',
      url: 'https://barcodes1.p.rapidapi.com/',
      params: {
        barcode: barcodeNumber 
      },
      headers: {
        // --- THIS IS YOUR SECRET ---
        // Keep it safe here on the server
        'X-RapidAPI-Key': '74202f4b6dmsh366cac642ff34f3p1b5cafjsn4adef7992b20', 
        'X-RapidAPI-Host': 'barcodes1.p.rapidapi.com'
      }
    };

    try {
        // Call the RapidAPI
        const response = await axios.request(options);
        
        // Send the data from RapidAPI back to your frontend
        res.json(response.data);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching product details" });
    }
});

// Start your server
app.listen(port, () => {
    console.log(`Backend server listening on http://localhost:${port}`);
});