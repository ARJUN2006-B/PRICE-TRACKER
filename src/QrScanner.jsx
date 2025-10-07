import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import "./QrScanner.css";

const QrScanner = () => {
  const [scanResult, setScanResult] = useState(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        qrbox: {
          width: 250,
          height: 250,
        },
        fps: 5,
      },
      false
    );

    const onScanSuccess = (decodedText) => {
      console.log(`Scan successful, result: ${decodedText}`);
      setScanResult(decodedText);

      // Stop scanner after success
      scanner.clear().catch((error) => {
        console.error("Failed to clear scanner.", error);
      });
    };

    const onScanFailure = (error) => {
      // Uncomment if you want debugging logs
      // console.warn(`QR scan failed: ${error}`);
    };

    scanner.render(onScanSuccess, onScanFailure);

    // Cleanup when unmounted
    return () => {
      scanner.clear().catch((error) => {
        console.error("Failed to clear scanner on unmount.", error);
      });
    };
  }, []);

  return (
    <div className="qr-scanner-container">
      <h1>QR Code Price Scanner</h1>
      <p>Point the camera at a product's QR code.</p>

      {/* QR reader area */}
      <div id="qr-reader"></div>

      {/* Show result if scanned */}
      {scanResult && (
        <div className="scan-result">
          <p><strong>Scanned Result:</strong> {scanResult}</p>
          {/^https?:\/\//.test(scanResult) && (
            <a href={scanResult} target="_blank" rel="noopener noreferrer">
              <button className="go-btn">Go to Link</button>
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default QrScanner;
