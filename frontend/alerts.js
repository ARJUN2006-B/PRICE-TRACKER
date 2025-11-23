async function loadAlerts() {
  const container = document.getElementById("alerts-container");
  const noAlerts = document.getElementById("noAlerts");

  container.innerHTML = "";
  const res = await fetch("http://localhost:3000/api/user/alerts");
  const alerts = await res.json();

  if (!alerts.length) {
    noAlerts.style.display = "block";
    return;
  }

  noAlerts.style.display = "none";

  alerts.forEach(a => {
    const card = document.createElement("div");
    card.style = `
      display: flex; gap:10px; border:1px solid #ddd;
      padding:10px; border-radius:8px; align-items:center;
    `;

    card.innerHTML = `
      <img src="${a.image}" style="width:70px; border-radius:6px;">
      <div style="flex:1;">
        <h3 style="margin:0; font-size:17px;">${a.title}</h3>
        <p style="margin:4px 0;">🔔 Target: ₹${a.target_price}</p>
        <a href="${a.url}" target="_blank" style="color:#ff9900;">View on Amazon</a>
      </div>
      <button style="padding:8px 12px; border:none; background:red; color:white; border-radius:6px; cursor:pointer;"
        onclick="deleteAlert('${a.asin}', '${a.watcherId}')">Delete</button>
    `;

    container.appendChild(card);
  });
}

async function deleteAlert(asin, watcherId) {
  if (!confirm("Delete this alert?")) return;

  await fetch(`http://localhost:3000/api/watch/${asin}/${watcherId}`, {
    method: "DELETE",
  });

  loadAlerts();
}

loadAlerts();