const AUTH_TOKEN_KEY = "agencyToken";

const authStatus = document.getElementById("authStatus");
const rosterStatus = document.getElementById("rosterStatus");

const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");
const profileForm = document.getElementById("profileForm");

const showRegisterBtn = document.getElementById("showRegisterBtn");
const showLoginBtn = document.getElementById("showLoginBtn");

const authSection = document.getElementById("authSection");
const dashboardSection = document.getElementById("dashboardSection");
const profileSection = document.getElementById("profileSection");
const securitySection = document.getElementById("securitySection");
const rosterSection = document.getElementById("rosterSection");
const rosterEditorSection = document.getElementById("rosterEditorSection");

const accountMenuBtn = document.getElementById("accountMenuBtn");
const accountMenuPanel = document.getElementById("accountMenuPanel");
const editProfileBtn = document.getElementById("editProfileBtn");
const changePasswordBtn = document.getElementById("changePasswordBtn");
const updateRosterBtn = document.getElementById("updateRosterBtn");

const dashboardAgencyName = document.getElementById("dashboardAgencyName");
const dashboardAgencyMeta = document.getElementById("dashboardAgencyMeta");
const summaryAgencyName = document.getElementById("summaryAgencyName");
const summaryEmail = document.getElementById("summaryEmail");
const summaryContactPerson = document.getElementById("summaryContactPerson");
const summaryContactNumber = document.getElementById("summaryContactNumber");

const personnelSummary = document.getElementById("personnelSummary");
const vehiclesSummary = document.getElementById("vehiclesSummary");
const equipmentSummary = document.getElementById("equipmentSummary");

const personnelList = document.getElementById("personnelList");
const vehiclesList = document.getElementById("vehiclesList");
const equipmentList = document.getElementById("equipmentList");

let agencyToken = localStorage.getItem(AUTH_TOKEN_KEY) || "";
const ROSTER_PREVIEW_LIMIT = 3;
const rosterCollapseState = {
  overview: null,
  editor: null,
};

const PERSONNEL_GENDER_OPTIONS = ["Male", "Female", "Other"];
const VEHICLE_KIND_OPTIONS = [
  "Ambulance",
  "Fire Truck",
  "Truck",
  "Rescue Van",
  "Van",
  "Other",
];
const VEHICLE_TYPE_OPTIONS = ["Land", "Air", "Water"];
const VEHICLE_FUEL_OPTIONS = [
  "Diesel",
  "Gasoline",
  "LPG",
  "Electric",
  "Hybrid",
];
const EQUIPMENT_KIND_OPTIONS = [
  "Pump",
  "Compressor",
  "Generator",
  "Chainsaw",
  "Crane",
  "Excavator",
  "Drone",
  "First Aid Kit",
  "Communication Device",
  "Water Tank",
  "Power Tool",
  "PPE",
  "Medical Equipment",
  "Detection Device",
  "Lighting Equipment",
  "Other",
];
const EQUIPMENT_TYPE_OPTIONS = [
  "Clearing",
  "Surveillance",
  "Rescue",
  "Medical",
  "Communication",
  "Fire Suppression",
  "Search",
  "Logistics",
  "Extraction",
  "Assessment",
  "Power Supply",
  "Water Supply",
  "Other",
];
const EQUIPMENT_POWER_OPTIONS = ["Electric", "Fuel", "Manual", "Pneumatic"];
const EQUIPMENT_FUEL_OPTIONS = ["Diesel", "Gasoline", "LPG", "N/A"];

const PERSONNEL_ROW_FIELDS = [
  { key: "name", type: "text", placeholder: "Full Name" },
  { key: "age", type: "number", placeholder: "Age", min: "18" },
  {
    key: "gender",
    type: "select",
    placeholder: "Gender",
    options: PERSONNEL_GENDER_OPTIONS,
  },
  {
    key: "weight",
    type: "number",
    placeholder: "Weight",
    step: "0.1",
  },
  { key: "contact", type: "tel", placeholder: "Phone/Email" },
  {
    key: "capabilities",
    type: "text",
    placeholder: "Skills, certifications, etc.",
  },
  { key: "others", type: "text", placeholder: "Additional notes" },
];

const VEHICLE_ROW_FIELDS = [
  { key: "operator", type: "text", placeholder: "Operator Name" },
  {
    key: "kind",
    type: "select",
    placeholder: "Select Kind",
    options: VEHICLE_KIND_OPTIONS,
  },
  {
    key: "type",
    type: "select",
    placeholder: "Select Type",
    options: VEHICLE_TYPE_OPTIONS,
  },
  { key: "plate", type: "text", placeholder: "License Plate" },
  {
    key: "fuel",
    type: "select",
    placeholder: "Fuel",
    options: VEHICLE_FUEL_OPTIONS,
  },
  { key: "weight", type: "number", placeholder: "Weight", step: "0.1" },
  { key: "contact", type: "tel", placeholder: "Phone/Email" },
  {
    key: "capabilities",
    type: "text",
    placeholder: "Special capabilities",
  },
  { key: "others", type: "text", placeholder: "Additional notes" },
];

const EQUIPMENT_ROW_FIELDS = [
  { key: "operator", type: "text", placeholder: "Operator Name" },
  {
    key: "kind",
    type: "custom-select",
    placeholder: "Select Kind",
    options: EQUIPMENT_KIND_OPTIONS,
    customPlaceholder: "Specify kind",
  },
  {
    key: "type",
    type: "custom-select",
    placeholder: "Select Type",
    options: EQUIPMENT_TYPE_OPTIONS,
    customPlaceholder: "Specify type",
  },
  {
    key: "power_source",
    type: "select",
    placeholder: "Power Source",
    options: EQUIPMENT_POWER_OPTIONS,
  },
  {
    key: "fuel",
    type: "select",
    placeholder: "Fuel",
    options: EQUIPMENT_FUEL_OPTIONS,
  },
  { key: "weight", type: "number", placeholder: "Weight", step: "0.1" },
  { key: "contact", type: "tel", placeholder: "Phone/Email" },
  {
    key: "capabilities",
    type: "text",
    placeholder: "Special capabilities",
  },
  { key: "others", type: "text", placeholder: "Additional notes" },
];

function setText(el, text, isError = false) {
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isError ? "#b91c1c" : "#0f4c81";
}

function showAuthMode(mode) {
  const registerMode = mode === "register";
  registerForm.classList.toggle("hidden", !registerMode);
  loginForm.classList.toggle("hidden", registerMode);
  showRegisterBtn.classList.toggle("active", registerMode);
  showLoginBtn.classList.toggle("active", !registerMode);
}

function showAuthenticatedState(isAuthenticated) {
  if (authSection) {
    authSection.classList.toggle("hidden", isAuthenticated);
  }

  if (dashboardSection) {
    dashboardSection.classList.toggle("hidden", !isAuthenticated);
  }

  if (rosterSection) {
    rosterSection.classList.toggle("hidden", !isAuthenticated);
  }
}

function hideAccountPanels() {
  if (accountMenuPanel) {
    accountMenuPanel.classList.add("hidden");
  }
}

function toggleAccountMenu() {
  if (!accountMenuPanel) return;
  accountMenuPanel.classList.toggle("hidden");
}

function openPanel(panel) {
  if (panel === profileSection) {
    closePanel(securitySection);
  } else if (panel === securitySection) {
    closePanel(profileSection);
  }

  if (panel) {
    panel.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  hideAccountPanels();
}

function closePanel(panel) {
  if (!panel) return;
  panel.classList.add("hidden");

  const anyModalOpen = [profileSection, securitySection].some(
    (section) => section && !section.classList.contains("hidden"),
  );

  if (!anyModalOpen) {
    document.body.style.overflow = "";
  }
}

function getAuthHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${agencyToken}`,
  };
}

function createTextControl(field, value = "") {
  const input = document.createElement("input");
  input.type = field.type || "text";
  input.placeholder = field.placeholder || "";
  input.value = value || "";
  input.dataset.key = field.key;

  if (field.min !== undefined) input.min = field.min;
  if (field.step !== undefined) input.step = field.step;
  if (field.required) input.required = true;

  return input;
}

function createSelectField(field, value = "") {
  const select = document.createElement("select");
  select.dataset.key = field.key;

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = field.placeholder || "Select";
  placeholderOption.disabled = true;
  placeholderOption.selected = !value;
  select.appendChild(placeholderOption);

  (field.options || []).forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    select.appendChild(option);
  });

  if (value && (field.options || []).includes(value)) {
    select.value = value;
  }

  return select;
}

function createCustomSelectField(field, value = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "field-stack";

  const select = createSelectField(field, "");
  const customInput = createTextControl(
    {
      key: field.key,
      type: "text",
      placeholder: field.customPlaceholder || "Specify value",
    },
    "",
  );
  customInput.dataset.customValue = "true";

  const optionList = field.options || [];
  const hasCustomValue = value && !optionList.includes(value);

  if (hasCustomValue) {
    select.value = "Other";
    customInput.value = value;
    customInput.style.display = "block";
  } else {
    select.value = value && optionList.includes(value) ? value : "";
    customInput.style.display = "none";
  }

  select.addEventListener("change", () => {
    const shouldShowCustom = select.value === "Other";
    customInput.style.display = shouldShowCustom ? "block" : "none";
    if (!shouldShowCustom) {
      customInput.value = "";
    }
  });

  wrapper.appendChild(select);
  wrapper.appendChild(customInput);
  return wrapper;
}

function createFieldControl(field, value = "") {
  if (field.type === "select") {
    return createSelectField(field, value);
  }

  if (field.type === "custom-select") {
    return createCustomSelectField(field, value);
  }

  return createTextControl(field, value);
}

function createRow(container, fields, values = {}) {
  const row = document.createElement("div");
  row.className = "row";

  if (container === equipmentList) {
    row.classList.add("equipment-row");
  }

  const grid = document.createElement("div");
  grid.className = "row-grid";

  fields.forEach((field) => {
    const control = createFieldControl(field, values[field.key] || "");
    grid.appendChild(control);
  });

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-btn";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => row.remove());

  row.appendChild(grid);
  row.appendChild(removeBtn);
  container.appendChild(row);
}

function getRosterMode(container) {
  return container === personnelSummary ||
    container === vehiclesSummary ||
    container === equipmentSummary
    ? "overview"
    : "editor";
}

function getRosterKey(container) {
  if (container === personnelSummary || container === personnelList)
    return "personnel";
  if (container === vehiclesSummary || container === vehiclesList)
    return "vehicles";
  if (container === equipmentSummary || container === equipmentList)
    return "equipment";
  return null;
}

function refreshRosterCollapseState(mode) {
  const activeKey = rosterCollapseState[mode];
  const containers =
    mode === "overview"
      ? [personnelSummary, vehiclesSummary, equipmentSummary]
      : [personnelList, vehiclesList, equipmentList];

  containers.forEach((container) => {
    if (!container) return;

    const key = getRosterKey(container);
    const items = Array.from(container.children);
    const button = document.querySelector(
      `[data-roster-toggle="${mode}-${key}"]`,
    );
    const hasOverflow = items.length > ROSTER_PREVIEW_LIMIT;
    const isExpanded = activeKey === key;

    items.forEach((item, index) => {
      item.classList.toggle(
        "hidden",
        hasOverflow ? !isExpanded && index >= ROSTER_PREVIEW_LIMIT : false,
      );
    });

    if (button) {
      if (!hasOverflow) {
        button.classList.add("hidden");
      } else {
        button.classList.remove("hidden");
        button.textContent = isExpanded ? "View less" : "View more";
      }
    }
  });
}

function setRosterExpanded(mode, key) {
  rosterCollapseState[mode] = rosterCollapseState[mode] === key ? null : key;
  refreshRosterCollapseState(mode);
}

function initializeRosterCollapseControls() {
  document.querySelectorAll("[data-roster-toggle]").forEach((button) => {
    if (button.dataset.initialized) return;

    button.dataset.initialized = "true";
    button.addEventListener("click", () => {
      const [mode, key] = button.dataset.rosterToggle.split("-");
      setRosterExpanded(mode, key);
    });
  });

  refreshRosterCollapseState("overview");
  refreshRosterCollapseState("editor");
}

function renderSummaryList(container, records, labels, emptyMessage) {
  if (!container) return;
  container.innerHTML = "";

  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "summary-empty";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }

  records.forEach((record, index) => {
    const card = document.createElement("div");
    card.className = "summary-item";

    const title = document.createElement("strong");
    title.textContent = `${labels.title} ${index + 1}`;
    card.appendChild(title);

    const details = document.createElement("p");
    details.className = "summary-item-details";
    details.textContent = labels.format(record);
    card.appendChild(details);

    container.appendChild(card);
  });

  refreshRosterCollapseState(getRosterMode(container));
}

function collectRows(container) {
  return Array.from(container.querySelectorAll(".row")).map((row) => {
    const record = {};
    row
      .querySelectorAll("input[data-key], select[data-key]")
      .forEach((input) => {
        if (input.hidden || input.style.display === "none") {
          return;
        }

        record[input.dataset.key] = input.value.trim();
      });
    return record;
  });
}

function populateRoster(data) {
  personnelList.innerHTML = "";
  vehiclesList.innerHTML = "";
  equipmentList.innerHTML = "";

  renderSummaryList(
    personnelSummary,
    data.personnel || [],
    {
      title: "Personnel",
      format: (item) =>
        [
          item.name,
          item.age,
          item.gender,
          item.weight,
          item.contact,
          item.capabilities,
          item.others,
        ]
          .filter(Boolean)
          .join(" | "),
    },
    "No personnel saved yet.",
  );

  renderSummaryList(
    vehiclesSummary,
    data.vehicles || [],
    {
      title: "Vehicle",
      format: (item) =>
        [
          item.operator_name,
          item.kind,
          item.type,
          item.plate_number,
          item.fuel_type,
          item.weight,
          item.contact,
          item.capabilities,
          item.others,
        ]
          .filter(Boolean)
          .join(" | "),
    },
    "No vehicles saved yet.",
  );

  renderSummaryList(
    equipmentSummary,
    data.equipment || [],
    {
      title: "Equipment",
      format: (item) =>
        [
          item.operator_name,
          item.kind,
          item.type,
          item.power_source,
          item.fuel_type,
          item.weight,
          item.contact,
          item.capabilities,
          item.others,
        ]
          .filter(Boolean)
          .join(" | "),
    },
    "No equipment saved yet.",
  );

  (data.personnel || []).forEach((item) =>
    createRow(personnelList, PERSONNEL_ROW_FIELDS, item),
  );

  (data.vehicles || []).forEach((item) =>
    createRow(vehiclesList, VEHICLE_ROW_FIELDS, {
      operator: item.operator_name,
      kind: item.kind,
      type: item.type,
      plate: item.plate_number,
      fuel: item.fuel_type,
      weight: item.weight,
      contact: item.contact,
      capabilities: item.capabilities,
      others: item.others,
    }),
  );

  (data.equipment || []).forEach((item) =>
    createRow(equipmentList, EQUIPMENT_ROW_FIELDS, {
      operator: item.operator_name,
      kind: item.kind,
      type: item.type,
      power_source: item.power_source,
      fuel: item.fuel_type,
      weight: item.weight,
      contact: item.contact,
      capabilities: item.capabilities,
      others: item.others,
    }),
  );

  refreshRosterCollapseState("overview");
  refreshRosterCollapseState("editor");
}

function populateSummary(profile) {
  const agencyName = profile.agency_name || "-";
  const email = profile.email || "-";
  const contactPerson = profile.contact_person || "-";
  const contactNumber = profile.contact_number || "-";

  if (dashboardAgencyName) dashboardAgencyName.textContent = agencyName;
  if (dashboardAgencyMeta) {
    dashboardAgencyMeta.textContent = `Logged in as ${agencyName}. Update profile, password, and roster from here.`;
  }
  if (summaryAgencyName) summaryAgencyName.textContent = agencyName;
  if (summaryEmail) summaryEmail.textContent = email;
  if (summaryContactPerson) summaryContactPerson.textContent = contactPerson;
  if (summaryContactNumber) summaryContactNumber.textContent = contactNumber;
}

async function loadAgencyData() {
  if (!agencyToken) {
    showAuthenticatedState(false);
    return;
  }

  try {
    const profileRes = await fetch("/api/agency/profile", {
      headers: getAuthHeaders(),
    });

    if (!profileRes.ok) {
      throw new Error("Session expired. Please login again.");
    }

    const profileData = await profileRes.json();
    const profile = profileData.profile;

    document.getElementById("profileAgencyName").value =
      profile.agency_name || "";
    document.getElementById("profileEmail").value = profile.email || "";
    document.getElementById("profileContactPerson").value =
      profile.contact_person || "";
    document.getElementById("profileContactNumber").value =
      profile.contact_number || "";
    populateSummary(profile);

    const rosterRes = await fetch("/api/agency/roster", {
      headers: getAuthHeaders(),
    });
    const rosterData = await rosterRes.json();
    if (!rosterData.success) {
      throw new Error(rosterData.error || "Failed to load roster");
    }

    populateRoster(rosterData);
    showAuthenticatedState(true);
    setText(authStatus, `Logged in as ${profile.agency_name}`);
  } catch (error) {
    agencyToken = "";
    localStorage.removeItem(AUTH_TOKEN_KEY);
    showAuthenticatedState(false);
    setText(authStatus, error.message, true);
  }
}

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const response = await fetch("/api/agency/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agency_name: document.getElementById("registerAgencyName").value.trim(),
        email: document.getElementById("registerEmail").value.trim(),
        password: document.getElementById("registerPassword").value,
        contact_person: document
          .getElementById("registerContactPerson")
          .value.trim(),
        contact_number: document
          .getElementById("registerContactNumber")
          .value.trim(),
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Registration failed");
    }

    agencyToken = data.token;
    localStorage.setItem(AUTH_TOKEN_KEY, agencyToken);
    registerForm.reset();
    setText(authStatus, "Agency account created and logged in.");
    await loadAgencyData();
  } catch (error) {
    setText(authStatus, error.message, true);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const response = await fetch("/api/agency/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("loginEmail").value.trim(),
        password: document.getElementById("loginPassword").value,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Login failed");
    }

    agencyToken = data.token;
    localStorage.setItem(AUTH_TOKEN_KEY, agencyToken);
    loginForm.reset();
    setText(authStatus, "Login successful.");
    await loadAgencyData();
  } catch (error) {
    setText(authStatus, error.message, true);
  }
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const response = await fetch("/api/agency/profile", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        agency_name: document.getElementById("profileAgencyName").value.trim(),
        contact_person: document
          .getElementById("profileContactPerson")
          .value.trim(),
        contact_number: document
          .getElementById("profileContactNumber")
          .value.trim(),
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to save profile");
    }

    populateSummary(data.profile);
    setText(rosterStatus, "Profile updated.");
  } catch (error) {
    setText(rosterStatus, error.message, true);
  }
});

document
  .getElementById("passwordForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmNewPassword =
      document.getElementById("confirmNewPassword").value;

    if (newPassword !== confirmNewPassword) {
      setText(rosterStatus, "New password confirmation does not match.", true);
      return;
    }

    try {
      const response = await fetch("/api/agency/password", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to change password");
      }

      document.getElementById("passwordForm").reset();
      setText(rosterStatus, "Password changed successfully.");
    } catch (error) {
      setText(rosterStatus, error.message, true);
    }
  });

document.getElementById("saveRosterBtn").addEventListener("click", async () => {
  try {
    const response = await fetch("/api/agency/roster", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        personnel: collectRows(personnelList),
        vehicles: collectRows(vehiclesList),
        equipment: collectRows(equipmentList),
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to save roster");
    }

    closePanel(rosterEditorSection);
    await loadAgencyData();
    setText(rosterStatus, "Roster updates saved successfully.");
  } catch (error) {
    setText(rosterStatus, error.message, true);
  }
});

if (updateRosterBtn) {
  updateRosterBtn.addEventListener("click", () =>
    openPanel(rosterEditorSection),
  );
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  agencyToken = "";
  localStorage.removeItem(AUTH_TOKEN_KEY);
  rosterSection.classList.add("hidden");
  showAuthenticatedState(false);
  hideAccountPanels();
  closePanel(profileSection);
  closePanel(securitySection);
  setText(authStatus, "Logged out.");
});

document.getElementById("addPersonnelBtn").addEventListener("click", () => {
  createRow(personnelList, PERSONNEL_ROW_FIELDS);
  setRosterExpanded("editor", "personnel");
});

document.getElementById("addVehicleBtn").addEventListener("click", () => {
  createRow(vehiclesList, VEHICLE_ROW_FIELDS);
  setRosterExpanded("editor", "vehicles");
});

document.getElementById("addEquipmentBtn").addEventListener("click", () => {
  createRow(equipmentList, EQUIPMENT_ROW_FIELDS);
  setRosterExpanded("editor", "equipment");
});

showRegisterBtn.addEventListener("click", () => showAuthMode("register"));
showLoginBtn.addEventListener("click", () => showAuthMode("login"));

if (accountMenuBtn) {
  accountMenuBtn.addEventListener("click", toggleAccountMenu);
}

if (editProfileBtn) {
  editProfileBtn.addEventListener("click", () => openPanel(profileSection));
}

if (changePasswordBtn) {
  changePasswordBtn.addEventListener("click", () => openPanel(securitySection));
}

initializeRosterCollapseControls();

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", (event) => {
    const targetId = event.currentTarget.getAttribute("data-close-modal");
    const targetPanel = document.getElementById(targetId);
    closePanel(targetPanel);
  });
});

document.addEventListener("click", (event) => {
  if (!accountMenuPanel || !accountMenuBtn) return;

  const clickedInsideMenu = accountMenuPanel.contains(event.target);
  const clickedButton = accountMenuBtn.contains(event.target);

  if (!clickedInsideMenu && !clickedButton) {
    hideAccountPanels();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (profileSection && !profileSection.classList.contains("hidden")) {
    closePanel(profileSection);
  }
  if (securitySection && !securitySection.classList.contains("hidden")) {
    closePanel(securitySection);
  }
});

showAuthMode("register");
loadAgencyData();
