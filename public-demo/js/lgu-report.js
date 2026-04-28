let verifiedLguId = null;
let verifiedLguName = null;
let verificationModal = null;

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

window.addEventListener("load", function () {
  console.log("Page loaded, initializing verification modal...");

  const modalElement = document.getElementById("lguVerificationModal");
  if (!modalElement) {
    console.error("Modal element not found!");
    return;
  }

  verificationModal = new bootstrap.Modal(modalElement, {
    backdrop: "static",
    keyboard: false,
  });

  verificationModal.show();
  console.log("Verification modal shown");

  setTimeout(() => {
    document.getElementById("lguCodeInput").focus();
  }, 500);

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.querySelector('input[name="datetime"]').value = now
    .toISOString()
    .slice(0, 16);

  document.getElementById("lguCodeInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      verifyLguCode();
    }
  });

  document
    .getElementById("reportForm")
    .addEventListener("submit", handleReportSubmit);
});

async function verifyLguCode() {
  const lguCode = document.getElementById("lguCodeInput").value.trim();
  const errorDiv = document.getElementById("verificationError");

  if (!lguCode) {
    errorDiv.textContent = "Please enter an LGU code";
    return;
  }

  errorDiv.textContent = "";

  try {
    const res = await fetch("/api/lgu/verify-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lgu_code: lguCode }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      verifiedLguId = data.lgu_id;
      verifiedLguName = data.lgu_name;
      document.getElementById("lguName").textContent = verifiedLguName;

      console.log("LGU verified:", verifiedLguName);

      if (verificationModal) {
        verificationModal.hide();
      }

      loadBarangays();
      loadMyIncidents();

      const toggleButtonContainer = document.getElementById(
        "toggleIncidentsButtonContainer",
      );
      if (toggleButtonContainer) {
        toggleButtonContainer.style.display = "block";
      }
    } else {
      errorDiv.textContent =
        data.error || "Invalid LGU code. Please try again.";
    }
  } catch (err) {
    console.error("Verification error:", err);
    errorDiv.textContent = "Error verifying code. Please try again.";
  }
}

async function loadBarangays() {
  try {
    const lgusRes = await fetch("/api/lgus");
    if (!lgusRes.ok) throw new Error("Failed to fetch LGUs");
    const lgus = await lgusRes.json();

    const lguObj = lgus.find((l) => l.id === verifiedLguId);
    if (!lguObj) throw new Error("LGU not found");

    const res = await fetch(`/api/barangays/${lguObj.id}`);
    if (!res.ok) throw new Error("Failed to fetch barangays");
    const barangays = await res.json();

    const barangaySelect = document.getElementById("barangaySelect");
    barangays.forEach((brgy) => {
      const opt = document.createElement("option");
      opt.value = brgy.name;
      opt.textContent = brgy.name;
      barangaySelect.appendChild(opt);
    });
  } catch (err) {
    console.error("Error loading barangays:", err);
    alert("Error loading barangays");
  }
}

async function handleReportSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const barangaySelect = document.getElementById("barangaySelect");
  const barangayName = barangaySelect.value;

  if (!verifiedLguName) {
    alert("Please verify your LGU code first");
    return;
  }

  const payload = {
    title: form.operation_name.value.trim(),
    type: normalizeIncidentType(form.disaster_type.value),
    severity: form.severity.value,
    lgu: verifiedLguName,
    barangay: barangayName,
    location: `${verifiedLguName}, ${barangayName}`,
    datetime: form.datetime.value,
    description: form.description.value.trim(),
    remarks: form.remarks.value.trim(),
    affected_population: form.affected_population.value
      ? parseInt(form.affected_population.value)
      : null,
  };

  try {
    const res = await fetch("/api/lgu/incident", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.success) {
      alert("Report submitted successfully! (ID: " + data.incident_id + ")");
      form.reset();
      loadMyIncidents();
    } else {
      alert("Failed to submit report: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    console.error(err);
    alert("Error submitting report. Please try again.");
  }
}

async function loadMyIncidents() {
  if (!verifiedLguName) {
    console.log("LGU not verified yet, skipping incident load");
    return;
  }

  const tableBody = document.getElementById("incidentsTableBody");
  const myIncidentsSection = document.getElementById("myIncidentsSection");
  const noIncidentsMessage = document.getElementById("noIncidentsMessage");
  const tableContainer = document.getElementById("incidentsTableContainer");

  try {
    const res = await fetch(
      `/api/lgu/my-incidents/${encodeURIComponent(verifiedLguName)}`,
    );

    if (!res.ok) {
      throw new Error("Failed to fetch incidents");
    }

    const data = await res.json();

    if (data.success && data.incidents && data.incidents.length > 0) {
      tableContainer.style.display = "block";
      noIncidentsMessage.style.display = "none";

      // Store incidents globally
      allIncidents = data.incidents;

      tableBody.innerHTML = data.incidents
        .map(
          (incident) => `
          <tr class="incident-row" onclick="viewIncidentDetails(${incident.id})" style="cursor: pointer;">
            <td><strong>#${incident.id}</strong></td>
            <td>${escapeHtml(incident.title)}</td>
            <td>${escapeHtml(incident.type || "-")}</td>
            <td>${capitalizeFirst(incident.severity || "-")}</td>
            <td>${escapeHtml(incident.barangay || incident.location)}</td>
            <td>${getStatusLabel(incident.status)}</td>
            <td>${formatDateTime(incident.created_at)}</td>
          </tr>
        `,
        )
        .join("");
    } else {
      tableContainer.style.display = "none";
      noIncidentsMessage.style.display = "block";
    }
  } catch (err) {
    console.error("Error loading incidents:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-3">
          Error loading incidents. Please try again.
        </td>
      </tr>
    `;
  }
}

function getStatusLabel(status) {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();
  const statusMap = {
    reported: "Reported",
    active: "Reported",
    activated: "Activated",
    ongoing: "Ongoing",
    resolved: "Resolved",
  };

  return (
    statusMap[normalizedStatus] || capitalizeFirst(normalizedStatus || "-")
  );
}

function formatDateTime(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  const options = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return date.toLocaleDateString("en-US", options);
}

function capitalizeFirst(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function viewIncidentDetails(incidentId) {
  const incident = allIncidents?.find((i) => i.id === incidentId);

  if (!incident) {
    alert("Incident details not found.");
    return;
  }

  // Populate modal content
  const modalBody = document.getElementById("incidentDetailsBody");
  modalBody.innerHTML = `
    <div class="incident-details-content">
      <div class="row g-3">
        <div class="col-md-6">
          <div class="detail-card">
            <label class="detail-label">Incident ID</label>
            <div class="detail-value">#${incident.id}</div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="detail-card">
            <label class="detail-label">Status</label>
            <div class="detail-value">${getStatusLabel(incident.status)}</div>
          </div>
        </div>
        <div class="col-12">
          <div class="detail-card">
            <label class="detail-label">Title</label>
            <div class="detail-value">${escapeHtml(incident.title)}</div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="detail-card">
            <label class="detail-label">Type</label>
            <div class="detail-value">${escapeHtml(incident.type || "-")}</div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="detail-card">
            <label class="detail-label">Severity</label>
            <div class="detail-value">${capitalizeFirst(incident.severity || "-")}</div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="detail-card">
            <label class="detail-label">Date & Time</label>
            <div class="detail-value">${incident.datetime ? formatDateTime(incident.datetime) : "N/A"}</div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="detail-card">
            <label class="detail-label">LGU</label>
            <div class="detail-value">${escapeHtml(incident.lgu || "N/A")}</div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="detail-card">
            <label class="detail-label">Barangay</label>
            <div class="detail-value">${escapeHtml(incident.barangay || "N/A")}</div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="detail-card">
            <label class="detail-label">Affected Population</label>
            <div class="detail-value">${incident.affected_population ? incident.affected_population.toLocaleString() : "N/A"}</div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="detail-card">
            <label class="detail-label">Reported On</label>
            <div class="detail-value">${formatDateTime(incident.created_at)}</div>
          </div>
        </div>
        <div class="col-12">
          <div class="detail-card">
            <label class="detail-label">Description</label>
            <div class="detail-value detail-description">${escapeHtml(incident.description || "No description provided.")}</div>
          </div>
        </div>
        ${
          incident.remarks
            ? `
        <div class="col-12">
          <div class="detail-card">
            <label class="detail-label">Remarks / Needs</label>
            <div class="detail-value detail-description">${escapeHtml(incident.remarks)}</div>
          </div>
        </div>
        `
            : ""
        }
      </div>
    </div>
  `;

  // Show modal
  const modal = new bootstrap.Modal(
    document.getElementById("incidentDetailsModal"),
  );
  modal.show();
}

let allIncidents = [];

async function loadMyIncidentsWithCache() {
  if (!verifiedLguName) {
    console.log("LGU not verified yet, skipping incident load");
    return;
  }

  try {
    const res = await fetch(
      `/api/lgu/my-incidents/${encodeURIComponent(verifiedLguName)}`,
    );

    if (!res.ok) {
      throw new Error("Failed to fetch incidents");
    }

    const data = await res.json();

    if (data.success && data.incidents) {
      allIncidents = data.incidents;
    }

    loadMyIncidents();
  } catch (err) {
    console.error("Error loading incidents:", err);
  }
}

function showIncidentsPage() {
  const reportFormSection = document.getElementById("reportFormSection");
  const incidentsSection = document.getElementById("myIncidentsSection");
  const toggleButtonContainer = document.getElementById(
    "toggleIncidentsButtonContainer",
  );

  reportFormSection.style.display = "none";
  toggleButtonContainer.style.display = "none";
  incidentsSection.style.display = "block";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showReportFormPage() {
  const reportFormSection = document.getElementById("reportFormSection");
  const incidentsSection = document.getElementById("myIncidentsSection");
  const toggleButtonContainer = document.getElementById(
    "toggleIncidentsButtonContainer",
  );

  incidentsSection.style.display = "none";
  reportFormSection.style.display = "block";
  toggleButtonContainer.style.display = "block";

  window.scrollTo({ top: 0, behavior: "smooth" });
}
