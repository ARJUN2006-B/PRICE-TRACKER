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
    alert("Please enter a valid URL (example: https://www.amazon.in/...)");
    return;
  }

  const allowedSites = ["amazon", "flipkart", "meesho", "ajio", "myntra"];
  const isValidSite = allowedSites.some(site => url.hostname.includes(site));

  if (!isValidSite) {
    alert("Please enter a valid e-commerce URL (Amazon, Flipkart, Meesho, Ajio, Myntra, etc.)");
    return;
  }

  alert("Valid URL! Proceeding with search...");
}
