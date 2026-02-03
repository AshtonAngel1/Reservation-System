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
    await fetch(`/${type}/${id}`, { method: "DELETE" });
    loadTables();
  });
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
    tr.innerHTML = `<td>${r.id}</td><td>${r.name}</td><td>${r.capacity}</td><td>${r.location}</td>`;
    const tdAction = document.createElement("td");
    tdAction.appendChild(createDeleteButton("rooms", r.id));
    tr.appendChild(tdAction);
    roomsTbody.appendChild(tr);
  });

  // Resources
  const resourcesTbody = document.querySelector("#resourcesTable tbody");
  resourcesTbody.innerHTML = "";
  resources.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.id}</td><td>${r.name}</td><td>${r.type}</td><td>${r.status}</td>`;
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
    tr.innerHTML = `<td>${p.id}</td><td>${p.name}</td><td>${p.role}</td><td>${p.availability_notes}</td>`;
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

  const id = Math.floor(Math.random() * 10000);
  await fetch("/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name, capacity, location }) });
  loadTables();
});

document.getElementById("addResourceBtn").addEventListener("click", async () => {
  const name = document.getElementById("resourceName").value.trim();
  const type = document.getElementById("resourceType").value.trim();
  const status = document.getElementById("resourceCondition").value.trim();

  if (!name || !type || !status) return alert("All resource fields are required!");

  const id = Math.floor(Math.random() * 10000);
  await fetch("/resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name, type, status }) });
  loadTables();
});

document.getElementById("addPersonBtn").addEventListener("click", async () => {
  const name = document.getElementById("personName").value.trim();
  const role = document.getElementById("personRole").value.trim();
  const availability_notes = document.getElementById("personAvailability").value.trim();

  if (!name || !role || !availability_notes) return alert("All person fields are required!");

  const id = Math.floor(Math.random() * 10000);
  await fetch("/people", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name, role, availability_notes }) });
  loadTables();
});

// --- INITIAL LOAD ---
loadTables();
