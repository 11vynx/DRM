let currentAgencyId = null;
let currentAgencyData = null;
let statusUpdateContext = null;
let allAgencies = [];
let assignedIncidentId = null;

const chiefToken = localStorage.getItem("chiefToken");
if (!chiefToken) {
  window.location.href = "chieflogin.html";
}

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("checkInContainer");
  container.classList.remove("hidden");

  await checkUserRole();
  await loadAgencies();
});

async function checkUserRole() {
  try {
    const response = await fetch("/api/chief/profile", {
      headers: {
        Authorization: `Bearer ${chiefToken}`,
      },
    });

    const data = await response.json();

    if (data.success && data.profile) {
      assignedIncidentId = data.profile.incident_id || null;

      const header = document.querySelector(".header .logo h1");
      if (header) {
        header.textContent = `${formatChiefRole(data.profile.chief_type)} - ${data.profile.incident_title || "No Assigned Incident"}`;
      }

      renderChiefProfile(data.profile);

      if (data.profile.incident_title) {
        displayIncidentInfo({
          title: data.profile.incident_title,
          status: data.profile.incident_status || "active",
          start_date: null,
          severity: null,
          lgu: null,
          barangay: null,
        });
      }
    }
  } catch (error) {
    console.error("Error checking user role:", error);
  }
}

function formatChiefRole(chiefType) {
  return chiefType === "planning" ? "Planning Chief" : "Operation Chief";
}

function renderChiefProfile(profile) {
  const chiefName = profile.name || "-";
  const chiefRole = formatChiefRole(profile.chief_type);
  const incidentTitle = profile.incident_title || "No assigned incident";

  const chiefProfileCard = document.getElementById("chiefProfileCard");
  if (chiefProfileCard) {
    chiefProfileCard.classList.toggle("no-incident", !profile.incident_title);
  }

  const chiefProfileName = document.getElementById("chiefProfileName");
  if (chiefProfileName) chiefProfileName.textContent = chiefName;

  const chiefProfileMeta = document.getElementById("chiefProfileMeta");
  if (chiefProfileMeta) {
    chiefProfileMeta.textContent = profile.incident_title
      ? `Assigned to ${incidentTitle}`
      : "No incident has been assigned yet.";
  }

  const chiefRoleBadge = document.getElementById("chiefRoleBadge");
  if (chiefRoleBadge) chiefRoleBadge.textContent = chiefRole;

  const chiefProfileUsername = document.getElementById("chiefProfileUsername");
  if (chiefProfileUsername)
    chiefProfileUsername.textContent = profile.username || "-";

  const chiefProfileRole = document.getElementById("chiefProfileRole");
  if (chiefProfileRole) chiefProfileRole.textContent = chiefRole;

  const chiefProfileAgency = document.getElementById("chiefProfileAgency");
  if (chiefProfileAgency)
    chiefProfileAgency.textContent = profile.agency_name || "-";

  const chiefProfileContact = document.getElementById("chiefProfileContact");
  if (chiefProfileContact)
    chiefProfileContact.textContent = profile.contact || "-";

  const chiefProfileCapabilities = document.getElementById(
    "chiefProfileCapabilities",
  );
  if (chiefProfileCapabilities) {
    chiefProfileCapabilities.textContent = profile.capabilities || "-";
  }

  const chiefProfileIncident = document.getElementById("chiefProfileIncident");
  if (chiefProfileIncident) chiefProfileIncident.textContent = incidentTitle;
}

function displayIncidentInfo(incident) {
  const container = document.getElementById("incidentInfoSection");
  if (!container) return;

  const startDate = incident.start_date
    ? new Date(incident.start_date).toLocaleString()
    : "Not set";

  container.innerHTML = `
    <h3 style="margin-bottom: 1rem; color: #2c3e50;">Assigned Incident</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
      <div>
        <div style="color: #7f8c8d; font-size: 0.9rem; margin-bottom: 0.25rem;">Incident Name</div>
        <div style="font-weight: 600; color: #2c3e50;">${escapeHtml(
          incident.title,
        )}</div>
      </div>
      <div>
        <div style="color: #7f8c8d; font-size: 0.9rem; margin-bottom: 0.25rem;">Status</div>
        <div>
          <span class="incident-badge ${
            incident.status
          }" style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.875rem; font-weight: 600;">
            ${incident.status.toUpperCase()}
          </span>
        </div>
      </div>
      ${
        incident.severity
          ? `
      <div>
        <div style="color: #7f8c8d; font-size: 0.9rem; margin-bottom: 0.25rem;">Severity</div>
        <div>
          <span class="severity-badge ${incident.severity.toLowerCase()}" style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.875rem; font-weight: 600;">
            ${incident.severity}
          </span>
        </div>
      </div>
      `
          : ""
      }
      <div>
        <div style="color: #7f8c8d; font-size: 0.9rem; margin-bottom: 0.25rem;">Start Date</div>
        <div style="color: #2c3e50;">${startDate}</div>
      </div>
      ${
        incident.lgu
          ? `
      <div>
        <div style="color: #7f8c8d; font-size: 0.9rem; margin-bottom: 0.25rem;">LGU</div>
        <div style="color: #2c3e50;">${escapeHtml(incident.lgu)}</div>
      </div>
      `
          : ""
      }
      ${
        incident.barangay
          ? `
      <div>
        <div style="color: #7f8c8d; font-size: 0.9rem; margin-bottom: 0.25rem;">Barangay</div>
        <div style="color: #2c3e50;">${escapeHtml(incident.barangay)}</div>
      </div>
      `
          : ""
      }
    </div>
  `;
}

function normalizeAgencyStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase();
}

function isAgencyDeployed(manifest) {
  return normalizeAgencyStatus(manifest?.status) === "deployed";
}

function isAgencyDemobilized(manifest) {
  return normalizeAgencyStatus(manifest?.status) === "demobilized";
}

function formatAgencyStatusLabel(status) {
  const normalized = normalizeAgencyStatus(status);
  if (!normalized) return "Submitted";

  return normalized
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

async function loadAgencies() {
  try {
    const response = await fetch("/api/agency-manifests");
    const data = await response.json();

    if (data.success && data.data) {
      if (assignedIncidentId) {
        allAgencies = data.data.filter(
          (agency) => agency.incident_id === assignedIncidentId,
        );
      } else {
        allAgencies = data.data;
      }

      displayAgencies(allAgencies);
    } else {
      showError("Failed to load agencies");
    }
  } catch (error) {
    console.error("Error loading agencies:", error);
    showError("Error loading agencies");
  }
}

function displayAgencies(agencies) {
  const container = document.getElementById("agenciesList");

  if (!agencies || agencies.length === 0) {
    container.innerHTML =
      '<div class="loading">No agencies checked in yet</div>';
    return;
  }

  container.innerHTML = agencies
    .map((agency) => {
      const hasLocation = agency.assigned_latitude && agency.assigned_longitude;
      const checkInTime = agency.created_at
        ? new Date(agency.created_at)
        : null;
      const timeAgo = checkInTime ? getTimeAgo(checkInTime) : "";
      const sourceType =
        agency.source_type === "registered" ? "Registered" : "Walk-In";

      const isDemobilized = isAgencyDemobilized(agency);
      const isDeployed = isAgencyDeployed(agency);
      const statusLabel = formatAgencyStatusLabel(agency.status);

      return `
        <div class="agency-card" style="cursor: pointer; ${
          isDemobilized ? "opacity: 0.7; border-left: 4px solid #95a5a6;" : ""
        } display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div class="agency-card-content" onclick="viewAgencyDetails(${
              agency.id
            })">
                <div class="agency-name">${escapeHtml(agency.agency_name)}</div>
                <span class="location-assigned-badge" style="display: inline-block; padding: 0.25rem 0.5rem; background: #1d4ed8; color: white; border-radius: 4px; font-size: 0.75rem; margin-top: 0.5rem;">${sourceType}</span>
                ${
                  hasLocation
                    ? '<span class="location-assigned-badge" style="display: inline-block; padding: 0.25rem 0.5rem; background: #27ae60; color: white; border-radius: 4px; font-size: 0.75rem; margin-top: 0.5rem;">Location Assigned</span>'
                    : ""
                }
                ${
                  isDeployed
                    ? '<span class="location-assigned-badge" style="display: inline-block; padding: 0.25rem 0.5rem; background: #2563eb; color: white; border-radius: 4px; font-size: 0.75rem; margin-top: 0.5rem; margin-left: 0.5rem;">Deployed</span>'
                    : ""
                }
                ${
                  isDemobilized
                    ? '<span class="location-assigned-badge" style="display: inline-block; padding: 0.25rem 0.5rem; background: #95a5a6; color: white; border-radius: 4px; font-size: 0.75rem; margin-top: 0.5rem; margin-left: 0.5rem;">Demobilized</span>'
                    : ""
                }
                ${
                  timeAgo
                    ? `<div class="time-info" style="color: #7f8c8d; font-size: 0.875rem; margin-top: 0.5rem;">Checked in ${timeAgo}</div>`
                    : ""
                }
                <div class="agency-meta" style="margin-top: 1rem;">
                    <div class="agency-meta-item">
                        <span class="agency-meta-label">Contact:</span>
                        <span>${escapeHtml(agency.contact_person)}</span>
                    </div>
                    <div class="agency-meta-item">
                        <span class="agency-meta-label">Phone:</span>
                        <span>${escapeHtml(
                          agency.contact_number || "N/A",
                        )}</span>
                    </div>
                    <div class="agency-meta-item">
                        <span class="agency-meta-label">Status:</span>
                      <span>${escapeHtml(statusLabel)}</span>
                    </div>
                </div>
            </div>
            <div class="agency-card-stats" onclick="viewAgencyDetails(${
              agency.id
            })">
                <div class="stat">
                    <div class="stat-number">${
                      agency.total_personnel || 0
                    }</div>
                    <div class="stat-label">Members</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${agency.total_vehicles || 0}</div>
                    <div class="stat-label">Vehicles</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${
                      agency.total_equipment || 0
                    }</div>
                    <div class="stat-label">Equipment</div>
                </div>
            </div>
            </div>
        </div>
    `;
    })
    .join("");
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + " minutes ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + " hours ago";
  if (seconds < 604800) return Math.floor(seconds / 86400) + " days ago";
  return date.toLocaleDateString();
}

async function viewAgencyDetails(agencyId) {
  currentAgencyId = agencyId;

  try {
    const response = await fetch(`/api/agency-manifest/${agencyId}`);
    const data = await response.json();

    if (data.success && data.manifest) {
      currentAgencyData = data.manifest;
      displayAgencyDetailsView(data.manifest, data.incident);
    } else {
      showError("Failed to load agency details");
    }
  } catch (error) {
    console.error("Error loading agency details:", error);
    showError("Error loading agency details");
  }
}

function displayAgencyDetailsView(manifest, incident) {
  document.getElementById("checkInContainer").classList.add("hidden");
  document.getElementById("agencyDetailsView").classList.remove("hidden");

  document.getElementById("detailsViewTitle").textContent = escapeHtml(
    manifest.agency_name,
  );

  if (incident) {
    document.getElementById("incidentName").textContent = escapeHtml(
      incident.title || "-",
    );
  } else {
    document.getElementById("incidentName").textContent = "-";
  }

  if (manifest.start_date_time) {
    const dateObj = new Date(manifest.start_date_time);
    const isoString = dateObj.toISOString().slice(0, 16);
    document.getElementById("incidentDateTime").value = isoString;
  }

  if (manifest.portal_location) {
    const locationCheckboxes = document.querySelectorAll(
      ".location-checkboxes input[type='checkbox']",
    );
    locationCheckboxes.forEach((checkbox) => {
      if (checkbox.value === manifest.portal_location) {
        checkbox.checked = true;
      } else {
        checkbox.checked = false;
      }
    });
  }

  displayAgencyDetailsTable(manifest);

  displayMembersTable(manifest.members || []);
  displayVehiclesTable(manifest.vehicles || []);
  displayEquipmentTable(manifest.equipment || []);

  updateLocationButtonStates(manifest);
  applyDeploymentControls(manifest);
}

function displayAgencyDetailsTable(manifest) {
  const tbody = document.getElementById("detailsTableBody");

  tbody.innerHTML = `
    <tr>
      <td>1</td>
      <td>${new Date().toLocaleString()}</td>
      <td><input type="radio" name="resourceIdentifier" value="Single" ${
        manifest.resource_identifier === "Single" ? "checked" : ""
      } /></td>
      <td><input type="radio" name="resourceIdentifier" value="ST" ${
        manifest.resource_identifier === "ST" ? "checked" : ""
      } /></td>
      <td><input type="radio" name="resourceIdentifier" value="TF" ${
        manifest.resource_identifier === "TF" ? "checked" : ""
      } /></td>
      <td>${escapeHtml(manifest.agency_name)}</td>
      <td>${escapeHtml(manifest.contact_person)}</td>
      <td>${escapeHtml(manifest.contact_number)}</td>
      <td>${manifest.total_personnel || 0}</td>
      <td>${manifest.total_vehicles || 0}</td>
      <td>${manifest.total_equipment || 0}</td>
      <td><input type="checkbox" checked disabled /></td>
      <td><input type="checkbox" disabled /></td>
    </tr>
  `;
}

function displayMembersTable(members) {
  const container = document.getElementById("membersList");
  document.getElementById("memberCountBadge").textContent = members.length;

  if (members.length === 0) {
    container.innerHTML =
      '<tr><td colspan="6" class="no-items">No members found</td></tr>';
    return;
  }

  container.innerHTML = members
    .map(
      (member, index) => `
        <tr onclick="openStatusModal('member', ${index}, '${
          member.status || "checked-in"
        }')" style="cursor: pointer;">
          <td>${escapeHtml(member.name)}</td>
          <td>${member.age || "-"}</td>
          <td>${member.gender || "-"}</td>
          <td>${formatWeightDisplay(member.weight)}</td>
          <td>${escapeHtml(member.capabilities || "-")}</td>
          <td>
            <span class="status-badge status-${member.status || "checked-in"}">
              ${member.status || "Checked-In"}
            </span>
          </td>
        </tr>
      `,
    )
    .join("");
}

function displayVehiclesTable(vehicles) {
  const container = document.getElementById("vehiclesList");
  document.getElementById("vehicleCountBadge").textContent = vehicles.length;

  if (vehicles.length === 0) {
    container.innerHTML =
      '<tr><td colspan="9" class="no-items">No vehicles found</td></tr>';
    return;
  }

  container.innerHTML = vehicles
    .map(
      (vehicle, index) => `
        <tr onclick="openStatusModal('vehicle', ${index}, '${
          vehicle.status || "checked-in"
        }')" style="cursor: pointer;">
          <td>${escapeHtml(vehicle.kind || "-")}</td>
          <td>${escapeHtml(vehicle.type || "-")}</td>
          <td>${escapeHtml(vehicle.plate_number || "-")}</td>
          <td>${escapeHtml(vehicle.operator_name || "-")}</td>
          <td>${escapeHtml(vehicle.fuel_type || "-")}</td>
          <td>${formatWeightDisplay(vehicle.weight)}</td>
          <td>${escapeHtml(vehicle.contact || "-")}</td>
          <td>${escapeHtml(vehicle.capabilities || "-")}</td>
          <td>
            <span class="status-badge status-${vehicle.status || "checked-in"}">
              ${vehicle.status || "Checked-In"}
            </span>
          </td>
        </tr>
      `,
    )
    .join("");
}

function displayEquipmentTable(equipment) {
  const container = document.getElementById("equipmentList");
  document.getElementById("equipmentCountBadge").textContent = equipment.length;

  if (equipment.length === 0) {
    container.innerHTML =
      '<tr><td colspan="9" class="no-items">No equipment found</td></tr>';
    return;
  }

  container.innerHTML = equipment
    .map(
      (item, index) => `
        <tr onclick="openStatusModal('equipment', ${index}, '${
          item.status || "checked-in"
        }')" style="cursor: pointer;">
          <td>${escapeHtml(item.kind || "-")}</td>
          <td>${escapeHtml(item.type || "-")}</td>
          <td>${escapeHtml(item.power_source || "-")}</td>
          <td>${escapeHtml(item.fuel_type || "-")}</td>
          <td>${formatWeightDisplay(item.weight)}</td>
          <td>${escapeHtml(item.operator_name || "-")}</td>
          <td>${escapeHtml(item.contact || "-")}</td>
          <td>
            <span class="status-badge status-${item.status || "checked-in"}">
              ${item.status || "Checked-In"}
            </span>
          </td>
        </tr>
      `,
    )
    .join("");
}

function updateLocationButtonStates(manifest) {
  const hasAssignedLocation =
    manifest.assigned_latitude && manifest.assigned_longitude;
  const viewLocationBtn = document.getElementById("viewLocationBtn");
  const assignLocationBtn = document.getElementById("assignLocationBtn");

  if (hasAssignedLocation) {
    viewLocationBtn.disabled = false;
    assignLocationBtn.textContent = "Change Response Location";
  } else {
    viewLocationBtn.disabled = true;
    assignLocationBtn.textContent = "Assign Response Location";
  }
}

function applyDeploymentControls(manifest) {
  const deployed = isAgencyDeployed(manifest);
  const demobilized = isAgencyDemobilized(manifest);
  const locked = deployed || demobilized;

  const incidentDateTime = document.getElementById("incidentDateTime");
  if (incidentDateTime) {
    incidentDateTime.disabled = locked;
  }

  const resourceIdentifierRadios = document.querySelectorAll(
    'input[name="resourceIdentifier"]',
  );
  resourceIdentifierRadios.forEach((radio) => {
    radio.disabled = locked;
  });

  const assignLocationBtn = document.getElementById("assignLocationBtn");
  if (assignLocationBtn) {
    if (locked) {
      assignLocationBtn.disabled = true;
      assignLocationBtn.title = "Location updates are locked after deployment.";
    } else {
      assignLocationBtn.title = "";
    }
  }

  const deployBtn = document.getElementById("deployAgencyBtn");
  if (deployBtn) {
    deployBtn.style.display = !deployed && !demobilized ? "block" : "none";
  }

  const demobilizeBtn = document.getElementById("demobilizeAgencyBtn");
  if (demobilizeBtn) {
    demobilizeBtn.style.display = deployed && !demobilized ? "block" : "none";
  }

  const saveBtn = document.getElementById("saveChangesBtn");
  if (saveBtn) {
    if (demobilized) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Save Changes";
      saveBtn.title = "Demobilized agencies can no longer be edited.";
    } else if (deployed) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Status Changes";
      saveBtn.title = "Only status updates to Demobilized are allowed.";
    } else {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
      saveBtn.title = "";
    }
  }
}

function backToList() {
  document.getElementById("agencyDetailsView").classList.add("hidden");
  document.getElementById("checkInContainer").classList.remove("hidden");
  currentAgencyId = null;
  currentAgencyData = null;
  loadAgencies();
}

function logoutChief() {
  localStorage.removeItem("chiefToken");
  window.location.href = "chieflogin.html";
}

function openStatusModal(type, index, currentStatus) {
  if (!currentAgencyData) return;

  if (isAgencyDemobilized(currentAgencyData)) {
    showError("This agency is already demobilized and cannot be updated.");
    return;
  }

  const statusSelect = document.getElementById("statusSelect");
  const normalizedCurrentStatus = normalizeAgencyStatus(currentStatus);

  if (isAgencyDeployed(currentAgencyData)) {
    if (normalizedCurrentStatus === "demobilized") {
      showError("This resource is already demobilized.");
      return;
    }

    statusSelect.innerHTML = '<option value="demobilized">Demobilized</option>';
    statusSelect.value = "demobilized";
  } else {
    statusSelect.innerHTML = `
      <option value="checked-in">Checked-In</option>
      <option value="unavailable">Unavailable</option>
      <option value="demobilized">Demobilized</option>
    `;
    statusSelect.value = normalizedCurrentStatus || "checked-in";
  }

  statusUpdateContext = { type, index, currentStatus };
  openModal("statusUpdateModal");
}

function closeStatusModal() {
  closeModal("statusUpdateModal");
  statusUpdateContext = null;
}

function confirmStatusUpdate() {
  if (!statusUpdateContext || !currentAgencyData) return;

  const newStatus = document.getElementById("statusSelect").value;

  if (isAgencyDeployed(currentAgencyData) && newStatus !== "demobilized") {
    showError("For deployed agencies, only Demobilized status is allowed.");
    return;
  }

  const { type, index } = statusUpdateContext;

  if (type === "member") {
    currentAgencyData.members[index].status = newStatus;
    displayMembersTable(currentAgencyData.members);
  } else if (type === "vehicle") {
    currentAgencyData.vehicles[index].status = newStatus;
    displayVehiclesTable(currentAgencyData.vehicles);
  } else if (type === "equipment") {
    currentAgencyData.equipment[index].status = newStatus;
    displayEquipmentTable(currentAgencyData.equipment);
  }

  closeStatusModal();
}

async function saveAgencyChanges() {
  if (!currentAgencyId || !currentAgencyData) return;

  const saveBtn = document.getElementById("saveChangesBtn");

  try {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    if (isAgencyDeployed(currentAgencyData)) {
      const nonDemobilizedStatuses = [
        ...(currentAgencyData.members || []),
        ...(currentAgencyData.vehicles || []),
        ...(currentAgencyData.equipment || []),
      ].some((item) => normalizeAgencyStatus(item.status) !== "demobilized");

      if (nonDemobilizedStatuses) {
        showError(
          "For deployed agencies, only status updates to Demobilized are allowed.",
        );
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Status Changes";
        return;
      }
    }

    const updatePromises = [];

    if (currentAgencyData.members && Array.isArray(currentAgencyData.members)) {
      for (const member of currentAgencyData.members) {
        if (member.id && member.status) {
          updatePromises.push(
            fetch(`/api/manifest-members/${member.id}/status`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: member.status }),
            }),
          );
        }
      }
    }

    if (
      currentAgencyData.vehicles &&
      Array.isArray(currentAgencyData.vehicles)
    ) {
      for (const vehicle of currentAgencyData.vehicles) {
        if (vehicle.id && vehicle.status) {
          updatePromises.push(
            fetch(`/api/manifest-vehicles/${vehicle.id}/status`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: vehicle.status }),
            }),
          );
        }
      }
    }

    if (
      currentAgencyData.equipment &&
      Array.isArray(currentAgencyData.equipment)
    ) {
      for (const equipment of currentAgencyData.equipment) {
        if (equipment.id && equipment.status) {
          updatePromises.push(
            fetch(`/api/manifest-equipment/${equipment.id}/status`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: equipment.status }),
            }),
          );
        }
      }
    }

    if (updatePromises.length > 0) {
      const results = await Promise.all(updatePromises);
      let hasErrors = false;

      for (const result of results) {
        if (!result.ok) {
          hasErrors = true;
          console.error("Error updating status:", result.statusText);
        }
      }

      if (hasErrors) {
        showError("Some status updates failed");
        saveBtn.disabled = false;
        saveBtn.textContent = isAgencyDeployed(currentAgencyData)
          ? "Save Status Changes"
          : "Save Changes";
        return;
      }
    }

    const allMembersDemobilized =
      currentAgencyData.members && currentAgencyData.members.length > 0
        ? currentAgencyData.members.every((m) => m.status === "demobilized")
        : true;

    const allVehiclesDemobilized =
      currentAgencyData.vehicles && currentAgencyData.vehicles.length > 0
        ? currentAgencyData.vehicles.every((v) => v.status === "demobilized")
        : true;

    const allEquipmentDemobilized =
      currentAgencyData.equipment && currentAgencyData.equipment.length > 0
        ? currentAgencyData.equipment.every((e) => e.status === "demobilized")
        : true;

    let agencyStatus = currentAgencyData.status || "submitted";
    if (
      allMembersDemobilized &&
      allVehiclesDemobilized &&
      allEquipmentDemobilized
    ) {
      if (
        (currentAgencyData.members && currentAgencyData.members.length > 0) ||
        (currentAgencyData.vehicles && currentAgencyData.vehicles.length > 0) ||
        (currentAgencyData.equipment && currentAgencyData.equipment.length > 0)
      ) {
        agencyStatus = "demobilized";
      }
    }

    const updateData = {
      agency_name: currentAgencyData.agency_name,
      contact_person: currentAgencyData.contact_person,
      contact_number: currentAgencyData.contact_number,
      status: agencyStatus,
      start_date_time: isAgencyDeployed(currentAgencyData)
        ? null
        : document.getElementById("incidentDateTime").value || null,
      resource_identifier: isAgencyDeployed(currentAgencyData)
        ? null
        : document.querySelector('input[name="resourceIdentifier"]:checked')
            ?.value || null,
    };

    const response = await fetch(`/api/agency-manifest/${currentAgencyId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    });

    const data = await response.json();

    if (data.success) {
      if (
        agencyStatus === "demobilized" &&
        currentAgencyData.status !== "demobilized"
      ) {
        currentAgencyData.status = "demobilized";
        showSuccess(
          "All changes saved successfully. Agency has been automatically demobilized as all components are demobilized.",
        );
        const demobilizeBtn = document.getElementById("demobilizeAgencyBtn");
        if (demobilizeBtn) {
          demobilizeBtn.style.display = "none";
        }
      } else {
        currentAgencyData.status = agencyStatus;
        showSuccess("All changes saved successfully");
      }

      applyDeploymentControls(currentAgencyData);
    } else {
      showError("Failed to save agency information");
    }

    saveBtn.disabled = false;
    applyDeploymentControls(currentAgencyData);
  } catch (error) {
    console.error("Error saving changes:", error);
    showError("Error saving changes");
    saveBtn.disabled = false;
    saveBtn.textContent = isAgencyDeployed(currentAgencyData)
      ? "Save Status Changes"
      : "Save Changes";
  }
}

async function deployCurrentAgency() {
  if (!currentAgencyId || !currentAgencyData) {
    showError("No agency selected");
    return;
  }

  if (isAgencyDeployed(currentAgencyData)) {
    showError("Agency is already deployed.");
    return;
  }

  if (isAgencyDemobilized(currentAgencyData)) {
    showError("Demobilized agencies cannot be deployed again.");
    return;
  }

  if (
    !confirm(
      `Deploy ${currentAgencyData.agency_name}?\n\nAfter deployment, updates are locked except changing status to Demobilized.`,
    )
  ) {
    return;
  }

  const deployBtn = document.getElementById("deployAgencyBtn");

  try {
    if (deployBtn) {
      deployBtn.disabled = true;
      deployBtn.textContent = "Deploying...";
    }

    const response = await fetch(`/api/agency-manifest/${currentAgencyId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "deployed" }),
    });

    const data = await response.json();

    if (data.success) {
      currentAgencyData.status = "deployed";
      applyDeploymentControls(currentAgencyData);
      await loadAgencies();
      showSuccess("Agency deployed successfully.");
    } else {
      showError(data.message || "Failed to deploy agency");
    }
  } catch (error) {
    console.error("Error deploying agency:", error);
    showError("Error deploying agency");
  } finally {
    if (deployBtn) {
      deployBtn.disabled = false;
      deployBtn.textContent = "Deploy Agency";
    }
  }
}

async function demobilizeCurrentAgency() {
  if (!currentAgencyId || !currentAgencyData) {
    showError("No agency selected");
    return;
  }

  if (!isAgencyDeployed(currentAgencyData)) {
    showError("Only deployed agencies can be demobilized.");
    return;
  }

  await demobilizeAgency(currentAgencyId, currentAgencyData.agency_name);

  if (currentAgencyData.status === "demobilized") {
    backToList();
  }
}

async function demobilizeAgency(agencyId, agencyName) {
  if (
    !confirm(
      `Are you sure you want to demobilize ${agencyName}?\n\nThis will demobilize ALL members, vehicles, and equipment associated with this agency.`,
    )
  ) {
    return;
  }

  try {
    const response = await fetch(
      `/api/agency-manifest/${agencyId}/demobilize`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();

    if (data.success) {
      if (currentAgencyData && Number(currentAgencyId) === Number(agencyId)) {
        currentAgencyData.status = "demobilized";
        applyDeploymentControls(currentAgencyData);
      }
      showSuccess(`${agencyName} has been demobilized successfully`);
      await loadAgencies();
    } else {
      showError(data.error || "Failed to demobilize agency");
    }
  } catch (error) {
    console.error("Error demobilizing agency:", error);
    showError("Error demobilizing agency");
  }
}

function filterAgencies() {
  const searchInput = document
    .getElementById("searchAgency")
    .value.toLowerCase();
  const agencyCards = document.querySelectorAll(".agency-card");

  agencyCards.forEach((card) => {
    const agencyName = card
      .querySelector(".agency-name")
      .textContent.toLowerCase();

    const matchesSearch = agencyName.includes(searchInput);
    card.style.display = matchesSearch ? "flex" : "none";
  });
}

function viewOnMap(agencyId) {
  alert("View on Map functionality - Agency ID: " + agencyId);
}

function viewIncidentDetails(incidentId) {
  alert("View Incident Details - Incident ID: " + incidentId);
}

function contactAgency(contactNumber) {
  if (contactNumber && contactNumber !== "N/A") {
    window.open("tel:" + contactNumber);
  } else {
    alert("No contact number available");
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("show");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("show");
  }
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatWeightDisplay(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return escapeHtml(value);
  }

  return numericValue.toString();
}

function showSuccess(message) {
  alert(message);
}

function showError(message) {
  alert("Error: " + message);
}

window.addEventListener("click", (event) => {
  if (event.target.classList.contains("modal")) {
    closeModal(event.target.id);
  }
});

function printAgencyDetails() {
  if (!currentAgencyData) {
    showError("No agency data available to print");
    return;
  }

  const manifest = currentAgencyData;
  const members = manifest.members || [];
  const vehicles = manifest.vehicles || [];
  const equipment = manifest.equipment || [];

  const availableMembers = members.filter((m) => m.status !== "unavailable");
  const availableVehicles = vehicles.filter((v) => v.status !== "unavailable");
  const availableEquipment = equipment.filter(
    (e) => e.status !== "unavailable",
  );

  const printWindow = window.open("", "", "width=800,height=600");

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Agency Check-In Receipt - ${manifest.agency_name}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Arial', sans-serif;
          background-color: white;
          padding: 20px;
        }
        .receipt-container {
          width: 7in;
          margin: 0 auto;
          padding: 15px;
          background: white;
          border: 2px solid #000;
        }
        .receipt-header {
          text-align: center;
          border-bottom: 3px solid #000;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        .receipt-header h1 {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .receipt-header p {
          font-size: 12px;
          color: #333;
        }
        .section-title {
          font-size: 14px;
          font-weight: bold;
          background-color: #f0f0f0;
          padding: 8px;
          margin-top: 10px;
          margin-bottom: 8px;
          border-left: 4px solid #333;
        }
        .info-row {
          display: flex;
          padding: 6px 0;
          border-bottom: 1px solid #ddd;
          font-size: 12px;
        }
        .info-label {
          font-weight: bold;
          width: 35%;
        }
        .info-value {
          width: 65%;
          word-break: break-word;
        }
        .summary-table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
          font-size: 12px;
        }
        .summary-table th {
          background-color: #333;
          color: white;
          padding: 8px;
          text-align: left;
          border: 1px solid #000;
        }
        .summary-table td {
          padding: 8px;
          border: 1px solid #ddd;
        }
        .summary-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .resource-table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
          font-size: 11px;
        }
        .resource-table th {
          background-color: #f0f0f0;
          padding: 6px;
          text-align: left;
          border: 1px solid #ddd;
          font-weight: bold;
        }
        .resource-table td {
          padding: 6px;
          border: 1px solid #ddd;
        }
        .resource-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .status-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: bold;
        }
        .status-available {
          background-color: #90EE90;
          color: #006400;
        }
        .footer {
          text-align: center;
          margin-top: 15px;
          padding-top: 10px;
          border-top: 2px solid #000;
          font-size: 12px;
        }
        .timestamp {
          font-size: 11px;
          color: #666;
          text-align: center;
          margin-top: 10px;
        }
        @media print {
          body { margin: 0; padding: 0; }
          .receipt-container { width: 100%; border: none; }
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <!-- Header -->
        <div class="receipt-header">
          <h1>DRM</h1>
          <p>Disaster Response Efficiency, Awareness, and Management System</p>
          <p style="margin-top: 5px; font-size: 13px; font-weight: bold;">AGENCY CHECK-IN RECEIPT</p>
        </div>

        <!-- Agency Information Section -->
        <div class="section-title">AGENCY INFORMATION</div>
        <div class="info-row">
          <div class="info-label">Agency:</div>
          <div class="info-value">${escapeHtml(manifest.agency_name)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Contact Person:</div>
          <div class="info-value">${escapeHtml(manifest.contact_person)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Contact Number:</div>
          <div class="info-value">${escapeHtml(manifest.contact_number)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Resource Identifier:</div>
          <div class="info-value"><strong>${escapeHtml(
            manifest.resource_identifier || "Single",
          )}</strong></div>
        </div>
        <div class="info-row">
          <div class="info-label">Check-In Location:</div>
          <div class="info-value">${escapeHtml(
            manifest.portal_location || "N/A",
          )}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Check-In Status:</div>
          <div class="info-value"><span class="status-badge status-available">${escapeHtml(
            manifest.status,
          ).toUpperCase()}</span></div>
        </div>
        <div class="info-row">
          <div class="info-label">Date/Time:</div>
          <div class="info-value">${new Date(
            manifest.created_at,
          ).toLocaleString()}</div>
        </div>

        <!-- Resource Summary Section -->
        <div class="section-title">RESOURCE SUMMARY</div>
        <table class="summary-table">
          <thead>
            <tr>
              <th>Resource Type</th>
              <th>Total Submitted</th>
              <th>Available</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Personnel/Members</td>
              <td style="text-align: center; font-weight: bold;">${
                members.length
              }</td>
              <td style="text-align: center; font-weight: bold;">${
                availableMembers.length
              }</td>
            </tr>
            <tr>
              <td>Vehicles</td>
              <td style="text-align: center; font-weight: bold;">${
                vehicles.length
              }</td>
              <td style="text-align: center; font-weight: bold;">${
                availableVehicles.length
              }</td>
            </tr>
            <tr>
              <td>Equipment</td>
              <td style="text-align: center; font-weight: bold;">${
                equipment.length
              }</td>
              <td style="text-align: center; font-weight: bold;">${
                availableEquipment.length
              }</td>
            </tr>
          </tbody>
        </table>
  `;

  if (availableMembers.length > 0) {
    html += `
        <div class="section-title">PERSONNEL/MEMBERS (${availableMembers.length} Available)</div>
        <table class="resource-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Capabilities</th>
              <th>Age</th>
              <th>Gender</th>
            </tr>
          </thead>
          <tbody>
    `;
    availableMembers.forEach((member, index) => {
      html += `
            <tr>
              <td>${escapeHtml(member.name || "-")}</td>
              <td>${escapeHtml(member.capabilities || "-")}</td>
              <td style="text-align: center;">${member.age || "-"}</td>
              <td style="text-align: center;">${member.gender || "-"}</td>
            </tr>
      `;
    });
    html += `
          </tbody>
        </table>
    `;
  }

  if (availableVehicles.length > 0) {
    html += `
        <div class="section-title">VEHICLES (${availableVehicles.length} Available)</div>
        <table class="resource-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Type</th>
              <th>Plate</th>
              <th>Fuel</th>
              <th>Wt(kg)</th>
              <th>Capabilities</th>
            </tr>
          </thead>
          <tbody>
    `;
    availableVehicles.forEach((vehicle) => {
      html += `
            <tr>
              <td>${escapeHtml(vehicle.kind || "-")}</td>
              <td>${escapeHtml(vehicle.type || "-")}</td>
              <td>${escapeHtml(vehicle.plate_number || "-")}</td>
              <td>${escapeHtml(vehicle.fuel_type || "-")}</td>
              <td style="text-align: center;">${formatWeightDisplay(
                vehicle.weight,
              )}</td>
              <td>${escapeHtml(vehicle.capabilities || "-")}</td>
            </tr>
      `;
    });
    html += `
          </tbody>
        </table>
    `;
  }

  if (availableEquipment.length > 0) {
    html += `
        <div class="section-title">EQUIPMENT (${availableEquipment.length} Available)</div>
        <table class="resource-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Type</th>
              <th>Power Source</th>
              <th>Fuel</th>
              <th>Wt(kg)</th>
              <th>Capabilities</th>
            </tr>
          </thead>
          <tbody>
    `;
    availableEquipment.forEach((item) => {
      html += `
            <tr>
              <td>${escapeHtml(item.kind || "-")}</td>
              <td>${escapeHtml(item.type || "-")}</td>
              <td>${escapeHtml(item.power_source || "-")}</td>
              <td>${escapeHtml(item.fuel_type || "-")}</td>
              <td style="text-align: center;">${formatWeightDisplay(
                item.weight,
              )}</td>
              <td>${escapeHtml(item.capabilities || "-")}</td>
            </tr>
      `;
    });
    html += `
          </tbody>
        </table>
    `;
  }

  html += `
        <div class="footer">
          <p style="margin: 5px 0; font-weight: bold;">AGENCY CHECK-IN COMPLETE</p>
          <p style="margin: 5px 0; font-size: 11px;">Only available resources are listed above</p>
        </div>

        <div class="timestamp">
          Printed on: ${new Date().toLocaleString()}
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
}

let assignLocationMap = null;
let assignLocationMarker = null;
let selectedLocation = null;
let currentIncidentData = null;

let viewLocationMap = null;
let viewLocationMarker = null;

async function viewAssignedLocation() {
  if (
    !currentAgencyData ||
    !currentAgencyData.assigned_latitude ||
    !currentAgencyData.assigned_longitude
  ) {
    alert("No location has been assigned to this agency yet.");
    return;
  }

  try {
    const response = await fetch(`/api/agency-manifest/${currentAgencyId}`);
    const data = await response.json();

    if (!data.success) {
      alert("Unable to load agency details.");
      return;
    }

    const manifest = data.manifest;
    const incident = data.incident;

    document.getElementById("viewModalAgencyName").textContent =
      manifest.agency_name || "-";
    document.getElementById("viewModalIncidentName").textContent = incident
      ? incident.title || "-"
      : "-";
    document.getElementById("viewModalIncidentLocation").textContent = incident
      ? `${incident.lgu || "-"}, ${incident.barangay || "-"}`
      : "-";

    const lat = parseFloat(manifest.assigned_latitude);
    const lng = parseFloat(manifest.assigned_longitude);

    document.getElementById("viewModalCoordinates").textContent =
      `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    const viewLocationModal = document.getElementById("viewLocationModal");
    viewLocationModal.classList.add("show");
    viewLocationModal.style.display = "flex";

    setTimeout(() => {
      initializeViewLocationMap(lat, lng);
    }, 100);
  } catch (error) {
    console.error("Error opening location view:", error);
    alert("Error loading location data");
  }
}

function initializeViewLocationMap(lat, lng) {
  try {
    if (viewLocationMap) {
      viewLocationMap.remove();
    }

    viewLocationMap = L.map("viewLocationMap", {
      center: [lat, lng],
      zoom: 15,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(viewLocationMap);

    const customIcon = L.icon({
      iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
      shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    viewLocationMarker = L.marker([lat, lng], { icon: customIcon }).addTo(
      viewLocationMap,
    );
    viewLocationMarker
      .bindPopup("<b>Assigned Response Location</b>")
      .openPopup();

    setTimeout(() => {
      viewLocationMap.invalidateSize();
    }, 100);

    console.log("✓ View location map initialized successfully");
  } catch (error) {
    console.error("Error initializing view location map:", error);
    alert("Error initializing map. Please check the console for details.");
  }
}

function closeViewLocationModal() {
  const viewLocationModal = document.getElementById("viewLocationModal");
  viewLocationModal.classList.remove("show");
  viewLocationModal.style.display = "none";

  if (viewLocationMap) {
    viewLocationMap.remove();
    viewLocationMap = null;
  }
  viewLocationMarker = null;
}

async function openAssignLocationModal() {
  if (
    currentAgencyData &&
    (isAgencyDeployed(currentAgencyData) ||
      isAgencyDemobilized(currentAgencyData))
  ) {
    alert("Location updates are not allowed after deployment.");
    return;
  }

  if (!currentAgencyData || !currentAgencyData.incident_id) {
    alert("No incident associated with this agency. Cannot assign location.");
    return;
  }

  try {
    const response = await fetch(`/api/agency-manifest/${currentAgencyId}`);
    const data = await response.json();

    if (!data.success || !data.incident) {
      alert("Unable to load incident details.");
      return;
    }

    currentIncidentData = data.incident;

    document.getElementById("modalIncidentName").textContent =
      currentIncidentData.title || "-";
    document.getElementById("modalIncidentLocation").textContent = `${
      currentIncidentData.lgu || "-"
    }, ${currentIncidentData.barangay || "-"}`;
    document.getElementById("modalAgencyName").textContent =
      currentAgencyData.agency_name;

    const assignLocationModal = document.getElementById("assignLocationModal");
    assignLocationModal.classList.add("show");
    assignLocationModal.style.display = "flex";

    setTimeout(async () => {
      await initializeAssignLocationMap();
    }, 100);
  } catch (error) {
    console.error("Error opening location assignment:", error);
    alert("Error loading location data");
  }
}

async function initializeAssignLocationMap() {
  if (!currentIncidentData.lgu) {
    alert("Incident LGU is not specified. Cannot load map.");
    return;
  }

  try {
    const response = await fetch(
      `/api/map/lgu-bounds/${encodeURIComponent(currentIncidentData.lgu)}`,
    );
    const data = await response.json();

    if (!data.success) {
      alert("Unable to load map bounds for this LGU.");
      return;
    }

    const { center, bounds, barangays } = data;

    if (assignLocationMap) {
      assignLocationMap.remove();
    }

    assignLocationMap = L.map("assignLocationMap", {
      center: [center.lat, center.lng],
      zoom: 13,
      maxBounds: [
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ],
      maxBoundsViscosity: 1.0,
      minZoom: 11,
      maxZoom: 18,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri",
        maxZoom: 18,
      },
    ).addTo(assignLocationMap);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
      {
        attribution: "&copy; OpenStreetMap contributors",
        subdomains: "abcd",
        maxZoom: 19,
      },
    ).addTo(assignLocationMap);

    if (currentIncidentData.latitude && currentIncidentData.longitude) {
      const incidentIcon = L.divIcon({
        className: "incident-marker",
        html: `<div style="
          background-color: #e74c3c;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 4px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      L.marker([currentIncidentData.latitude, currentIncidentData.longitude], {
        icon: incidentIcon,
      })
        .bindPopup(
          `<strong>Incident Location</strong><br>${currentIncidentData.title}`,
        )
        .addTo(assignLocationMap);
    }

    barangays.forEach((brgy) => {
      const brgyIcon = L.divIcon({
        className: "barangay-marker",
        html: `<div style="
          background-color: #95a5a6;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 2px solid white;
        "></div>`,
        iconSize: [8, 8],
        iconAnchor: [4, 4],
      });

      L.marker([brgy.lat, brgy.lng], { icon: brgyIcon })
        .bindTooltip(brgy.name, { permanent: false, direction: "top" })
        .addTo(assignLocationMap);
    });

    if (
      currentAgencyData.assigned_latitude &&
      currentAgencyData.assigned_longitude
    ) {
      setAssignedLocationMarker(
        parseFloat(currentAgencyData.assigned_latitude),
        parseFloat(currentAgencyData.assigned_longitude),
      );
    }

    assignLocationMap.on("click", (e) => {
      setAssignedLocationMarker(e.latlng.lat, e.latlng.lng);
    });

    console.log("✓ Assign location map initialized");
  } catch (error) {
    console.error("Error initializing assign location map:", error);
    alert("Error initializing map");
  }
}

function setAssignedLocationMarker(lat, lng) {
  // Convert to numbers if they are strings
  lat = parseFloat(lat);
  lng = parseFloat(lng);

  if (assignLocationMarker) {
    assignLocationMap.removeLayer(assignLocationMarker);
  }

  const assignedIcon = L.divIcon({
    className: "assigned-marker",
    html: `<div style="
      background-color: #27ae60;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      position: relative;
    ">
      <div style="
        position: absolute;
        bottom: -10px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 10px solid #27ae60;
      "></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 34],
  });

  assignLocationMarker = L.marker([lat, lng], { icon: assignedIcon })
    .bindPopup(
      `<strong>Response Location</strong><br>Lat: ${lat.toFixed(
        6,
      )}<br>Lng: ${lng.toFixed(6)}`,
    )
    .addTo(assignLocationMap);

  selectedLocation = { lat, lng };

  document.getElementById("selectedCoordinates").style.display = "block";
  document.getElementById("selectedLat").textContent = lat.toFixed(6);
  document.getElementById("selectedLng").textContent = lng.toFixed(6);
  document.getElementById("saveLocationBtn").disabled = false;
}

async function saveAssignedLocation() {
  if (
    currentAgencyData &&
    (isAgencyDeployed(currentAgencyData) ||
      isAgencyDemobilized(currentAgencyData))
  ) {
    alert("Location updates are not allowed after deployment.");
    return;
  }

  if (!selectedLocation) {
    alert("Please select a location on the map first.");
    return;
  }

  try {
    const response = await fetch(
      `/api/agency-manifest/${currentAgencyId}/location`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: selectedLocation.lat,
          longitude: selectedLocation.lng,
        }),
      },
    );

    const data = await response.json();

    if (data.success) {
      alert("Response location assigned successfully!");

      currentAgencyData.assigned_latitude = selectedLocation.lat;
      currentAgencyData.assigned_longitude = selectedLocation.lng;

      updateLocationButtonStates(currentAgencyData);
      applyDeploymentControls(currentAgencyData);
      closeAssignLocationModal();
    } else {
      alert("Failed to save location: " + (data.message || "Unknown error"));
    }
  } catch (error) {
    console.error("Error saving location:", error);
    alert("Error saving location");
  }
}

function closeAssignLocationModal() {
  const assignLocationModal = document.getElementById("assignLocationModal");
  assignLocationModal.classList.remove("show");
  assignLocationModal.style.display = "none";

  if (assignLocationMap) {
    assignLocationMap.remove();
    assignLocationMap = null;
  }
  assignLocationMarker = null;
  selectedLocation = null;

  document.getElementById("selectedCoordinates").style.display = "none";
  document.getElementById("saveLocationBtn").disabled = true;
}

window.addEventListener("click", (event) => {
  const modal = document.getElementById("assignLocationModal");
  if (event.target === modal) {
    closeAssignLocationModal();
  }
});
