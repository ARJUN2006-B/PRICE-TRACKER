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
            .then(response => {
                // Check if the server responded with an error (like 404 or 500)
                if (!response.ok) {
                    throw new Error('Product not found or server error');
                }
                // If the response is good, parse it as JSON
                return response.json();
            })
            .then(productData => {
                // SUCCESS! 'productData' is the JSON from your backend.
                console.log("Success! Received product data:", productData);
                
                // You can now show this data on your page.
                // For a simple test, just show an alert:
                alert(`Product Found: ${productData.product.brand} ${productData.product.title}`);
                
                // In your real project, you would redirect to a product page:
                // window.location.href = `/pricehistory.html?barcode=${decodedText}`;
            })
            .catch(error => {
                // This runs if the 'fetch' fails or if you threw an error.
                console.error("Error fetching product data:", error);
                alert("Error: Could not get product details.");
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

});