// This function runs when the HTML document is fully loaded
document.addEventListener("DOMContentLoaded", function() {

    // This function gets called when a barcode is successfully scanned
    function onScanSuccess(decodedText, decodedResult) {
        // 'decodedText' is the barcode number (e.g., "036000291452")
        console.log(`Scan successful: ${decodedText}`);

        // Stop the scanner. This is important to free up the camera.
        html5QrcodeScanner.clear();

        // --- THIS IS THE INTEGRATION STEP ---
        // Now, we call YOUR backend server (the one on localhost:3000)
        
        const url = `http://localhost:3000/api/product/barcode/${decodedText}`;

        console.log(`Fetching data from: ${url}`);

        fetch(url)
            // ... inside fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Product not found or server error');
            }
            return response.json();
        })
        // --- REPLACE THIS BLOCK ---
        .then(data => {
            // 'data' is our new object: { product: {...}, prices: [...] }
            console.log("Success! Received product data:", data);

            // Find the best price from the results
            let bestPrice = null;
            let amazonPrice = "Not found";

            for (const item of data.prices) {
                if (item.platform === 'Amazon') {
                    amazonPrice = item.price ? `₹${item.price}` : "Not found";
                }
                if (item.price && (bestPrice === null || item.price < bestPrice)) {
                    bestPrice = item.price;
                }
            }

            // Show a useful alert with the price
            alert(
                `Product: ${data.product.name}\n` +
                `Amazon Price: ${amazonPrice}\n` +
                `Best Price: ${bestPrice ? `₹${bestPrice}` : 'Not found'}`
            );

            // Now, redirect to the history page
            //window.location.href = `pricehistory.html?barcode=${data.product.barcode}`;
        })
        // --- END OF REPLACEMENT ---
        .catch(error => {
            // ... (your existing catch block) ...
        });
    }

    // This function gets called if the scan fails (optional)
    function onScanFailure(error) {
        // You can ignore this or log it
        // console.warn(`Scan error: ${error}`);
    }


    // --- This is the main code that starts the scanner ---

    // 1. Create a new scanner instance
    let html5QrcodeScanner = new Html5QrcodeScanner(
        "barcode-reader",  // The ID of the div you created in HTML
        { 
            fps: 10,                 // Frames per second
            qrbox: { width: 250, height: 250 }  // Size of the scanning box
        },
        false // 'verbose' - set to false to reduce console logs
    );

    // 2. Start the scanner
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    window.location.href = `product.html?barcode=${scannedBarcode}`;


});