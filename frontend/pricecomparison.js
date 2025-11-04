// pricecomparison.js

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const productUrl = params.get("productUrl");

  if (!productUrl) {
    alert("No product URL provided!");
    return;
  }

  const container = document.getElementById("comparisonResults");
  container.innerHTML = "<p>Fetching prices, please wait...</p>";

  try {
    // Call your Node.js backend (server.js)
    const response = await fetch("http://localhost:3000/api/compare-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: productUrl }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch prices");
    }

    // Display results
    displayResults(data.results);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
});

function displayResults(results) {
  const container = document.getElementById("comparisonResults");
  container.innerHTML = `
    <h2>💰 Price Comparison</h2>
    <div class="price-grid">
      ${results
        .map(
          r => `
        <div class="price-card">
          <h3>${r.platform}</h3>
          <p class="price">${r.price ? "₹" + r.price : "❌ Not available"}</p>
          <a href="${r.link}" target="_blank">View on ${r.platform}</a>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}
