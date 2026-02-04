// --- HELPER FUNCTIONS ---
async function fetchInventory() {
  const res = await fetch("/inventory");
  return await res.json();
}

function createDeleteButton(type, id) {
  const btn = document.createElement("button");
  btn.textContent = "Delete";
  btn.onclick = async () => {
    await fetch(`/${type}/${id}`, { method: "DELETE" });
    loadTables();
  };
  return btn;
}

// --- LOAD TABLES ---
async function loadTables() {
  const { rooms, resources, people } = await fetchInventory();

  // Rooms
  const roomsTbody = document.querySelector("#roomsTable tbody");
  roomsTbody.innerHTML = "";
  rooms.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.name}</td>
      <td>${r.capacity}</td>
      <td>${r.location}</td>
    `;
    const actionTd = document.createElement("td");
    actionTd.appendChild(createDeleteButton("rooms", r.id));
    tr.appendChild(actionTd);
    roomsTbody.appendChild(tr);
  });

  // Resources
  const resourcesTbody = document.querySelector("#resourcesTable tbody");
  resourcesTbody.innerHTML = "";
  resources.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.name}</td>
      <td>${r.type}</td>
      <td>${r.condition}</td>
    `;
    const actionTd = document.createElement("td");
    actionTd.appendChild(createDeleteButton("resources", r.id));
    tr.appendChild(actionTd);
    resourcesTbody.appendChild(tr);
  });

  // People
  const peopleTbody = document.querySelector("#peopleTable tbody");
  peopleTbody.innerHTML = "";
  people.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>${p.role}</td>
      <td>${p.availability_notes}</td>
    `;
    const actionTd = document.createElement("td");
    actionTd.appendChild(createDeleteButton("people", p.id));
    tr.appendChild(actionTd);
    peopleTbody.appendChild(tr);
  });
}

// --- ADD ROOM ---
document.getElementById("addRoomBtn").onclick = async () => {
  const name = document.getElementById("roomName").value.trim();
  const location = document.getElementById("roomLocation").value.trim();
  const capacity = Number(document.getElementById("roomCapacity").value);

  if (!name || !location) {
    return alert("Room name and location cannot be empty");
  }

  if (!Number.isInteger(capacity) || capacity <= 0) {
    return alert("Capacity must be a positive number");
  }

  await fetch("/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, capacity, location })
  });

  loadTables();
};

// --- ADD RESOURCE ---
document.getElementById("addResourceBtn").onclick = async () => {
  const name = document.getElementById("resourceName").value.trim();
  const type = document.getElementById("resourceType").value.trim();
  const condition = document.getElementById("resourceCondition").value.trim();

  if (!name || !type || !condition) {
    return alert("All resource fields are required");
  }

  await fetch("/resources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, type, condition })
  });

  loadTables();
};

// --- ADD PERSON ---
document.getElementById("addPersonBtn").onclick = async () => {
  const name = document.getElementById("personName").value.trim();
  const role = document.getElementById("personRole").value.trim();
  const availability_notes =
    document.getElementById("personAvailability").value.trim();

  if (!name || !role || !availability_notes) {
    return alert("All person fields are required");
  }

  await fetch("/people", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, role, availability_notes })
  });

  loadTables();
};

// --- INITIAL LOAD ---
loadTables();

