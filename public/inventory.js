// --- HELPER FUNCTIONS ---
async function fetchInventory() {
  const res = await fetch("/inventory");
  const data = await res.json();
  return data;
}

function normalizeTime(t) {
  // If already HH:MM:SS → return as is
  if (t.split(":").length === 3) return t;

  // If HH:MM -> append seconds
  return t + ":00";
}

async function loadStaffUsers() {
  const res = await fetch('/admin/staff-users');
  const users = await res.json();

  const select = document.getElementById('personUser');
  select.innerHTML = '<option value="">None</option>';

  for (const u of users) {
    const option = document.createElement('option');
    option.value = u.id;
    option.textContent = u.email;
    select.appendChild(option);
  }
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

function createActionButton(item) {
  const btn = document.createElement("button");

  btn.textContent = item.active ? "Deactivate" : "Restore";

  btn.addEventListener("click", async () => {
    const method = item.active ? "DELETE" : "POST";
    const url = item.active
      ? `/inventory/${item.id}`
      : `/inventory/${item.id}/restore`;

    const res = await fetch(url, { method });
    const result = await res.json();

    if (!res.ok) {
      alert(result.message || "Action failed");
      return;
    }

    loadTables();
  });

  return btn;
}

function getColumnsForType(type) {
  if (type === "room") {
    return ["id", "name", "capacity", "location"];
  }

  if (type === "resource") {
    return ["id", "name", "resource_type"];
  }

  if (type === "person") {
    return ["id", "first_name", "last_name", "role"];
  }

  return [];
}

function renderTable(tableSelector, items, type) {
  const tbody = document.querySelector(`${tableSelector} tbody`);
  tbody.innerHTML = "";

  const columns = getColumnsForType(type);

  items.forEach(item => {
    const tr = document.createElement("tr");

    tr.innerHTML = columns
      .map(col => `<td>${item[col] || ""}</td>`)
      .join("");

    const tdAction = document.createElement("td");
    tdAction.appendChild(createActionButton(item));
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  });
}

function createRuleRow() {
  const div = document.createElement("div");

  div.innerHTML = `
    <select class="day">
      <option value="0">Sunday</option>
      <option value="1">Monday</option>
      <option value="2">Tuesday</option>
      <option value="3">Wednesday</option>
      <option value="4">Thursday</option>
      <option value="5">Friday</option>
      <option value="6">Saturday</option>
    </select>

    <input type="time" class="start">
    <input type="time" class="end">

    <button class="removeRuleBtn">X</button>
  `;

  div.querySelector(".removeRuleBtn").onclick = () => div.remove();

  return div;
}

// --- LOAD TABLES ---
async function loadDeactivatedTables(items) {
  const inactiveItems = items.filter(i => i.active === 0);

  const inactiveSection = document.getElementById("inactiveSection");
  inactiveSection.style.display = inactiveItems.length ? "" : "none";

  renderTable(
    "#inactiveRoomsTable",
    inactiveItems.filter(i => i.type === "room"),
    "room"
  );

  renderTable(
    "#inactiveResourcesTable",
    inactiveItems.filter(i => i.type === "resource"),
    "resource"
  );

  renderTable(
    "#inactivePeopleTable",
    inactiveItems.filter(i => i.type === "person"),
    "person"
  );
}

async function loadTables() {
  const data = await fetchInventory();
  const items = data.items;

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

  await loadStaffUsers();

  people.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.first_name || ""}</td>
      <td>${p.last_name || ""}</td>
      <td>${p.role || ""}</td>
    `;
    const tdAction = document.createElement("td");
    tdAction.appendChild(createDeleteButton("people", p.id));
    tr.appendChild(tdAction);
    peopleTbody.appendChild(tr);
  });

  // Populate Availability Dropdown
  const availabilitySelect = document.getElementById("availabilityItem");
  availabilitySelect.innerHTML = "";

  items.forEach(item => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.name} (${item.type})`;
    availabilitySelect.appendChild(option);
  });

  if (items.length > 0) {
    availabilitySelect.value = items[0].id;

    // manually trigger load
    availabilitySelect.dispatchEvent(new Event("change"));
  }

  // Load deactivated items in separate tables
  // loadDeactivatedTables(items);
}

// --- ADD NEW ITEMS ---
document.getElementById("addRoomBtn").addEventListener("click", async () => {
  const name = document.getElementById("roomName").value.trim();
  const capacity = parseInt(document.getElementById("roomCapacity").value);
  const location = document.getElementById("roomLocation").value.trim();

  if (!name || !location) return alert("Name and Location cannot be empty!");
  if (isNaN(capacity) || capacity <= 0) return alert("Capacity must be a positive number!");

  await fetch("/rooms", { 
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
  const user_id = document.getElementById("personUser").value;

  if (!first_name || !last_name || !role || !user_id) return alert("All person fields are required!");

  await fetch("/people", { 
    method: "POST", headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify({ first_name, last_name, role, user_id }) 
  });

  loadTables();
});

document.getElementById("addExceptionBtn").addEventListener("click", async () => {
  const item_id = document.getElementById("availabilityItem").value;
  const start = document.getElementById("exceptionStart").value;
  const end = document.getElementById("exceptionEnd").value;
  const is_available = document.getElementById("exceptionType").value === "true";

  if (!item_id || !start || !end) {
    return alert("All fields required");
  }

  if (new Date(start) >= new Date(end)) {
    return alert("Invalid time range");
  }

  await fetch("/availability/exceptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item_id,
      start_datetime: start,
      end_datetime: end,
      is_available
    })
  });

  alert("Exception added!");
});

document.getElementById("addRuleRowBtn").addEventListener("click", () => {
  const container = document.getElementById("weeklyRulesContainer");
  container.appendChild(createRuleRow());
});

document.getElementById("saveRulesBtn").addEventListener("click", async () => {
  const item_id = document.getElementById("availabilityItem").value;
  const rows = document.querySelectorAll("#weeklyRulesContainer > div");
  

  if (!item_id || rows.length === 0) {
    return alert("Select an item and add at least one time block");
  }

  const rules = [];

  for (const row of rows) {
    const day = parseInt(row.querySelector(".day").value);
    const start = row.querySelector(".start").value;
    const end = row.querySelector(".end").value;

    if (!start || !end || start >= end) {
      return alert("Invalid time range in one of the blocks");
    }

    rules.push({
      day_of_week: day,
      start_time: normalizeTime(start),
      end_time: normalizeTime(end)
    });
  }

  await fetch("/availability/rules/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item_id,
      rules
    })
  });

  alert("Weekly schedule saved!");
});

// Load existing time blocks when item changes
document.getElementById("availabilityItem").addEventListener("change", async () => {
  const item_id = document.getElementById("availabilityItem").value;

  const res = await fetch(`/availability/rules/${item_id}`);
  const rules = await res.json();

  const container = document.getElementById("weeklyRulesContainer");
  container.innerHTML = "";

  rules.forEach(rule => {
    const row = createRuleRow();

    row.querySelector(".day").value = rule.day_of_week;
    row.querySelector(".start").value = rule.start_time;
    row.querySelector(".end").value = rule.end_time;

    container.appendChild(row);
  });
});

// --- INITIAL LOAD ---
loadTables();