// --- HELPER FUNCTIONS ---
async function fetchInventory() {
  const res = await fetch("/inventory");
  const data = await res.json();
  return data;
}

function createDeleteButton(type, id) {
  const btn = document.createElement("button");
  btn.textContent = "Delete";
  btn.addEventListener("click", async () => {
  const res = await fetch(`/${type}/${id}`, { method: "DELETE" });

  if (!res.ok) {
    alert("Delete failed!");
    return;
  }

  loadTables();
});
  return btn;
}


// --- LOAD TABLES ---
async function loadTables() {
  const items = await fetchInventory();

  const rooms = items.filter(i => i.type === "room");
  const resources = items.filter(i => i.type === "resource");
  const people = items.filter(i => i.type === "person");

  // Rooms
  const roomsTbody = document.querySelector("#roomsTable tbody");
  roomsTbody.innerHTML = "";

  rooms.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.name}</td>
      <td>${r.capacity || ""}</td>
      <td>${r.location || ""}</td>
    `;
    const tdAction = document.createElement("td");
    tdAction.appendChild(createDeleteButton("rooms", r.id));
    tr.appendChild(tdAction);
    roomsTbody.appendChild(tr);

    // Populate Availability Dropdown
    const availabilitySelect = document.getElementById("availabilityItem");
    availabilitySelect.innerHTML = "";

    items.forEach(item => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.name} (${item.type})`;
      availabilitySelect.appendChild(option);
    });
  });

  // Resources
  const resourcesTbody = document.querySelector("#resourcesTable tbody");
  resourcesTbody.innerHTML = "";

  resources.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.name}</td>
      <td>${r.resource_type || ""}</td>
    `;
    const tdAction = document.createElement("td");
    tdAction.appendChild(createDeleteButton("resources", r.id));
    tr.appendChild(tdAction);
    resourcesTbody.appendChild(tr);
  });

  // People
  const peopleTbody = document.querySelector("#peopleTable tbody");
  peopleTbody.innerHTML = "";

  people.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.first_name || ""} ${p.last_name || ""}</td>
      <td>${p.role || ""}</td>
    `;
    const tdAction = document.createElement("td");
    tdAction.appendChild(createDeleteButton("people", p.id));
    tr.appendChild(tdAction);
    peopleTbody.appendChild(tr);
  });
}

// --- ADD NEW ITEMS ---
document.getElementById("addRoomBtn").addEventListener("click", async () => {
  const name = document.getElementById("roomName").value.trim();
  const capacity = parseInt(document.getElementById("roomCapacity").value);
  const location = document.getElementById("roomLocation").value.trim();

  if (!name || !location) return alert("Name and Location cannot be empty!");
  if (isNaN(capacity) || capacity <= 0) return alert("Capacity must be a positive number!");

  await fetch("rooms", { 
    method: "POST", 
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify({ name, capacity, location }) 
  });

  loadTables();
});

document.getElementById("addResourceBtn").addEventListener("click", async () => {
  const name = document.getElementById("resourceName").value.trim();
  const resource_type = document.getElementById("resourceType").value.trim();

  if (!name || !resource_type) return alert("All resource fields are required!");

  await fetch("/resources", { 
    method: "POST", headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify({ name, resource_type}) });

  loadTables();
});

document.getElementById("addPersonBtn").addEventListener("click", async () => {
  const first_name = document.getElementById("personName").value.trim();
  const last_name = document.getElementById("personLastName").value.trim();
  const role = document.getElementById("personRole").value.trim();

  if (!first_name || !last_name || !role) return alert("All person fields are required!");

  await fetch("/people", { 
    method: "POST", headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify({ first_name, last_name, role }) 
  });

  loadTables();
});

document.getElementById("addAvailabilityBtn").addEventListener("click", async () => {

  const item_id = document.getElementById("availabilityItem").value;
  const start_time = document.getElementById("availabilityStart").value;
  const end_time = document.getElementById("availabilityEnd").value;

  if (!item_id || !start_time || !end_time) {
    return alert("All availability fields are required!");
  }

  if (new Date(start_time) >= new Date(end_time)) {
    return alert("End time must be after start time!");
  }

  await fetch("/availability-slots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id, start_time, end_time })
  });

  alert("Availability slot added!");
});

// --- INITIAL LOAD ---
loadTables();