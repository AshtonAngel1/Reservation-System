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
      tr.innerHTML = `<td>${r.id}</td><td>${r.name}</td><td>${r.type}</td><td>${r.condition}</td>`;
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
  document.getElementById("addRoomBtn").addEventListener("click", async ()=>{
    const name = document.getElementById("roomName").value;
    const capacity = document.getElementById("roomCapacity").value;
    const location = document.getElementById("roomLocation").value;
    if(!name || !capacity || !location) return alert("Fill all fields");
    const id = Math.floor(Math.random()*10000); // simple id
    await fetch("/rooms", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({id,name,capacity,location}) });
    loadTables();
  });
  
  document.getElementById("addResourceBtn").addEventListener("click", async ()=>{
    const name = document.getElementById("resourceName").value;
    const type = document.getElementById("resourceType").value;
    const condition = document.getElementById("resourceCondition").value;
    if(!name || !type || !condition) return alert("Fill all fields");
    const id = Math.floor(Math.random()*10000);
    await fetch("/resources", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({id,name,type,condition}) });
    loadTables();
  });
  
  document.getElementById("addPersonBtn").addEventListener("click", async ()=>{
    const name = document.getElementById("personName").value;
    const role = document.getElementById("personRole").value;
    const availability_notes = document.getElementById("personAvailability").value;
    if(!name || !role || !availability_notes) return alert("Fill all fields");
    const id = Math.floor(Math.random()*10000);
    await fetch("/people", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({id,name,role,availability_notes}) });
    loadTables();
  });
  
  // --- INITIAL LOAD ---
  loadTables();
  