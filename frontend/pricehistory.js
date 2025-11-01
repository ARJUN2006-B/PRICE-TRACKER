document.addEventListener("DOMContentLoaded", function () {
  const params = new URLSearchParams(window.location.search);
  const rawProductUrl = params.get("productUrl");
  const productUrl = rawProductUrl ? decodeURIComponent(rawProductUrl) : null;

  const productLinkEl = document.getElementById("productLink");
  const canvasEl = document.getElementById("priceChart");

  if (!productLinkEl) {
    console.error("Missing element: #productLink");
  } else {
    productLinkEl.innerText = productUrl ? `Tracking: ${productUrl}` : "No product URL provided";
  }

  if (!canvasEl) {
    console.error("Missing element: #priceChart");
    return;
  }

  // Dummy data for now
  const priceData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May"],
    prices: [999, 899, 949, 879, 929]
  };

  // Ensure Chart is available
  if (typeof Chart === "undefined") {
    console.error("Chart.js not loaded. Make sure you included Chart.js before this script.");
    return;
  }

  const ctx = canvasEl.getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: priceData.labels,
      datasets: [{
        label: "Price (INR)",
        data: priceData.prices,
        borderColor: "blue",
        backgroundColor: "rgba(0, 0, 255, 0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
          ticks: { callback: value => `₹${value}` }
        }
      },
      plugins: {
        legend: { display: true }
      }
    }
  });
});

