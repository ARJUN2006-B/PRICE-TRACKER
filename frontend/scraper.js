// This file handles BOTH scraping and tracking

document.addEventListener('DOMContentLoaded', () => {

    // --- Part 1: Get Price Button Elements ---
    const urlInput = document.getElementById('url-input');
    const scrapeButton = document.getElementById('scrape-button');
    const resultPrice = document.getElementById('result-price');

    // --- Part 2: Track Button Elements ---
    const trackButton = document.getElementById('track-button');
    const trackStatus = document.getElementById('track-status');
    const targetPriceInput = document.getElementById('target-price');
    const emailInput = document.getElementById('user-email');

    // --- Logic for "Get Price" Button ---
    scrapeButton.addEventListener('click', () => {
        
        const url = urlInput.value;
        if (!url) {
            alert("Please paste a URL first.");
            return;
        }

        resultPrice.innerText = "Scraping... please wait. This can take 10-20 seconds.";

        // Call our backend API route
        fetch('http://localhost:3000/api/scrape-price', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: url }) // Send the URL in the body
        })
        .then(response => {
            if (!response.ok) {
                // Get the error message from the server and throw it
                return response.json().then(err => { throw new Error(err.message) });
            }
            return response.json();
        })
        .then(data => {
            // Success!
            resultPrice.innerText = `The price is: ₹${data.price}`; // Changed to Rupee symbol
        })
        .catch(error => {
            console.error('Fetch error:', error);
            resultPrice.innerText = `Error: ${error.message}`;
        });
    });

    // --- Logic for "Track Price" Button ---
    trackButton.addEventListener('click', () => {
        const url = urlInput.value;
        const targetPrice = targetPriceInput.value;
        const email = emailInput.value;

        if (!url || !targetPrice || !email) {
            trackStatus.innerText = "Please fill in all fields (URL, Target Price, and Email).";
            trackStatus.style.color = 'red';
            return;
        }

        trackStatus.innerText = "Saving your track request...";
        trackStatus.style.color = 'black';

        // Call our new backend route
        fetch('http://localhost:3000/api/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                targetPrice: targetPrice,
                email: email
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message === 'Tracking started successfully!') {
                trackStatus.innerText = "Success! We will email you on price drops.";
                trackStatus.style.color = 'green';
            } else {
                throw new Error(data.message);
            }
        })
        .catch(error => {
            trackStatus.innerText = `Error: ${error.message}`;
            trackStatus.style.color = 'red';
        });
    });

}); // This closes the ONE main DOMContentLoaded listener