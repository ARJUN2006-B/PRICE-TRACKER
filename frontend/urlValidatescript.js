// urlValidatescript.js

function validateUrl() {
  const input = document.getElementById("productUrl").value.trim();
  if (!input) {
    alert("Please enter a product URL!");
    return;
  }

  const validDomains = ["amazon", "flipkart", "meesho", "jiomart"];
  const isValid = validDomains.some(domain => input.includes(domain));

  if (!isValid) {
    alert("Please enter a valid product URL (Amazon, Flipkart, Meesho, or JioMart)");
    return;
  }

  // ✅ Redirect to pricecomparison.html with encoded URL
  const encodedUrl = encodeURIComponent(input);
  window.location.href = `pricecomparison.html?productUrl=${encodedUrl}`;
}
