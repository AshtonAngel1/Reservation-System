// Import libraries
const db = require('./db');
const express = require("express");
const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const path = require("path");
const userImpl = require('./reservation/userImpl');
const ReservationImpl = require('./reservation/ReservationImpl');

// Session Configuration
const session = require("express-session");

app.use(session({
  secret: "supersecretkey",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Create app
const app = express();

// Parse JSON requests
app.use(express.json());

// --------- API ROUTES ---------

// Register
app.post("/register", async (req, res) => {
  try {    

    const { email, password } = req.body;

    const user = new userImpl(email, password);

    await user.registerUser();

    return res.status(200).json({
      message: "User registered successfully"
    });

  } catch(err) {

    console.error(err);
    return res.status(400).json({ 
      errors: [err.message] 
    });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = new userImpl(email, password);

    const loggedInUser = await user.validateUserLogIn();

    // Set session variables for user:
    req.session.user = loggedInUser;

    return res.json({
      message: "Login successful"
    });

  } catch(err) {
    console.error(err);
    return res.status(400).json({ 
      message: err.message 
    });
  }
});

// Inventory
app.get("/inventory", async (req, res) => {
  try {
    const [rooms] = await db.query("SELECT * FROM rooms");
    const [resources] = await db.query("SELECT * FROM resources");
    const [people] = await db.query("SELECT * FROM people");

    res.json({ rooms, resources, people });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});




// Rooms
app.post("/rooms", async (req, res) => {
  try {
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

    const [result] = await db.query(
      "INSERT INTO rooms (name, capacity, location) VALUES (?, ?, ?)",
      [name, capacity, location]
    );

    res.status(201).json({ id: result.insertId });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }

});
app.delete("/rooms/:id", async (req,res)=>{
  try {
    await db.query("DELETE FROM rooms WHERE id = ?", [req.params.id]);
    res.json({ message: "Room Deleted" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// Resources
app.post("/resources", async (req, res) => {
  try {
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

    const [result] = await db.query(
      "INSERT INTO resources (name, type, status, quantity) VALUES (?, ?, ?, ?)",
      [name, type, condition, quantity]
    );

    res.status(201).json({ id: result.insertId });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});


app.delete("/resources/:id", async (req,res)=>{
  try {
  await db.query("DELETE FROM resources WHERE id = ?", [req.params.id]);
  res.json({ message: "Resource Deleted" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// People
app.post("/people", async (req, res) => {
  try {
    let { name, role, availability_notes } = req.body;

    name = name?.trim();
    role = role?.trim();
    availability_notes = availability_notes?.trim();

    if (!name || !role || !availability_notes) {
      return res.status(400).json({ error: "All people fields are required" });
    }

    const [result] = await db.query(
      "INSERT INTO people (name, role, availability_notes) VALUES (?, ?, ?)",
      [name, role, availability_notes]
    );

    res.status(201).json({ id: result.insertId });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

app.delete("/people/:id", async (req,res)=>{
  try {
    await db.query("DELETE FROM people WHERE id = ?", [req.params.id]);
    res.json({ message: "Person Deleted" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// All Reservations
app.get("/reservations", async (req, res) => {
  try {
    const [reservations] = await db.query(`
      SELECT 
        reservations.id,
        reservations.item_type,
        reservations.item_id,
        users.email AS user_email,
        reservations.start_date,
        reservations.end_date
      FROM reservations
      JOIN users ON reservations.user_id = users.id
      WHERE reservations.end_date >= NOW()
      ORDER BY reservations.start_date ASC
    `);

    res.json(reservations);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

app.post("/reservations", async (req, res) => {
  try {

    if (!req.session.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const reservation = new ReservationImpl(
      req.body.item_type,
      req.body.item_id,
      req.session.user.id,
      req.body.start_date,
      req.body.end_date
    );

    await reservation.validateReservation();
    await reservation.addReservation();

    console.log("Reservation added successfully");
    res.status(201).json({ 
        message: "Reservation created successfully",
    });

  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
});

app.delete("/reservations/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM reservations WHERE id = ?", [req.params.id]); 
    res.json({ message: "Reservation Deleted" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});


// --------- Serve frontend AFTER API ROUTES ---------
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req,res)=>{
  res.send("Reservation System Backend Running");
});

const PORT = 3000;
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
