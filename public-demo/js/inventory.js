const adminToken = localStorage.getItem("adminToken");
if (!adminToken) {
  alert("Please login as admin first");
  window.location.href = "index.html";
}

async function loadData() {
  try {
    console.log("Loading inventory data...");

    const equipmentResponse = await fetch("/api/equipment", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    });
    console.log("Equipment response status:", equipmentResponse.status);

    if (!equipmentResponse.ok) {
      throw new Error(
        `Failed to load equipment: ${equipmentResponse.status} ${equipmentResponse.statusText}`,
      );
    }

    const equipmentData = await equipmentResponse.json();
    console.log("Equipment data loaded:", equipmentData.length, "items");

    const vehiclesResponse = await fetch("/api/vehicles", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    });
    console.log("Vehicles response status:", vehiclesResponse.status);

    if (!vehiclesResponse.ok) {
      throw new Error(
        `Failed to load vehicles: ${vehiclesResponse.status} ${vehiclesResponse.statusText}`,
      );
    }

    const vehiclesData = await vehiclesResponse.json();
    console.log("Vehicles data loaded:", vehiclesData.length, "items");

    const personnelResponse = await fetch("/api/personnel", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    });
    console.log("Personnel response status:", personnelResponse.status);

    if (!personnelResponse.ok) {
      throw new Error(
        `Failed to load personnel: ${personnelResponse.status} ${personnelResponse.statusText}`,
      );
    }

    const personnelData = await personnelResponse.json();
    console.log("Personnel data loaded:", personnelData.length, "items");

    const equipmentTable = document.querySelector("#equipmentTable tbody");
    equipmentTable.innerHTML = "";

    if (equipmentData.length === 0) {
      equipmentTable.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted py-4">
            No equipment found. Add some equipment to get started.
          </td>
        </tr>`;
    } else {
      equipmentData.forEach((item) => {
        const statusClass = getStatusClass(item.condition);
        const conditionClass = getConditionClass(item.condition);

        const row = equipmentTable.insertRow();
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.type}</td>
            <td><span class="quantity-badge">${item.quantity}</span></td>
            <td><span class="status-badge ${statusClass}">${
              item.condition
            }</span></td>
            <td><span class="condition-badge ${conditionClass}">${
              item.condition
            }</span></td>
            <td>${item.location || "N/A"}</td>`;
        row.onclick = () => showDetailsModal(item, "equipment");
      });
    }

    const vehiclesTable = document.querySelector("#vehiclesTable tbody");
    vehiclesTable.innerHTML = "";

    if (vehiclesData.length === 0) {
      vehiclesTable.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted py-4">
            No vehicles found. Add some vehicles to get started.
          </td>
        </tr>`;
    } else {
      vehiclesData.forEach((item) => {
        const statusClass = getStatusClass(item.condition);
        const conditionClass = getConditionClass(item.condition);

        const row = vehiclesTable.insertRow();
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.plate_number || "N/A"}</td>
            <td><span class="status-badge ${statusClass}">${
              item.condition
            }</span></td>
            <td><span class="condition-badge ${conditionClass}">${
              item.condition
            }</span></td>
            <td>${item.location || "N/A"}</td>`;
        row.onclick = () => showDetailsModal(item, "vehicle");
      });
    }

    const personnelTable = document.querySelector("#personnelTable tbody");
    personnelTable.innerHTML = "";

    if (personnelData.length === 0) {
      personnelTable.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted py-4">
            No personnel found. Add some personnel to get started.
          </td>
        </tr>`;
    } else {
      personnelData.forEach((item) => {
        const statusClass = getPersonnelStatusClass(item.status);
        const trainingsDisplay = parseTrainingsField(item.trainings);

        const row = personnelTable.insertRow();
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.role}</td>
            <td>${trainingsDisplay}</td>
            <td><span class="status-badge ${statusClass}">${
              item.status
            }</span></td>
            <td>${item.contact || "N/A"}</td>`;
        row.onclick = () => showDetailsModal(item, "personnel");
      });
    }

    console.log("Inventory data loaded successfully");
    updateInventoryOverview();
  } catch (error) {
    console.error("Error loading data:", error);
    alert(`Error: ${error.message}`);
  }
}

function showDetailsModal(item, type) {
  const modal = new bootstrap.Modal(document.getElementById("itemDetailModal"));
  const title = document.getElementById("itemDetailModalTitle");
  const body = document.getElementById("itemDetailModalBody");
  const footer = document.getElementById("itemDetailModalFooter");

  let bodyHtml = "";
  let footerHtml = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>`;

  if (type === "equipment") {
    title.textContent = `Equipment: ${item.name}`;
    bodyHtml = `
      <p><strong>Type:</strong> ${item.type}</p>
      <p><strong>Quantity:</strong> ${item.quantity}</p>
      <p><strong>Location:</strong> ${item.location || "N/A"}</p>
      <p><strong>Condition:</strong> ${item.condition}</p>
    `;
    footerHtml += `
      <button class="btn btn-info" onclick="toggleEquipmentCondition(${item.id}, '${item.condition}')">Toggle Condition</button>
    `;
  } else if (type === "vehicle") {
    title.textContent = `Vehicle: ${item.name}`;
    bodyHtml = `
      <p><strong>Plate Number:</strong> ${item.plate_number || "N/A"}</p>
      <p><strong>Location:</strong> ${item.location || "N/A"}</p>
      <p><strong>Condition:</strong> ${item.condition}</p>
    `;
    footerHtml += `
      <button class="btn btn-info" onclick="toggleVehicleCondition(${item.id}, '${item.condition}')">Toggle Condition</button>
    `;
  } else if (type === "personnel") {
    title.textContent = `Personnel: ${item.name}`;
    const trainingsDisplay = parseTrainingsField(item.trainings);

    bodyHtml = `
      <p><strong>Role:</strong> ${item.role}</p>
      <p><strong>Trainings:</strong> ${trainingsDisplay}</p>
      <p><strong>Contact:</strong> ${item.contact || "N/A"}</p>
      <p><strong>Status:</strong> ${item.status}</p>
    `;
    footerHtml += `
      <button class="btn btn-outline-warning" onclick="updatePersonnel(${item.id}, '${item.status}')">Toggle Status</button>
    `;
  }

  body.innerHTML = bodyHtml;
  footer.innerHTML = footerHtml;

  const actionButtons = footer.querySelectorAll(
    "button:not([data-bs-dismiss])",
  );
  actionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const modalInstance = bootstrap.Modal.getInstance(
        document.getElementById("itemDetailModal"),
      );
      modalInstance.hide();
    });
  });

  modal.show();
}

function getStatusClass(status) {
  switch (status) {
    case "Available":
      return "status-available";
    case "In Use":
      return "status-in-use";
    case "Reserved":
      return "status-reserved";
    default:
      return "status-available";
  }
}

function getConditionClass(condition) {
  switch (condition) {
    case "Good":
      return "condition-good";
    case "Damaged":
      return "condition-damaged";
    case "Under Maintenance":
      return "condition-maintenance";
    default:
      return "condition-good";
  }
}

function getPersonnelStatusClass(status) {
  switch (status) {
    case "Available":
      return "status-available";
    case "Deployed":
      return "status-deployed";
    case "On Leave":
      return "status-reserved";
    default:
      return "status-available";
  }
}

function parseTrainingsField(trainings) {
  let result = trainings || "N/A";
  if (
    typeof result === "string" &&
    result.startsWith("{") &&
    result.endsWith("}")
  ) {
    try {
      const parsed = JSON.parse(result);
      result = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
    } catch (e) {
      result = result
        .replace(/^{\s*"/, "")
        .replace(/"\s*}$/, "")
        .replace(/\\"/g, '"');
    }
  }
  return result;
}

async function updateInventoryOverview() {
  try {
    const equipment = await fetch("/api/equipment", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    }).then((res) => res.json());

    const vehicles = await fetch("/api/vehicles", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    }).then((res) => res.json());

    const personnel = await fetch("/api/personnel", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    }).then((res) => res.json());

    const totalEquipment = equipment.reduce(
      (sum, item) => sum + (item.quantity || 1),
      0,
    );
    const goodEquipment = equipment.filter(
      (item) => item.condition === "Good",
    ).length;
    const damagedEquipment = equipment.filter(
      (item) => item.condition === "Damaged",
    ).length;
    const maintenanceEquipment = equipment.filter(
      (item) => item.condition === "Under Maintenance",
    ).length;

    document.getElementById("totalEquipment").textContent = totalEquipment;
    document.getElementById("availableEquipment").textContent = totalEquipment;
    document.getElementById("goodEquipment").textContent = goodEquipment;
    document.getElementById("damagedEquipment").textContent = damagedEquipment;
    document.getElementById("maintenanceEquipment").textContent =
      maintenanceEquipment;

    const totalVehicles = vehicles.length;
    const availableVehicles = vehicles.length;
    const goodVehicles = vehicles.filter(
      (item) => item.condition === "Good",
    ).length;
    const damagedVehicles = vehicles.filter(
      (item) => item.condition === "Damaged",
    ).length;
    const maintenanceVehicles = vehicles.filter(
      (item) => item.condition === "Under Maintenance",
    ).length;

    const totalPersonnel = personnel.length;
    const availablePersonnel = personnel.filter(
      (item) => item.status === "Available",
    ).length;
    const deployedPersonnel = personnel.filter(
      (item) => item.status === "Deployed",
    ).length;
    const onLeavePersonnel = personnel.filter(
      (item) => item.status === "On Leave",
    ).length;

    document.getElementById("totalEquipment").textContent = totalEquipment;
    document.getElementById("availableEquipment").textContent = totalEquipment;
    document.getElementById("goodEquipment").textContent = goodEquipment;
    document.getElementById("damagedEquipment").textContent = damagedEquipment;
    document.getElementById("maintenanceEquipment").textContent =
      maintenanceEquipment;

    document.getElementById("totalVehicles").textContent = totalVehicles;
    document.getElementById("availableVehicles").textContent =
      availableVehicles;
    document.getElementById("goodVehicles").textContent = goodVehicles;
    document.getElementById("damagedVehicles").textContent = damagedVehicles;
    document.getElementById("maintenanceVehicles").textContent =
      maintenanceVehicles;

    document.getElementById("totalPersonnel").textContent = totalPersonnel;
    document.getElementById("availablePersonnel").textContent =
      availablePersonnel;
    document.getElementById("availablePersonnelCount").textContent =
      availablePersonnel;
    document.getElementById("deployedPersonnel").textContent =
      deployedPersonnel;
    document.getElementById("onLeavePersonnel").textContent = onLeavePersonnel;
  } catch (error) {
    console.error("Error updating inventory overview:", error);
  }
}

async function toggleEquipmentStatus(id, currentStatus) {
  try {
    const newStatus = currentStatus === "Available" ? "In Use" : "Available";
    await fetch("/api/equipment/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ id, condition: newStatus }),
    });
    loadData();
  } catch (error) {
    console.error("Error toggling equipment status:", error);
    alert(`Error updating equipment status: ${error.message}`);
  }
}

async function toggleEquipmentCondition(id, currentCondition) {
  try {
    const newCondition = currentCondition === "Good" ? "Damaged" : "Good";
    await fetch("/api/equipment/condition", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ id, condition: newCondition }),
    });
    loadData();
  } catch (error) {
    console.error("Error toggling equipment condition:", error);
    alert(`Error updating equipment condition: ${error.message}`);
  }
}

async function toggleVehicleStatus(id, currentStatus) {
  try {
    const newStatus = currentStatus === "Available" ? "In Use" : "Available";
    await fetch("/api/vehicles/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ id, condition: newStatus }),
    });
    loadData();
  } catch (error) {
    console.error("Error toggling vehicle status:", error);
    alert(`Error updating vehicle status: ${error.message}`);
  }
}

async function toggleVehicleCondition(id, currentCondition) {
  try {
    const newCondition = currentCondition === "Good" ? "Damaged" : "Good";
    await fetch("/api/vehicles/condition", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ id, condition: newCondition }),
    });
    loadData();
  } catch (error) {
    console.error("Error toggling vehicle condition:", error);
    alert(`Error updating vehicle condition: ${error.message}`);
  }
}

async function updatePersonnel(id, currentStatus) {
  try {
    const newStatus = currentStatus === "Available" ? "Deployed" : "Available";
    await fetch("/api/personnel/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ id, status: newStatus }),
    });
    loadData();
  } catch (error) {
    console.error("Error updating personnel:", error);
    alert(`Error updating personnel: ${error.message}`);
  }
}

document.querySelector("#equipmentForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const formData = new FormData(e.target);
    const data = {
      name: formData.get("name"),
      type: formData.get("type"),
      quantity: parseInt(formData.get("quantity")) || 1,
      location: formData.get("location"),
      condition: "Good",
    };

    await fetch("/api/equipment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(data),
    });
    e.target.reset();
    loadData();
  } catch (error) {
    console.error("Error adding equipment:", error);
    alert(`Error adding equipment: ${error.message}`);
  }
};

document.querySelector("#vehiclesForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const formData = new FormData(e.target);
    const data = {
      name: formData.get("name"),
      plate_number: formData.get("plate_number"),
      location: formData.get("location"),
      condition: "Good",
    };

    await fetch("/api/vehicles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(data),
    });
    e.target.reset();
    loadData();
  } catch (error) {
    console.error("Error adding vehicle:", error);
    alert(`Error adding vehicle: ${error.message}`);
  }
};

document.querySelector("#personnelForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const formData = new FormData(e.target);
    const data = {
      name: formData.get("name"),
      role: formData.get("role"),
      trainings: formData.get("trainings"),
      contact: formData.get("contact"),
      status: "Available",
    };

    await fetch("/api/personnel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(data),
    });
    e.target.reset();
    loadData();
  } catch (error) {
    console.error("Error adding personnel:", error);
    alert(`Error adding personnel: ${error.message}`);
  }
};

document
  .getElementById("inventoryModal")
  .addEventListener("show.bs.modal", updateInventoryOverview);

document.getElementById("exportEquipment").addEventListener("click", () => {
  alert("Export equipment feature coming soon!");
});

document.getElementById("exportVehicles").addEventListener("click", () => {
  alert("Export vehicles feature coming soon!");
});

document.getElementById("exportPersonnel").addEventListener("click", () => {
  alert("Export personnel feature coming soon!");
});

function setCurrentDate() {
  const now = new Date();
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  document.getElementById("currentDate").textContent = now.toLocaleDateString(
    "en-US",
    options,
  );
}

setCurrentDate();
loadData();
