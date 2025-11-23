window.addEventListener("load", function() {
    const resultBox   = document.getElementById('result-box');
    const scannerView = document.getElementById('scanner-view');

    function onScanSuccess(decodedText, decodedResult) {
        console.log(`Code scanned: ${decodedText}`);
        html5QrcodeScanner.clear(); // stop camera

        fetch(`http://localhost:3000/api/product/barcode/${decodedText}`)
            .then(async res => {
                if (!res.ok) {
                    const err = await res.json().catch(() => null);
                    throw new Error(err?.error || "Failed to fetch product details.");
                }
                return res.json();
            })
            .then(data => {
                const p = data?.product;
                if (!p) {
                    alert("No product data found.");
                    location.reload();
                    return;
                }

                // Switch Views
                scannerView.style.display = 'none';
                resultBox.style.display   = 'block';

                // Fill Data
                document.getElementById('p-name').innerText  = p.name  || "Unknown Product";
                document.getElementById('p-brand').innerText = p.brand || "Unknown Brand";
                document.getElementById('p-price').innerText = p.price || "N/A";

                const img = document.getElementById('p-image');
                if (p.image_url) {
                    img.src = p.image_url;
                    img.style.display = 'block';
                } else {
                    img.style.display = 'none';
                }

                const link = document.getElementById('p-link');
                link.href = p.url || "#";
            })
            .catch(err => {
                console.error("SCAN ERROR:", err.message);
                alert(err.message);
                location.reload();
            });
    }

    function onScanFailure(error) {
        // Optional: console.log("Scan failure:", error);
    }

    let html5QrcodeScanner = new Html5QrcodeScanner(
        "barcode-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
    );
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
});
