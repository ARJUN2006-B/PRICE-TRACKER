import React, { useState } from "react";
import {Link} from "react-router-dom";
import "./Home.css";
import { Router } from "react-router-dom";

function Home() {
  const [productURL, setProductURL] = useState("");

  const handleCheck = () => {
    if (!productURL) {
      alert("⚠️ Please enter a product URL first!");
    } else if (!productURL.startsWith("http")) {
      alert("❌ Please enter a valid URL (must start with http or https).");
    } else {
      alert(`✅ Checking price for: ${productURL}`);
    }
  };

  return (
    <div className="home-container">
      {/* ✅ Modern Navbar */}
      <nav className="navbar">
        <div className="nav-links">
         <Link To="/Home" className ="active">Home</Link>
         <Link To="/profile">Profile</Link>
          <a href="#features">Help</a>
          <a href="#contact">About</a>
        </div>
      </nav>

      {/* Title */}
      <div className="title-section">
        <h1>Price Tracker</h1>
        <p>Track, Compare & Save Money!</p>
      </div>

      {/* Supported Stores */}
      <div className="stores">
        <img src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" alt="Amazon" />
        <img src="https://upload.wikimedia.org/wikipedia/commons/0/08/Flipkart_logo.svg" alt="Flipkart" />
        <img src="https://upload.wikimedia.org/wikipedia/commons/5/5d/Myntra_logo.png" alt="Myntra" />
        <img src="https://upload.wikimedia.org/wikipedia/commons/2/28/Paytm_logo.png" alt="Paytm" />
      </div>

      {/* Input + Buttons */}
      <div className="card">
        <div className="input-section">
          <input
            type="text"
            placeholder="Paste product URL here..."
            value={productURL}
            onChange={(e) => setProductURL(e.target.value)}
          />
          <button className="check-btn" onClick={handleCheck}>Check</button>
        </div>
        <button className="qr-btn">📷 Scan QR</button>
      </div>

      {/* Info Grid */}
      <div className="info-grid" id="features">
        <div className="info-card">
          <h2>🔔 Price Alerts</h2>
          <p>Get notified when the price drops. Save money smartly!</p>
        </div>
        <div className="info-card">
          <h2>💡 Smart Shopping</h2>
          <p>Compare across stores and always buy at the best price.</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>© {new Date().getFullYear()} Price Tracker. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default Home;
