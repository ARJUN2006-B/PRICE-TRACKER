function validateUrl() {
  const urlInput = document.getElementById("productUrl").value.trim();

  if (!urlInput) {
    alert("Please enter a product URL!");
    return;
  }

  let url;
  try {
    url = new URL(urlInput);
  } catch {
    alert("Invalid URL format.");
    return;
  }

  const allowedSites = ["amazon", "flipkart", "meesho"];
  const isValidSite = allowedSites.some(site => url.hostname.includes(site));

  if (!isValidSite) {
    alert("Unsupported e-commerce site. Only Amazon, Flipkart, and Meesho are supported.");
    return;
  }

  // Redirect to price.html with encoded URL
  window.location.href = `pricehistory.html?productUrl=${encodeURIComponent(urlInput)}`;
}
