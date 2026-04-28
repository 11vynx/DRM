let authToken = localStorage.getItem("adminToken");
let adminProfile = null;
let activatedPortalUrls =
  JSON.parse(localStorage.getItem("activatedPortalUrls")) || {};
let portalManagementInterval = null;
let currentPortalData = null;
let allPortalInstances = [];

function setDashboardVisibility(isVisible) {
  const dashboardSection = document.getElementById("dashboardSection");
  if (!dashboardSection) return;

  if (isVisible) {
    dashboardSection.classList.remove("hidden");
  } else {
    dashboardSection.classList.add("hidden");
  }
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatRosterCounts(user) {
  const personnel = Number(user.personnel_count || 0);
  const vehicles = Number(user.vehicle_count || 0);
  const equipment = Number(user.equipment_count || 0);
  return `P${personnel} / V${vehicles} / E${equipment}`;
}

function normalizeIncidentStatusLabel(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  const statusMap = {
    reported: "Reported",
    active: "Reported",
    activated: "Activated",
    ongoing: "Ongoing",
    resolved: "Resolved",
  };

  return statusMap[normalized] || capitalizeFirst(normalized || "-");
}

if (authToken) {
  loadAdminProfile();
} else {
  window.location.href = "adminlogin.html";
}

async function loadAdminProfile() {
  try {
    const tokenPayload = JSON.parse(atob(authToken.split(".")[1]));
    adminProfile = {
      email: tokenPayload.email,
      name: "Administrator",
    };

    setDashboardVisibility(true);
    updateAdminProfileUI();

    await loadDashboard();
  } catch (error) {
    console.error("Error loading admin profile:", error);
    setDashboardVisibility(false);
    localStorage.removeItem("adminToken");
    window.location.href = "adminlogin.html";
  }
}

function updateAdminProfileUI() {
  if (!adminProfile) return;

  document.getElementById("adminName").textContent =
    adminProfile.name || adminProfile.email.split("@")[0];
  document.getElementById("adminAvatar").textContent = (
    adminProfile.name || adminProfile.email
  )
    .charAt(0)
    .toUpperCase();
}

function showMessage(message, type) {
  const messageDiv = document.getElementById("dashboardMessage");
  if (!messageDiv) {
    console.warn("Dashboard message container is missing:", message);
    return;
  }
  messageDiv.innerHTML = message;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = "block";
  setTimeout(() => (messageDiv.style.display = "none"), 5000);
}

function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      alert("Portal link copied to clipboard!");
    })
    .catch(() => {
      alert("Failed to copy. Please copy manually: " + text);
    });
}

function openModal(modalId) {
  document.getElementById(modalId).style.display = "block";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

async function logout() {
  try {
    await fetch("/api/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
    });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    localStorage.removeItem("adminToken");
    window.location.href = "adminlogin.html";
  }
}

window.onclick = function (event) {
  const modals = document.querySelectorAll(".modal");
  modals.forEach((modal) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
};

function showTab(tabName, evt) {
  document
    .querySelectorAll(".sidebar-menu a")
    .forEach((link) => link.classList.remove("active"));

  if (evt && evt.target) {
    let el = evt.target;
    if (el.tagName.toLowerCase() !== "a") el = el.closest("a");
    if (el) el.classList.add("active");
  } else {
    const fallback = Array.from(
      document.querySelectorAll(".sidebar-menu a"),
    ).find(
      (a) =>
        a.getAttribute("onclick") &&
        a.getAttribute("onclick").includes(`'${tabName}'`),
    );
    if (fallback) fallback.classList.add("active");
  }

  if (portalManagementInterval) {
    clearInterval(portalManagementInterval);
    portalManagementInterval = null;
  }

  [
    "dashboardTab",
    "incidentsTab",
    "downloadableFormsTab",
    "portalManagementTab",
    "mapTab",
    "agencyCheckInTab",
    "postIncidentLogsTab",
    "pendingTab",
    "allTab",
    "incidentsTab",
    "manageUsersTab",
  ].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.style.display = "none";
  });

  if (tabName !== "map") {
    selectedMapIncidentId = null;
    selectedMapIncidentTitle = "";
    currentMapView = "incidents";
  }

  if (tabName === "reports") return;

  const targetTab = document.getElementById(tabName + "Tab");
  if (targetTab) {
    targetTab.style.display = "block";
    if (tabName === "dashboard") {
      loadDashboard();
    } else if (tabName === "incidents") {
      loadIncidents();
    } else if (tabName === "downloadableForms") {
      loadDownloadableForms();
    } else if (tabName === "portalManagement") {
      loadPortalManagement();
    } else if (tabName === "map") {
      loadMapView();
    } else if (tabName === "agencyCheckIn") {
      loadAgencyCheckIn();
    } else if (tabName === "postIncidentLogs") {
      loadPostIncidentLogs();
    } else if (tabName === "manageUsers") {
      // Initialize with LGU Users subtab
      showUserSubTab("lguUsers", null);
      // Set the first button as active
      const firstButton = document.querySelector(".user-subtab");
      if (firstButton) {
        firstButton.style.borderBottomColor = "#3498db";
        firstButton.style.color = "#3498db";
      }
    }
  }
}

let currentIncidentId = null;
let openPortalProvisionFromActivation = false;
let pendingActivationPortalLocation = null;
let allIncidents = [];
let allPostIncidentReports = [];
let filteredPostIncidentReports = [];
let currentPostIncidentReport = null;
let currentReportPreview = null;
let dashboardRangeState = {
  mode: "30d",
  startDate: null,
  endDate: null,
};
let downloadableFormsData = {
  incidents: [],
  agencyCheckIns: [],
  postIncidentReports: [],
};

const SYSTEM_WIDE_LGUS = [
  "Banga",
  "Koronadal",
  "Lake Sebu",
  "Norala",
  "Polomolok",
  "Santo Nino",
  "Surallah",
  "T'boli",
  "Tampakan",
  "Tantangan",
  "Tupi",
];

const normalizeLguFilterKey = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['`.]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const LGU_FILTER_ALIAS_MAP = {
  banga: "Banga",
  "banga (sc)": "Banga",
  koronadal: "Koronadal",
  "koronadal city": "Koronadal",
  "lake sebu": "Lake Sebu",
  norala: "Norala",
  polomolok: "Polomolok",
  "santo nino": "Santo Nino",
  "santo nino (sc)": "Santo Nino",
  "sto nino": "Santo Nino",
  "sto nino (sc)": "Santo Nino",
  surallah: "Surallah",
  tboli: "T'boli",
  "t boli": "T'boli",
  "t'boli": "T'boli",
  tampakan: "Tampakan",
  tantangan: "Tantangan",
  tupi: "Tupi",
};

function toCanonicalLguFilterValue(value = "") {
  const normalized = normalizeLguFilterKey(value);
  return LGU_FILTER_ALIAS_MAP[normalized] || String(value || "").trim();
}

async function loadIncidents() {
  try {
    initializeIncidentsRangeControls();

    const response = await fetch("/api/admin/all-incidents", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load incidents");
    }

    const data = await response.json();
    allIncidents = data.incidents || [];
    populateLguFilterOptions(allIncidents);

    await loadActivatedPortals();

    updateIncidentsRangeHint();
    filterAndDisplayIncidents();
  } catch (error) {
    console.error("Error loading incidents:", error);
    showMessage("Error loading incidents", "error");
  }
}

function populateLguFilterOptions(incidents) {
  const lguFilter = document.getElementById("lguFilter");
  if (!lguFilter) return;

  const selectedValue = lguFilter.value || "";
  const lguOptions = [...SYSTEM_WIDE_LGUS];

  lguFilter.innerHTML =
    '<option value="">All LGUs</option>' +
    lguOptions
      .map(
        (lgu) =>
          `<option value="${escapeHtml(lgu)}">${escapeHtml(lgu)}</option>`,
      )
      .join("");

  const optionValues = Array.from(lguFilter.options).map(
    (option) => option.value,
  );
  lguFilter.value = optionValues.includes(selectedValue) ? selectedValue : "";
}

async function loadActivatedPortals() {
  try {
    const response = await fetch("/api/admin/portals", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load portals");
    }

    const data = await response.json();
    const portals = data.portals || [];

    portals.forEach((portal) => {
      if (portal.activated_incident_id && portal.portal_location) {
        activatedPortalUrls[portal.activated_incident_id] = {
          portalLocation: portal.portal_location,
          url: portal.portal_url || "",
        };
      }
    });

    localStorage.setItem(
      "activatedPortalUrls",
      JSON.stringify(activatedPortalUrls),
    );
  } catch (error) {
    console.error("Error loading activated portals:", error);
  }
}

async function loadDashboard() {
  const dashboardTab = document.getElementById("dashboardTab");

  try {
    if (!dashboardTab) {
      console.warn("Dashboard elements not found, skipping dashboard load");
      return;
    }

    dashboardTab.style.display = "block";

    const response = await fetch("/api/admin/all-incidents", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load incidents");
    }

    const data = await response.json();
    allIncidents = data.incidents || [];
    await loadActivatedPortals();

    initializeDashboardRangeControls();
    applyDashboardRange(false);
  } catch (error) {
    console.error("Error loading dashboard:", error);
    if (document.getElementById("dashboardMessage")) {
      showMessage("Error loading dashboard", "error");
    }
    if (dashboardTab) {
      dashboardTab.style.display = "block";
    }
  }
}

function calculateIncidentAverages(incidents) {
  if (!incidents || incidents.length === 0) {
    return { perDay: 0, perWeek: 0, perMonth: 0, daysPeriod: 0 };
  }

  const dates = incidents
    .map((i) => new Date(i.created_at))
    .sort((a, b) => a - b);

  const oldestDate = dates[0];
  const newestDate = dates[dates.length - 1];

  const daysDiff = Math.max(
    1,
    Math.floor((newestDate - oldestDate) / (1000 * 60 * 60 * 24)),
  );

  const totalIncidents = incidents.length;
  const perDay = totalIncidents / Math.max(1, daysDiff);
  const perWeek = perDay * 7;
  const perMonth = perDay * 30;

  return {
    perDay: perDay,
    perWeek: perWeek,
    perMonth: perMonth,
    daysPeriod: daysDiff,
  };
}

function updateAverageIndicators(averages) {
  const dashboardTab = document.getElementById("dashboardTab");
  if (!dashboardTab) return;

  let averageSection = document.getElementById("dashboardAverages");

  if (!averageSection) {
    const h2 = dashboardTab.querySelector("h2");
    if (!h2) return;
    averageSection = document.createElement("div");
    averageSection.id = "dashboardAverages";
    h2.insertAdjacentElement("afterend", averageSection);
  }

  averageSection.innerHTML = `
    <div style="background: #f8f9fa; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
      <div style="background: white; border-radius: 6px; padding: 1rem; border-left: 4px solid #3498db;">
        <div style="font-size: 0.85rem; color: #666; margin-bottom: 0.5rem;">Avg Incidents Per Day</div>
        <div style="font-size: 1.8rem; font-weight: bold; color: #3498db;">${averages.perDay.toFixed(
          2,
        )}</div>
      </div>
      <div style="background: white; border-radius: 6px; padding: 1rem; border-left: 4px solid #9b59b6;">
        <div style="font-size: 0.85rem; color: #666; margin-bottom: 0.5rem;">Avg Incidents Per Week</div>
        <div style="font-size: 1.8rem; font-weight: bold; color: #9b59b6;">${averages.perWeek.toFixed(
          2,
        )}</div>
      </div>
      <div style="background: white; border-radius: 6px; padding: 1rem; border-left: 4px solid #e74c3c;">
        <div style="font-size: 0.85rem; color: #666; margin-bottom: 0.5rem;">Avg Incidents Per Month</div>
        <div style="font-size: 1.8rem; font-weight: bold; color: #e74c3c;">${averages.perMonth.toFixed(
          2,
        )}</div>
      </div>
    </div>
  `;
}

function displayRecentIncidents() {
  const tbody = document.getElementById("recentIncidentsBody");
  if (!tbody) return;

  const recent = allIncidents.slice(0, 10);

  if (recent.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #999;">No incidents found</td></tr>';
    return;
  }

  tbody.innerHTML = recent
    .map((incident) => {
      const statusColors = {
        active: "#e74c3c",
        activated: "#f39c12",
        ongoing: "#3498db",
        resolved: "#27ae60",
      };

      const statusColor =
        statusColors[String(incident.status || "").toLowerCase()] || "#95a5a6";
      const date = new Date(incident.created_at).toLocaleDateString();

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; cursor: pointer;" onclick="viewIncidentDetails(${
          incident.id
        })">
          <td style="padding: 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${
            incident.title
          }</td>
          <td style="padding: 0.75rem;">${incident.type || "N/A"}</td>
          <td style="padding: 0.75rem;">${incident.severity || "N/A"}</td>
          <td style="padding: 0.75rem;">
            <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.85rem; text-transform: capitalize;">
              ${normalizeIncidentStatusLabel(incident.status)}
            </span>
          </td>
          <td style="padding: 0.75rem;">${date}</td>
        </tr>
      `;
    })
    .join("");
}

function initializeDashboardRangeControls() {
  const select = document.getElementById("dashboardRangeSelect");
  const customWrapper = document.getElementById("dashboardCustomDateInputs");
  const startInput = document.getElementById("dashboardStartDate");
  const endInput = document.getElementById("dashboardEndDate");
  if (!select || !customWrapper || !startInput || !endInput) return;

  if (!select.dataset.initialized) {
    select.addEventListener("change", onDashboardRangeModeChanged);
    select.dataset.initialized = "true";
  }

  ensureDefaultRangeDates();
  syncRangeControlsToState();
}

function initializeIncidentsRangeControls() {
  const select = document.getElementById("incidentsRangeSelect");
  const customWrapper = document.getElementById("incidentsCustomDateInputs");
  const startInput = document.getElementById("incidentsStartDate");
  const endInput = document.getElementById("incidentsEndDate");
  if (!select || !customWrapper || !startInput || !endInput) return;

  if (!select.dataset.initialized) {
    select.addEventListener("change", onIncidentsRangeModeChanged);
    select.dataset.initialized = "true";
  }

  ensureDefaultRangeDates();
  syncRangeControlsToState();
}

function ensureDefaultRangeDates() {
  if (dashboardRangeState.startDate && dashboardRangeState.endDate) {
    return;
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 29);

  dashboardRangeState.startDate = startDate.toISOString().slice(0, 10);
  dashboardRangeState.endDate = endDate.toISOString().slice(0, 10);
}

function syncRangeControlsToState() {
  const dashboardSelect = document.getElementById("dashboardRangeSelect");
  const dashboardCustom = document.getElementById("dashboardCustomDateInputs");
  const dashboardStart = document.getElementById("dashboardStartDate");
  const dashboardEnd = document.getElementById("dashboardEndDate");

  if (dashboardSelect) dashboardSelect.value = dashboardRangeState.mode;
  if (dashboardStart)
    dashboardStart.value = dashboardRangeState.startDate || "";
  if (dashboardEnd) dashboardEnd.value = dashboardRangeState.endDate || "";
  if (dashboardCustom) {
    dashboardCustom.style.display =
      dashboardRangeState.mode === "custom" ? "flex" : "none";
  }

  const incidentsSelect = document.getElementById("incidentsRangeSelect");
  const incidentsCustom = document.getElementById("incidentsCustomDateInputs");
  const incidentsStart = document.getElementById("incidentsStartDate");
  const incidentsEnd = document.getElementById("incidentsEndDate");

  if (incidentsSelect) incidentsSelect.value = dashboardRangeState.mode;
  if (incidentsStart)
    incidentsStart.value = dashboardRangeState.startDate || "";
  if (incidentsEnd) incidentsEnd.value = dashboardRangeState.endDate || "";
  if (incidentsCustom) {
    incidentsCustom.style.display =
      dashboardRangeState.mode === "custom" ? "flex" : "none";
  }
}

function onDashboardRangeModeChanged() {
  const select = document.getElementById("dashboardRangeSelect");
  if (!select) return;

  dashboardRangeState.mode = select.value;
  syncRangeControlsToState();
  if (select.value !== "custom") {
    applyDashboardRange(false, "dashboard");
  }
}

function onIncidentsRangeModeChanged() {
  const select = document.getElementById("incidentsRangeSelect");
  if (!select) return;

  dashboardRangeState.mode = select.value;
  syncRangeControlsToState();
  if (select.value !== "custom") {
    applyDashboardRange(false, "incidents");
  }
}

function getDashboardRangeMeta(incidents) {
  const mode = dashboardRangeState.mode || "30d";
  const now = new Date();
  let startDate = null;
  let endDate = null;
  let label = "";

  if (mode === "all") {
    const filtered = [...incidents];
    filtered.sort(
      (left, right) => new Date(right.created_at) - new Date(left.created_at),
    );
    return {
      filtered,
      startDate: null,
      endDate: null,
      label: "All time",
    };
  }

  if (mode === "custom") {
    if (!dashboardRangeState.startDate || !dashboardRangeState.endDate) {
      throw new Error("Choose both start and end dates for custom range.");
    }
    startDate = new Date(dashboardRangeState.startDate);
    endDate = new Date(dashboardRangeState.endDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    if (startDate > endDate) {
      throw new Error("Dashboard range start date cannot be after end date.");
    }
    label = `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
  } else {
    const days = parseInt(mode.replace("d", ""), 10);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    startDate = new Date(now);
    startDate.setDate(now.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);
    label = `Last ${days} days`;
  }

  const filtered = incidents
    .filter((incident) => {
      const created = new Date(incident.created_at);
      if (Number.isNaN(created.getTime())) return false;
      return created >= startDate && created <= endDate;
    })
    .sort(
      (left, right) => new Date(right.created_at) - new Date(left.created_at),
    );

  return { filtered, startDate, endDate, label };
}

function applyDashboardRange(showNotice = true, source = "dashboard") {
  try {
    const isIncidentsSource = source === "incidents";
    const select = document.getElementById(
      isIncidentsSource ? "incidentsRangeSelect" : "dashboardRangeSelect",
    );
    const startInput = document.getElementById(
      isIncidentsSource ? "incidentsStartDate" : "dashboardStartDate",
    );
    const endInput = document.getElementById(
      isIncidentsSource ? "incidentsEndDate" : "dashboardEndDate",
    );

    if (select) {
      dashboardRangeState.mode = select.value;
    }
    if (startInput) dashboardRangeState.startDate = startInput.value || null;
    if (endInput) dashboardRangeState.endDate = endInput.value || null;

    syncRangeControlsToState();
    renderDashboardWithCurrentRange();
    updateIncidentsRangeHint();

    const incidentsTab = document.getElementById("incidentsTab");
    if (incidentsTab && incidentsTab.style.display === "block") {
      filterAndDisplayIncidents();
    }

    if (showNotice) {
      showMessage("Dashboard range updated", "success");
    }
  } catch (error) {
    console.error("Error applying dashboard range:", error);
    showMessage(error.message || "Unable to apply dashboard range", "error");
  }
}

function applyIncidentsRange(showNotice = true) {
  applyDashboardRange(showNotice, "incidents");
}

function getDashboardRangeMetaSafe(incidents) {
  try {
    return getDashboardRangeMeta(incidents || []);
  } catch (error) {
    return {
      filtered: [...(incidents || [])],
      startDate: null,
      endDate: null,
      label: "All time",
    };
  }
}

function updateIncidentsRangeHint() {
  const hint = document.getElementById("incidentsRangeHint");
  const rangeLabel = document.getElementById("incidentsRangeLabel");

  const rangeMeta = getDashboardRangeMetaSafe(allIncidents || []);
  if (hint) {
    hint.textContent = `Synced with dashboard range: ${rangeMeta.label} (${rangeMeta.filtered.length} incidents)`;
  }
  if (rangeLabel) {
    rangeLabel.textContent = `Viewing: ${rangeMeta.label}`;
  }
}

function renderDashboardWithCurrentRange() {
  const rangeMeta = getDashboardRangeMeta(allIncidents || []);
  const incidents = rangeMeta.filtered;

  const total = incidents.length;
  const active = incidents.filter((i) => i.status === "active").length;
  const activated = incidents.filter((i) => i.status === "activated").length;
  const ongoing = incidents.filter((i) => i.status === "ongoing").length;
  const resolved = incidents.filter((i) => i.status === "resolved").length;
  const openPortals = Object.keys(activatedPortalUrls).length;
  const averages = calculateIncidentAverages(incidents);

  const totalCard = document.getElementById("totalIncidentsCard");
  const totalLabel = document.getElementById("totalIncidentsLabel");
  const activeCard = document.getElementById("activeIncidentsCard");
  const activatedCard = document.getElementById("activatedPortalsCard");
  const resolvedCard = document.getElementById("resolvedIncidentsCard");
  const rangeLabel = document.getElementById("dashboardRangeLabel");

  if (totalCard) totalCard.textContent = total;
  if (totalLabel) {
    totalLabel.textContent = `${rangeMeta.label} | Avg: ${averages.perDay.toFixed(2)}/day`;
  }
  if (activeCard) activeCard.textContent = active;
  if (activatedCard) activatedCard.textContent = openPortals;
  if (resolvedCard) resolvedCard.textContent = resolved;
  if (rangeLabel) rangeLabel.textContent = `Viewing: ${rangeMeta.label}`;

  updateAverageIndicators(averages);
  displayRecentIncidentsForRange(incidents);

  if (typeof Chart === "function") {
    createStatusChart(active, activated, ongoing, resolved);
    createIncidentTrendChart(incidents, rangeMeta.startDate, rangeMeta.endDate);
    createIncidentTypeChart(incidents);
    createSeverityChart(incidents);
  } else {
    console.warn("Chart.js is not available; dashboard charts were skipped.");
  }
}

function displayRecentIncidentsForRange(incidents) {
  const tbody = document.getElementById("recentIncidentsBody");
  if (!tbody) return;

  const recent = (incidents || []).slice(0, 10);

  if (recent.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #999;">No incidents found in selected range</td></tr>';
    return;
  }

  tbody.innerHTML = recent
    .map((incident) => {
      const statusColors = {
        active: "#e74c3c",
        activated: "#f39c12",
        ongoing: "#3498db",
        resolved: "#27ae60",
      };

      const statusColor = statusColors[incident.status] || "#95a5a6";
      const date = new Date(incident.created_at).toLocaleDateString();

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; cursor: pointer;" onclick="viewIncidentDetails(${incident.id})">
          <td style="padding: 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${incident.title}</td>
          <td style="padding: 0.75rem;">${incident.type || "N/A"}</td>
          <td style="padding: 0.75rem;">${incident.severity || "N/A"}</td>
          <td style="padding: 0.75rem;">
            <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.85rem; text-transform: capitalize;">
              ${normalizeIncidentStatusLabel(incident.status)}
            </span>
          </td>
          <td style="padding: 0.75rem;">${date}</td>
        </tr>
      `;
    })
    .join("");
}

function displayActivePortalsWidget() {
  const widget = document.getElementById("activePortalsWidget");
  if (!widget) return;

  const portals = Object.entries(activatedPortalUrls);

  if (portals.length === 0) {
    widget.innerHTML =
      '<p style="color: #999; text-align: center; margin: 1rem 0;">No active portals</p>';
    return;
  }

  widget.innerHTML = portals
    .map(([incidentId, portalData]) => {
      const incident = allIncidents.find((i) => i.id == incidentId);
      const incidentTitle = incident
        ? incident.title
        : `Incident ${incidentId}`;

      return `
        <div style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600; color: #2d3748;">${incidentTitle}</div>
            <div style="font-size: 0.85rem; color: #666;">Location: ${portalData.portalLocation}</div>
          </div>
          <span style="background: #f39c12; color: white; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.85rem;">
            Active
          </span>
        </div>
      `;
    })
    .join("");
}

function createStatusChart(active, activated, ongoing, resolved) {
  const ctx = document.getElementById("statusChart");
  if (!ctx) return;

  if (window.statusChartInstance) {
    window.statusChartInstance.destroy();
  }

  window.statusChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Active", "Activated", "Ongoing", "Resolved"],
      datasets: [
        {
          data: [active, activated, ongoing, resolved],
          backgroundColor: ["#e74c3c", "#f39c12", "#3498db", "#27ae60"],
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}

function createIncidentTrendChart(incidents, startDate, endDate) {
  const ctx = document.getElementById("trendChart");
  if (!ctx) return;

  if (window.trendChartInstance) {
    window.trendChartInstance.destroy();
  }

  let rangeStart = startDate ? new Date(startDate) : null;
  let rangeEnd = endDate ? new Date(endDate) : null;

  if (!rangeEnd) {
    rangeEnd = new Date();
    rangeEnd.setHours(23, 59, 59, 999);
  }

  if (!rangeStart) {
    rangeStart = new Date(rangeEnd);
    rangeStart.setDate(rangeEnd.getDate() - 29);
  }

  rangeStart.setHours(0, 0, 0, 0);
  const days = [];

  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    const date = new Date(cursor);
    date.setHours(0, 0, 0, 0);
    days.push(date);
    cursor.setDate(cursor.getDate() + 1);
    if (days.length > 365) break;
  }

  const labels = days.map((date) =>
    date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  );

  const counts = days.map((day) => {
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);
    return incidents.filter((incident) => {
      const created = new Date(incident.created_at);
      return created >= day && created < nextDay;
    }).length;
  });

  window.trendChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Incidents",
          data: counts,
          borderColor: "#1d4ed8",
          backgroundColor: "rgba(29, 78, 216, 0.15)",
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
    },
  });
}

function createIncidentTypeChart(incidents) {
  const ctx = document.getElementById("typeChart");
  if (!ctx) return;

  if (window.typeChartInstance) {
    window.typeChartInstance.destroy();
  }

  const typeCounts = incidents.reduce((accumulator, incident) => {
    const key = (incident.type || "Unknown").trim();
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const entries = Object.entries(typeCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8);

  window.typeChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: entries.map((entry) => entry[0]),
      datasets: [
        {
          label: "Incidents",
          data: entries.map((entry) => entry[1]),
          backgroundColor: "rgba(245, 158, 11, 0.75)",
          borderColor: "#d97706",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
    },
  });
}

function createSeverityChart(incidents) {
  const ctx = document.getElementById("severityChart");
  if (!ctx) return;

  if (window.severityChartInstance) {
    window.severityChartInstance.destroy();
  }

  const severityOrder = ["low", "medium", "high", "critical"];
  const severityCounts = incidents.reduce((accumulator, incident) => {
    const key = (incident.severity || "unknown").toLowerCase();
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const labels = severityOrder
    .filter((severity) => severityCounts[severity] !== undefined)
    .map((severity) => severity.charAt(0).toUpperCase() + severity.slice(1));

  const values = severityOrder
    .filter((severity) => severityCounts[severity] !== undefined)
    .map((severity) => severityCounts[severity]);

  if (severityCounts.unknown !== undefined) {
    labels.push("Unknown");
    values.push(severityCounts.unknown);
  }

  window.severityChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: [
            "#10b981",
            "#3b82f6",
            "#f59e0b",
            "#ef4444",
            "#94a3b8",
          ],
          borderWidth: 2,
          borderColor: "#ffffff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}

function filterAndDisplayIncidents() {
  const searchInput = document
    .getElementById("searchInput")
    .value.toLowerCase();
  const statusFilter = document.getElementById("statusFilter").value;
  const lguFilter = document.getElementById("lguFilter")?.value || "";
  const selectedCanonicalLgu = toCanonicalLguFilterValue(lguFilter);

  console.log(
    "Filtering with search:",
    searchInput,
    "status:",
    statusFilter,
    "lgu:",
    selectedCanonicalLgu,
  );
  console.log("Total incidents:", allIncidents.length);

  let filtered = allIncidents.filter((incident) => {
    const incidentLgu = toCanonicalLguFilterValue(incident.lgu || "");
    const matchesLgu =
      selectedCanonicalLgu === "" || incidentLgu === selectedCanonicalLgu;

    if (!searchInput || searchInput.trim() === "") {
      const matchesStatus =
        statusFilter === "" || incident.status === statusFilter;
      return matchesStatus && matchesLgu;
    }

    const matchesSearch =
      incident.title.toLowerCase().includes(searchInput) ||
      incident.location.toLowerCase().includes(searchInput) ||
      (incident.lgu && incident.lgu.toLowerCase().includes(searchInput)) ||
      incident.type.toLowerCase().includes(searchInput) ||
      (incident.severity &&
        incident.severity.toLowerCase().includes(searchInput)) ||
      incident.status.toLowerCase().includes(searchInput) ||
      (incident.source && incident.source.toLowerCase().includes(searchInput));

    const matchesStatus =
      statusFilter === "" || incident.status === statusFilter;

    return matchesSearch && matchesStatus && matchesLgu;
  });

  const rangeMeta = getDashboardRangeMetaSafe(allIncidents || []);
  const rangeIncidentIds = new Set(
    rangeMeta.filtered.map((incident) => incident.id),
  );
  filtered = filtered.filter((incident) => rangeIncidentIds.has(incident.id));

  updateIncidentsRangeHint();

  console.log("Filtered results:", filtered.length);

  const tableBody = document.getElementById("reportsTableBody");
  tableBody.innerHTML = "";

  if (filtered.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No incidents found</td></tr>';
    return;
  }

  filtered.forEach((incident) => {
    const row = document.createElement("tr");
    const createdDate = new Date(incident.created_at).toLocaleDateString();
    let statusBadge = "";
    if (incident.status === "active") {
      statusBadge = `<span class="status-active">${normalizeIncidentStatusLabel(incident.status)}</span>`;
    } else if (incident.status === "activated") {
      statusBadge = `<span class="status-active" style="background: #f39c12;">Activated</span>`;
    } else if (incident.status === "ongoing") {
      statusBadge = `<span class="status-ongoing">${normalizeIncidentStatusLabel(incident.status)}</span>`;
    } else {
      statusBadge = `<span class="status-resolved">${normalizeIncidentStatusLabel(incident.status)}</span>`;
    }

    row.innerHTML = `
      <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${
        incident.title
      }</td>
      <td>${incident.type}</td>
      <td>${incident.severity || "N/A"}</td>
      <td>${incident.lgu || "N/A"}</td>
      <td>${incident.source || "N/A"}</td>
      <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${
        incident.location
      }</td>
      <td>${statusBadge}</td>
      <td>${createdDate}</td>
    `;

    row.style.cursor = "pointer";
    row.addEventListener("click", () => viewIncidentDetails(incident.id));
    tableBody.appendChild(row);
  });
}

async function viewIncidentDetails(incidentId) {
  try {
    currentIncidentId = incidentId;
    const incident = allIncidents.find((inc) => inc.id === incidentId);

    if (!incident) {
      throw new Error("Incident not found");
    }

    const detailsBody = document.getElementById("incidentDetailsBody");
    let statusText = "";
    if (incident.status === "active") {
      statusText = `<span class="status-active">${normalizeIncidentStatusLabel(incident.status)}</span>`;
    } else if (incident.status === "activated") {
      statusText = `<span class="status-active" style="background: #f39c12;">${normalizeIncidentStatusLabel(incident.status)}</span>`;
    } else if (incident.status === "ongoing") {
      statusText = `<span class="status-ongoing">${normalizeIncidentStatusLabel(incident.status)}</span>`;
    } else {
      statusText = `<span class="status-resolved">${normalizeIncidentStatusLabel(incident.status)}</span>`;
    }

    detailsBody.innerHTML = `
      <div class="info-grid">
        <div class="info-item">
          <strong>Incident ID:</strong> ${incident.id}
        </div>
        <div class="info-item">
          <strong>Status:</strong> ${statusText}
        </div>
        ${
          incident.status === "activated" && activatedPortalUrls[incidentId]
            ? `
        <div class="info-item" style="grid-column: 1 / -1; background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 0.75rem; font-weight: 500; color: #856404;">
          <strong>Portal Location:</strong> ${activatedPortalUrls[incidentId].portalLocation}
        </div>
        `
            : ""
        }
        <div class="info-item">
          <strong>Title:</strong> ${incident.title}
        </div>
        <div class="info-item">
          <strong>Type:</strong> ${incident.type}
        </div>
        <div class="info-item">
          <strong>Severity:</strong> ${incident.severity || "N/A"}
        </div>
        <div class="info-item">
          <strong>LGU:</strong> ${incident.lgu || "N/A"}
        </div>
        <div class="info-item">
          <strong>Source:</strong> ${incident.source || "N/A"}
        </div>
        <div class="info-item" style="grid-column: 1 / -1;">
          <strong>Location:</strong> ${incident.location}
        </div>
        <div class="info-item" style="grid-column: 1 / -1;">
          <strong>Description:</strong> ${incident.description}
        </div>
        <div class="info-item" style="grid-column: 1 / -1;">
          <strong>Remarks:</strong> ${incident.remarks || "N/A"}
        </div>
        <div class="info-item">
          <strong>Date Created:</strong> ${new Date(
            incident.created_at,
          ).toLocaleString()}
        </div>
      </div>
    `;

    const resolveBtn = document.getElementById("resolveIncidentBtn");
    const activateBtn = document.getElementById("activateIcsBtn");
    const closePortalBtn = document.getElementById("closePortalBtn");

    if (incident.status === "active") {
      resolveBtn.style.display = "block";
      activateBtn.style.display = "block";
      activateBtn.textContent = "Activate ICS";
      closePortalBtn.style.display = "none";
    } else if (incident.status === "activated") {
      resolveBtn.style.display = "none";
      activateBtn.style.display = "block";
      activateBtn.textContent = "Add Portal";
      closePortalBtn.style.display = "block";
      closePortalBtn.disabled = false;
      closePortalBtn.style.opacity = "1";
      closePortalBtn.style.cursor = "pointer";
    } else if (incident.status === "ongoing") {
      resolveBtn.style.display = "block";
      activateBtn.style.display = "block";
      activateBtn.textContent = "Activate ICS";
      closePortalBtn.style.display = "none";
    } else {
      resolveBtn.style.display = "block";
      activateBtn.style.display = "none";
      closePortalBtn.style.display = "none";
    }

    openModal("incidentDetailsModal");
  } catch (error) {
    console.error("Error loading incident details:", error);
    showMessage("Error loading incident details", "error");
  }
}

async function resolveIncident() {
  if (!currentIncidentId) return;

  try {
    const response = await fetch(
      `/api/admin/resolve-incident/${currentIncidentId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to resolve incident");
    }

    showMessage("Incident resolved successfully", "success");
    closeModal("incidentDetailsModal");
    loadIncidents();
  } catch (error) {
    console.error("Error resolving incident:", error);
    showMessage("Error resolving incident", "error");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const lguFilter = document.getElementById("lguFilter");

  if (searchInput) {
    searchInput.addEventListener("input", filterAndDisplayIncidents);
  }
  if (statusFilter) {
    statusFilter.addEventListener("change", filterAndDisplayIncidents);
  }
  if (lguFilter) {
    lguFilter.addEventListener("change", filterAndDisplayIncidents);
  }
});

function openPortalSelectionModal() {
  const listContainer = document.getElementById("portalActivationList");
  if (listContainer) {
    listContainer.innerHTML =
      '<div style="color: #718096; font-size: 0.9rem">Loading portals...</div>';
  }

  openModal("portalSelectionModal");

  const loadOptions = async () => {
    try {
      const response = await fetch("/api/admin/portals", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load portal instances");
      }

      const data = await response.json();
      renderPortalActivationOptions(data.portals || []);
    } catch (error) {
      console.error("Error loading activation portal options:", error);
      if (listContainer) {
        listContainer.innerHTML = `<div style="color: #e53e3e; font-size: 0.9rem;">${error.message}</div>`;
      }
    }
  };

  loadOptions();
}

function renderPortalActivationOptions(portals) {
  const listContainer = document.getElementById("portalActivationList");
  if (!listContainer) return;

  const availablePortals = portals.filter((portal) => {
    const assignment = portal.activated_incident_id;
    return !assignment || String(assignment) === String(currentIncidentId);
  });

  if (availablePortals.length === 0) {
    listContainer.innerHTML =
      '<div style="color: #718096; font-size: 0.9rem">No standby portals available right now. Use Add Portal to create one.</div>';
    return;
  }

  listContainer.innerHTML = availablePortals
    .map((portal) => {
      const isAlreadyAssigned =
        portal.activated_incident_id &&
        String(portal.activated_incident_id) === String(currentIncidentId);
      const buttonLabel = portal.display_name || portal.portal_location;
      const escapedPortalLocation = String(
        portal.portal_location || "",
      ).replace(/'/g, "\\'");

      return `
      <button
        type="button"
        class="btn portal-button"
        onclick="activatePortal('${escapedPortalLocation}')"
        ${isAlreadyAssigned ? "disabled" : ""}
        style="justify-content: space-between; display: flex; align-items: center; ${isAlreadyAssigned ? "opacity: 0.65; cursor: not-allowed;" : ""}"
      >
        <span>${buttonLabel}</span>
        <span style="font-size: 0.78rem; opacity: 0.85;">${isAlreadyAssigned ? "Already assigned" : "Standby"}</span>
      </button>`;
    })
    .join("");

  if (pendingActivationPortalLocation) {
    const autoPortal = availablePortals.find(
      (portal) =>
        String(portal.portal_location || "") ===
        String(pendingActivationPortalLocation),
    );

    if (autoPortal) {
      const portalToActivate = pendingActivationPortalLocation;
      pendingActivationPortalLocation = null;
      setTimeout(() => activatePortal(portalToActivate), 0);
      return;
    }

    pendingActivationPortalLocation = null;
  }
}

function openPortalProvisionFromIncidentActivation() {
  openPortalProvisionFromActivation = true;
  closeModal("portalSelectionModal");
  openAddPortalModal({ fromActivation: true });
}

function closePortalProvisionModal() {
  const shouldReturnToSelection = openPortalProvisionFromActivation;
  openPortalProvisionFromActivation = false;
  closeModal("portalProvisionModal");

  if (shouldReturnToSelection && currentIncidentId) {
    openPortalSelectionModal();
  }
}

function activatePortal(portalLocation) {
  if (!currentIncidentId) return;

  const updateIncidentStatus = async () => {
    try {
      const response = await fetch(
        `/api/admin/activate-incident/${currentIncidentId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ portalLocation }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to activate incident");
      }

      const data = await response.json();
      console.log("Incident activated:", data);

      const incidentIndex = allIncidents.findIndex(
        (inc) => inc.id === currentIncidentId,
      );
      if (incidentIndex > -1) {
        allIncidents[incidentIndex].status = "activated";
      }

      closeModal("portalSelectionModal");
      closeModal("incidentDetailsModal");

      const statusMessage = data.connected
        ? `Portal activated successfully! The ${portalLocation} portal has been notified and is now ready to receive check-ins.`
        : `Portal activation request sent. The ${portalLocation} portal will activate when it comes online.`;

      showMessage(statusMessage, "success");

      filterAndDisplayIncidents();
      await loadPortalManagement();
    } catch (error) {
      console.error("Error activating incident:", error);
      showMessage("Failed to activate incident: " + error.message, "error");
    }
  };

  updateIncidentStatus();
}

async function closeIncidentPortal() {
  if (!currentIncidentId) return;

  if (
    !confirm(
      "Are you sure you want to close this incident portal? Agencies will no longer be able to check in.",
    )
  ) {
    return;
  }

  try {
    const response = await fetch(
      `/api/admin/close-incident-portal/${currentIncidentId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to close incident portal");
    }

    const data = await response.json();
    console.log("Incident portal closed:", data);

    const incidentIndex = allIncidents.findIndex(
      (inc) => inc.id === currentIncidentId,
    );
    if (incidentIndex > -1) {
      allIncidents[incidentIndex].status = "ongoing";
    }

    delete activatedPortalUrls[currentIncidentId];
    localStorage.setItem(
      "activatedPortalUrls",
      JSON.stringify(activatedPortalUrls),
    );

    filterAndDisplayIncidents();
    closeModal("incidentDetailsModal");
    showMessage("Incident portal closed successfully.", "success");
  } catch (error) {
    console.error("Error closing incident portal:", error);
    showMessage("Error closing incident portal: " + error.message, "error");
  }
}

async function loadPortalManagement() {
  try {
    const response = await fetch("/api/admin/portals", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load portals");
    }

    const data = await response.json();
    allPortalInstances = data.portals || [];
    displayPortals(data.portals, data.connectedPortals);
  } catch (error) {
    console.error("Error loading portals:", error);
    document.getElementById("portalsContainer").innerHTML = `
      <div style="text-align: center; padding: 2rem; grid-column: 1 / -1; color: #e53e3e;">
        <p>Failed to load portals: ${error.message}</p>
      </div>
    `;
  }

  if (portalManagementInterval) {
    clearInterval(portalManagementInterval);
  }
  portalManagementInterval = setInterval(async () => {
    try {
      const response = await fetch("/api/admin/portals", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        allPortalInstances = data.portals || [];
        displayPortals(data.portals, data.connectedPortals);
      }
    } catch (error) {
      console.error("Error refreshing portals:", error);
    }
  }, 5000);
}

function displayPortals(portals, connectedPortals) {
  const container = document.getElementById("portalsContainer");

  if (!portals || portals.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; grid-column: 1 / -1;">
        <p>No portals found</p>
      </div>
    `;
    return;
  }

  container.innerHTML = portals
    .map((portal) => {
      const isOnline = portal.activated_incident_id !== null;
      const statusClass = isOnline ? "online" : "offline";
      const statusText = isOnline ? "Online" : "Offline";
      const displayName = portal.display_name || portal.portal_location;

      let incidentDisplay = "No incident assigned";
      let severityClass = "";

      if (portal.incident_title) {
        incidentDisplay = portal.incident_title;
        const severity = (portal.incident_severity || "").toLowerCase();
        if (severity === "critical" || severity === "high") {
          severityClass = "severity-high";
        } else if (severity === "medium") {
          severityClass = "severity-medium";
        } else {
          severityClass = "severity-low";
        }
      }

      const duration = isOnline
        ? calculatePortalDuration(portal.incident_activated_at)
        : null;

      const escapedPortalLocation = String(
        portal.portal_location || "",
      ).replace(/'/g, "\\'");

      return `
      <div class="portal-card ${statusClass}" onclick="viewPortalDetails('${escapedPortalLocation}')">
        <div class="portal-card-header">
          <h3>${displayName}</h3>
          <span class="portal-status ${statusClass}">${statusText}</span>
        </div>
        <div class="portal-incident-banner">
          <span class="incident-tag ${severityClass}" title="${incidentDisplay}">
            ${incidentDisplay}
          </span>
        </div>
        <div class="portal-card-body">
          <div class="portal-info-item">
            <span class="portal-info-label">Status:</span>
            <span class="portal-info-value ${isOnline ? "active" : "inactive"}">
              ${isOnline ? "Active" : "Waiting"}
            </span>
          </div>
          ${
            isOnline && duration
              ? `
          <div class="portal-info-item">
            <span class="portal-info-label">Portal Open For:</span>
            <span class="portal-info-value" style="color: #2563eb; font-weight: 600;">${duration}</span>
          </div>
          `
              : ""
          }
          <div class="portal-info-item">
            <span class="portal-info-label">Check-ins:</span>
            <span class="portal-info-value">${portal.check_in_count || 0}</span>
          </div>
          <div class="portal-info-item">
            <span class="portal-info-label">Last Update:</span>
            <span class="portal-info-value">${formatDate(
              portal.last_heartbeat,
            )}</span>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

function openAddPortalModal(options = {}) {
  const fromActivation = Boolean(options.fromActivation);
  openPortalProvisionFromActivation = fromActivation;

  const countInput = document.getElementById("newPortalCount");
  if (countInput && fromActivation) {
    countInput.value = "1";
  }

  setPortalProvisionStatus(
    fromActivation ? "Create a portal for this incident." : "",
    "info",
  );
  openModal("portalProvisionModal");
}

function setPortalProvisionStatus(message, type = "info") {
  const statusEl = document.getElementById("portalProvisionStatus");
  if (!statusEl) return;

  statusEl.textContent = message || "";
  if (!message) {
    statusEl.style.color = "#4a5568";
    return;
  }

  statusEl.style.color = type === "error" ? "#e53e3e" : "#2b6cb0";
}

async function createPortalInstances() {
  const locationTypeSelect = document.getElementById("newPortalLocationType");
  const countInput = document.getElementById("newPortalCount");

  if (!locationTypeSelect || !countInput) return;

  const locationType = locationTypeSelect.value;
  const count = parseInt(countInput.value, 10) || 1;

  try {
    setPortalProvisionStatus("Creating portal instance(s)...");

    const response = await fetch("/api/admin/portals", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ locationType, count }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to create portal instances");
    }

    const created = data.created || [];
    if (created.length === 0) {
      setPortalProvisionStatus("No new portals were created.", "error");
      return;
    }

    const preview = created
      .slice(0, 3)
      .map((portal) => portal.display_name || portal.portal_location)
      .join(", ");

    setPortalProvisionStatus(
      `Created ${created.length} portal(s): ${preview}${created.length > 3 ? "..." : ""}`,
      "success",
    );

    const createdPortalLocation = created[0]?.portal_location || null;
    const createdPortalName =
      created[0]?.display_name || createdPortalLocation || "new portal";

    if (openPortalProvisionFromActivation && createdPortalLocation) {
      openPortalProvisionFromActivation = false;
      pendingActivationPortalLocation = createdPortalLocation;
      closeModal("portalProvisionModal");
      await loadPortalManagement();
      openPortalSelectionModal();
      showMessage(
        `${createdPortalName} created. Activating portal for this incident...`,
        "success",
      );
      return;
    }

    openPortalProvisionFromActivation = false;

    closeModal("portalProvisionModal");
    await loadPortalManagement();
  } catch (error) {
    console.error("Error creating portal instances:", error);
    setPortalProvisionStatus(
      error.message || "Failed to create portals",
      "error",
    );
  }
}

async function viewPortalDetails(portalLocation) {
  try {
    const encodedPortalLocation = encodeURIComponent(portalLocation);
    const response = await fetch(
      `/api/admin/portals/${encodedPortalLocation}/manifests`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to load portal manifests");
    }

    const data = await response.json();
    currentPortalData = data.portal;
    displayPortalManifests(portalLocation, data.manifests, data.portal);

    const modal = document.getElementById("portalDetailsModal");
    modal.style.display = "block";
  } catch (error) {
    console.error("Error loading portal details:", error);
    showMessage("Error loading portal details: " + error.message, "error");
  }
}

function displayPortalManifests(portalLocation, manifests, portalData) {
  const modal = document.getElementById("portalDetailsModal");
  const title = modal.querySelector("#modalPortalTitle");
  const displayName = portalData?.display_name || portalLocation;
  title.textContent = `${displayName} Portal - Check-ins`;

  const closePortalBtn = document.getElementById(
    "closePortalFromManagementBtn",
  );
  const deletePortalBtn = document.getElementById(
    "deletePortalFromManagementBtn",
  );

  if (portalData && portalData.activated_incident_id) {
    closePortalBtn.style.display = "block";
  } else {
    closePortalBtn.style.display = "none";
  }

  if (deletePortalBtn) {
    if (portalData && portalData.can_delete) {
      deletePortalBtn.style.display = "block";
      deletePortalBtn.disabled = false;
    } else {
      deletePortalBtn.style.display = "none";
      deletePortalBtn.disabled = true;
    }
  }

  const manifestsList = document.getElementById("manifestsList");

  if (!manifests || manifests.length === 0) {
    manifestsList.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #718096;">
        <p>No agencies checked in yet</p>
      </div>
    `;
    return;
  }

  manifestsList.innerHTML = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f7fafc; border-bottom: 2px solid #e2e8f0;">
          <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #2d3748;">Agency Name</th>
          <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #2d3748;">Contact Person</th>
          <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #2d3748;">Contact Number</th>
          <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #2d3748;">Type</th>
          <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #2d3748;">Personnel</th>
        </tr>
      </thead>
      <tbody>
        ${manifests
          .map(
            (manifest) => `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 0.75rem; color: #2d3748;">${
              manifest.agency_name
            }</td>
            <td style="padding: 0.75rem; color: #2d3748;">${
              manifest.contact_person
            }</td>
            <td style="padding: 0.75rem; color: #2d3748;">${
              manifest.contact_number
            }</td>
            <td style="padding: 0.75rem; color: #2d3748;">${
              manifest.organization_type
            }</td>
            <td style="padding: 0.75rem; color: #2d3748;">${
              manifest.total_personnel || 0
            }</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function closePortalDetailsModal() {
  const modal = document.getElementById("portalDetailsModal");
  modal.style.display = "none";
  currentPortalData = null;
}

async function closePortalFromManagement() {
  if (!currentPortalData || !currentPortalData.activated_incident_id) {
    showMessage("No active incident to close", "error");
    return;
  }

  if (
    !confirm(
      `Are you sure you want to close the ${currentPortalData.portal_location} portal? Agencies will no longer be able to check in for this incident.`,
    )
  ) {
    return;
  }

  try {
    const response = await fetch(
      `/api/admin/portals/${encodeURIComponent(currentPortalData.portal_location)}/close`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to close incident portal");
    }

    const data = await response.json();
    console.log("Portal closed from portal management:", data);

    showMessage(`Portal closed successfully.`, "success");

    closePortalDetailsModal();

    await loadPortalManagement();
  } catch (error) {
    console.error("Error closing portal:", error);
    showMessage("Failed to close portal: " + error.message, "error");
  }
}

async function deletePortalFromManagement() {
  if (!currentPortalData || !currentPortalData.can_delete) {
    showMessage("This portal cannot be deleted.", "error");
    return;
  }

  if (
    !confirm(
      `Delete ${currentPortalData.display_name || currentPortalData.portal_location}?\n\nThis is only allowed when no incident is assigned, and at least one portal remains for that location.`,
    )
  ) {
    return;
  }

  try {
    const response = await fetch(
      `/api/admin/portals/${encodeURIComponent(currentPortalData.portal_location)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    );

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to delete portal");
    }

    showMessage(data.message || "Portal deleted successfully.", "success");
    closePortalDetailsModal();
    await loadPortalManagement();
  } catch (error) {
    console.error("Error deleting portal from management:", error);
    showMessage("Failed to delete portal: " + error.message, "error");
  }
}

async function deletePortalFromManagement() {
  if (!currentPortalData || !currentPortalData.can_delete) {
    showMessage("This portal cannot be deleted.", "error");
    return;
  }

  if (
    !confirm(
      `Delete ${currentPortalData.display_name || currentPortalData.portal_location}?\n\nThis is only allowed when no incident is assigned, and at least one portal remains for that location.`,
    )
  ) {
    return;
  }

  try {
    const response = await fetch(
      `/api/admin/portals/${encodeURIComponent(currentPortalData.portal_location)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    );

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to delete portal");
    }

    showMessage(data.message || "Portal deleted successfully.", "success");
    closePortalDetailsModal();
    await loadPortalManagement();
  } catch (error) {
    console.error("Error deleting portal from management:", error);
    showMessage("Failed to delete portal: " + error.message, "error");
  }
}

function formatDate(dateString) {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  return date.toLocaleString();
}

function calculatePortalDuration(activatedAt) {
  if (!activatedAt) return null;

  const now = new Date();
  const activated = new Date(activatedAt);
  const diffMs = now - activated;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days} day${days !== 1 ? "s" : ""}, ${hours} hour${
      hours !== 1 ? "s" : ""
    }`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""}, ${minutes} minute${
      minutes !== 1 ? "s" : ""
    }`;
  } else {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }
}

let unifiedMap = null;
let mapMarkers = [];
let mapBounds = null;
let currentMapView = "incidents";
let selectedMapIncidentId = null;
let selectedMapIncidentTitle = "";

async function loadMapView() {
  try {
    if (!unifiedMap) {
      await initializeMap();
    }

    await switchMapView(currentMapView, selectedMapIncidentId);
  } catch (error) {
    console.error("Error loading map view:", error);
    showMessage("Error loading map", "error");
  }
}

async function switchMapView(viewType, incidentId = null) {
  currentMapView = viewType;
  if (viewType === "incident-agencies") {
    selectedMapIncidentId = incidentId || selectedMapIncidentId;
  } else {
    selectedMapIncidentId = null;
  }

  const incidentsBtn = document.getElementById("viewIncidentsBtn");
  const agenciesBtn = document.getElementById("viewAgenciesBtn");
  const backButton = document.getElementById("backToIncidentMapBtn");
  const contextLabel = document.getElementById("mapContextLabel");

  if (backButton) {
    backButton.style.display = "none";
  }

  if (contextLabel) {
    contextLabel.style.display = "none";
    contextLabel.textContent = "";
  }

  if (viewType === "incidents") {
    incidentsBtn.classList.add("active");
    agenciesBtn.classList.remove("active");

    document.getElementById("incidentFilters").style.display = "flex";
    document.getElementById("agencyFilters").style.display = "none";
    document.getElementById("incidentLegend").style.display = "block";
    document.getElementById("agencyLegend").style.display = "none";

    await refreshMapIncidents();
  } else {
    agenciesBtn.classList.add("active");
    incidentsBtn.classList.remove("active");

    document.getElementById("incidentFilters").style.display = "none";
    document.getElementById("agencyFilters").style.display = "flex";
    document.getElementById("incidentLegend").style.display = "none";
    document.getElementById("agencyLegend").style.display = "block";

    if (viewType === "incident-agencies") {
      if (backButton) {
        backButton.style.display = "inline-flex";
      }

      const incident = allIncidents.find(
        (inc) => inc.id === selectedMapIncidentId,
      );
      const incidentTitle =
        selectedMapIncidentTitle || incident?.title || "Selected incident";

      if (contextLabel) {
        contextLabel.textContent = `Loading agencies for: ${incidentTitle}...`;
        contextLabel.style.display = "block";
      }
    }

    await refreshMapAgencies(selectedMapIncidentId);

    if (viewType === "incident-agencies") {
      updateIncidentContextLabel();
    }
  }
}

function updateIncidentContextLabel() {
  const contextLabel = document.getElementById("mapContextLabel");
  if (!contextLabel) return;

  const incident = allIncidents.find((inc) => inc.id === selectedMapIncidentId);
  const incidentTitle =
    selectedMapIncidentTitle || incident?.title || "Selected incident";

  const agencyCount = mapMarkers.filter(
    (m) => m.markerType === "agency",
  ).length;

  if (agencyCount === 0) {
    contextLabel.textContent = `${incidentTitle}: No agencies checked in`;
  } else {
    contextLabel.textContent = `${incidentTitle}: ${agencyCount} agency${agencyCount !== 1 ? "ies" : ""} checked in`;
  }
}

function showIncidentMap() {
  selectedMapIncidentId = null;
  selectedMapIncidentTitle = "";
  switchMapView("incidents");
}

function viewIncidentAgenciesOnMap() {
  if (!currentIncidentId) {
    showMessage("Please open an incident first", "error");
    return;
  }

  const incident = allIncidents.find((inc) => inc.id === currentIncidentId);
  selectedMapIncidentId = currentIncidentId;
  selectedMapIncidentTitle = incident?.title || "Selected incident";
  currentMapView = "incident-agencies";

  closeModal("incidentDetailsModal");
  showTab("map");
}

async function initializeMap() {
  try {
    const configResponse = await fetch("/api/map/config");
    if (!configResponse.ok) {
      throw new Error(`Failed to fetch map config: ${configResponse.status}`);
    }
    const config = await configResponse.json();
    mapBounds = config;

    const mapElement = document.getElementById("map");
    if (!mapElement) {
      throw new Error("Map container element not found");
    }

    unifiedMap = L.map("map", {
      center: [config.center.lat, config.center.lng],
      zoom: 10,
      maxBounds: [
        [config.south, config.west],
        [config.north, config.east],
      ],
      maxBoundsViscosity: 1.0,
      minZoom: 9,
      maxZoom: 16,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        maxZoom: 18,
      },
    ).addTo(unifiedMap);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      },
    ).addTo(unifiedMap);

    console.log("Unified map initialized successfully");
  } catch (error) {
    console.error("Error initializing map:", error);
    throw error;
  }
}

async function refreshMapIncidents() {
  try {
    mapMarkers.forEach((marker) => unifiedMap.removeLayer(marker));
    mapMarkers = [];

    const response = await fetch("/api/admin/all-incidents", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load incidents");
    }

    const data = await response.json();
    const incidents = data.incidents || [];

    const incidentsWithCoords = incidents.filter(
      (inc) => inc.latitude && inc.longitude,
    );

    console.log(
      `Loaded ${incidentsWithCoords.length} incidents with coordinates`,
    );

    incidentsWithCoords.forEach((incident) => {
      addIncidentMarker(incident);
    });

    filterMapMarkers();
  } catch (error) {
    console.error("Error refreshing map incidents:", error);
    showMessage("Error loading incidents on map", "error");
  }
}

async function refreshMapAgencies(incidentId = null) {
  try {
    mapMarkers.forEach((marker) => unifiedMap.removeLayer(marker));
    mapMarkers = [];

    const requestUrl = new URL("/api/agency-manifests", window.location.origin);
    if (incidentId) {
      requestUrl.searchParams.set("incidentId", incidentId);
    }

    const response = await fetch(requestUrl.toString());

    if (!response.ok) {
      throw new Error("Failed to load agencies");
    }

    const data = await response.json();
    const agencies = data.data || [];

    const agenciesWithCoords = agencies.filter(
      (agency) => agency.assigned_latitude && agency.assigned_longitude,
    );

    console.log(
      `Loaded ${agenciesWithCoords.length} agencies with assigned locations`,
    );

    agenciesWithCoords.forEach((agency) => {
      addAgencyMarker(agency);
    });

    filterMapMarkers();
  } catch (error) {
    console.error("Error refreshing map agencies:", error);
    showMessage("Error loading agencies on map", "error");
  }
}

function addIncidentMarker(incident) {
  const {
    latitude,
    longitude,
    title,
    status,
    type,
    severity,
    lgu,
    barangay,
    created_at,
    id,
  } = incident;

  let markerColor = "#666";
  if (status === "active") markerColor = "#e74c3c";
  else if (status === "activated") markerColor = "#f39c12";
  else if (status === "ongoing") markerColor = "#3498db";
  else if (status === "resolved") markerColor = "#6b7280";

  const markerIcon = L.divIcon({
    className: "custom-marker",
    html: `<div style="
      background-color: ${markerColor};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      cursor: pointer;
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });

  const marker = L.marker([latitude, longitude], { icon: markerIcon });

  marker.incidentStatus = status;
  marker.incidentId = id;

  const popupContent = `
    <div style="min-width: 200px;">
      <h3 style="margin: 0 0 0.5rem 0; color: #2d3748;">${title}</h3>
      <p style="margin: 0.25rem 0;"><strong>Type:</strong> ${type}</p>
      <p style="margin: 0.25rem 0;"><strong>Severity:</strong> ${severity}</p>
      <p style="margin: 0.25rem 0;"><strong>Status:</strong> 
        <span style="color: ${markerColor}; font-weight: bold;">${status.toUpperCase()}</span>
      </p>
      ${
        lgu
          ? `<p style="margin: 0.25rem 0;"><strong>LGU:</strong> ${lgu}</p>`
          : ""
      }
      ${
        barangay
          ? `<p style="margin: 0.25rem 0;"><strong>Barangay:</strong> ${barangay}</p>`
          : ""
      }
      <p style="margin: 0.25rem 0; font-size: 0.85rem; color: #666;">
        ${new Date(created_at).toLocaleString()}
      </p>
      <button 
        onclick="viewIncidentDetails(${id})" 
        style="
          margin-top: 0.75rem;
          padding: 0.5rem 1rem;
          background: #2d3748;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          width: 100%;
        "
      >
        View Details
      </button>
    </div>
  `;

  marker.bindPopup(popupContent);
  marker.addTo(unifiedMap);
  marker.markerType = "incident";
  mapMarkers.push(marker);
}

function addAgencyMarker(agency) {
  const {
    assigned_latitude,
    assigned_longitude,
    agency_name,
    status,
    contact_person,
    contact_number,
    total_personnel,
    total_vehicles,
    total_equipment,
    portal_location,
    incident_status,
    incident_title,
    incident_id,
    id,
  } = agency;

  let markerColor = "#666";
  if (incident_status === "active") markerColor = "#e74c3c";
  else if (incident_status === "activated") markerColor = "#f39c12";
  else if (incident_status === "ongoing") markerColor = "#3498db";
  else if (incident_status === "resolved") markerColor = "#6b7280";

  const markerIcon = L.divIcon({
    className: "agency-marker",
    html: `<div style="
      background-color: ${markerColor};
      width: 28px;
      height: 28px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 3px 8px rgba(0,0,0,0.4);
      cursor: pointer;
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [9, 26],
    popupAnchor: [0, -26],
  });

  const marker = L.marker([assigned_latitude, assigned_longitude], {
    icon: markerIcon,
  });

  marker.agencyStatus = status;
  marker.incidentStatus = incident_status;
  marker.incidentId = incident_id;
  marker.agencyId = id;
  marker.markerType = "agency";

  const popupContent = `
    <div style="min-width: 220px;">
      <h3 style="margin: 0 0 0.5rem 0; color: #2d3748;">${agency_name}</h3>
      ${
        incident_title
          ? `<p style="margin: 0.25rem 0; padding: 0.5rem; background: #f8f9fa; border-radius: 4px;">
        <strong>Ongoing Incident:</strong> ${incident_title}<br>
        <span style="color: ${markerColor}; font-weight: bold; font-size: 0.85rem;">● ${
          incident_status ? incident_status.toUpperCase() : "UNKNOWN"
        }</span>
      </p>`
          : ""
      }
      <p style="margin: 0.25rem 0;"><strong>Contact Person:</strong> ${contact_person}</p>
      <p style="margin: 0.25rem 0;"><strong>Contact:</strong> ${contact_number}</p>
      <p style="margin: 0.25rem 0;"><strong>Agency Status:</strong> 
        <span style="font-weight: bold;">${status.toUpperCase()}</span>
      </p>
      ${
        portal_location
          ? `<p style="margin: 0.25rem 0;"><strong>Portal Location:</strong> ${portal_location}</p>`
          : ""
      }
      <hr style="margin: 0.5rem 0; border: none; border-top: 1px solid #e0e0e0;">
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; text-align: center; margin-top: 0.5rem;">
        <div>
          <div style="font-size: 1.2rem; font-weight: bold; color: #2d3748;">${
            total_personnel || 0
          }</div>
          <div style="font-size: 0.75rem; color: #666;">Personnel</div>
        </div>
        <div>
          <div style="font-size: 1.2rem; font-weight: bold; color: #2d3748;">${
            total_vehicles || 0
          }</div>
          <div style="font-size: 0.75rem; color: #666;">Vehicles</div>
        </div>
        <div>
          <div style="font-size: 1.2rem; font-weight: bold; color: #2d3748;">${
            total_equipment || 0
          }</div>
          <div style="font-size: 0.75rem; color: #666;">Equipment</div>
        </div>
      </div>
    </div>
  `;

  marker.bindPopup(popupContent);
  marker.addTo(unifiedMap);
  mapMarkers.push(marker);
}

function filterMapMarkers() {
  if (currentMapView === "incidents") {
    const filterActive = document.getElementById("filterActive").checked;
    const filterActivated = document.getElementById("filterActivated").checked;
    const filterOngoing = document.getElementById("filterOngoing").checked;
    const filterResolved = document.getElementById("filterResolved").checked;

    mapMarkers.forEach((marker) => {
      if (marker.markerType !== "incident") return;

      const status = marker.incidentStatus;
      let shouldShow = false;

      if (status === "active" && filterActive) shouldShow = true;
      if (status === "activated" && filterActivated) shouldShow = true;
      if (status === "ongoing" && filterOngoing) shouldShow = true;
      if (status === "resolved" && filterResolved) shouldShow = true;

      if (shouldShow) {
        marker.addTo(unifiedMap);
      } else {
        unifiedMap.removeLayer(marker);
      }
    });
  } else if (currentMapView === "agencies") {
    const filterAgencyOngoing = document.getElementById(
      "filterAgencyOngoing",
    ).checked;
    const filterAgencyResolved = document.getElementById(
      "filterAgencyResolved",
    ).checked;

    mapMarkers.forEach((marker) => {
      if (marker.markerType !== "agency") return;

      const status = marker.incidentStatus;
      let shouldShow = false;

      if (
        (status === "active" ||
          status === "activated" ||
          status === "ongoing") &&
        filterAgencyOngoing
      ) {
        shouldShow = true;
      }
      if (status === "resolved" && filterAgencyResolved) shouldShow = true;

      if (shouldShow) {
        marker.addTo(unifiedMap);
      } else {
        unifiedMap.removeLayer(marker);
      }
    });
  } else if (currentMapView === "incident-agencies") {
    const filterAgencyOngoing = document.getElementById(
      "filterAgencyOngoing",
    ).checked;
    const filterAgencyResolved = document.getElementById(
      "filterAgencyResolved",
    ).checked;

    mapMarkers.forEach((marker) => {
      if (marker.markerType !== "agency") return;

      const status = marker.incidentStatus;
      let shouldShow = false;

      if (
        selectedMapIncidentId &&
        marker.incidentId &&
        Number(marker.incidentId) === Number(selectedMapIncidentId)
      ) {
        if (
          (status === "active" ||
            status === "activated" ||
            status === "ongoing") &&
          filterAgencyOngoing
        ) {
          shouldShow = true;
        }
        if (status === "resolved" && filterAgencyResolved) shouldShow = true;
      }

      if (shouldShow) {
        marker.addTo(unifiedMap);
      } else {
        unifiedMap.removeLayer(marker);
      }
    });
  }
}

async function refreshMap() {
  if (unifiedMap) {
    if (currentMapView === "incidents") {
      await refreshMapIncidents();
    } else if (currentMapView === "incident-agencies") {
      await refreshMapAgencies(selectedMapIncidentId);
    } else {
      await refreshMapAgencies();
    }
    showMessage("Map refreshed successfully", "success");
  }
}

let allAgenciesCheckIn = [];

async function loadAgencyCheckIn() {
  try {
    const response = await fetch("/api/admin/agency-check-ins", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load agency check-ins");
    }

    const data = await response.json();
    allAgenciesCheckIn = data.manifests || [];

    updateCheckInStats(allAgenciesCheckIn);
    displayIncidentGroupsCheckIn(allAgenciesCheckIn);
  } catch (error) {
    console.error("Error loading agency check-ins:", error);
    document.getElementById("incidentGroupsListCheckIn").innerHTML =
      '<div style="text-align: center; padding: 2rem; color: #e74c3c;">Error loading agency check-ins</div>';
  }
}

function updateCheckInStats(agencies) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const incidentsToday = new Set();
  const activeIncidents = new Set();
  let totalAgencies = 0;
  let locationsAssigned = 0;

  agencies.forEach((agency) => {
    if (agency.created_at) {
      const createdAt = new Date(agency.created_at);
      createdAt.setHours(0, 0, 0, 0);
      if (createdAt.getTime() === today.getTime() && agency.incident_id) {
        incidentsToday.add(agency.incident_id);
      }
    }

    if (
      agency.incident_status === "active" ||
      agency.incident_status === "activated" ||
      agency.incident_status === "ongoing"
    ) {
      if (agency.incident_id) activeIncidents.add(agency.incident_id);
    }

    totalAgencies++;

    if (agency.assigned_latitude && agency.assigned_longitude) {
      locationsAssigned++;
    }
  });

  document.getElementById("totalIncidentsTodayCheckIn").textContent =
    incidentsToday.size;
  document.getElementById("activeIncidentsCheckIn").textContent =
    activeIncidents.size;
  document.getElementById("totalAgenciesCheckIn").textContent = totalAgencies;
  document.getElementById("locationsAssignedCheckIn").textContent =
    locationsAssigned;
}

function displayIncidentGroupsCheckIn(agencies) {
  const container = document.getElementById("incidentGroupsListCheckIn");

  const incidentMap = new Map();

  agencies.forEach((agency) => {
    if (!agency.incident_id) return;

    if (!incidentMap.has(agency.incident_id)) {
      incidentMap.set(agency.incident_id, {
        id: agency.incident_id,
        title: agency.incident_title,
        status: agency.incident_status,
        severity: agency.incident_severity,
        lgu: agency.incident_lgu,
        barangay: agency.incident_barangay,
        operation_chief_name: agency.operation_chief_name,
        operation_chief_id: agency.operation_chief_id,
        operation_chief_username: agency.operation_chief_username,
        planning_chief_name: agency.planning_chief_name,
        planning_chief_id: agency.planning_chief_id,
        planning_chief_username: agency.planning_chief_username,
        agencies: [],
      });
    }

    incidentMap.get(agency.incident_id).agencies.push(agency);
  });

  if (incidentMap.size === 0) {
    container.innerHTML =
      '<div style="text-align: center; padding: 2rem; color: #999;">No incidents with agencies</div>';
    return;
  }

  container.innerHTML = Array.from(incidentMap.values())
    .map((incident) => {
      const totalPersonnel = incident.agencies.reduce(
        (sum, a) => sum + (a.total_personnel || 0),
        0,
      );
      const totalVehicles = incident.agencies.reduce(
        (sum, a) => sum + (a.total_vehicles || 0),
        0,
      );
      const totalEquipment = incident.agencies.reduce(
        (sum, a) => sum + (a.total_equipment || 0),
        0,
      );
      const hasOperationChief = !!incident.operation_chief_id;
      const hasPlanningChief = !!incident.planning_chief_id;
      const hasAnyChief = hasOperationChief || hasPlanningChief;
      const isResolved = (incident.status || "").toLowerCase() === "resolved";
      const isFullyAssigned = hasOperationChief && hasPlanningChief;

      const statusColors = {
        active: "#e74c3c",
        activated: "#f39c12",
        ongoing: "#3498db",
        resolved: "#27ae60",
      };

      const statusColor =
        statusColors[String(incident.status || "").toLowerCase()] || "#999";

      async function loadPostIncidentLogs() {
        try {
          const response = await fetch("/api/admin/post-incident-reports", {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });

          if (!response.ok) {
            throw new Error("Failed to load post-incident logs");
          }

          const data = await response.json();
          allPostIncidentReports = data.reports || [];
          populatePostIncidentIncidentFilter(allPostIncidentReports);
          filterPostIncidentReports();
        } catch (error) {
          console.error("Error loading post-incident logs:", error);
          const tableBody = document.getElementById(
            "postIncidentReportsTableBody",
          );
          if (tableBody) {
            tableBody.innerHTML =
              '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #e74c3c;">Error loading post-incident logs</td></tr>';
          }
        }
      }

      function populatePostIncidentIncidentFilter(reports) {
        const select = document.getElementById("postIncidentIncidentFilter");
        if (!select) return;

        const currentValue = select.value;
        const incidents = new Map();

        reports.forEach((report) => {
          if (report.incident_id && report.incident_title) {
            incidents.set(report.incident_id, report.incident_title);
          }
        });

        const options = Array.from(incidents.entries())
          .sort((left, right) => left[1].localeCompare(right[1]))
          .map(
            ([id, title]) =>
              `<option value="${id}">${escapeHtml(title)}</option>`,
          )
          .join("");

        select.innerHTML = `<option value="">All incidents</option>${options}`;

        if (
          [...select.options].some((option) => option.value === currentValue)
        ) {
          select.value = currentValue;
        }
      }

      function clearPostIncidentFilters() {
        const searchInput = document.getElementById("postIncidentSearchInput");
        const agencyFilter = document.getElementById(
          "postIncidentAgencyFilter",
        );
        const incidentFilter = document.getElementById(
          "postIncidentIncidentFilter",
        );

        if (searchInput) searchInput.value = "";
        if (agencyFilter) agencyFilter.value = "";
        if (incidentFilter) incidentFilter.value = "";

        filterPostIncidentReports();
      }

      function filterPostIncidentReports() {
        const searchInput = document
          .getElementById("postIncidentSearchInput")
          ?.value.toLowerCase()
          .trim();
        const agencyFilter = document
          .getElementById("postIncidentAgencyFilter")
          ?.value.toLowerCase()
          .trim();
        const incidentFilter = document.getElementById(
          "postIncidentIncidentFilter",
        )?.value;

        filteredPostIncidentReports = allPostIncidentReports.filter(
          (report) => {
            const receiptNumber = (report.report_number || "").toLowerCase();
            const agencyName = (report.agency_name || "").toLowerCase();
            const incidentTitle = (report.incident_title || "").toLowerCase();
            const incidentLocation = (
              report.incident_location || ""
            ).toLowerCase();
            const portalLocation = (report.portal_location || "").toLowerCase();
            const matchesSearch =
              !searchInput ||
              receiptNumber.includes(searchInput) ||
              agencyName.includes(searchInput) ||
              incidentTitle.includes(searchInput) ||
              incidentLocation.includes(searchInput) ||
              portalLocation.includes(searchInput);
            const matchesAgency =
              !agencyFilter || agencyName.includes(agencyFilter);
            const matchesIncident =
              !incidentFilter || String(report.incident_id) === incidentFilter;

            return matchesSearch && matchesAgency && matchesIncident;
          },
        );

        updatePostIncidentStats(filteredPostIncidentReports);
        displayPostIncidentReports(filteredPostIncidentReports);
      }

      function updatePostIncidentStats(reports) {
        const totalReports = reports.length;
        const totalPersonnel = reports.reduce(
          (sum, report) => sum + (parseInt(report.total_personnel, 10) || 0),
          0,
        );
        const totalVehicles = reports.reduce(
          (sum, report) => sum + (parseInt(report.total_vehicles, 10) || 0),
          0,
        );
        const totalEquipment = reports.reduce(
          (sum, report) => sum + (parseInt(report.total_equipment, 10) || 0),
          0,
        );

        const totalReportsElement = document.getElementById(
          "postIncidentTotalReports",
        );
        const totalPersonnelElement = document.getElementById(
          "postIncidentTotalPersonnel",
        );
        const totalVehiclesElement = document.getElementById(
          "postIncidentTotalVehicles",
        );
        const totalEquipmentElement = document.getElementById(
          "postIncidentTotalEquipment",
        );

        if (totalReportsElement) totalReportsElement.textContent = totalReports;
        if (totalPersonnelElement)
          totalPersonnelElement.textContent = totalPersonnel;
        if (totalVehiclesElement)
          totalVehiclesElement.textContent = totalVehicles;
        if (totalEquipmentElement)
          totalEquipmentElement.textContent = totalEquipment;
      }

      function displayPostIncidentReports(reports) {
        const tableBody = document.getElementById(
          "postIncidentReportsTableBody",
        );
        if (!tableBody) return;

        if (!reports || reports.length === 0) {
          tableBody.innerHTML =
            '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #999;">No post-incident reports found</td></tr>';
          return;
        }

        tableBody.innerHTML = reports
          .map((report) => {
            const durationText = formatPostIncidentDuration(
              report.duration_minutes,
              report.mobilized_at,
              report.demobilized_at,
            );
            const mobilizedAt = formatPostIncidentDate(report.mobilized_at);
            const demobilizedAt = formatPostIncidentDate(report.demobilized_at);
            const incidentLabel = report.incident_title
              ? `${escapeHtml(report.incident_title)}${report.incident_lgu ? ` - ${escapeHtml(report.incident_lgu)}` : ""}`
              : "No incident linked";

            return `
          <tr style="border-bottom: 1px solid #e2e8f0; cursor: pointer;" onclick="openPostIncidentReport(${report.id})">
            <td style="padding: 0.75rem; color: #2d3748; font-family: monospace;">${escapeHtml(report.report_number || "-")}</td>
            <td style="padding: 0.75rem; color: #2d3748;">${escapeHtml(report.agency_name || "-")}</td>
            <td style="padding: 0.75rem; color: #2d3748;">${incidentLabel}</td>
            <td style="padding: 0.75rem; color: #2d3748;">${mobilizedAt}</td>
            <td style="padding: 0.75rem; color: #2d3748;">${demobilizedAt}</td>
            <td style="padding: 0.75rem; color: #2d3748;">${durationText}</td>
            <td style="padding: 0.75rem; text-align: center; color: #2d3748;">${report.total_personnel || 0}</td>
            <td style="padding: 0.75rem; text-align: center; color: #2d3748;">${report.total_vehicles || 0}</td>
            <td style="padding: 0.75rem; text-align: center; color: #2d3748;">${report.total_equipment || 0}</td>
          </tr>
        `;
          })
          .join("");
      }

      function formatPostIncidentDate(value) {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleString();
      }

      function formatPostIncidentDuration(
        durationMinutes,
        mobilizedAt,
        demobilizedAt,
      ) {
        let totalMinutes = parseInt(durationMinutes, 10);

        if (Number.isNaN(totalMinutes) || totalMinutes < 0) {
          const start = new Date(mobilizedAt);
          const end = demobilizedAt ? new Date(demobilizedAt) : new Date();
          totalMinutes =
            Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
              ? 0
              : Math.max(
                  0,
                  Math.round((end.getTime() - start.getTime()) / 60000),
                );
        }

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (hours > 0 && minutes > 0) {
          return `${hours}h ${minutes}m`;
        }

        if (hours > 0) {
          return `${hours}h`;
        }

        return `${minutes}m`;
      }

      function formatPostIncidentResourceTimeline(resource, reportMobilizedAt) {
        const resourceStatus = resource?.status || "submitted";
        const resourceMobilizedAt = resource?.mobilized_at || reportMobilizedAt;
        const resourceDemobilizedAt = resource?.demobilized_at || null;
        const resourceDurationText = formatPostIncidentDuration(
          resource?.duration_minutes,
          resourceMobilizedAt,
          resourceDemobilizedAt,
        );

        return `
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.45rem; color: #4a5568; font-size: 0.82rem;">
            <span><strong>Status:</strong> ${escapeHtml(resourceStatus)}</span>
            <span><strong>Mobilized:</strong> ${formatPostIncidentDate(resourceMobilizedAt)}</span>
            <span><strong>Demobilized:</strong> ${resourceDemobilizedAt ? formatPostIncidentDate(resourceDemobilizedAt) : "Active"}</span>
            <span><strong>Duration:</strong> ${resourceDurationText}</span>
          </div>
        `;
      }

      function normalizeSnapshotEntries(entries) {
        if (!entries) return [];
        if (Array.isArray(entries)) return entries;

        if (typeof entries === "string") {
          try {
            const parsed = JSON.parse(entries);
            return Array.isArray(parsed) ? parsed : [];
          } catch (error) {
            return [];
          }
        }

        return [];
      }

      async function openPostIncidentReport(reportId) {
        try {
          const response = await fetch(
            `/api/admin/post-incident-reports/${reportId}`,
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            },
          );

          if (!response.ok) {
            throw new Error("Failed to load report details");
          }

          const data = await response.json();
          if (!data.success || !data.report) {
            throw new Error("Report not found");
          }

          currentPostIncidentReport = data.report;
          renderPostIncidentReportDetail(data.report);
          openModal("postIncidentReportModal");
        } catch (error) {
          console.error("Error opening post-incident report:", error);
          showMessage("Error loading report details", "error");
        }
      }

      function closePostIncidentReportModal() {
        currentPostIncidentReport = null;
        closeModal("postIncidentReportModal");
      }

      function renderPostIncidentReportDetail(report) {
        const container = document.getElementById("postIncidentReportBody");
        if (!container) return;

        const members = normalizeSnapshotEntries(report.members_snapshot);
        const vehicles = normalizeSnapshotEntries(report.vehicles_snapshot);
        const equipment = normalizeSnapshotEntries(report.equipment_snapshot);
        const durationText = formatPostIncidentDuration(
          report.duration_minutes,
          report.mobilized_at,
          report.demobilized_at,
        );

        const resourceCards = (title, items, renderItem) => `
      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
        <h4 style="margin: 0 0 0.75rem 0; color: #2d3748;">${title}</h4>
        ${items.length === 0 ? '<div style="color: #999;">No records captured</div>' : items.map(renderItem).join("")}
      </div>
    `;

        container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
        <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Receipt No.</div><div style="font-weight: 700; color: #2d3748; font-family: monospace;">${escapeHtml(report.report_number || "-")}</div></div>
        <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Agency</div><div style="font-weight: 700; color: #2d3748;">${escapeHtml(report.agency_name || "-")}</div></div>
        <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Incident</div><div style="font-weight: 700; color: #2d3748;">${escapeHtml(report.incident_title || "-")}</div></div>
        <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Duration</div><div style="font-weight: 700; color: #2d3748;">${durationText}</div></div>
        <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Mobilized</div><div style="font-weight: 700; color: #2d3748;">${formatPostIncidentDate(report.mobilized_at)}</div></div>
        <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Demobilized</div><div style="font-weight: 700; color: #2d3748;">${formatPostIncidentDate(report.demobilized_at)}</div></div>
        <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Personnel</div><div style="font-weight: 700; color: #2d3748;">${report.total_personnel || 0}</div></div>
        <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Vehicles</div><div style="font-weight: 700; color: #2d3748;">${report.total_vehicles || 0}</div></div>
        <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Equipment</div><div style="font-weight: 700; color: #2d3748;">${report.total_equipment || 0}</div></div>
        <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Portal</div><div style="font-weight: 700; color: #2d3748;">${escapeHtml(report.portal_location || "-")}</div></div>
        <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Assigned Location</div><div style="font-weight: 700; color: #2d3748;">${report.assigned_latitude && report.assigned_longitude ? `${report.assigned_latitude}, ${report.assigned_longitude}` : "-"}</div></div>
      </div>

      <div style="margin-bottom: 1rem; color: #4a5568;">
        <strong>Contact Person:</strong> ${escapeHtml(report.contact_person || "-")} &nbsp;&nbsp; <strong>Contact Number:</strong> ${escapeHtml(report.contact_number || "-")}
      </div>

      ${resourceCards(
        "Personnel Snapshot",
        members,
        (member) => `
          <div style="border-top: 1px solid #edf2f7; padding: 0.75rem 0;">
            <div style="font-weight: 600; color: #2d3748;">${escapeHtml(member.name || "-")}</div>
            <div style="color: #718096; font-size: 0.9rem;">${[member.gender, member.age ? `${member.age} yrs` : null, member.contact].filter(Boolean).map(escapeHtml).join(" • ") || "No extra details"}</div>
            <div style="color: #4a5568; font-size: 0.85rem; margin-top: 0.25rem;">${escapeHtml(member.capabilities || "-")}</div>
            ${formatPostIncidentResourceTimeline(member, report.mobilized_at)}
          </div>
        `,
      )}

      ${resourceCards(
        "Vehicles Snapshot",
        vehicles,
        (vehicle) => `
          <div style="border-top: 1px solid #edf2f7; padding: 0.75rem 0;">
            <div style="font-weight: 600; color: #2d3748;">${escapeHtml(vehicle.kind || "-")}</div>
            <div style="color: #718096; font-size: 0.9rem;">${[vehicle.type, vehicle.plate_number, vehicle.operator_name].filter(Boolean).map(escapeHtml).join(" • ") || "No extra details"}</div>
            <div style="color: #4a5568; font-size: 0.85rem; margin-top: 0.25rem;">${escapeHtml(vehicle.capabilities || "-")}</div>
            ${formatPostIncidentResourceTimeline(vehicle, report.mobilized_at)}
          </div>
        `,
      )}

      ${resourceCards(
        "Equipment Snapshot",
        equipment,
        (item) => `
          <div style="border-top: 1px solid #edf2f7; padding: 0.75rem 0;">
            <div style="font-weight: 600; color: #2d3748;">${escapeHtml(item.kind || "-")}</div>
            <div style="color: #718096; font-size: 0.9rem;">${[item.type, item.power_source, item.fuel_type, item.operator_name].filter(Boolean).map(escapeHtml).join(" • ") || "No extra details"}</div>
            <div style="color: #4a5568; font-size: 0.85rem; margin-top: 0.25rem;">${escapeHtml(item.capabilities || "-")}</div>
            ${formatPostIncidentResourceTimeline(item, report.mobilized_at)}
          </div>
        `,
      )}
    `;
      }

      return `
        <div class="incident-group" style="background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
            <div style="flex: 1;">
              <h3 style="margin: 0 0 0.5rem 0; color: #2d3748; display: flex; align-items: center; gap: 0.5rem;">
                <span style="display: inline-block; padding: 0.25rem 0.75rem; background: ${statusColor}; color: white; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
                  ${escapeHtml(normalizeIncidentStatusLabel(incident.status) || "UNKNOWN")}
                </span>
                ${escapeHtml(incident.title)}
              </h3>
              <div style="font-size: 0.9rem; color: #666;">
                ${
                  incident.lgu
                    ? `<span>${escapeHtml(incident.lgu)}${
                        incident.barangay
                          ? ", " + escapeHtml(incident.barangay)
                          : ""
                      }</span>`
                    : ""
                }
                ${
                  incident.severity
                    ? `<span style="margin-left: 1rem;">${escapeHtml(
                        incident.severity,
                      )}</span>`
                    : ""
                }
              </div>
            </div>
            <div style="display: flex; gap: 1rem; font-size: 0.9rem; color: #666;">
              <div style="text-align: center;">
                <div style="font-weight: bold; color: #2d3748; font-size: 1.2rem;">${
                  incident.agencies.length
                }</div>
                <div>Agencies</div>
              </div>
              <div style="text-align: center;">
                <div style="font-weight: bold; color: #2d3748; font-size: 1.2rem;">${totalPersonnel}</div>
                <div>Personnel</div>
              </div>
              <div style="text-align: center;">
                <div style="font-weight: bold; color: #2d3748; font-size: 1.2rem;">${totalVehicles}</div>
                <div>Vehicles</div>
              </div>
              <div style="text-align: center;">
                <div style="font-weight: bold; color: #2d3748; font-size: 1.2rem;">${totalEquipment}</div>
                <div>Equipment</div>
              </div>
            </div>
          </div>
          
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
              <thead>
                <tr style="border-bottom: 2px solid #e2e8f0; background: #f7fafc;">
                  <th style="text-align: left; padding: 0.75rem; color: #4a5568; font-weight: 600;">Agency Name</th>
                  <th style="text-align: left; padding: 0.75rem; color: #4a5568; font-weight: 600;">Leader</th>
                  <th style="text-align: left; padding: 0.75rem; color: #4a5568; font-weight: 600;">Contact</th>
                  <th style="text-align: center; padding: 0.75rem; color: #4a5568; font-weight: 600;">Personnel</th>
                  <th style="text-align: center; padding: 0.75rem; color: #4a5568; font-weight: 600;">Vehicles</th>
                  <th style="text-align: center; padding: 0.75rem; color: #4a5568; font-weight: 600;">Equipment</th>
                  <th style="text-align: left; padding: 0.75rem; color: #4a5568; font-weight: 600;">Portal Location</th>
                  <th style="text-align: center; padding: 0.75rem; color: #4a5568; font-weight: 600;">Location Assigned</th>
                </tr>
              </thead>
              <tbody>
                ${incident.agencies
                  .map(
                    (agency) => `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 0.75rem; font-weight: 500; color: #2d3748;">${escapeHtml(
                      agency.agency_name,
                    )}</td>
                    <td style="padding: 0.75rem; color: #4a5568;">${escapeHtml(
                      agency.contact_person || "-",
                    )}</td>
                    <td style="padding: 0.75rem; color: #4a5568;">${escapeHtml(
                      agency.contact_number || "-",
                    )}</td>
                    <td style="padding: 0.75rem; text-align: center; color: #4a5568;">${
                      agency.total_personnel || 0
                    }</td>
                    <td style="padding: 0.75rem; text-align: center; color: #4a5568;">${
                      agency.total_vehicles || 0
                    }</td>
                    <td style="padding: 0.75rem; text-align: center; color: #4a5568;">${
                      agency.total_equipment || 0
                    }</td>
                    <td style="padding: 0.75rem; color: #4a5568;">${escapeHtml(
                      agency.portal_location || "-",
                    )}</td>
                    <td style="padding: 0.75rem; text-align: center;">
                      ${
                        agency.assigned_latitude && agency.assigned_longitude
                          ? '<span style="color: #27ae60;">Yes</span>'
                          : '<span style="color: #999;">No</span>'
                      }
                    </td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
          <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: grid; gap: 0.35rem; color: #27ae60;">
              ${
                incident.operation_chief_name
                  ? `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-weight: 600;">Operation Chief:</span>
                  <span>${escapeHtml(incident.operation_chief_name)}</span>
                  <span style="color: #666;">(${escapeHtml(incident.operation_chief_username || "")})</span>
                </div>
              `
                  : ""
              }
              ${
                incident.planning_chief_name
                  ? `
                <div style="display: flex; align-items: center; gap: 0.5rem; color: #b7791f;">
                  <span style="font-weight: 600;">Planning Chief:</span>
                  <span>${escapeHtml(incident.planning_chief_name)}</span>
                  <span style="color: #666;">(${escapeHtml(incident.planning_chief_username || "")})</span>
                </div>
              `
                  : ""
              }
            </div>
            <button 
              class="btn ${
                hasAnyChief || isResolved ? "btn-secondary" : "btn-verify"
              }" 
              onclick="openAgencyChiefAssignmentModal(${incident.id}, '${escapeHtml(
                incident.title,
              ).replace(/'/g, "\\'")}')"
              style="padding: 0.5rem 1.5rem; ${
                hasAnyChief || isResolved
                  ? "opacity: 0.6; cursor: not-allowed;"
                  : ""
              }"
              ${isResolved || isFullyAssigned ? "disabled" : ""}>
              ${
                isResolved || isFullyAssigned
                  ? "Section Chiefs Assigned"
                  : "Assign Section Chief"
              }
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

async function loadPostIncidentLogs() {
  try {
    const response = await fetch("/api/admin/post-incident-reports", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load post-incident logs");
    }

    const data = await response.json();
    allPostIncidentReports = data.reports || [];
    populatePostIncidentIncidentFilter(allPostIncidentReports);
    filterPostIncidentReports();
  } catch (error) {
    console.error("Error loading post-incident logs:", error);
    const tableBody = document.getElementById("postIncidentReportsTableBody");
    if (tableBody) {
      tableBody.innerHTML =
        '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #e74c3c;">Error loading post-incident logs</td></tr>';
    }
  }
}

function populatePostIncidentIncidentFilter(reports) {
  const select = document.getElementById("postIncidentIncidentFilter");
  if (!select) return;

  const currentValue = select.value;
  const incidents = new Map();

  reports.forEach((report) => {
    if (report.incident_id && report.incident_title) {
      incidents.set(report.incident_id, report.incident_title);
    }
  });

  const options = Array.from(incidents.entries())
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([id, title]) => `<option value="${id}">${escapeHtml(title)}</option>`)
    .join("");

  select.innerHTML = `<option value="">All incidents</option>${options}`;

  if ([...select.options].some((option) => option.value === currentValue)) {
    select.value = currentValue;
  }
}

function clearPostIncidentFilters() {
  const searchInput = document.getElementById("postIncidentSearchInput");
  const agencyFilter = document.getElementById("postIncidentAgencyFilter");
  const incidentFilter = document.getElementById("postIncidentIncidentFilter");

  if (searchInput) searchInput.value = "";
  if (agencyFilter) agencyFilter.value = "";
  if (incidentFilter) incidentFilter.value = "";

  filterPostIncidentReports();
}

function filterPostIncidentReports() {
  const searchInput = document
    .getElementById("postIncidentSearchInput")
    ?.value.toLowerCase()
    .trim();
  const agencyFilter = document
    .getElementById("postIncidentAgencyFilter")
    ?.value.toLowerCase()
    .trim();
  const incidentFilter = document.getElementById(
    "postIncidentIncidentFilter",
  )?.value;

  filteredPostIncidentReports = allPostIncidentReports.filter((report) => {
    const receiptNumber = (report.report_number || "").toLowerCase();
    const agencyName = (report.agency_name || "").toLowerCase();
    const incidentTitle = (report.incident_title || "").toLowerCase();
    const incidentLocation = (report.incident_location || "").toLowerCase();
    const portalLocation = (report.portal_location || "").toLowerCase();
    const matchesSearch =
      !searchInput ||
      receiptNumber.includes(searchInput) ||
      agencyName.includes(searchInput) ||
      incidentTitle.includes(searchInput) ||
      incidentLocation.includes(searchInput) ||
      portalLocation.includes(searchInput);
    const matchesAgency = !agencyFilter || agencyName.includes(agencyFilter);
    const matchesIncident =
      !incidentFilter || String(report.incident_id) === incidentFilter;

    return matchesSearch && matchesAgency && matchesIncident;
  });

  updatePostIncidentStats(filteredPostIncidentReports);
  displayPostIncidentReports(filteredPostIncidentReports);
}

function updatePostIncidentStats(reports) {
  const totalReports = reports.length;
  const totalPersonnel = reports.reduce(
    (sum, report) => sum + (parseInt(report.total_personnel, 10) || 0),
    0,
  );
  const totalVehicles = reports.reduce(
    (sum, report) => sum + (parseInt(report.total_vehicles, 10) || 0),
    0,
  );
  const totalEquipment = reports.reduce(
    (sum, report) => sum + (parseInt(report.total_equipment, 10) || 0),
    0,
  );

  const totalReportsElement = document.getElementById(
    "postIncidentTotalReports",
  );
  const totalPersonnelElement = document.getElementById(
    "postIncidentTotalPersonnel",
  );
  const totalVehiclesElement = document.getElementById(
    "postIncidentTotalVehicles",
  );
  const totalEquipmentElement = document.getElementById(
    "postIncidentTotalEquipment",
  );

  if (totalReportsElement) totalReportsElement.textContent = totalReports;
  if (totalPersonnelElement) totalPersonnelElement.textContent = totalPersonnel;
  if (totalVehiclesElement) totalVehiclesElement.textContent = totalVehicles;
  if (totalEquipmentElement) totalEquipmentElement.textContent = totalEquipment;
}

function displayPostIncidentReports(reports) {
  const tableBody = document.getElementById("postIncidentReportsTableBody");
  if (!tableBody) return;

  if (!reports || reports.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #999;">No post-incident reports found</td></tr>';
    return;
  }

  tableBody.innerHTML = reports
    .map((report) => {
      const durationText = formatPostIncidentDuration(
        report.duration_minutes,
        report.mobilized_at,
        report.demobilized_at,
      );
      const mobilizedAt = formatPostIncidentDate(report.mobilized_at);
      const demobilizedAt = formatPostIncidentDate(report.demobilized_at);
      const incidentLabel = report.incident_title
        ? `${escapeHtml(report.incident_title)}${report.incident_lgu ? ` - ${escapeHtml(report.incident_lgu)}` : ""}`
        : "No incident linked";

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; cursor: pointer;" onclick="openPostIncidentReport(${report.id})">
          <td style="padding: 0.75rem; color: #2d3748; font-family: monospace;">${escapeHtml(report.report_number || "-")}</td>
          <td style="padding: 0.75rem; color: #2d3748;">${escapeHtml(report.agency_name || "-")}</td>
          <td style="padding: 0.75rem; color: #2d3748;">${incidentLabel}</td>
          <td style="padding: 0.75rem; color: #2d3748;">${mobilizedAt}</td>
          <td style="padding: 0.75rem; color: #2d3748;">${demobilizedAt}</td>
          <td style="padding: 0.75rem; color: #2d3748;">${durationText}</td>
          <td style="padding: 0.75rem; text-align: center; color: #2d3748;">${report.total_personnel || 0}</td>
          <td style="padding: 0.75rem; text-align: center; color: #2d3748;">${report.total_vehicles || 0}</td>
          <td style="padding: 0.75rem; text-align: center; color: #2d3748;">${report.total_equipment || 0}</td>
        </tr>
      `;
    })
    .join("");
}

function formatPostIncidentDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatPostIncidentDuration(
  durationMinutes,
  mobilizedAt,
  demobilizedAt,
) {
  let totalMinutes = parseInt(durationMinutes, 10);

  if (Number.isNaN(totalMinutes) || totalMinutes < 0) {
    const start = new Date(mobilizedAt);
    const end = demobilizedAt ? new Date(demobilizedAt) : new Date();
    totalMinutes =
      Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
        ? 0
        : Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

function formatPostIncidentResourceTimeline(resource, reportMobilizedAt) {
  const resourceStatus = resource?.status || "submitted";
  const resourceMobilizedAt = resource?.mobilized_at || reportMobilizedAt;
  const resourceDemobilizedAt = resource?.demobilized_at || null;
  const resourceDurationText = formatPostIncidentDuration(
    resource?.duration_minutes,
    resourceMobilizedAt,
    resourceDemobilizedAt,
  );

  return `
    <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.45rem; color: #4a5568; font-size: 0.82rem;">
      <span><strong>Status:</strong> ${escapeHtml(resourceStatus)}</span>
      <span><strong>Mobilized:</strong> ${formatPostIncidentDate(resourceMobilizedAt)}</span>
      <span><strong>Demobilized:</strong> ${resourceDemobilizedAt ? formatPostIncidentDate(resourceDemobilizedAt) : "Active"}</span>
      <span><strong>Duration:</strong> ${resourceDurationText}</span>
    </div>
  `;
}

function normalizeSnapshotEntries(entries) {
  if (!entries) return [];
  if (Array.isArray(entries)) return entries;

  if (typeof entries === "string") {
    try {
      const parsed = JSON.parse(entries);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
}

async function openPostIncidentReport(reportId) {
  try {
    const response = await fetch(
      `/api/admin/post-incident-reports/${reportId}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to load report details");
    }

    const data = await response.json();
    if (!data.success || !data.report) {
      throw new Error("Report not found");
    }

    currentPostIncidentReport = data.report;
    renderPostIncidentReportDetail(data.report);
    openModal("postIncidentReportModal");
  } catch (error) {
    console.error("Error opening post-incident report:", error);
    showMessage("Error loading report details", "error");
  }
}

function closePostIncidentReportModal() {
  currentPostIncidentReport = null;
  closeModal("postIncidentReportModal");
}

function renderPostIncidentReportDetail(report) {
  const container = document.getElementById("postIncidentReportBody");
  if (!container) return;

  const members = normalizeSnapshotEntries(report.members_snapshot);
  const vehicles = normalizeSnapshotEntries(report.vehicles_snapshot);
  const equipment = normalizeSnapshotEntries(report.equipment_snapshot);
  const durationText = formatPostIncidentDuration(
    report.duration_minutes,
    report.mobilized_at,
    report.demobilized_at,
  );

  const resourceCards = (title, items, renderItem) => `
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
      <h4 style="margin: 0 0 0.75rem 0; color: #2d3748;">${title}</h4>
      ${items.length === 0 ? '<div style="color: #999;">No records captured</div>' : items.map(renderItem).join("")}
    </div>
  `;

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
      <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Receipt No.</div><div style="font-weight: 700; color: #2d3748; font-family: monospace;">${escapeHtml(report.report_number || "-")}</div></div>
      <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Agency</div><div style="font-weight: 700; color: #2d3748;">${escapeHtml(report.agency_name || "-")}</div></div>
      <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Incident</div><div style="font-weight: 700; color: #2d3748;">${escapeHtml(report.incident_title || "-")}</div></div>
      <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Duration</div><div style="font-weight: 700; color: #2d3748;">${durationText}</div></div>
      <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Mobilized</div><div style="font-weight: 700; color: #2d3748;">${formatPostIncidentDate(report.mobilized_at)}</div></div>
      <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Demobilized</div><div style="font-weight: 700; color: #2d3748;">${formatPostIncidentDate(report.demobilized_at)}</div></div>
      <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Personnel</div><div style="font-weight: 700; color: #2d3748;">${report.total_personnel || 0}</div></div>
      <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Vehicles</div><div style="font-weight: 700; color: #2d3748;">${report.total_vehicles || 0}</div></div>
      <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Equipment</div><div style="font-weight: 700; color: #2d3748;">${report.total_equipment || 0}</div></div>
      <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Portal</div><div style="font-weight: 700; color: #2d3748;">${escapeHtml(report.portal_location || "-")}</div></div>
      <div style="background: #f7fafc; border-radius: 8px; padding: 1rem;"><div style="color: #718096; font-size: 0.85rem;">Assigned Location</div><div style="font-weight: 700; color: #2d3748;">${report.assigned_latitude && report.assigned_longitude ? `${report.assigned_latitude}, ${report.assigned_longitude}` : "-"}</div></div>
    </div>

    <div style="margin-bottom: 1rem; color: #4a5568;">
      <strong>Contact Person:</strong> ${escapeHtml(report.contact_person || "-")} &nbsp;&nbsp; <strong>Contact Number:</strong> ${escapeHtml(report.contact_number || "-")}
    </div>

    ${resourceCards(
      "Personnel Snapshot",
      members,
      (member) => `
        <div style="border-top: 1px solid #edf2f7; padding: 0.75rem 0;">
          <div style="font-weight: 600; color: #2d3748;">${escapeHtml(member.name || "-")}</div>
          <div style="color: #718096; font-size: 0.9rem;">${[member.gender, member.age ? `${member.age} yrs` : null, member.contact].filter(Boolean).map(escapeHtml).join(" • ") || "No extra details"}</div>
          <div style="color: #4a5568; font-size: 0.85rem; margin-top: 0.25rem;">${escapeHtml(member.capabilities || "-")}</div>
          ${formatPostIncidentResourceTimeline(member, report.mobilized_at)}
        </div>
      `,
    )}

    ${resourceCards(
      "Vehicles Snapshot",
      vehicles,
      (vehicle) => `
        <div style="border-top: 1px solid #edf2f7; padding: 0.75rem 0;">
          <div style="font-weight: 600; color: #2d3748;">${escapeHtml(vehicle.kind || "-")}</div>
          <div style="color: #718096; font-size: 0.9rem;">${[vehicle.type, vehicle.plate_number, vehicle.operator_name].filter(Boolean).map(escapeHtml).join(" • ") || "No extra details"}</div>
          <div style="color: #4a5568; font-size: 0.85rem; margin-top: 0.25rem;">${escapeHtml(vehicle.capabilities || "-")}</div>
          ${formatPostIncidentResourceTimeline(vehicle, report.mobilized_at)}
        </div>
      `,
    )}

    ${resourceCards(
      "Equipment Snapshot",
      equipment,
      (item) => `
        <div style="border-top: 1px solid #edf2f7; padding: 0.75rem 0;">
          <div style="font-weight: 600; color: #2d3748;">${escapeHtml(item.kind || "-")}</div>
          <div style="color: #718096; font-size: 0.9rem;">${[item.type, item.power_source, item.fuel_type, item.operator_name].filter(Boolean).map(escapeHtml).join(" • ") || "No extra details"}</div>
          <div style="color: #4a5568; font-size: 0.85rem; margin-top: 0.25rem;">${escapeHtml(item.capabilities || "-")}</div>
          ${formatPostIncidentResourceTimeline(item, report.mobilized_at)}
        </div>
      `,
    )}
  `;
}

function filterIncidentsCheckIn() {
  const searchInput = document
    .getElementById("searchIncidentCheckIn")
    .value.toLowerCase();

  if (!searchInput) {
    displayIncidentGroupsCheckIn(allAgenciesCheckIn);
    return;
  }

  const filtered = allAgenciesCheckIn.filter((agency) => {
    const incidentTitle = (agency.incident_title || "").toLowerCase();
    const agencyName = (agency.agency_name || "").toLowerCase();
    const lgu = (agency.incident_lgu || "").toLowerCase();
    const barangay = (agency.incident_barangay || "").toLowerCase();

    return (
      incidentTitle.includes(searchInput) ||
      agencyName.includes(searchInput) ||
      lgu.includes(searchInput) ||
      barangay.includes(searchInput)
    );
  });

  displayIncidentGroupsCheckIn(filtered);
}

let currentAgencyChiefAssignment = null;
let currentAgencyChiefRole = null;

async function openAgencyChiefAssignmentModal(incidentId, incidentTitle) {
  currentAgencyChiefAssignment = { id: incidentId, title: incidentTitle };
  currentAgencyChiefRole = null;

  document.getElementById("agencyChiefTypeTitle").textContent =
    `Assign Section Chief - ${incidentTitle}`;
  document.getElementById("agencyChiefTypeBody").textContent =
    "Choose which section chief you want to assign for this incident.";

  openModal("agencyChiefTypeSelectionModal");
}

function selectAgencyChiefType(chiefType) {
  if (!currentAgencyChiefAssignment) return;

  currentAgencyChiefRole = chiefType;
  closeModal("agencyChiefTypeSelectionModal");
  loadAgencyPersonnelForChiefAssignment();
}

async function loadAgencyPersonnelForChiefAssignment() {
  if (!currentAgencyChiefAssignment || !currentAgencyChiefRole) return;

  const titleElement = document.getElementById("assignChiefModalTitle");
  const bodyElement = document.getElementById("assignChiefModalBody");
  const personnelList = document.getElementById("personnelListForChief");

  titleElement.textContent = `Assign ${currentAgencyChiefRole === "operation" ? "Operation" : "Planning"} Section Chief`;
  bodyElement.textContent =
    "Select a qualified personnel from this incident to continue.";
  personnelList.innerHTML =
    '<p style="text-align: center; padding: 2rem; color: #999;">Loading personnel...</p>';

  openModal("assignChiefModal");

  try {
    const response = await fetch(
      `/api/admin/incident/${currentAgencyChiefAssignment.id}/personnel`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    );

    const data = await response.json();

    if (data.success && data.personnel.length > 0) {
      displayPersonnelForChiefSelection(data.personnel);
    } else {
      personnelList.innerHTML =
        '<p style="text-align: center; padding: 2rem; color: #999;">No personnel available for this incident.</p>';
    }
  } catch (error) {
    console.error("Error loading personnel:", error);
    personnelList.innerHTML =
      '<p style="text-align: center; padding: 2rem; color: #e74c3c;">Error loading personnel.</p>';
  }
}

function displayPersonnelForChiefSelection(personnel) {
  const container = document.getElementById("personnelListForChief");

  if (!personnel || personnel.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; padding: 2rem; color: #999;">No personnel found.</p>';
    return;
  }

  container.innerHTML = personnel
    .map(
      (person) => `
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 4px; padding: 0.75rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #2d3748; margin-bottom: 0.25rem;">${escapeHtml(
                person.name,
              )}</div>
              <div style="font-size: 0.85rem; color: #666;">
                ${person.age ? `Age: ${person.age} • ` : ""}
                ${person.gender ? `${person.gender} • ` : ""}
                ${
                  person.capabilities
                    ? `<strong>Capabilities:</strong> ${escapeHtml(person.capabilities)}`
                    : ""
                }
              </div>
              ${
                person.contact
                  ? `<div style="font-size: 0.85rem; color: #666;">Contact: ${escapeHtml(person.contact)}</div>`
                  : ""
              }
            </div>
            <button 
              class="btn btn-verify" 
              onclick="assignAgencyChief(${person.id}, '${escapeHtml(
                person.name,
              ).replace(/'/g, "\\'")}')"
              style="padding: 0.5rem 1rem; margin-left: 1rem;">
              Select
            </button>
          </div>
      `,
    )
    .join("");
}

async function assignAgencyChief(memberId, memberName) {
  if (!currentAgencyChiefAssignment || !currentAgencyChiefRole) return;

  const roleLabel =
    currentAgencyChiefRole === "operation" ? "Operation" : "Planning";

  if (
    !confirm(
      `Assign ${memberName} as ${roleLabel} Section Chief for this incident?`,
    )
  ) {
    return;
  }

  try {
    const endpoint =
      currentAgencyChiefRole === "operation"
        ? `/api/admin/incident/${currentAgencyChiefAssignment.id}/assign-chief`
        : `/api/admin/incident/${currentAgencyChiefAssignment.id}/assign-planning-chief`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ member_id: memberId }),
    });

    const data = await response.json();

    if (data.success) {
      closeModal("assignChiefModal");
      showChiefCredentials(data.credentials, currentAgencyChiefRole);
      currentAgencyChiefAssignment = null;
      currentAgencyChiefRole = null;
      loadAgencyCheckIn();
    } else {
      alert("Error: " + (data.error || "Failed to assign chief"));
    }
  } catch (error) {
    console.error("Error assigning chief:", error);
    alert("Error assigning chief");
  }
}

function showChiefCredentials(credentials, role) {
  document.getElementById("chiefCredentialsTitle").textContent =
    role === "planning"
      ? "Planning Chief Credentials"
      : "Operation Chief Credentials";
  document.getElementById("chiefCredentialsMessage").textContent =
    role === "planning"
      ? "Planning Section Chief assigned successfully!"
      : "Operation Section Chief assigned successfully!";
  document.getElementById("chiefName").textContent = credentials.name;
  document.getElementById("chiefAgency").textContent = credentials.agency;
  document.getElementById("chiefUsername").textContent = credentials.username;
  document.getElementById("chiefPassword").textContent = credentials.password;

  openModal("chiefCredentialsModal");
}

// =============================================
// MANAGE USERS FUNCTIONALITY
// =============================================

let allLGUUsers = [];
let allAgencyUsers = [];
let allIMTUsers = [];
let currentIMTRole = null; // 'operation' or 'planning'
let selectedIncidentForIMT = null;

// Sub-tab switching
function showUserSubTab(tabName, event) {
  // Update button styles
  const buttons = document.querySelectorAll(".user-subtab");
  buttons.forEach((btn) => {
    btn.style.borderBottomColor = "transparent";
    btn.style.color = "#666";
  });

  if (event) {
    event.target.style.borderBottomColor = "#3498db";
    event.target.style.color = "#3498db";
  }

  // Hide all sub-tab contents
  document.querySelectorAll(".user-subtab-content").forEach((content) => {
    content.style.display = "none";
  });

  // Show selected sub-tab
  const tabMap = {
    lguUsers: "lguUsersSubTab",
    agencyUsers: "agencyUsersSubTab",
    imtUsers: "imtUsersSubTab",
  };

  const selectedTab = document.getElementById(tabMap[tabName]);
  if (selectedTab) {
    selectedTab.style.display = "block";
  }

  // Load data for the selected tab
  if (tabName === "lguUsers") {
    loadLGUUsers();
  } else if (tabName === "agencyUsers") {
    loadAgencyUsers();
  } else if (tabName === "imtUsers") {
    loadIMTUsers();
  }
}

// =============================================
// LGU USERS MANAGEMENT
// =============================================

async function loadLGUUsers() {
  try {
    const response = await fetch("/api/admin/lgu-users", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    if (data.success) {
      allLGUUsers = data.users || [];
      displayLGUUsers(allLGUUsers);
    } else {
      document.getElementById("lguUsersTableBody").innerHTML =
        '<tr><td colspan="3" style="padding: 2rem; text-align: center; color: #e74c3c;">Failed to load LGU users</td></tr>';
    }
  } catch (error) {
    console.error("Error loading LGU users:", error);
    document.getElementById("lguUsersTableBody").innerHTML =
      '<tr><td colspan="3" style="padding: 2rem; text-align: center; color: #e74c3c;">Error loading LGU users</td></tr>';
  }
}

function displayLGUUsers(users) {
  const tbody = document.getElementById("lguUsersTableBody");

  if (!users || users.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="3" style="padding: 2rem; text-align: center; color: #999;">No LGU users found</td></tr>';
    return;
  }

  tbody.innerHTML = users
    .map(
      (user) => `
    <tr onclick="viewLGUUserDetails(${user.id})" 
        style="border-bottom: 1px solid #e2e8f0; cursor: pointer; transition: background 0.2s;"
        onmouseover="this.style.background='#f7fafc'"
        onmouseout="this.style.background='transparent'">
      <td style="padding: 0.75rem; color: #2d3748;">${user.id}</td>
      <td style="padding: 0.75rem; color: #2d3748; font-weight: 500;">${escapeHtml(user.lgu || "-")}</td>
      <td style="padding: 0.75rem; color: #4a5568;">${escapeHtml(user.code || "-")}</td>
    </tr>
  `,
    )
    .join("");
}

function filterLGUUsers() {
  const searchTerm = document.getElementById("searchLGU").value.toLowerCase();

  const filtered = allLGUUsers.filter(
    (user) =>
      (user.lgu || "").toLowerCase().includes(searchTerm) ||
      (user.code || "").toLowerCase().includes(searchTerm),
  );

  displayLGUUsers(filtered);
}

function viewLGUUserDetails(id, lgu, code) {
  const user = allLGUUsers.find((u) => u.id === id);
  if (!user) return;

  document.getElementById("lguDetailId").textContent = user.id;
  document.getElementById("lguDetailLgu").textContent = user.lgu || "-";
  document.getElementById("lguDetailCode").textContent = user.code || "-";

  openModal("lguDetailsModal");
}

function openCreateLGUModal() {
  document.getElementById("lguModalTitle").textContent = "Create LGU User";
  document.getElementById("lguUserForm").reset();
  document.getElementById("lguUserId").value = "";
  document.getElementById("lguPasswordContainer").style.display = "block";
  document.getElementById("lguPassword").required = true;
  openModal("lguUserModal");
}

function editLGUUser(userId) {
  const user = allLGUUsers.find((u) => u.id === userId);
  if (!user) return;

  document.getElementById("lguModalTitle").textContent = "Edit LGU User";
  document.getElementById("lguUserId").value = user.id;
  document.getElementById("lguName").value = user.name || "";
  document.getElementById("lguContactPerson").value = user.contact_person || "";
  document.getElementById("lguContactNumber").value = user.contact_number || "";
  document.getElementById("lguEmail").value = user.email || "";
  document.getElementById("lguPasswordContainer").style.display = "none";
  document.getElementById("lguPassword").required = false;

  openModal("lguUserModal");
}

async function saveLGUUser() {
  const userId = document.getElementById("lguUserId").value;
  const isEdit = !!userId;

  const userData = {
    name: document.getElementById("lguName").value,
    contact_person: document.getElementById("lguContactPerson").value,
    contact_number: document.getElementById("lguContactNumber").value,
    email: document.getElementById("lguEmail").value,
  };

  if (!isEdit) {
    userData.password = document.getElementById("lguPassword").value;
    if (!userData.password) {
      alert("Password is required for new users");
      return;
    }
  }

  try {
    const url = isEdit
      ? `/api/admin/lgu-users/${userId}`
      : "/api/admin/lgu-users";
    const method = isEdit ? "PUT" : "POST";

    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (data.success) {
      closeModal("lguUserModal");
      loadLGUUsers();
      showMessage(
        isEdit
          ? "LGU user updated successfully"
          : "LGU user created successfully",
        "success",
      );
    } else {
      alert("Error: " + (data.error || "Failed to save LGU user"));
    }
  } catch (error) {
    console.error("Error saving LGU user:", error);
    alert("Error saving LGU user");
  }
}

async function deleteLGUUser(userId, userName) {
  if (!confirm(`Are you sure you want to delete the LGU user: ${userName}?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/lgu-users/${userId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    if (data.success) {
      loadLGUUsers();
      showMessage("LGU user deleted successfully", "success");
    } else {
      alert("Error: " + (data.error || "Failed to delete LGU user"));
    }
  } catch (error) {
    console.error("Error deleting LGU user:", error);
    alert("Error deleting LGU user");
  }
}

async function loadAgencyUsers() {
  try {
    const response = await fetch("/api/admin/agency-users", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    if (data.success) {
      allAgencyUsers = data.users || [];
      displayAgencyUsers(allAgencyUsers);
    } else {
      document.getElementById("agencyUsersTableBody").innerHTML =
        '<tr><td colspan="7" style="padding: 2rem; text-align: center; color: #e74c3c;">Failed to load agency users</td></tr>';
    }
  } catch (error) {
    console.error("Error loading agency users:", error);
    document.getElementById("agencyUsersTableBody").innerHTML =
      '<tr><td colspan="7" style="padding: 2rem; text-align: center; color: #e74c3c;">Error loading agency users</td></tr>';
  }
}

function displayAgencyUsers(users) {
  const tbody = document.getElementById("agencyUsersTableBody");

  if (!users || users.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="padding: 2rem; text-align: center; color: #999;">No agency accounts found</td></tr>';
    return;
  }

  tbody.innerHTML = users
    .map(
      (user) => `
    <tr onclick="viewAgencyUserDetails(${user.id})" 
        style="border-bottom: 1px solid #e2e8f0; cursor: pointer; transition: background 0.2s;"
        onmouseover="this.style.background='#f7fafc'"
        onmouseout="this.style.background='transparent'">
      <td style="padding: 0.75rem; color: #2d3748;">${user.id}</td>
      <td style="padding: 0.75rem; color: #2d3748; font-weight: 500;">${escapeHtml(user.agency_name)}</td>
      <td style="padding: 0.75rem; color: #4a5568;">${escapeHtml(user.email || "-")}</td>
      <td style="padding: 0.75rem; color: #4a5568;">${escapeHtml(user.contact_person || "-")}</td>
      <td style="padding: 0.75rem; color: #4a5568;">${escapeHtml(user.contact_number || "-")}</td>
      <td style="padding: 0.75rem; color: #4a5568;">${escapeHtml(formatRosterCounts(user))}</td>
      <td style="padding: 0.75rem; text-align: center;">
        <span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600; 
          ${user.status === "active" ? "background: #d4edda; color: #155724;" : "background: #f8d7da; color: #721c24;"}">
          ${escapeHtml(user.status || "active")}
        </span>
      </td>
    </tr>
  `,
    )
    .join("");
}

function filterAgencyUsers() {
  const searchTerm = document
    .getElementById("searchAgencyUser")
    .value.toLowerCase();

  const filtered = allAgencyUsers.filter(
    (user) =>
      (user.agency_name || "").toLowerCase().includes(searchTerm) ||
      (user.email || "").toLowerCase().includes(searchTerm) ||
      (user.contact_person || "").toLowerCase().includes(searchTerm) ||
      (user.contact_number || "").toLowerCase().includes(searchTerm),
  );

  displayAgencyUsers(filtered);
}

function viewAgencyUserDetails(id) {
  const user = allAgencyUsers.find((u) => u.id === id);
  if (!user) return;

  window.currentAgencyUserId = user.id;
  window.currentAgencyUserName = user.agency_name;
  window.currentAgencyUserData = user;

  document.getElementById("agencyDetailId").textContent = user.id;
  document.getElementById("agencyDetailName").textContent =
    user.agency_name || "-";
  document.getElementById("agencyDetailEmail").textContent = user.email || "-";
  document.getElementById("agencyDetailContact").textContent =
    user.contact_person || "-";
  document.getElementById("agencyDetailNumber").textContent =
    user.contact_number || "-";
  document.getElementById("agencyDetailCreatedAt").textContent = formatDateTime(
    user.created_at,
  );
  document.getElementById("agencyDetailUpdatedAt").textContent = formatDateTime(
    user.updated_at,
  );
  document.getElementById("agencyDetailRoster").textContent =
    formatRosterCounts(user);
  document.getElementById("agencyDetailCheckIns").textContent = String(
    user.total_check_ins || 0,
  );
  document.getElementById("agencyDetailLastCheckIn").textContent =
    formatDateTime(user.last_check_in_at);

  const statusEl = document.getElementById("agencyDetailStatus");
  const status = user.status || "active";
  statusEl.innerHTML = `<span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600; ${
    status === "active"
      ? "background: #d4edda; color: #155724;"
      : "background: #f8d7da; color: #721c24;"
  }">${status}</span>`;

  openModal("agencyDetailsModal");
}

function deleteAgencyFromModal() {
  if (window.currentAgencyUserId && window.currentAgencyUserName) {
    closeModal("agencyDetailsModal");
    deleteAgencyUser(window.currentAgencyUserId, window.currentAgencyUserName);
  }
}

function editAgencyFromModal() {
  if (!window.currentAgencyUserId) return;
  closeModal("agencyDetailsModal");
  editAgencyUser(window.currentAgencyUserId);
}

function openCreateAgencyModal() {
  document.getElementById("agencyModalTitle").textContent =
    "Create Agency Account";
  document.getElementById("agencyUserForm").reset();
  document.getElementById("agencyUserId").value = "";
  document.getElementById("agencyPasswordContainer").style.display = "block";
  document.getElementById("agencyPassword").required = true;
  document.getElementById("agencyStatus").value = "active";
  openModal("agencyUserModal");
}

function editAgencyUser(userId) {
  const user = allAgencyUsers.find((u) => u.id === userId);
  if (!user) return;

  document.getElementById("agencyModalTitle").textContent =
    "Edit Agency Account";
  document.getElementById("agencyUserId").value = user.id;
  document.getElementById("agencyName").value = user.agency_name || "";
  document.getElementById("agencyStatus").value = user.status || "active";
  document.getElementById("agencyContactPerson").value =
    user.contact_person || "";
  document.getElementById("agencyContactNumber").value =
    user.contact_number || "";
  document.getElementById("agencyEmail").value = user.email || "";
  document.getElementById("agencyPasswordContainer").style.display = "none";
  document.getElementById("agencyPassword").required = false;

  openModal("agencyUserModal");
}

async function saveAgencyUser() {
  const userId = document.getElementById("agencyUserId").value;
  const isEdit = !!userId;

  const userData = {
    agency_name: document.getElementById("agencyName").value.trim(),
    contact_person: document.getElementById("agencyContactPerson").value.trim(),
    contact_number: document.getElementById("agencyContactNumber").value.trim(),
    email: document.getElementById("agencyEmail").value.trim(),
    status: document.getElementById("agencyStatus").value,
  };

  if (!isEdit) {
    userData.password = document.getElementById("agencyPassword").value;
    if (!userData.password) {
      alert("Password is required for new accounts");
      return;
    }
  }

  try {
    const url = isEdit
      ? `/api/admin/agency-users/${userId}`
      : "/api/admin/agency-users";
    const method = isEdit ? "PUT" : "POST";

    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (data.success) {
      closeModal("agencyUserModal");
      loadAgencyUsers();
      showMessage(
        isEdit
          ? "Agency account updated successfully"
          : "Agency account created successfully",
        "success",
      );
    } else {
      alert("Error: " + (data.error || "Failed to save agency account"));
    }
  } catch (error) {
    console.error("Error saving agency account:", error);
    alert("Error saving agency account");
  }
}

async function deleteAgencyUser(userId, agencyName) {
  if (
    !confirm(
      `Are you sure you want to disable the agency account: ${agencyName}?`,
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/agency-users/${userId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    if (data.success) {
      loadAgencyUsers();
      showMessage("Agency account disabled successfully", "success");
    } else {
      alert("Error: " + (data.error || "Failed to disable agency account"));
    }
  } catch (error) {
    console.error("Error disabling agency account:", error);
    alert("Error disabling agency account");
  }
}

async function loadIMTUsers() {
  try {
    const response = await fetch("/api/admin/imt-users", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    if (data.success) {
      allIMTUsers = data.users || [];
      displayIMTUsers(allIMTUsers);
    } else {
      document.getElementById("imtUsersTableBody").innerHTML =
        '<tr><td colspan="8" style="padding: 2rem; text-align: center; color: #e74c3c;">Failed to load IMT users</td></tr>';
    }
  } catch (error) {
    console.error("Error loading IMT users:", error);
    document.getElementById("imtUsersTableBody").innerHTML =
      '<tr><td colspan="8" style="padding: 2rem; text-align: center; color: #e74c3c;">Error loading IMT users</td></tr>';
  }
}

function displayIMTUsers(users) {
  const tbody = document.getElementById("imtUsersTableBody");

  if (!users || users.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="padding: 2rem; text-align: center; color: #999;">No IMT users found</td></tr>';
    return;
  }

  tbody.innerHTML = users
    .map(
      (user) => `
    <tr onclick="viewIMTUserDetails(${user.id})" 
        style="border-bottom: 1px solid #e2e8f0; cursor: pointer; transition: background 0.2s;"
        onmouseover="this.style.background='#f7fafc'"
        onmouseout="this.style.background='transparent'">
      <td style="padding: 0.75rem; color: #2d3748;">${user.id}</td>
      <td style="padding: 0.75rem; color: #2d3748; font-weight: 500;">${escapeHtml(user.name)}</td>
      <td style="padding: 0.75rem; color: #4a5568;">
        <span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600; 
          ${user.chief_type === "operation" || !user.chief_type ? "background: #dbeafe; color: #1e40af;" : "background: #fef3c7; color: #92400e;"}">
          ${user.chief_type === "operation" || !user.chief_type ? "Operation Chief" : "Planning Chief"}
        </span>
      </td>
      <td style="padding: 0.75rem; color: #4a5568; font-family: monospace;">${escapeHtml(user.username)}</td>
      <td style="padding: 0.75rem; color: #4a5568;">${escapeHtml(user.agency_name || "-")}</td>
      <td style="padding: 0.75rem; color: #4a5568;">${escapeHtml(user.capabilities || "-")}</td>
      <td style="padding: 0.75rem; color: #4a5568;">${escapeHtml(user.incident_title || "-")}</td>
      <td style="padding: 0.75rem; text-align: center;">
        <span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600; ${getIMTStatusBadgeStyle(user)}">
          ${escapeHtml(getIMTStatusLabel(user))}
        </span>
      </td>
    </tr>
  `,
    )
    .join("");
}

function filterIMTUsers() {
  const searchTerm = document.getElementById("searchIMT").value.toLowerCase();
  const roleFilter = document.getElementById("filterIMTRole").value;
  const statusFilter = document.getElementById("filterIMTStatus").value;

  let filtered = allIMTUsers.filter(
    (user) =>
      (user.name || "").toLowerCase().includes(searchTerm) ||
      (user.username || "").toLowerCase().includes(searchTerm) ||
      (user.agency_name || "").toLowerCase().includes(searchTerm) ||
      (user.capabilities || "").toLowerCase().includes(searchTerm) ||
      (user.incident_title || "").toLowerCase().includes(searchTerm),
  );

  if (roleFilter) {
    filtered = filtered.filter(
      (user) => (user.chief_type || "operation") === roleFilter,
    );
  }

  if (statusFilter) {
    filtered = filtered.filter(
      (user) =>
        (user.account_status || user.status || "active") === statusFilter,
    );
  }

  displayIMTUsers(filtered);
}

function viewArchivedIMTAccounts() {
  const statusFilter = document.getElementById("filterIMTStatus");
  if (!statusFilter) return;
  statusFilter.value = "archived";
  filterIMTUsers();
}

function showAllIMTAccounts() {
  const statusFilter = document.getElementById("filterIMTStatus");
  if (!statusFilter) return;
  statusFilter.value = "";
  filterIMTUsers();
}

function getIMTStatusLabel(user) {
  return (user.account_status || user.status || "active") === "archived"
    ? "Archived"
    : "Active";
}

function getIMTStatusBadgeStyle(user) {
  return (user.account_status || user.status || "active") === "archived"
    ? "background: #edf2f7; color: #4a5568;"
    : "background: #d4edda; color: #155724;";
}

function viewIMTUserDetails(id) {
  const user = allIMTUsers.find((u) => u.id === id);
  if (!user) return;

  window.currentIMTUserId = user.id;
  window.currentIMTUserName = user.name;
  window.currentIMTUserData = user;

  const chiefTypeLabel =
    user.chief_type === "operation" || !user.chief_type
      ? "Operation Chief"
      : "Planning Chief";
  const chiefTypeColor =
    user.chief_type === "operation" || !user.chief_type
      ? "background: #dbeafe; color: #1e40af;"
      : "background: #fef3c7; color: #92400e;";

  document.getElementById("imtDetailId").textContent = user.id;
  document.getElementById("imtDetailName").textContent = user.name || "-";
  document.getElementById("imtDetailType").innerHTML =
    `<span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600; ${chiefTypeColor}">${chiefTypeLabel}</span>`;
  document.getElementById("imtDetailUsername").textContent =
    user.username || "-";
  document.getElementById("imtDetailAgency").textContent =
    user.agency_name || "-";
  document.getElementById("imtDetailContact").textContent = user.contact || "-";
  document.getElementById("imtDetailCapabilities").textContent =
    user.capabilities || "-";
  document.getElementById("imtDetailIncident").textContent =
    user.incident_title || "-";
  document.getElementById("imtDetailStatus").innerHTML =
    `<span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600; ${getIMTStatusBadgeStyle(user)}">${escapeHtml(getIMTStatusLabel(user))}</span>`;

  const archiveButton = document.getElementById("imtRemoveBtn");
  const isArchived =
    (user.account_status || user.status || "active") === "archived";
  archiveButton.textContent = isArchived ? "Archived" : "Archive Chief";
  archiveButton.disabled = isArchived;
  archiveButton.style.opacity = isArchived ? "0.65" : "1";
  archiveButton.style.cursor = isArchived ? "not-allowed" : "pointer";

  openModal("imtDetailsModal");
}

function removeIMTFromModal() {
  if (window.currentIMTUserId && window.currentIMTUserName) {
    closeModal("imtDetailsModal");
    removeIMTUser(window.currentIMTUserId, window.currentIMTUserName);
  }
}

function editIMTFromModal() {
  if (!window.currentIMTUserId) return;
  closeModal("imtDetailsModal");
  openIMTUserModal(window.currentIMTUserId);
}

function openIMTUserModal(userId) {
  const user = allIMTUsers.find((entry) => entry.id === userId);
  if (!user) return;

  document.getElementById("imtModalTitle").textContent = "Manage Chief Profile";
  document.getElementById("imtUserId").value = user.id;
  document.getElementById("imtName").value = user.name || "";
  document.getElementById("imtUsername").value = user.username || "";
  document.getElementById("imtAgencyName").value = user.agency_name || "";
  document.getElementById("imtContact").value = user.contact || "";
  document.getElementById("imtCapabilities").value = user.capabilities || "";
  document.getElementById("imtAssignedIncident").textContent =
    user.incident_title || "-";

  openModal("imtUserModal");
}

function closeIMTUserModal() {
  closeModal("imtUserModal");
}

async function saveIMTUser() {
  const userId = document.getElementById("imtUserId").value;
  if (!userId) return;

  const userData = {
    name: document.getElementById("imtName").value.trim(),
    username: document.getElementById("imtUsername").value.trim(),
    agency_name: document.getElementById("imtAgencyName").value.trim(),
    contact: document.getElementById("imtContact").value.trim(),
    capabilities: document.getElementById("imtCapabilities").value.trim(),
  };

  if (!userData.name || !userData.username || !userData.agency_name) {
    alert("Name, username, and agency are required");
    return;
  }

  try {
    const response = await fetch(`/api/admin/imt-users/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (data.success) {
      closeModal("imtUserModal");
      loadIMTUsers();
      showMessage("Chief profile updated successfully", "success");
    } else {
      alert("Error: " + (data.error || "Failed to save chief profile"));
    }
  } catch (error) {
    console.error("Error saving chief profile:", error);
    alert("Error saving chief profile");
  }
}

function openAssignChiefModal() {
  openModal("chiefTypeSelectionModal");
}

function selectChiefType(chiefType) {
  closeModal("chiefTypeSelectionModal");
  currentIMTRole = chiefType;
  loadIncidentsForChiefAssignment();
}

async function loadIncidentsForChiefAssignment() {
  document.getElementById("imtAssignmentTitle").textContent =
    `Assign ${currentIMTRole === "operation" ? "Operation" : "Planning"} Chief - Select Incident`;

  const incidentList = document.getElementById("incidentListForChief");
  incidentList.innerHTML =
    '<p style="text-align: center; padding: 2rem; color: #999;">Loading incidents...</p>';

  openModal("imtIncidentSelectionModal");

  try {
    const response = await fetch("/api/admin/all-incidents", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    if (data.incidents && data.incidents.length > 0) {
      displayIncidentsForChief(data.incidents);
    } else {
      incidentList.innerHTML =
        '<p style="text-align: center; padding: 2rem; color: #999;">No incidents available</p>';
    }
  } catch (error) {
    console.error("Error loading incidents:", error);
    incidentList.innerHTML =
      '<p style="text-align: center; padding: 2rem; color: #e74c3c;">Error loading incidents</p>';
  }
}

function displayIncidentsForChief(incidents) {
  const container = document.getElementById("incidentListForChief");

  container.innerHTML = incidents
    .map(
      (incident) => `
    <div onclick="selectIncidentForChief(${incident.id}, '${escapeHtml(incident.title).replace(/'/g, "\\'")}')" 
         style="background: white; border: 1px solid #e2e8f0; border-radius: 4px; padding: 1rem; margin-bottom: 0.75rem; cursor: pointer; transition: all 0.2s;"
         onmouseover="this.style.borderColor='#3498db'; this.style.boxShadow='0 2px 8px rgba(52, 152, 219, 0.2)';"
         onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="flex: 1;">
          <div style="font-weight: 600; color: #2d3748; margin-bottom: 0.25rem;">${escapeHtml(incident.title)}</div>
          <div style="font-size: 0.85rem; color: #666;">
            ${escapeHtml(incident.lgu || "-")} • ${escapeHtml(incident.barangay || "-")}
            ${incident.status ? ` • <span style="color: ${String(incident.status).toLowerCase() === "resolved" ? "#27ae60" : "#3498db"};">${normalizeIncidentStatusLabel(incident.status)}</span>` : ""}
          </div>
        </div>
        <div style="color: #3498db; font-weight: 600;">Select →</div>
      </div>
    </div>
  `,
    )
    .join("");
}

function filterIncidentsForChief() {
  const searchTerm = document
    .getElementById("searchIncidentForChief")
    .value.toLowerCase();
  const incidentDivs = document.querySelectorAll("#incidentListForChief > div");

  incidentDivs.forEach((div) => {
    const text = div.textContent.toLowerCase();
    div.style.display = text.includes(searchTerm) ? "block" : "none";
  });
}

async function selectIncidentForChief(incidentId, incidentTitle) {
  selectedIncidentForIMT = { id: incidentId, title: incidentTitle };

  closeModal("imtIncidentSelectionModal");

  document.getElementById("imtPersonnelTitle").textContent =
    `Assign ${currentIMTRole === "operation" ? "Operation" : "Planning"} Chief - Select Personnel`;
  document.getElementById("selectedIncidentName").textContent = incidentTitle;

  const personnelList = document.getElementById("personnelListForIMT");
  personnelList.innerHTML =
    '<p style="text-align: center; padding: 2rem; color: #999;">Loading personnel...</p>';

  openModal("imtPersonnelSelectionModal");

  try {
    const response = await fetch(
      `/api/admin/incident/${incidentId}/personnel`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    );

    const data = await response.json();

    if (data.success && data.personnel.length > 0) {
      displayPersonnelForIMT(data.personnel);
    } else {
      personnelList.innerHTML =
        '<p style="text-align: center; padding: 2rem; color: #999;">No personnel available for this incident</p>';
    }
  } catch (error) {
    console.error("Error loading personnel:", error);
    personnelList.innerHTML =
      '<p style="text-align: center; padding: 2rem; color: #e74c3c;">Error loading personnel</p>';
  }
}

function displayPersonnelForIMT(personnel) {
  const container = document.getElementById("personnelListForIMT");

  const byAgency = {};
  personnel.forEach((person) => {
    if (!byAgency[person.agency_name]) {
      byAgency[person.agency_name] = [];
    }
    byAgency[person.agency_name].push(person);
  });

  container.innerHTML = Object.keys(byAgency)
    .map(
      (agencyName) => `
    <div style="margin-bottom: 1.5rem; background: #f7fafc; border-radius: 8px; padding: 1rem;">
      <h4 style="margin: 0 0 1rem 0; color: #2d3748;">${escapeHtml(agencyName)}</h4>
      <div style="display: grid; gap: 0.75rem;">
        ${byAgency[agencyName]
          .map(
            (person) => `
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 4px; padding: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #2d3748; margin-bottom: 0.25rem;">${escapeHtml(person.name)}</div>
              <div style="font-size: 0.85rem; color: #666;">
                ${person.age ? `Age: ${person.age} • ` : ""}
                ${person.gender ? `${person.gender}` : ""}
                ${person.capabilities ? ` • <strong>Capabilities:</strong> ${escapeHtml(person.capabilities)}` : ""}
              </div>
              ${person.contact ? `<div style="font-size: 0.85rem; color: #666;">Contact: ${escapeHtml(person.contact)}</div>` : ""}
            </div>
            <button class="btn btn-primary" onclick="assignChiefFromPersonnel(${person.id}, '${escapeHtml(person.name).replace(/'/g, "\\'")}')" style="padding: 0.5rem 1rem; margin-left: 1rem;">
              Select
            </button>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `,
    )
    .join("");
}

async function assignChiefFromPersonnel(memberId, memberName) {
  if (!selectedIncidentForIMT || !currentIMTRole) return;

  if (
    !confirm(
      `Assign ${memberName} as ${currentIMTRole === "operation" ? "Operation" : "Planning"} Chief for ${selectedIncidentForIMT.title}?`,
    )
  ) {
    return;
  }

  try {
    const endpoint =
      currentIMTRole === "operation"
        ? `/api/admin/incident/${selectedIncidentForIMT.id}/assign-chief`
        : `/api/admin/incident/${selectedIncidentForIMT.id}/assign-planning-chief`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ member_id: memberId }),
    });

    const data = await response.json();

    if (data.success) {
      closeModal("imtPersonnelSelectionModal");
      showIMTCredentials(data.credentials, currentIMTRole);
    } else {
      alert("Error: " + (data.error || "Failed to assign chief"));
    }
  } catch (error) {
    console.error("Error assigning chief:", error);
    alert("Error assigning chief");
  }
}

function showIMTCredentials(credentials, role) {
  document.getElementById("imtCredName").textContent = credentials.name;
  document.getElementById("imtCredRole").textContent =
    role === "operation" ? "Operation Chief" : "Planning Chief";
  document.getElementById("imtCredAgency").textContent = credentials.agency;
  document.getElementById("imtCredUsername").textContent = credentials.username;
  document.getElementById("imtCredPassword").textContent = credentials.password;

  openModal("imtCredentialsModal");
}

function backToIncidentSelection() {
  closeModal("imtPersonnelSelectionModal");
  loadIncidentsForChiefAssignment();
}

function closeIMTCredentialsModal() {
  closeModal("imtCredentialsModal");
  loadIMTUsers();
  currentIMTRole = null;
  selectedIncidentForIMT = null;
}

function printIMTCredentials() {
  const name = document.getElementById("imtCredName").textContent;
  const role = document.getElementById("imtCredRole").textContent;
  const agency = document.getElementById("imtCredAgency").textContent;
  const username = document.getElementById("imtCredUsername").textContent;
  const password = document.getElementById("imtCredPassword").textContent;

  const printWindow = window.open("", "", "width=600,height=400");
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Chief Credentials</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h2 { color: #2d3748; }
        .credential-box { background: #f7fafc; border: 2px solid #3498db; border-radius: 8px; padding: 15px; margin: 10px 0; }
        .label { font-weight: bold; color: #4a5568; }
        .value { color: #2d3748; font-size: 1.1rem; }
        .password { color: #e74c3c; font-weight: bold; font-size: 1.2rem; }
      </style>
    </head>
    <body>
      <h2>Chief Account Credentials</h2>
      <div class="credential-box">
        <p><span class="label">Name:</span> <span class="value">${name}</span></p>
        <p><span class="label">Role:</span> <span class="value">${role}</span></p>
        <p><span class="label">Agency:</span> <span class="value">${agency}</span></p>
        <p><span class="label">Username:</span> <span class="value">${username}</span></p>
        <p><span class="label">Password:</span> <span class="password">${password}</span></p>
      </div>
      <p style="margin-top: 20px; color: #856404; font-size: 0.9rem;">⚠ Keep these credentials secure. They cannot be retrieved later.</p>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

async function removeIMTUser(userId, userName) {
  if (
    !confirm(
      `Archive ${userName}? The account will stay available for view-only login.`,
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/imt-users/${userId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    if (data.success) {
      loadIMTUsers();
      showMessage("IMT user archived successfully", "success");
    } else {
      alert("Error: " + (data.error || "Failed to archive IMT user"));
    }
  } catch (error) {
    console.error("Error archiving IMT user:", error);
    alert("Error archiving IMT user");
  }
}

function setDefaultDownloadDateRange() {
  const startInput = document.getElementById("downloadStartDate");
  const endInput = document.getElementById("downloadEndDate");
  if (!startInput || !endInput) return;

  if (!startInput.value || !endInput.value) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);

    startInput.value = startDate.toISOString().slice(0, 10);
    endInput.value = endDate.toISOString().slice(0, 10);
  }
}

function resetDownloadableFormFilters() {
  const startInput = document.getElementById("downloadStartDate");
  const endInput = document.getElementById("downloadEndDate");
  if (!startInput || !endInput) return;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 6);

  startInput.value = startDate.toISOString().slice(0, 10);
  endInput.value = endDate.toISOString().slice(0, 10);
  showMessage("Date range reset to the last 7 days", "info");
}

function parseDateBoundary(value, isEnd = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (isEnd) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function triggerFileDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function formatReportDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function getIncidentReportRange(reportType) {
  const now = new Date();
  const defaultEnd = new Date(now);
  defaultEnd.setHours(23, 59, 59, 999);

  if (reportType === "weekly") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end: defaultEnd, label: "Last 7 days" };
  }

  if (reportType === "monthly") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end: defaultEnd, label: "Last 30 days" };
  }

  if (reportType === "yearly") {
    const start = new Date(now);
    start.setDate(start.getDate() - 364);
    start.setHours(0, 0, 0, 0);
    return { start, end: defaultEnd, label: "Last 365 days" };
  }

  const startInput = document.getElementById("downloadStartDate");
  const endInput = document.getElementById("downloadEndDate");
  const start = parseDateBoundary(startInput?.value || "", false);
  const end = parseDateBoundary(endInput?.value || "", true);

  if (!start || !end) {
    throw new Error(
      "Please choose a valid start and end date for the custom report.",
    );
  }

  if (start > end) {
    throw new Error(
      "The start date must be earlier than or equal to the end date.",
    );
  }

  return {
    start,
    end,
    label: `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
  };
}

function filterRecordsByDate(records, fieldName, start, end) {
  return (records || []).filter((record) => {
    const value = record[fieldName];
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date >= start && date <= end;
  });
}

function buildIncidentReportData(reportType) {
  const { start, end, label } = getIncidentReportRange(reportType);
  const incidents = filterRecordsByDate(
    downloadableFormsData.incidents,
    "created_at",
    start,
    end,
  );

  const statusCounts = incidents.reduce((counts, incident) => {
    const status = (incident.status || "unknown").toLowerCase();
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  const severityCounts = incidents.reduce((counts, incident) => {
    const severity = (incident.severity || "unknown").toLowerCase();
    counts[severity] = (counts[severity] || 0) + 1;
    return counts;
  }, {});

  return {
    title:
      reportType === "weekly"
        ? "Weekly Incident Report"
        : reportType === "monthly"
          ? "Monthly Incident Report"
          : reportType === "yearly"
            ? "Yearly Incident Report"
            : "Custom Incident Log",
    label,
    incidents,
    start,
    end,
    statusCounts,
    severityCounts,
    filenamePrefix:
      reportType === "weekly"
        ? "weekly-incident-report"
        : reportType === "monthly"
          ? "monthly-incident-report"
          : reportType === "yearly"
            ? "yearly-incident-report"
            : "custom-incident-log",
  };
}

function buildIncidentRows(incidents) {
  return incidents.map((incident) => ({
    title: incident.title || "",
    type: incident.type || "",
    severity: incident.severity || "",
    lgu: incident.lgu || "",
    barangay: incident.barangay || "",
    location: incident.location || "",
    status: incident.status || "",
    source: incident.source || "",
    created_at: formatReportDateTime(incident.created_at),
    affected_population: incident.affected_population || "",
    description: incident.description || "",
    remarks: incident.remarks || "",
  }));
}

function buildCheckInRows(checkIns) {
  return checkIns.map((checkIn) => ({
    report_number: checkIn.report_number || "",
    agency_name: checkIn.agency_name || "",
    contact_person: checkIn.contact_person || "",
    contact_number: checkIn.contact_number || "",
    incident_title: checkIn.incident_title || "",
    incident_status: checkIn.incident_status || "",
    total_personnel: checkIn.total_personnel || 0,
    total_vehicles: checkIn.total_vehicles || 0,
    total_equipment: checkIn.total_equipment || 0,
    portal_location: checkIn.portal_location || "",
    mobilized_at: formatReportDateTime(
      checkIn.created_at || checkIn.mobilized_at,
    ),
    demobilized_at: formatReportDateTime(checkIn.demobilized_at),
    duration_minutes: checkIn.duration_minutes || 0,
  }));
}

function buildPostIncidentRows(reports) {
  return reports.map((report) => ({
    report_number: report.report_number || "",
    agency_name: report.agency_name || "",
    incident_title: report.incident_title || "",
    incident_lgu: report.incident_lgu || "",
    portal_location: report.portal_location || "",
    mobilized_at: formatReportDateTime(report.mobilized_at),
    demobilized_at: formatReportDateTime(report.demobilized_at),
    duration_minutes: report.duration_minutes || 0,
    total_personnel: report.total_personnel || 0,
    total_vehicles: report.total_vehicles || 0,
    total_equipment: report.total_equipment || 0,
  }));
}

function buildCsv(headers, rows) {
  const csvLines = [headers.map(csvEscape).join(",")];

  rows.forEach((row) => {
    csvLines.push(
      headers.map((header) => csvEscape(row[header] || "")).join(","),
    );
  });

  return csvLines.join("\n");
}

function buildPrintableReportHtml(
  title,
  subtitle,
  summaryItems,
  headers,
  rows,
) {
  const summaryHtml = summaryItems
    .map(
      (item) => `
        <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.9rem;">
          <div style="font-size: 0.8rem; color: #718096; text-transform: uppercase; letter-spacing: 0.04em;">${escapeHtml(item.label)}</div>
          <div style="font-size: 1.4rem; font-weight: 700; color: #1a365d; margin-top: 0.25rem;">${escapeHtml(item.value)}</div>
        </div>
      `,
    )
    .join("");

  const tableRows = rows
    .map(
      (row) => `
        <tr>
          ${headers
            .map(
              (header) =>
                `<td style="padding: 0.55rem 0.65rem; border-bottom: 1px solid #e2e8f0; vertical-align: top;">${escapeHtml(row[header] || "-")}</td>`,
            )
            .join("")}
        </tr>
      `,
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #1f2937; }
        h1 { margin: 0 0 0.35rem 0; color: #1a365d; }
        .subtitle { color: #64748b; margin-bottom: 1.25rem; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
        .report-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .report-table th { text-align: left; padding: 0.65rem; background: #f7fafc; border-bottom: 2px solid #cbd5e0; color: #2d3748; }
        .report-table td { color: #374151; }
        .footer-note { margin-top: 1rem; color: #6b7280; font-size: 0.8rem; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <div class="subtitle">${escapeHtml(subtitle)}</div>
      <div class="summary-grid">${summaryHtml}</div>
      <table class="report-table">
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(header.replace(/_/g, " "))}</th>`).join("")}</tr>
        </thead>
        <tbody>${tableRows || `<tr><td colspan="${headers.length}" style="padding: 1rem; text-align: center; color: #6b7280;">No records found</td></tr>`}</tbody>
      </table>
      <div class="footer-note">Generated on ${new Date().toLocaleString()}</div>
    </body>
    </html>
  `;
}

function openReportPreview(title, subtitle, summaryItems, headers, rows) {
  const modal = document.getElementById("reportPreviewModal");
  const titleElement = document.getElementById("reportPreviewTitle");
  const subtitleElement = document.getElementById("reportPreviewSubtitle");
  const frame = document.getElementById("reportPreviewFrame");

  if (!modal || !titleElement || !subtitleElement || !frame) {
    showMessage("Preview window is unavailable.", "error");
    return;
  }

  currentReportPreview = {
    title,
    subtitle,
    summaryItems,
    headers,
    rows,
  };

  titleElement.textContent = title;
  subtitleElement.textContent = subtitle;
  frame.srcdoc = buildPrintableReportHtml(
    title,
    subtitle,
    summaryItems,
    headers,
    rows,
  );
  modal.style.display = "block";
}

function closeReportPreviewModal() {
  const modal = document.getElementById("reportPreviewModal");
  const frame = document.getElementById("reportPreviewFrame");

  if (modal) modal.style.display = "none";
  if (frame) frame.srcdoc = "";
  currentReportPreview = null;
}

function printCurrentPreview() {
  const frame = document.getElementById("reportPreviewFrame");
  if (!frame || !frame.contentWindow) {
    showMessage("Preview is not ready to print.", "error");
    return;
  }

  frame.contentWindow.focus();
  frame.contentWindow.print();
}

function renderPrintWindow(title, subtitle, summaryItems, headers, rows) {
  const printWindow = window.open("", "", "width=1200,height=900");
  if (!printWindow) {
    showMessage("Pop-up blocked. Allow pop-ups to print reports.", "error");
    return;
  }

  printWindow.document.write(
    buildPrintableReportHtml(title, subtitle, summaryItems, headers, rows),
  );
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function loadDownloadableForms() {
  try {
    setDefaultDownloadDateRange();

    const [incidentsResponse, checkInsResponse, reportsResponse] =
      await Promise.all([
        fetch("/api/admin/all-incidents", {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch("/api/admin/agency-check-ins", {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch("/api/admin/post-incident-reports", {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);

    if (!incidentsResponse.ok || !checkInsResponse.ok || !reportsResponse.ok) {
      throw new Error("Failed to load report sources");
    }

    const incidentsData = await incidentsResponse.json();
    const checkInsData = await checkInsResponse.json();
    const reportsData = await reportsResponse.json();

    downloadableFormsData = {
      incidents: incidentsData.incidents || [],
      agencyCheckIns: checkInsData.manifests || [],
      postIncidentReports: reportsData.reports || [],
    };

    updateDownloadableFormStats();
    showMessage("Downloadable form data refreshed", "success");
  } catch (error) {
    console.error("Error loading downloadable forms:", error);
    showMessage("Error loading downloadable forms", "error");
  }
}

function updateDownloadableFormStats() {
  const incidents = downloadableFormsData.incidents || [];
  const now = new Date();

  const last7Start = new Date(now);
  last7Start.setDate(last7Start.getDate() - 6);
  last7Start.setHours(0, 0, 0, 0);

  const last30Start = new Date(now);
  last30Start.setDate(last30Start.getDate() - 29);
  last30Start.setHours(0, 0, 0, 0);

  const weeklyIncidents = filterRecordsByDate(
    incidents,
    "created_at",
    last7Start,
    now,
  );
  const monthlyIncidents = filterRecordsByDate(
    incidents,
    "created_at",
    last30Start,
    now,
  );
  const last365Start = new Date(now);
  last365Start.setDate(last365Start.getDate() - 364);
  last365Start.setHours(0, 0, 0, 0);
  const yearlyIncidents = filterRecordsByDate(
    incidents,
    "created_at",
    last365Start,
    now,
  );

  const openIncidents = incidents.filter((incident) => {
    const status = (incident.status || "").toLowerCase();
    return (
      status === "active" || status === "activated" || status === "ongoing"
    );
  }).length;

  const weeklyCount = document.getElementById("weeklyIncidentCount");
  const monthlyCount = document.getElementById("monthlyIncidentCount");
  const yearlyCount = document.getElementById("yearlyIncidentCount");
  const openCount = document.getElementById("openIncidentCount");
  const checkInCount = document.getElementById("checkInCount");

  if (weeklyCount) weeklyCount.textContent = weeklyIncidents.length;
  if (monthlyCount) monthlyCount.textContent = monthlyIncidents.length;
  if (yearlyCount) yearlyCount.textContent = yearlyIncidents.length;
  if (openCount) openCount.textContent = openIncidents;
  if (checkInCount)
    checkInCount.textContent = downloadableFormsData.agencyCheckIns.length;
}

function downloadIncidentReport(reportType, format) {
  try {
    const reportData = buildIncidentReportData(reportType);
    const rows = buildIncidentRows(reportData.incidents);
    const headers = [
      "title",
      "type",
      "severity",
      "lgu",
      "barangay",
      "location",
      "status",
      "source",
      "created_at",
      "affected_population",
      "description",
      "remarks",
    ];

    if (format === "csv") {
      const csv = buildCsv(headers, rows);
      triggerFileDownload(
        `${reportData.filenamePrefix}.csv`,
        csv,
        "text/csv;charset=utf-8",
      );
      showMessage(`${reportData.title} downloaded as CSV`, "success");
      return;
    }

    renderPrintWindow(
      reportData.title,
      `Period: ${reportData.label}`,
      [
        { label: "Total Incidents", value: String(rows.length) },
        { label: "Active", value: String(reportData.statusCounts.active || 0) },
        {
          label: "Activated",
          value: String(reportData.statusCounts.activated || 0),
        },
        {
          label: "Ongoing",
          value: String(reportData.statusCounts.ongoing || 0),
        },
        {
          label: "Resolved",
          value: String(reportData.statusCounts.resolved || 0),
        },
      ],
      headers,
      rows,
    );
  } catch (error) {
    console.error("Error creating incident report:", error);
    showMessage(error.message || "Unable to generate incident report", "error");
  }
}

function printIncidentReport(reportType) {
  downloadIncidentReport(reportType, "print");
}

function previewIncidentReport(reportType) {
  try {
    const reportData = buildIncidentReportData(reportType);
    const rows = buildIncidentRows(reportData.incidents);
    openReportPreview(
      reportData.title,
      `Period: ${reportData.label}`,
      [
        { label: "Total Incidents", value: String(rows.length) },
        { label: "Active", value: String(reportData.statusCounts.active || 0) },
        {
          label: "Activated",
          value: String(reportData.statusCounts.activated || 0),
        },
        {
          label: "Ongoing",
          value: String(reportData.statusCounts.ongoing || 0),
        },
        {
          label: "Resolved",
          value: String(reportData.statusCounts.resolved || 0),
        },
      ],
      [
        "title",
        "type",
        "severity",
        "lgu",
        "barangay",
        "location",
        "status",
        "source",
        "created_at",
        "affected_population",
        "description",
        "remarks",
      ],
      rows,
    );
  } catch (error) {
    console.error("Error opening incident preview:", error);
    showMessage(error.message || "Unable to open incident preview", "error");
  }
}

function downloadCheckInReport(format) {
  try {
    const rows = buildCheckInRows(downloadableFormsData.agencyCheckIns || []);
    const headers = [
      "report_number",
      "agency_name",
      "contact_person",
      "contact_number",
      "incident_title",
      "incident_status",
      "total_personnel",
      "total_vehicles",
      "total_equipment",
      "portal_location",
      "mobilized_at",
      "demobilized_at",
      "duration_minutes",
    ];

    if (format === "csv") {
      const csv = buildCsv(headers, rows);
      triggerFileDownload(
        "agency-check-in-summary.csv",
        csv,
        "text/csv;charset=utf-8",
      );
      showMessage("Agency check-in summary downloaded as CSV", "success");
      return;
    }

    renderPrintWindow(
      "Agency Check-In Summary",
      "Deployment manifests and incident assignment details",
      [
        { label: "Total Check-Ins", value: String(rows.length) },
        {
          label: "Agencies Deployed",
          value: String(
            new Set(rows.map((row) => row.agency_name).filter(Boolean)).size,
          ),
        },
        {
          label: "Assigned Locations",
          value: String(rows.filter((row) => row.portal_location).length),
        },
      ],
      headers,
      rows,
    );
  } catch (error) {
    console.error("Error creating check-in report:", error);
    showMessage(error.message || "Unable to generate check-in report", "error");
  }
}

function printCheckInReport() {
  downloadCheckInReport("print");
}

function previewCheckInReport() {
  try {
    const rows = buildCheckInRows(downloadableFormsData.agencyCheckIns || []);
    openReportPreview(
      "Agency Check-In Summary",
      "Deployment manifests and incident assignment details",
      [
        { label: "Total Check-Ins", value: String(rows.length) },
        {
          label: "Agencies Deployed",
          value: String(
            new Set(rows.map((row) => row.agency_name).filter(Boolean)).size,
          ),
        },
        {
          label: "Assigned Locations",
          value: String(rows.filter((row) => row.portal_location).length),
        },
      ],
      [
        "report_number",
        "agency_name",
        "contact_person",
        "contact_number",
        "incident_title",
        "incident_status",
        "total_personnel",
        "total_vehicles",
        "total_equipment",
        "portal_location",
        "mobilized_at",
        "demobilized_at",
        "duration_minutes",
      ],
      rows,
    );
  } catch (error) {
    console.error("Error opening check-in preview:", error);
    showMessage(error.message || "Unable to open check-in preview", "error");
  }
}

function downloadPostIncidentReport(format) {
  try {
    const rows = buildPostIncidentRows(
      downloadableFormsData.postIncidentReports || [],
    );
    const headers = [
      "report_number",
      "agency_name",
      "incident_title",
      "incident_lgu",
      "portal_location",
      "mobilized_at",
      "demobilized_at",
      "duration_minutes",
      "total_personnel",
      "total_vehicles",
      "total_equipment",
    ];

    if (format === "csv") {
      const csv = buildCsv(headers, rows);
      triggerFileDownload(
        "post-incident-archive.csv",
        csv,
        "text/csv;charset=utf-8",
      );
      showMessage("Post-incident archive downloaded as CSV", "success");
      return;
    }

    renderPrintWindow(
      "Post-Incident Archive",
      "Archived reports for audit and review",
      [
        { label: "Total Reports", value: String(rows.length) },
        {
          label: "Total Personnel",
          value: String(
            rows.reduce(
              (sum, row) => sum + (parseInt(row.total_personnel, 10) || 0),
              0,
            ),
          ),
        },
        {
          label: "Total Vehicles",
          value: String(
            rows.reduce(
              (sum, row) => sum + (parseInt(row.total_vehicles, 10) || 0),
              0,
            ),
          ),
        },
        {
          label: "Total Equipment",
          value: String(
            rows.reduce(
              (sum, row) => sum + (parseInt(row.total_equipment, 10) || 0),
              0,
            ),
          ),
        },
      ],
      headers,
      rows,
    );
  } catch (error) {
    console.error("Error creating post-incident report:", error);
    showMessage(
      error.message || "Unable to generate post-incident report",
      "error",
    );
  }
}

function printPostIncidentReport() {
  downloadPostIncidentReport("print");
}

function previewPostIncidentReport() {
  try {
    const rows = buildPostIncidentRows(
      downloadableFormsData.postIncidentReports || [],
    );
    openReportPreview(
      "Post-Incident Archive",
      "Archived reports for audit and review",
      [
        { label: "Total Reports", value: String(rows.length) },
        {
          label: "Total Personnel",
          value: String(
            rows.reduce(
              (sum, row) => sum + (parseInt(row.total_personnel, 10) || 0),
              0,
            ),
          ),
        },
        {
          label: "Total Vehicles",
          value: String(
            rows.reduce(
              (sum, row) => sum + (parseInt(row.total_vehicles, 10) || 0),
              0,
            ),
          ),
        },
        {
          label: "Total Equipment",
          value: String(
            rows.reduce(
              (sum, row) => sum + (parseInt(row.total_equipment, 10) || 0),
              0,
            ),
          ),
        },
      ],
      [
        "report_number",
        "agency_name",
        "incident_title",
        "incident_lgu",
        "portal_location",
        "mobilized_at",
        "demobilized_at",
        "duration_minutes",
        "total_personnel",
        "total_vehicles",
        "total_equipment",
      ],
      rows,
    );
  } catch (error) {
    console.error("Error opening post-incident preview:", error);
    showMessage(
      error.message || "Unable to open post-incident preview",
      "error",
    );
  }
}
