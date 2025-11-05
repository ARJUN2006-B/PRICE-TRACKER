// pricecomparison.js

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const productUrl = params.get("productUrl");

  if (!productUrl) {
    alert("No product URL found! Please go back and enter a link.");
    return;
  }

  document.getElementById("productTitle").textContent = `Comparing prices for: ${productUrl}`;
  document.getElementById("loading").style.display = "block";

  try {
    // ✅ Send the URL to your backend route
    const response = await fetch("http://localhost:3000/api/compare-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: productUrl }),
    });

    const data = await response.json();
    document.getElementById("loading").style.display = "none";

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch prices");
    }

    // ✅ Fill in each platform price
    data.results.forEach((result) => {
      const id = result.platform.toLowerCase() + "Price";
      const priceElement = document.getElementById(id);
      if (priceElement) {
        if (result.price) {
          priceElement.textContent = `₹${result.price}`;
        } else {
          priceElement.textContent = "Not available";
        }
      }
    });
  } catch (error) {
    document.getElementById("loading").style.display = "none";
    alert("Error fetching comparison prices: " + error.message);
  }
});
