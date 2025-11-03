document.addEventListener('DOMContentLoaded', () => {

    const urlInput = document.getElementById('url-input');
    const scrapeButton = document.getElementById('scrape-button');
    const resultPrice = document.getElementById('result-price');

    // Listen for a click on the button
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
            // This part is improved to show better errors
            if (!response.ok) {
                // Get the error message from the server and throw it
                return response.json().then(err => { throw new Error(err.message) });
            }
            return response.json();
        })
        .then(data => {
            // Success!
            resultPrice.innerText = `The price is: $${data.price}`;
        })
        .catch(error => {
            console.error('Fetch error:', error);
            // This will now show the real error, like "Could not find price"
            resultPrice.innerText = `Error: ${error.message}`;
        });
    });
});
// This code runs when the 'scraper.html' page loads
document.addEventListener('DOMContentLoaded', () => {

    // ... all your existing code for "Get Price" button ...
    const scrapeButton = document.getElementById('scrape-button');
    // ... etc ...

    // 🚀 NEW CODE FOR THE "TRACK" BUTTON 🚀
    const trackButton = document.getElementById('track-button');
    const trackStatus = document.getElementById('track-status');

    trackButton.addEventListener('click', () => {
        const url = document.getElementById('url-input').value;
        const targetPrice = document.getElementById('target-price').value;
        const email = document.getElementById('user-email').value;

        if (!url || !targetPrice || !email) {
            trackStatus.innerText = "Please fill in all fields.";
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
            trackStatus.innerText = error.message;
            trackStatus.style.color = 'red';
        });
    });

}); // This closes the main DOMContentLoaded