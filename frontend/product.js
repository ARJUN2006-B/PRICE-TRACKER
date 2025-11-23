// product.js

const urlParams = new URLSearchParams(window.location.search);
const asin = urlParams.get("asin");

if (!asin) {
  alert("Invalid product link. Redirecting to Home.");
  window.location.href = "Home.html";
}

window.PRODUCT_ASIN = asin;

// DOM elements
const titleEl = document.getElementById("product-title");
const imgEl = document.getElementById("product-image");
const priceEl = document.getElementById("latest-price");
const historyTable = document.getElementById("history-body");
const chartCanvas = document.getElementById("priceChart");
const viewOnAmazonBtn = document.getElementById("view-on-amazon");

let priceChart = null;

// your project id
const PROJECT_ID = "price-tracker-5b9dd";

// -------- Load product metadata from Firestore REST --------
async function loadProductMeta() {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products/${asin}`;

  const res = await fetch(url);
  const meta = await res.json();

  if (!meta.fields) {
    titleEl.innerText = "Product not found in database";
    priceEl.innerText = "Unavailable";
    return;
  }

  const fields = meta.fields;
  const title = fields.title?.stringValue || "Unknown product";
  const image = fields.image?.stringValue || "";
  const lastPriceText =
    fields.last_price_text?.stringValue ||
    (fields.last_price?.integerValue
      ? "₹" + Number(fields.last_price.integerValue).toLocaleString()
      : fields.last_price?.doubleValue
      ? "₹" + Number(fields.last_price.doubleValue).toLocaleString()
      : "Unavailable");
  const urlField = fields.url?.stringValue || "";

  titleEl.innerText = title;
  if (image) {
    imgEl.src = image;
  } else {
    imgEl.alt = "No image available";
  }
  priceEl.innerText = lastPriceText;

  if (urlField) {
    viewOnAmazonBtn.onclick = () => {
      window.open(urlField, "_blank");
    };
  } else {
    viewOnAmazonBtn.style.display = "none";
  }
}

// -------- Load price history from backend --------
async function loadPriceHistory() {
  const res = await fetch(`http://localhost:3000/api/prices/${asin}`);
  const history = await res.json();

  if (!Array.isArray(history) || history.length === 0) {
    historyTable.innerHTML =
      "<tr><td colspan='2' style='text-align:center; padding:10px;'>No price history yet.</td></tr>";
    return;
  }

  const labels = [];
  const prices = [];

  historyTable.innerHTML = "";

  history.forEach((entry) => {
    const date = new Date(entry.timestamp);
    const label = date.toLocaleString();
    labels.push(label);

    // use numeric price if available
    let numeric = null;
    if (entry.price !== null && entry.price !== undefined) {
      numeric = Number(entry.price);
    } else if (entry.price_text) {
      numeric = Number(String(entry.price_text).replace(/[^0-9.]/g, ""));
    }

    if (!isNaN(numeric)) {
      prices.push(numeric);
    } else {
      prices.push(null);
    }

    const displayPrice =
      entry.price_text ||
      (!isNaN(numeric) ? "₹" + numeric.toLocaleString() : "Unavailable");

    const row = `
      <tr>
        <td style="padding: 6px; border: 1px solid #ddd;">${label}</td>
        <td style="padding: 6px; border: 1px solid #ddd;">${displayPrice}</td>
      </tr>
    `;
    historyTable.innerHTML += row;
  });

  drawChart(labels, prices);
}

// -------- Draw chart with Chart.js --------
function drawChart(labels, prices) {
  if (priceChart) {
    priceChart.destroy();
  }

  // Filter out null prices for chart
  const filteredLabels = [];
  const filteredPrices = [];
  labels.forEach((l, idx) => {
    if (prices[idx] !== null) {
      filteredLabels.push(l);
      filteredPrices.push(prices[idx]);
    }
  });

  if (filteredPrices.length === 0) {
    // no numeric data to chart
    chartCanvas.replaceWith(document.createTextNode("No numeric price data to plot yet."));
    return;
  }

  priceChart = new Chart(chartCanvas, {
    type: "line",
    data: {
      labels: filteredLabels,
      datasets: [
        {
          label: "Price (₹)",
          data: filteredPrices,
          borderColor: "#6a0dad",
          backgroundColor: "rgba(106, 13, 173, 0.15)",
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: false,
          title: { display: true, text: "Price (₹)" },
        },
        x: {
          title: { display: true, text: "Date / Time" },
        },
      },
    },
  });
}

// -------- Init --------
async function init() {
  await loadProductMeta();
  await loadPriceHistory();
}

init();
