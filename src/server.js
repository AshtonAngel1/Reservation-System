// Import libraries
const db = require('./db');
const express = require("express");
const path = require("path");
const userImpl = require('./reservation/userImpl');
const ReservationImpl = require('./reservation/ReservationImpl');

// Create app
const app = express();

// Parse JSON requests
app.use(express.json());

// Session Configuration
const session = require("express-session");

app.use(session({
  secret: "supersecretkey",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "You must be logged in" });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.is_admin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function preventLoggedInAccess(req, res, next) {
  if (req.session.user) {
    return res.redirect("/");
  }
  next();
}

// --------- API ROUTES ---------

app.get("/session", (req, res) => {
  if (!req.session.user) {
    return res.json({ loggedIn: false });
  }

  res.json({
    loggedIn: true,
    is_admin: req.session.user.is_admin,
    email: req.session.user.email
  });
});


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
    return res.status(401).json({ 
      message: err.message 
    });
  }
});

// Inventory
app.get("/inventory", requireAdmin, async (req, res) => {
  try {
    const [items] = await db.query(`
      SELECT i.id, i.name, i.type,
             r.capacity, r.location,
             p.first_name, p.last_name, p.role,
             rs.resource_type
      FROM items i
      LEFT JOIN rooms r ON i.id = r.item_id
      LEFT JOIN people p ON i.id = p.item_id
      LEFT JOIN resources rs ON i.id = rs.item_id
      WHERE i.active = TRUE
    `);
    

    res.json({ items });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});


//DASHBOARD STATS ROUTE
app.get("/dashboard-stats", requireAuth, (req, res) => {

  if (!req.session.user.id) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const userId = req.session.user.id;

  db.query(
    "SELECT COUNT(*) AS total FROM reservations WHERE user_id = ?",
    [userId],
    (err, totalResult) => {
      if (err) return res.status(500).json(err);

      db.query(
        "SELECT COUNT(*) AS upcoming FROM reservations WHERE user_id = ? AND end_date >= NOW()",
        [userId],
        (err, upcomingResult) => {
          if (err) return res.status(500).json(err);

          res.json({
            total: totalResult[0].total,
            upcoming: upcomingResult[0].upcoming
          });
        }
      );
    }
  );
});


app.get("/inventory/available", requireAuth, async (req, res) => {
  try {
    const { type, start, end } = req.query;

    if (!type || !start || !end) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const sql = `
      SELECT i.id, i.name, i.type
      FROM items i
      WHERE i.type = ?
      AND i.active = TRUE
      AND i.id NOT IN (
        SELECT r.item_id
        FROM reservations r
        WHERE r.start_date < ?
        AND r.end_date > ?
      )
    `;

    const [rows] = await db.execute(sql, [type, end, start]);

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// Rooms
app.post("/rooms", requireAdmin, async (req, res) => {
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
      "INSERT INTO items (name, type) VALUES (?, 'room')",
      [name]
    );

    const itemId = result.insertId;

    await db.query(
      "INSERT INTO rooms (item_id, capacity, location) VALUES (?, ?, ?)",
      [itemId, capacity, location]
    );

    res.status(201).json({ id: itemId });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }

});
app.delete("/rooms/:id", requireAdmin, async (req,res)=>{
  try {
    await db.query("DELETE FROM items WHERE id = ?", [req.params.id]);
    res.json({ message: "Room Deleted" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// Resources
app.post("/resources", requireAdmin, async (req, res) => {
  try {
    let { name, resource_type} = req.body;

    name = name?.trim();
    resource_type = resource_type?.trim();

    if (!name || !resource_type) {
      return res.status(400).json({ error: "All fields required" });
    }

    const [result] = await db.query(
      "INSERT INTO items (name, type) VALUES (?, 'resource')",
      [name]
    );

    const itemId = result.insertId;

    await db.query(
      "INSERT INTO resources (item_id, resource_type) VALUES (?, ?)",
      [itemId, resource_type]
    );

    res.status(201).json({ id: itemId });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});


app.delete("/resources/:id", requireAdmin, async (req,res)=>{
  try {
  await db.query("DELETE FROM items WHERE id = ?", [req.params.id]);
  res.json({ message: "Resource Deleted" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// People
app.post("/people", requireAdmin, async (req, res) => {
  try {
    let { first_name, last_name, role } = req.body;

    first_name = first_name?.trim();
    last_name = last_name?.trim();
    role = role?.trim();

    if (!first_name || !last_name || !role) {
      return res.status(400).json({ error: "All people fields are required" });
    }

    const fullName = `${first_name} ${last_name}`;

    const [result] = await db.query(
      "INSERT INTO items (name, type) VALUES (?, 'person')",
      [fullName]
    );

    const itemId = result.insertId;

    await db.query(
      "INSERT INTO people (item_id, first_name, last_name, role) VALUES (?, ?, ?, ?)",
      [itemId, first_name, last_name, role]
    )

    res.status(201).json({ id: itemId });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});

app.delete("/people/:id", requireAdmin, async (req,res)=>{
  try {
    await db.query("DELETE FROM items WHERE id = ?", [req.params.id]);
    res.json({ message: "Person Deleted" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// All Reservations can take out where if want past aswell
app.get("/my-reservations", requireAuth, async (req, res) => {
  try {

    const [reservations] = await db.query(`
      SELECT 
        r.id,
        i.name AS item_name,
        i.type AS item_type,
        r.start_date,
        r.end_date
      FROM reservations r
      JOIN items i ON r.item_id = i.id
      WHERE r.user_id = ?
      ORDER BY r.start_date ASC
    `, [req.session.user.id]);

    res.json(reservations);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});


app.get("/admin/reservations", requireAdmin, async (req, res) => {
  try {

    const [reservations] = await db.query(`
      SELECT 
        r.id,
        i.name AS item_name,
        i.type AS item_type,
        u.email AS user_email,
        r.start_date,
        r.end_date
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN items i ON r.item_id = i.id
      ORDER BY r.start_date ASC
    `);

    res.json(reservations);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});


app.post("/reservations", requireAuth, async (req, res) => {
  try {

    const reservation = new ReservationImpl(
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

app.delete("/reservations/:id", requireAuth, async (req, res) => {
  try {
    
    await db.query("DELETE FROM reservations WHERE id = ? AND user_id = ?", [req.params.id, req.session.user.id]); 
    res.json({ message: "Reservation Deleted" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});


app.delete("/admin/reservations/:id", requireAdmin, async (req, res) => {
  try {
    
    await db.query("DELETE FROM reservations WHERE id = ?", [req.params.id]); 
    res.json({ message: "Reservation Deleted by Admin" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Could not log out" });
    }

    res.clearCookie("connect.sid");
    res.json({ message: "Logout successful" });
  });
});

// Admin page protection route
app.get("/admin/view-reservations", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "../admin_views/view-reservation.html"));
});

app.get("/admin/inventory", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "../admin_views/inventory.html"));
});

app.get("/login", preventLoggedInAccess, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/login.html"));
});

app.get("/reserve", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "../protected/reserve.html"));
});

app.get("/my_reservations_page", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "../protected/userReservations.html"));
});

// --------- Serve frontend AFTER API ROUTES ---------
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req,res)=>{
  res.send("Reservation System Backend Running");
});

const PORT = 3000;
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
