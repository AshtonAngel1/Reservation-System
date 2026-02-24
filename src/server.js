// Import libraries
const db = require('./db');
const express = require("express");
const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const path = require("path");

// Create app
const app = express();

// Parse JSON requests
app.use(express.json());

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
        return res.status(400).json({ 
          errors: errors.array().map(e => e.msg) 
        });
      }

      const { email, password } = req.body;

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Insert into DB, mysql checks duplicates
      try {
        const result = await db.query(
          "INSERT INTO users (email, passwordHash) VALUES (?, ?)",
          [email, passwordHash]
        );

        return res.status(200).json({
          message: "User registered successfully"
        });

      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ 
                errors: ["User already Exists"] 
              });
        }
        return res.status(500).json(err);
      }

    } catch(err) {
      console.error(err);
      return res.status(500).json({ errors: ["Server error: " + err.message] });
    }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        message: "Email and password are required" }
      );
    }

    // Get User from DB:
    const [results] = await db.query("SELECT * FROM users WHERE email = ?", 
      [email]
    );

    // Check if User Exists
    if (results.length === 0) {
      return res.status(400).json({ 
        message: "Invalid email or password" 
      });
    }

    const user = results[0];

    // Compare password
    const match = await bcrypt.compare(password, user.passwordHash);

    if (!match) {
      return res.status(400).json({
        message: "Invalid email or password"
      });
    }

    // Successful login
    return res.json({
      message: "Login successful"
    });

  } catch(err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
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

// Reservations
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
    const { item_type, item_id, user_email, start_date, end_date } = req.body;

    if (!item_type || !item_id || !user_email || !start_date || !end_date) {
      return res.status(400).json({ error: "All fields required" });
    }

    if (new Date(end_date) <= new Date(start_date)) {
      return res.status(400).json({ error: "End date must be after start date" });
    }

    // Get User ID from email:
    const [userResults] = await db.query("SELECT * FROM users WHERE email = ?", 
      [user_email]
    );

    if (userResults.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const user_id = userResults[0].id;

    // Check for conflicts:
    const [conflicts] = await db.query(
      "SELECT * FROM reservations WHERE item_type = ? AND item_id = ? AND start_date < ? AND end_date > ?",
      [item_type, item_id, end_date, start_date]
    );

    if (conflicts.length > 0) {
      return res.status(400).json({ error: 
        "This Item is already reserved during that time" 
      });
    }
          
    // Insert reservation:
    const [result] = await db.query(
      "INSERT INTO reservations (item_type, item_id, user_id, start_date, end_date) VALUES (?, ?, ?, ?, ?)",
      [item_type, item_id, user_id, start_date, end_date]
    );

    res.status(201).json({ 
      message: "Reservation created successfully",
      id: result.insertId 
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
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
