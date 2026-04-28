const adminToken = localStorage.getItem("adminToken");
if (!adminToken) {
  alert("Please login as admin first");
  window.location.href = "index.html";
}

const NON_EMERGENCY_TYPE_KEYS = new Set([
  "non-emergency",
  "non emergency",
  "nonemergency",
  "cleaning operations",
  "big events",
  "school events",
  "community activities",
  "public gathering",
  "training exercise",
  "other",
]);

function normalizeIncidentType(value = "") {
  const normalized = String(value).trim().toLowerCase();
  if (NON_EMERGENCY_TYPE_KEYS.has(normalized)) {
    return "Non-Emergency";
  }
  return String(value).trim();
}

document.addEventListener("DOMContentLoaded", function () {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.querySelector('input[name="datetime"]').value = now
    .toISOString()
    .slice(0, 16);
  loadLGUs();
});

async function loadLGUs() {
  try {
    const lgusRes = await fetch("/api/lgus");
    if (!lgusRes.ok) throw new Error("Failed to fetch LGUs");
    const lgus = await lgusRes.json();
    lgus.forEach((lgu) => {
      const opt = document.createElement("option");
      opt.value = lgu.id;
      opt.textContent = lgu.name;
      document.getElementById("lguSelect").appendChild(opt);
    });
  } catch (err) {
    console.error("Error fetching LGUs:", err);
    alert("Error loading cities/municipalities");
  }
}

document
  .getElementById("lguSelect")
  .addEventListener("change", async function () {
    const selectedLguId = this.value;
    const barangaySelect = document.getElementById("barangaySelect");
    barangaySelect.innerHTML =
      '<option value="" disabled selected>Select Barangay</option>';
    if (!selectedLguId) return;
    try {
      const res = await fetch(`/api/barangays/${selectedLguId}`);
      if (!res.ok) throw new Error("Failed to fetch barangays");
      const barangays = await res.json();
      barangays.forEach((brgy) => {
        const opt = document.createElement("option");
        opt.value = brgy.name;
        opt.textContent = brgy.name;
        barangaySelect.appendChild(opt);
      });
    } catch (err) {
      console.error("Error fetching barangays:", err);
      alert("Error loading barangays");
    }
  });

document.getElementById("reportForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const lguSelect = document.getElementById("lguSelect");
  const barangaySelect = document.getElementById("barangaySelect");
  const lguName = lguSelect.options[lguSelect.selectedIndex].text;
  const barangayName = barangaySelect.value;

  const payload = {
    title: form.operation_name.value.trim(),
    type: normalizeIncidentType(form.disaster_type.value),
    severity: form.severity.value,
    lgu: lguName,
    barangay: barangayName,
    location: `${lguName}, ${barangayName}`,
    datetime: form.datetime.value,
    description: form.description.value.trim(),
    remarks: form.remarks.value.trim(),
    affected_population: form.affected_population.value
      ? parseInt(form.affected_population.value)
      : null,
  };

  try {
    const res = await fetch("/api/incident", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      alert("✓ Report created successfully! (ID: " + data.incident_id + ")");
      form.reset();
    } else {
      alert("✗ Failed to create report: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    console.error(err);
    alert("✗ Error creating report. Please try again.");
  }
});

function logout() {
  localStorage.removeItem("adminToken");
  window.location.href = "index.html";
}
