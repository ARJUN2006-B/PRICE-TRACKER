function validateUrl() {
  const urlInput = document.getElementById("productUrl").value.trim();

  if (urlInput === "") {
    alert("Please enter a product URL!");
    return;
  }

  let url;
  try {
    url = new URL(urlInput);
  } catch (e) {
    alert("Invalid URL format.");
    return;
  }

  const allowedSites = ["amazon", "flipkart", "meesho", "ajio", "myntra"];
  const isValidSite = allowedSites.some(site => url.hostname.includes(site));

  if (!isValidSite) {
    alert("Unsupported e-commerce site.");
    return;
  }

  // ✅ Redirect to pricehistory.html with the product URL as a query parameter
  window.location.href = `pricehistory.html?productUrl=${encodeURIComponent(urlInput)}`;
}
