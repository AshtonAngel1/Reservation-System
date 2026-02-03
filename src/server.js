// Import libraries
const express = require("express");
const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const path = require("path");

// Create app
const app = express();

// Parse JSON requests
app.use(express.json());

// --------- FAKE DATABASE FOR SPRINT 1 ---------
let users = [
  {
    email: "testuser@school.edu",
    passwordHash: "$2b$10$8mJycAIvyJaBsx53Cz2b8.nFWH922wbnKgCWbaaiuVwQEUMFTGj8S"
  }
];

let rooms = [
  { id: 1, name: "Study Room A", capacity: 4, location: "1st Floor" },
  { id: 2, name: "Conference Room", capacity: 10, location: "2nd Floor" },
  { id: 3, name: "Recording Studio", capacity: 2, location: "Basement" }
];

let resources = [
  { id: 1, name: "Camera", type: "Media", condition: "Good" },
  { id: 2, name: "Laptop", type: "Computer", condition: "Good" },
  { id: 3, name: "Tripod", type: "Media", condition: "Fair" }
];

let people = [
  { id: 1, name: "Alice", role: "Tutor", availability_notes: "MWF 9-5" },
  { id: 2, name: "Bob", role: "Technician", availability_notes: "TTh 10-4" },
  { id: 3, name: "Charlie", role: "Lab Assistant", availability_notes: "Flexible" }
];

// --------- API ROUTES ---------

// Register
app.post("/register",
  body("email")
    .isEmail().withMessage("Email must be valid")
    .matches(/\.(com|org|edu|gov)$/i).withMessage("Email must end with .com/.org/.edu/.gov"),
  body("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[a-zA-Z]/).withMessage("Password must include a letter")
    .matches(/[0-9]/).withMessage("Password must include a number")
    .matches(/[@$!%*?&]/).withMessage("Password must include a special character (@$!%*?&)"),
  async (req, res) => {
    try {
      console.log("REQ BODY:", req.body);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("VALIDATION ERRORS:", errors.array());
        return res.status(400).json({ errors: errors.array().map(e => e.msg) });
      }

      const { email, password } = req.body;

      if(users.find(u => u.email === email)) {
        return res.status(400).json({ errors: ["User already exists"] });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      users.push({ email, passwordHash });

      return res.status(200).json({ message: "User registered successfully" });
    } catch(err) {
      console.error(err);
      return res.status(500).json({ errors: ["Server error: " + err.message] });
    }
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ message: "Invalid email or password" });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(400).json({ message: "Invalid email or password" });

  res.json({ message: "Login successful" });
});

// Inventory
app.get("/inventory", (req, res) => {
  res.json({
    rooms,
    resources,
    people
  });
});



// Rooms
app.post("/rooms", (req, res) => {
  let { name, capacity, location } = req.body;

  // Trim strings
  name = name?.trim();
  location = location?.trim();

  // Validation
  if (!name || !location) {
    return res.status(400).json({ error: "Name and location are required" });
  }

  if (!Number.isInteger(capacity) || capacity <= 0) {
    return res.status(400).json({ error: "Capacity must be a positive integer" });
  }

  const newRoom = {
    id: rooms.length ? rooms[rooms.length - 1].id + 1 : 1,
    name,
    capacity,
    location
  };

  rooms.push(newRoom);
  res.status(201).json(newRoom);
});
app.delete("/rooms/:id",(req,res)=>{
  rooms = rooms.filter(r=>r.id != req.params.id);
  res.json({message:"Room deleted"});
});

// Resources
app.post("/resources", (req, res) => {
  let { name, type, condition, quantity } = req.body;

  name = name?.trim();
  type = type?.trim();
  condition = condition?.trim();
  quantity = Number(quantity);

  if (!name || !type || !condition) {
    return res.status(400).json({ error: "All fields required" });
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: "Quantity must be positive" });
  }

  db.query(
    "INSERT INTO resources (name, type, status, quantity) VALUES (?, ?, ?, ?)",
    [name, type, condition, quantity],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.status(201).json({ id: result.insertId });
    }
  );
});


app.delete("/resources/:id",(req,res)=>{
  resources = resources.filter(r=>r.id != req.params.id);
  res.json({message:"Resource deleted"});
});

// People
app.post("/people", (req, res) => {
  let { name, role, availability_notes } = req.body;

  name = name?.trim();
  role = role?.trim();
  availability_notes = availability_notes?.trim();

  if (!name || !role || !availability_notes) {
    return res.status(400).json({ error: "All people fields are required" });
  }

  const newPerson = {
    id: people.length ? people[people.length - 1].id + 1 : 1,
    name,
    role,
    availability_notes
  };

  people.push(newPerson);
  res.status(201).json(newPerson);
});

app.delete("/people/:id",(req,res)=>{
  people = people.filter(p=>p.id != req.params.id);
  res.json({message:"Person deleted"});
});

// --------- Serve frontend AFTER API ROUTES ---------
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req,res)=>{
  res.send("Reservation System Backend Running");
});

const PORT = 3000;
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
