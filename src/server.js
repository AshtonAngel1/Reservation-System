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
      db.query(
        "INSERT INTO users (email, passwordHash) VALUES (?, ?)",
        [email, passwordHash],
        (err, result) => {
          if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
              return res.status(400).json({ 
                errors: ["User already Exists"] 
              });
            }
            return res.status(500).json(err);
          }

          return res.status(200).json({ 
            message: "User registered successfully" 
          });
        }
      );

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
    db.query("SELECT * FROM users WHERE email = ?", 
      [email], 
      async (err, results) => {
        if (err) return res.status(500).json(err);

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
      }
    );

  } catch(err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// Inventory
app.get("/inventory", (req, res) => {
  db.query("SELECT * FROM rooms", (err, rooms) => {
    if (err) return res.status(500).json(err);

    db.query("SELECT * FROM resources", (err, resources) => {
      if (err) return res.status(500).json(err);

      db.query("SELECT * FROM people", (err, people) => {
        if (err) return res.status(500).json(err);
  
        res.json({ rooms, resources, people });
      });
    });
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

  // New DB version:

  db.query(
    "INSERT INTO rooms (name, capacity, location) VALUES (?, ?, ?)",
    [name, capacity, location],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.status(201).json({ id: result.insertId });
    }
  );

});
app.delete("/rooms/:id",(req,res)=>{

  // New DB Delete Version:
  db.query("DELETE FROM rooms WHERE id = ?", 
    [req.params.id], 
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Room Deleted" });
    }
  );
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
  // New DB Delete Version:
  db.query("DELETE FROM resources WHERE id = ?", 
    [req.params.id], 
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Resource Deleted" });
    }
  );
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

  // New DB version:

  db.query(
    "INSERT INTO people (name, role, availability_notes) VALUES (?, ?, ?)",
    [name, role, availability_notes],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.status(201).json({ id: result.insertId });
    }
  );
});

app.delete("/people/:id",(req,res)=>{
  // New DB Delete Version:
  db.query("DELETE FROM people WHERE id = ?", 
    [req.params.id], 
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Person Deleted" });
    }
  );
});

// Reservations
app.get("/reservations", (req, res) => {
  db.query(`
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
  `, 
    (err, reservations) => {
      if (err) return res.status(500).json(err);
      res.json(reservations);
    }
  );
});

app.post("/reservations", (req, res) => {
  const { item_type, item_id, user_email, start_date, end_date } = req.body;

  if (!item_type || !item_id || !user_email || !start_date || !end_date) {
    return res.status(400).json({ error: "All fields required" });
  }

  if (new Date(end_date) <= new Date(start_date)) {
    return res.status(400).json({ error: "End date must be after start date" });
  }

  // New DB version:
  db.query("SELECT * FROM users WHERE email = ?",
    [user_email],
    (err, userResults) => {
      if (err) return res.status(500).json(err);

      if (userResults.length === 0) {
        return res.status(400).json({ error: "User not found" });
      }

      const user_id = userResults[0].id;

      // Check for conflicts:
      db.query(
        "SELECT * FROM reservations WHERE item_type = ? AND item_id = ? AND start_date < ? AND end_date > ?",
        [item_type, item_id, end_date, start_date],
        (err, conflicts) => {
          if (err) return res.status(500).json(err);

          if (conflicts.length > 0) {
            return res.status(400).json({ error: 
              "This Item is already reserved during that time" 
            });
          }
          

          db.query(
            "INSERT INTO reservations (item_type, item_id, user_id, start_date, end_date) VALUES (?, ?, ?, ?, ?)",
            [item_type, item_id, user_id, start_date, end_date],
            (err, result) => {
              if (err) return res.status(500).json(err);
              res.status(201).json({ 
                message: "Reservation created successfully",
                id: result.insertId 
              });
            }
          );
        }
      );
    }
  );
});

app.delete("/reservations/:id", (req, res) => {
  // New DB Delete Version:
  db.query("DELETE FROM reservations WHERE id = ?", 
    [req.params.id], 
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Reservation Deleted" });
    }
  );
});


// --------- Serve frontend AFTER API ROUTES ---------
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req,res)=>{
  res.send("Reservation System Backend Running");
});

const PORT = 3000;
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
