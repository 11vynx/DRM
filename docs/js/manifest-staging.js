let memberCount = 0;
let vehicleCount = 0;
let equipmentCount = 0;
const portalUrlParams = new URLSearchParams(window.location.search);
const PORTAL_LOCATION =
  portalUrlParams.get("instance") ||
  document.body?.dataset.portalLocation ||
  "Staging Area";
let socket;
let portalToken = null;
let activatedIncidentId = null;
let checkInMode = "walk_in";
let agencySession = {
  token: localStorage.getItem("agencyToken") || "",
  account: null,
};

const setAgencyStatus = (message, isError = false) => {
  const statusEl = document.getElementById("agencyCheckInStatus");
  if (!statusEl) return;

  if (!message) {
    statusEl.textContent = "";
    statusEl.classList.add("hidden");
    return;
  }

  statusEl.classList.remove("hidden");
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#fca5a5" : "#e2e8f0";
};

function showChoiceScreen() {
  const choiceScreen = document.getElementById("checkInModeScreen");
  const loginScreen = document.getElementById("agencyLoginScreen");

  if (choiceScreen) {
    choiceScreen.classList.remove("hidden");
    choiceScreen.style.display = "flex";
  }

  if (loginScreen) {
    loginScreen.classList.add("hidden");
    loginScreen.style.display = "none";
  }

  setAgencyStatus("");
}

function showLoginScreen() {
  const choiceScreen = document.getElementById("checkInModeScreen");
  const loginScreen = document.getElementById("agencyLoginScreen");

  if (choiceScreen) {
    choiceScreen.classList.add("hidden");
    choiceScreen.style.display = "none";
  }

  if (loginScreen) {
    loginScreen.classList.remove("hidden");
    loginScreen.style.display = "flex";
  }

  setAgencyStatus("Enter agency credentials to continue.");
}

const getAgencyHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${agencySession.token}`,
});

function setCheckInMode(mode) {
  checkInMode = mode === "registered" ? "registered" : "walk_in";

  const walkInBtn = document.getElementById("agencyModeWalkIn");
  const registeredBtn = document.getElementById("agencyModeRegistered");
  const loginPanel = document.getElementById("agencyLoginPanel");
  const choicesPanel = document.getElementById("checkInModeChoices");

  if (walkInBtn)
    walkInBtn.classList.toggle("active", checkInMode === "walk_in");
  if (registeredBtn)
    registeredBtn.classList.toggle("active", checkInMode === "registered");

  if (checkInMode === "registered") {
    showLoginScreen();
    return;
  }

  showChoiceScreen();
}

function resetTableRows(bodyId) {
  const tbody = document.getElementById(bodyId);
  if (tbody) tbody.innerHTML = "";
}

function setInputValueByName(row, name, value) {
  const input = row.querySelector(`[name$="[${name}]"]`);
  if (input) input.value = value || "";
}

function fillRosterFromAccount(roster) {
  resetTableRows("membersBody");
  resetTableRows("vehiclesBody");
  resetTableRows("equipmentBody");

  memberCount = 0;
  vehicleCount = 0;
  equipmentCount = 0;

  (roster.personnel || []).forEach((person) => {
    addMemberRow();
    const row = document.querySelector("#membersBody tr:last-child");
    if (!row) return;
    setInputValueByName(row, "name", person.name);
    setInputValueByName(row, "age", person.age);
    setInputValueByName(row, "gender", person.gender);
    setInputValueByName(row, "weight", person.weight);
    setInputValueByName(row, "contact", person.contact);
    setInputValueByName(row, "capabilities", person.capabilities);
    setInputValueByName(row, "others", person.others);
  });

  (roster.vehicles || []).forEach((vehicle) => {
    addVehicleRow();
    const row = document.querySelector("#vehiclesBody tr:last-child");
    if (!row) return;
    setInputValueByName(row, "operator", vehicle.operator_name);
    setInputValueByName(row, "kind", vehicle.kind);
    setInputValueByName(row, "type", vehicle.type);
    setInputValueByName(row, "plate", vehicle.plate_number);
    setInputValueByName(row, "fuel", vehicle.fuel_type);
    setInputValueByName(row, "weight", vehicle.weight);
    setInputValueByName(row, "contact", vehicle.contact);
    setInputValueByName(row, "capabilities", vehicle.capabilities);
    setInputValueByName(row, "others", vehicle.others);
  });

  (roster.equipment || []).forEach((item) => {
    addEquipmentRow();
    const row = document.querySelector("#equipmentBody tr:last-child");
    if (!row) return;
    setInputValueByName(row, "operator", item.operator_name);
    setInputValueByName(row, "kind", item.kind);
    setInputValueByName(row, "type", item.type);
    setInputValueByName(row, "power_source", item.power_source);
    setInputValueByName(row, "fuel", item.fuel_type);
    setInputValueByName(row, "weight", item.weight);
    setInputValueByName(row, "contact", item.contact);
    setInputValueByName(row, "capabilities", item.capabilities);
    setInputValueByName(row, "others", item.others);
  });

  if ((roster.personnel || []).length === 0) addMemberRow();
  if ((roster.vehicles || []).length === 0) addVehicleRow();
  if ((roster.equipment || []).length === 0) addEquipmentRow();

  updateTotalCounts();
}

async function loginRegisteredAgency() {
  const email = document.getElementById("agencyLoginEmail")?.value?.trim();
  const password = document.getElementById("agencyLoginPassword")?.value;

  if (!email || !password) {
    setAgencyStatus("Provide agency email and password.", true);
    return;
  }

  try {
    const loginResponse = await fetch("/api/agency/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const loginData = await loginResponse.json();
    if (!loginResponse.ok || !loginData.success) {
      throw new Error(loginData.error || "Agency login failed");
    }

    agencySession.token = loginData.token;
    agencySession.account = loginData.account;
    localStorage.setItem("agencyToken", loginData.token);

    const rosterResponse = await fetch("/api/agency/roster", {
      headers: getAgencyHeaders(),
    });
    const rosterData = await rosterResponse.json();

    if (!rosterResponse.ok || !rosterData.success) {
      throw new Error(rosterData.error || "Failed to load agency roster");
    }

    document.getElementById("agencyName").value =
      loginData.account.agency_name || "";
    document.getElementById("leaderName").value =
      loginData.account.contact_person || "";
    document.getElementById("leaderContact").value =
      loginData.account.contact_number || "";

    fillRosterFromAccount(rosterData);
    setAgencyStatus("");
    openManifestForm();
  } catch (error) {
    console.error("Agency login/load error:", error);
    setAgencyStatus(error.message || "Failed to load registered agency", true);
  }
}

function clearAgencySession(showChoice = true) {
  agencySession.token = "";
  agencySession.account = null;
  localStorage.removeItem("agencyToken");
  const emailInput = document.getElementById("agencyLoginEmail");
  const passwordInput = document.getElementById("agencyLoginPassword");
  if (emailInput) emailInput.value = "";
  if (passwordInput) passwordInput.value = "";
  if (showChoice) {
    showChoiceScreen();
    return;
  }

  const modeScreen = document.getElementById("checkInModeScreen");
  const loginScreen = document.getElementById("agencyLoginScreen");
  if (modeScreen) {
    modeScreen.classList.add("hidden");
    modeScreen.style.display = "none";
  }
  if (loginScreen) {
    loginScreen.classList.add("hidden");
    loginScreen.style.display = "none";
  }
  setAgencyStatus("");
}

function initializeAgencyCheckInMode() {
  const walkInBtn = document.getElementById("agencyModeWalkIn");
  const registeredBtn = document.getElementById("agencyModeRegistered");
  const loginBtn = document.getElementById("agencyLoginBtn");
  const backBtn = document.getElementById("agencyBackToChoiceBtn");
  const modeScreen = document.getElementById("checkInModeScreen");
  const loginScreen = document.getElementById("agencyLoginScreen");

  if (walkInBtn) {
    walkInBtn.addEventListener("click", () => {
      checkInMode = "walk_in";
      openManifestForm();
    });
  }
  if (registeredBtn) {
    registeredBtn.addEventListener("click", () => setCheckInMode("registered"));
  }
  if (loginBtn) {
    loginBtn.addEventListener("click", loginRegisteredAgency);
  }
  if (backBtn) {
    backBtn.addEventListener("click", clearAgencySession);
  }

  if (modeScreen) {
    modeScreen.classList.add("hidden");
    modeScreen.style.display = "none";
  }
  if (loginScreen) {
    loginScreen.classList.add("hidden");
    loginScreen.style.display = "none";
  }
  setAgencyStatus("");
}

function openCheckInModeStep() {
  const greetingScreen = document.getElementById("greetingScreen");
  const modeScreen = document.getElementById("checkInModeScreen");

  if (greetingScreen) greetingScreen.style.display = "none";
  if (modeScreen) {
    modeScreen.classList.remove("hidden");
    modeScreen.style.display = "flex";
  }

  clearAgencySession();
}

function openManifestForm() {
  const modeScreen = document.getElementById("checkInModeScreen");
  const loginScreen = document.getElementById("agencyLoginScreen");
  const govHeader = document.querySelector(".gov-header");
  const form = document.getElementById("manifestForm");

  if (modeScreen) {
    modeScreen.classList.add("hidden");
    modeScreen.style.display = "none";
  }

  if (loginScreen) {
    loginScreen.classList.add("hidden");
    loginScreen.style.display = "none";
  }

  if (govHeader) govHeader.style.display = "block";
  if (form) form.style.display = "block";
}

function initializePortalConnection() {
  socket = io();

  socket.on("connect", () => {
    console.log("Connected to server");
    registerPortal();
  });

  socket.on("portal:registered", async (data) => {
    console.log("Portal registered:", data);
    // Restore portal state after successful registration
    await restorePortalState();
  });

  socket.on("portal:activate", (data) => {
    console.log("Portal activated with incident:", data);
    activatedIncidentId = data.incidentId;
    updatePortalUI(data);
  });

  socket.on("portal:activated", (data) => {
    console.log("Portal activated on registration:", data);
    if (data.incident) {
      activatedIncidentId = data.incident.id;
      updatePortalUI({
        incidentId: data.incident.id,
        incidentTitle: data.incident.title,
        incidentLocation: data.incident.location,
        incidentSeverity: data.incident.severity,
      });
    }
  });

  socket.on("portal:deactivate", (data) => {
    console.log("Portal deactivated:", data);
    activatedIncidentId = null;
    resetPortalUI();
  });

  socket.on("portal:error", (data) => {
    console.error("Portal error:", data);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
  });

  setInterval(() => {
    if (socket && socket.connected) {
      socket.emit("portal:heartbeat");
    }
  }, 30000);
}

async function registerPortal() {
  try {
    const response = await fetch("/api/portal/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        portalLocation: PORTAL_LOCATION,
      }),
    });

    const data = await response.json();

    if (data.success) {
      portalToken = data.token;
      socket.emit("portal:register", {
        portalLocation: PORTAL_LOCATION,
        token: data.token,
      });
      console.log("Portal registration request sent");
    } else {
      console.error("Failed to register portal:", data);
    }
  } catch (error) {
    console.error("Error registering portal:", error);
  }
}

async function restorePortalState() {
  try {
    const response = await fetch(`/api/portal/status/${PORTAL_LOCATION}`);
    const data = await response.json();

    if (data.success && data.portal.activated_incident_id) {
      activatedIncidentId = data.portal.activated_incident_id;
      updatePortalUI({
        incidentId: data.portal.activated_incident_id,
        incidentTitle: data.incident.title,
        incidentLocation: data.incident.location,
        incidentSeverity: data.incident.severity,
      });
      console.log(
        "Portal state restored: Incident",
        activatedIncidentId,
        "is active",
      );
    } else {
      resetPortalUI();
      console.log("Portal is waiting for activation");
    }
  } catch (error) {
    console.error("Error restoring portal state:", error);
    resetPortalUI();
  }
}

function updatePortalUI(data) {
  const govHeader = document.querySelector(".gov-header");
  const statusSpan = document.querySelector(".status-bar span:nth-child(2)");

  if (statusSpan) {
    statusSpan.innerHTML =
      'INCIDENT: <span style="color: #666; font-weight: bold;">' +
      data.incidentTitle +
      "</span>";
  }

  const greetingScreen = document.getElementById("greetingScreen");
  const greetingContent = greetingScreen.querySelector(".greeting-content");

  if (greetingContent) {
    greetingContent.innerHTML = `
      <h1>Check-In to DRM</h1>
      <p style="font-size: 1.2rem; color: #666; font-weight: bold; margin: 1rem 0;">
        ${data.incidentTitle}
      </p>
      <p style="font-size: 0.9rem; color: #888; margin-bottom: 0.5rem;">
        Location: ${data.incidentLocation || "N/A"}
      </p>
      <p style="font-size: 0.9rem; color: #888; margin-bottom: 1.5rem;">
        Severity: ${data.incidentSeverity || "N/A"}
      </p>
      <div class="subtitle">Click anywhere to check in your agency</div>
    `;
  }
}

function resetPortalUI() {
  const statusSpan = document.querySelector(".status-bar span:nth-child(2)");

  if (statusSpan) {
    statusSpan.innerHTML =
      'STATUS: <strong style="color: #10b981">ONLINE - READY</strong>';
  }

  const greetingScreen = document.getElementById("greetingScreen");
  const greetingContent = greetingScreen.querySelector(".greeting-content");

  if (greetingContent) {
    greetingContent.innerHTML = `
      <h1>DRM PORTAL</h1>
      <div style="border-bottom: 1px solid #444; margin: 15px 0"></div>
      <p style="color: #10b981; font-weight: bold; font-family: monospace; font-size: 1.2rem;">
        ● STATUS: ONLINE
      </p>
      <p style="color: #9ca3af; line-height: 1.6">
        Portal is connected and ready. <br />
        Waiting for incident activation from Admin Command.
      </p>
      <div style="margin-top: 30px; font-size: 0.8rem; color: #6b7280">
        [PORTAL ACTIVE - AWAITING ASSIGNMENT]
      </div>
    `;
  }
}

function startForm() {
  if (!activatedIncidentId) {
    alert(
      "Portal is waiting for activation. Please ask the admin to activate an incident first.",
    );
    return;
  }

  openCheckInModeStep();
}

document.addEventListener("DOMContentLoaded", function () {
  initializePortalConnection();

  initializeAgencyCheckInMode();

  addMemberRow();
  addVehicleRow();
  addEquipmentRow();

  document
    .getElementById("manifestForm")
    .addEventListener("submit", handleFormSubmit);
});

function addMemberRow() {
  const tbody = document.getElementById("membersBody");
  const rowId = `member-${memberCount++}`;

  const row = document.createElement("tr");
  row.id = rowId;
  row.innerHTML = `
        <td><input type="text" name="members[${memberCount}][name]" placeholder="Full Name"></td>
        <td><input type="number" name="members[${memberCount}][age]" placeholder="Age" min="18"></td>
        <td>
            <select name="members[${memberCount}][gender]">
                <option value="" disabled selected>Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
            </select>
        </td>
        <td><input type="number" name="members[${memberCount}][weight]" placeholder="Weight" step="0.1"></td>
        <td><input type="tel" name="members[${memberCount}][contact]" placeholder="Phone/Email"></td>
        <td><input type="text" name="members[${memberCount}][capabilities]" placeholder="Skills, certifications, etc."></td>
        <td><input type="text" name="members[${memberCount}][others]" placeholder="Additional notes"></td>
        <td><button type="button" class="btn-delete" onclick="deleteMemberRow('${rowId}')">Delete</button></td>
    `;

  tbody.appendChild(row);
  attachEventListeners();
}

function deleteMemberRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) {
    row.remove();
    updateTotalCounts();
  }
}

function addVehicleRow() {
  const tbody = document.getElementById("vehiclesBody");
  const rowId = `vehicle-${vehicleCount++}`;

  const row = document.createElement("tr");
  row.id = rowId;
  row.innerHTML = `
        <td><input type="text" name="vehicles[${vehicleCount}][operator]" placeholder="Operator Name"></td>
        <td>
            <select name="vehicles[${vehicleCount}][kind]">
                <option value="" disabled selected>Select Kind</option>
                <option value="Ambulance">Ambulance</option>
                <option value="Fire Truck">Fire Truck</option>
                <option value="Truck">Truck</option>
                <option value="Rescue Van">Rescue Van</option>
                <option value="Van">Van</option>
                <option value="Other">Other</option>
            </select>
        </td>
        <td>
            <select name="vehicles[${vehicleCount}][type]">
                <option value="" disabled selected>Select Type</option>
                <option value="Land">Land</option>
                <option value="Air">Air</option>
                <option value="Water">Water</option>
            </select>
        </td>
        <td><input type="text" name="vehicles[${vehicleCount}][plate]" placeholder="License Plate"></td>
        <td>
            <select name="vehicles[${vehicleCount}][fuel]">
                <option value="" disabled selected>Select</option>
                <option value="Diesel">Diesel</option>
                <option value="Gasoline">Gasoline</option>
                <option value="LPG">LPG</option>
                <option value="Electric">Electric</option>
                <option value="Hybrid">Hybrid</option>
            </select>
        </td>
        <td><input type="number" name="vehicles[${vehicleCount}][weight]" placeholder="Weight" step="0.1"></td>
        <td><input type="tel" name="vehicles[${vehicleCount}][contact]" placeholder="Phone/Email"></td>
        <td><input type="text" name="vehicles[${vehicleCount}][capabilities]" placeholder="Special capabilities"></td>
        <td><input type="text" name="vehicles[${vehicleCount}][others]" placeholder="Additional notes"></td>
        <td><button type="button" class="btn-delete" onclick="deleteVehicleRow('${rowId}')">Delete</button></td>
    `;

  tbody.appendChild(row);
  attachEventListeners();
}

function deleteVehicleRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) {
    row.remove();
    updateTotalCounts();
  }
}

function addEquipmentRow() {
  const tbody = document.getElementById("equipmentBody");
  const rowId = `equipment-${equipmentCount++}`;

  const row = document.createElement("tr");
  row.id = rowId;
  row.innerHTML = `
        <td><input type="text" name="equipment[${equipmentCount}][operator]" placeholder="Operator Name"></td>
        <td>
            <select name="equipment[${equipmentCount}][kind]" class="kind-select-${equipmentCount}" onchange="handleKindChange(this, ${equipmentCount})">
                <option value="" disabled selected>Select Kind</option>
                <option value="Pump">Pump</option>
                <option value="Compressor">Compressor</option>
                <option value="Generator">Generator</option>
                <option value="Chainsaw">Chainsaw</option>
                <option value="Crane">Crane</option>
                <option value="Excavator">Excavator</option>
                <option value="Drone">Drone</option>
                <option value="First Aid Kit">First Aid Kit</option>
                <option value="Communication Device">Communication Device</option>
                <option value="Water Tank">Water Tank</option>
                <option value="Power Tool">Power Tool</option>
                <option value="PPE">PPE</option>
                <option value="Medical Equipment">Medical Equipment</option>
                <option value="Detection Device">Detection Device</option>
                <option value="Lighting Equipment">Lighting Equipment</option>
                <option value="Other">Other</option>
            </select>
            <input type="text" name="equipment[${equipmentCount}][kind]" class="kind-input-${equipmentCount}" placeholder="Specify kind" style="display: none;">
        </td>
        <td>
            <select name="equipment[${equipmentCount}][type]" class="type-select-${equipmentCount}" onchange="handleTypeChange(this, ${equipmentCount})">
                <option value="" disabled selected>Select Type</option>
                <option value="Clearing">Clearing</option>
                <option value="Surveillance">Surveillance</option>
                <option value="Rescue">Rescue</option>
                <option value="Medical">Medical</option>
                <option value="Communication">Communication</option>
                <option value="Fire Suppression">Fire Suppression</option>
                <option value="Search">Search</option>
                <option value="Logistics">Logistics</option>
                <option value="Extraction">Extraction</option>
                <option value="Assessment">Assessment</option>
                <option value="Power Supply">Power Supply</option>
                <option value="Water Supply">Water Supply</option>
                <option value="Other">Other</option>
            </select>
            <input type="text" name="equipment[${equipmentCount}][type]" class="type-input-${equipmentCount}" placeholder="Specify type" style="display: none;">
        </td>
        <td>
            <select name="equipment[${equipmentCount}][power_source]" onchange="handlePowerSourceChange(this, ${equipmentCount})">
                <option value="" disabled selected>Select</option>
                <option value="Electric">Electric</option>
                <option value="Fuel">Fuel</option>
                <option value="Manual">Manual</option>
                <option value="Pneumatic">Pneumatic</option>
            </select>
        </td>
        <td>
            <select name="equipment[${equipmentCount}][fuel]" class="fuel-select-${equipmentCount}">
                <option value="" disabled selected>Select</option>
                <option value="Diesel">Diesel</option>
                <option value="Gasoline">Gasoline</option>
                <option value="LPG">LPG</option>
                <option value="N/A">N/A</option>
            </select>
        </td>
        <td><input type="number" name="equipment[${equipmentCount}][weight]" placeholder="Weight" step="0.1"></td>
        <td><input type="tel" name="equipment[${equipmentCount}][contact]" placeholder="Phone/Email"></td>
        <td><input type="text" name="equipment[${equipmentCount}][capabilities]" placeholder="Special capabilities"></td>
        <td><input type="text" name="equipment[${equipmentCount}][others]" placeholder="Additional notes"></td>
        <td><button type="button" class="btn-delete" onclick="deleteEquipmentRow('${rowId}')">Delete</button></td>
    `;

  tbody.appendChild(row);
  attachEventListeners();
}

function handlePowerSourceChange(selectElement, equipmentIndex) {
  const powerSource = selectElement.value;
  const fuelSelect = document.querySelector(`.fuel-select-${equipmentIndex}`);

  if (powerSource === "Fuel") {
    fuelSelect.required = true;
    fuelSelect.style.borderColor = "#666";
  } else {
    fuelSelect.required = false;
    fuelSelect.style.borderColor = "";
    fuelSelect.value = "N/A";
  }
}

function handleKindChange(selectElement, rowId) {
  if (selectElement.value === "Other") {
    const select = document.querySelector(`.kind-select-${rowId}`);
    const input = document.querySelector(`.kind-input-${rowId}`);
    select.style.display = "none";
    input.style.display = "block";
    input.focus();
  }
}

function handleTypeChange(selectElement, rowId) {
  if (selectElement.value === "Other") {
    const select = document.querySelector(`.type-select-${rowId}`);
    const input = document.querySelector(`.type-input-${rowId}`);
    select.style.display = "none";
    input.style.display = "block";
    input.focus();
  }
}

function deleteEquipmentRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) {
    row.remove();
    updateTotalCounts();
  }
}

function attachEventListeners() {
  updateTotalCounts();
}

function collectTableData(tableBodyId) {
  const tbody = document.getElementById(tableBodyId);
  const data = [];

  if (!tbody) return data;

  tbody.querySelectorAll("tr").forEach((row) => {
    const inputs = row.querySelectorAll("input, select");
    const rowData = {};

    inputs.forEach((input) => {
      if (input.style.display === "none") {
        return;
      }

      const name = input.name;
      if (name) {
        const match = name.match(/\[([^\]]+)\]$/);
        const fieldName = match ? match[1] : name;
        rowData[fieldName] = input.value;
      }
    });

    if (Object.keys(rowData).length > 0) {
      if (tableBodyId === "membersBody" && rowData.name) {
        data.push(rowData);
      } else if (tableBodyId === "vehiclesBody" && rowData.kind) {
        data.push(rowData);
      } else if (tableBodyId === "equipmentBody" && rowData.kind) {
        data.push(rowData);
      }
    }
  });

  return data;
}

function updateTotalCounts() {
  const memberRows = document.querySelectorAll("#membersBody tr");
  const vehicleRows = document.querySelectorAll("#vehiclesBody tr");
  const equipmentRows = document.querySelectorAll("#equipmentBody tr");

  document.getElementById("totalPersonnel").textContent = memberRows.length;
  document.getElementById("totalVehicles").textContent = vehicleRows.length;
  document.getElementById("totalEquipment").textContent = equipmentRows.length;

  let landVehicles = 0;
  let airVehicles = 0;
  let waterVehicles = 0;

  vehicleRows.forEach((row) => {
    const kindSelect = row.querySelector("select");
    if (kindSelect) {
      const kind = kindSelect.value.toLowerCase();
      if (
        kind.includes("truck") ||
        kind.includes("van") ||
        kind.includes("ambulance")
      ) {
        landVehicles++;
      } else if (kind.includes("helicopter") || kind.includes("drone")) {
        airVehicles++;
      } else if (kind.includes("boat") || kind.includes("barge")) {
        waterVehicles++;
      }
    }
  });

  document.getElementById("landVehicles").textContent = landVehicles;
  document.getElementById("airVehicles").textContent = airVehicles;
  document.getElementById("waterVehicles").textContent = waterVehicles;
}

function handleFormSubmit(e) {
  e.preventDefault();

  if (checkInMode === "registered" && !agencySession.account) {
    alert("Please login with a registered agency account first.");
    return;
  }

  if (!document.getElementById("agencyName").value) {
    alert("Please enter Agency Name");
    return;
  }
  if (!document.getElementById("leaderName").value) {
    alert("Please enter Leader Name");
    return;
  }
  if (!document.getElementById("leaderContact").value) {
    alert("Please enter Leader Contact Details");
    return;
  }

  const formData = new FormData(document.getElementById("manifestForm"));

  let incidentId = activatedIncidentId;

  if (!incidentId) {
    incidentId = sessionStorage.getItem("activatedIncidentId");
  }
  if (!incidentId) {
    const urlParams = new URLSearchParams(window.location.search);
    incidentId = urlParams.get("incident_id");
  }

  const manifestData = {
    agency_name: formData.get("agencyName"),
    contact_person: formData.get("leaderName"),
    contact_number: formData.get("leaderContact"),
    total_personnel: parseInt(
      document.getElementById("totalPersonnel").textContent,
    ),
    total_vehicles: parseInt(
      document.getElementById("totalVehicles").textContent,
    ),
    total_equipment: parseInt(
      document.getElementById("totalEquipment").textContent,
    ),
    members: collectTableData("membersBody"),
    vehicles: collectTableData("vehiclesBody"),
    equipment: collectTableData("equipmentBody"),
    incident_id: incidentId ? parseInt(incidentId) : null,
    portal_location: PORTAL_LOCATION,
    checkin_type: checkInMode,
    agency_account_id:
      checkInMode === "registered" && agencySession.account
        ? agencySession.account.id
        : null,
  };

  console.log("Manifest Data:", manifestData);

  fetch("/api/agency-manifest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(manifestData),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((data) => {
          throw new Error(data.message || `HTTP Error: ${response.status}`);
        });
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        alert("Manifest submitted successfully! ID: " + data.manifest_id);
        document.getElementById("manifestForm").reset();

        sessionStorage.removeItem("activatedIncidentId");
        sessionStorage.removeItem("activatedPortalLocation");

        resetToGreeting();
      } else {
        alert(
          "Error submitting manifest: " + (data.message || "Unknown error"),
        );
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Error submitting form: " + error.message);
    });
}

function resetToGreeting() {
  const greetingScreen = document.getElementById("greetingScreen");
  const modeScreen = document.getElementById("checkInModeScreen");
  const loginScreen = document.getElementById("agencyLoginScreen");
  const govHeader = document.querySelector(".gov-header");
  const form = document.getElementById("manifestForm");

  if (form) form.style.display = "none";
  if (govHeader) govHeader.style.display = "none";
  if (modeScreen) {
    modeScreen.classList.add("hidden");
    modeScreen.style.display = "none";
  }
  if (loginScreen) {
    loginScreen.classList.add("hidden");
    loginScreen.style.display = "none";
  }
  if (greetingScreen) {
    greetingScreen.style.display = "flex";
    greetingScreen.style.alignItems = "center";
    greetingScreen.style.justifyContent = "center";
    greetingScreen.style.height = "100vh";
  }

  clearAgencySession(false);
}

window.addEventListener("DOMContentLoaded", function () {
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dateElement = document.getElementById("currentDate");
  if (dateElement) {
    dateElement.textContent = formattedDate;
  }
});
