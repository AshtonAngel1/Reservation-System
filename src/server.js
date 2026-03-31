// Import libraries
const db = require('./db');
const express = require("express");
const path = require("path");
const userImpl = require('./reservation/userImpl');
const ReservationImpl = require('./reservation/reservationImpl');
//const profileRoutes = require("./profile/profileRoutes");
// Create app
const app = express();

// Use routes
//app.use("/profile", profileRoutes);

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

// Lock HTML pages behind login
function requireLoginPage(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }
  next();
}

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

function requireStaff(req, res, next) {
  if (!req.session.user || !req.session.user.is_staff) {
    return res.status(403).json({ error: "Staff access required" });
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
    is_staff: req.session.user.is_staff,
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
      message: "Login successful",
      is_admin: loggedInUser.is_admin,
      is_staff: loggedInUser.is_staff
    });

  } catch(err) {
    console.error(err);
    return res.status(401).json({ 
      error: err.message 
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
app.get("/dashboard-stats", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [totalResult] = await db.query(
      "SELECT COUNT(*) AS total FROM reservations WHERE user_id = ?",
      [userId]
    );

    const [upcomingResult] = await db.query(
      "SELECT COUNT(*) AS upcoming FROM reservations WHERE user_id = ? AND end_date >= UTC_TIMESTAMP()",
      [userId]
    );

    res.json({
      total: totalResult[0].total,
      upcoming: upcomingResult[0].upcoming
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


app.get("/inventory/available", async (req, res) => { //took out requestAuth
  try {
    const { type, start, end, excludeReservationId } = req.query;

    if (!type) {
      return res.status(400).json({ error: "Missing item type" });
    }

    if (!start || !end) {

      const [rows] = await db.query(`
        SELECT id, name, type
        FROM items
        WHERE type = ?
        AND active = TRUE
      `, [type]);

      return res.json(rows);
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    // enforce single-day (same as validation)
    if (startDate.toDateString() !== endDate.toDateString()) {
      return res.status(400).json({ error: "Must be same-day reservation" });
    }

    // Local Time
    const dayOfWeek = startDate.getDay();
    const startTime = startDate.toTimeString().slice(0, 8);
    const endTime = endDate.toTimeString().slice(0, 8);
    const startDateOnly = startDate.toISOString().slice(0, 10);

    const [rows] = await db.query(`
      SELECT i.id, i.name, i.type
      FROM items i

      JOIN availability_rules ar
        ON ar.item_id = i.id
        AND ar.day_of_week = ?
        AND ar.start_time <= ?
        AND ar.end_time >= ?
        AND COALESCE(ar.valid_from, '1000-01-01') <= ?
        AND COALESCE(ar.valid_until, '9999-12-31') >= ?

      LEFT JOIN availability_exceptions override
        ON override.item_id = i.id
        AND override.is_available = TRUE
        AND override.start_datetime <= ?
        AND override.end_datetime >= ?

      LEFT JOIN availability_exceptions block
        ON block.item_id = i.id
        AND block.is_available = FALSE
        AND block.start_datetime < ?
        AND block.end_datetime > ?

      LEFT JOIN reservations r
        ON r.item_id = i.id
        AND r.start_date < ?
        AND r.end_date > ?
        AND (? IS NULL OR r.id != ?)

      WHERE i.type = ?
      AND i.active = TRUE
      AND (ar.id IS NOT NULL OR override.id IS NOT NULL)
      AND block.id IS NULL
      AND r.id IS NULL

      GROUP BY i.id
    `, [
      dayOfWeek,
      startTime,
      endTime,
      startDateOnly,
      startDateOnly,

      endDate,
      startDate,

      endDate,
      startDate,

      endDate,
      startDate,
      excludeReservationId || null,
      excludeReservationId || null,

      type
    ]);

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


//Availability Route

const availabilityRoutes = require('./reservation/availabilityRoutes');
const reservationUtils = require('./utils/reservationUtils');
app.use('/availability', requireAuth, availabilityRoutes)

// Deprecated
app.post("/availability-slots", requireAdmin, async (req, res) => {
  try {
    const { item_id, start_time, end_time } = req.body;

    if (!item_id || !start_time || !end_time) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (new Date(start_time) >= new Date(end_time)) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    const startIso = reservationUtils.toMySQLDatetime(start_time);
    const endIso = reservationUtils.toMySQLDatetime(end_time);

    await db.query(
      `INSERT INTO availability_slots (item_id, start_time, end_time)
       VALUES (?, ?, ?)`,
      [item_id, startIso, endIso]
    );

    res.status(201).json({ message: "Availability slot created" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error: " + err.message });
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
    let { first_name, last_name, role, user_id } = req.body;

    first_name = first_name?.trim();
    last_name = last_name?.trim();
    role = role?.trim();

    if (!first_name || !last_name || !role || !user_id) {
      return res.status(400).json({ error: "All people fields are required" });
    }

    const fullName = `${first_name} ${last_name}`;

    const [result] = await db.query(
      "INSERT INTO items (name, type) VALUES (?, 'person')",
      [fullName]
    );

    const itemId = result.insertId;

    await db.query(
      "INSERT INTO people (item_id, first_name, last_name, role, user_id) VALUES (?, ?, ?, ?, ?)",
      [itemId, first_name, last_name, role, user_id || null]
    )

    res.json({ message: "Person added" });

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

//PROFILE API ROUTES

// Get profile information
app.get("/api/profile", requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
         u.id,
         u.email,
         up.bio,
         up.profile_picture
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = ?`,
      [req.session.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = rows[0];
    user.bio = user.bio || "";
    user.profile_picture = user.profile_picture || "/components/profile-pic.png";

    res.json(user);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update biography
app.put("/api/profile/bio", requireAuth, async (req, res) => {
  try {
    const { bio } = req.body;

    await db.query(
      `INSERT INTO user_profiles (user_id, bio)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE bio = VALUES(bio)`,
      [req.session.user.id, bio || ""]
    );

    res.json({ message: "Biography updated successfully." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update profile picture (URL)
app.put("/api/profile/picture", requireAuth, async (req, res) => {
  try {
    const { profile_picture } = req.body;

    if (!profile_picture || !profile_picture.trim()) {
      return res.status(400).json({ error: "Profile picture URL is required" });
    }

    await db.query(
      `INSERT INTO user_profiles (user_id, profile_picture)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE profile_picture = VALUES(profile_picture)`,
      [req.session.user.id, profile_picture.trim()]
    );

    res.json({ message: "Profile picture updated successfully." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get reservations for profile page
app.get("/api/profile/reservations", requireAuth, async (req, res) => {
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
    res.status(500).json({ error: "Server error" });
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
        r.item_id,
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

//ADMIN VIEW ALL USERS
// Can add active reservations to the query if needed
app.get("/admin/users", requireAdmin, async (req, res) => {
  try {

    const [users] = await db.query(`
      SELECT 
        u.id,
        u.email,
        DATEDIFF(NOW(), u.created_at) AS days_registered,

        COUNT(r.id) AS total_reservations,

        SUM(CASE WHEN r.end_date < UTC_TIMESTAMP() THEN 1 ELSE 0 END) AS past_reservations,

        SUM(CASE WHEN r.start_date > UTC_TIMESTAMP() THEN 1 ELSE 0 END) AS upcoming_reservations

      FROM users u
      LEFT JOIN reservations r ON u.id = r.user_id
      GROUP BY u.id
      ORDER BY u.id ASC
    `);

    res.json(users);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Make Reservation Route
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

//Get reservation Route
app.get("/reservations/:id", requireAuth, async (req, res) => {
  try {
    const reservationId = req.params.id;
    const userId = req.session.user.id;

    const [reservations] = await db.query(`
      SELECT r.id, r.item_id, r.start_date, r.end_date, i.name AS item_name, i.type AS item_type
      FROM reservations r
      JOIN items i ON r.item_id = i.id
      WHERE r.id = ? AND r.user_id = ?
    `, [reservationId, userId]);

    if (reservations.length === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    res.json(reservations[0]);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

//Edit Reservation route
app.put("/reservations/:id", requireAuth, async (req, res) => {
  try {
    const reservationId = req.params.id;
    const userId = req.session.user.id;

    // Verify reservation belongs to user
    const [existing] = await db.query(
      "SELECT * FROM reservations WHERE id = ? AND user_id = ?",
      [reservationId, userId]
    );

    if (existing.length === 0) {
      return res.status(403).json({ error: "Not authorized to edit this reservation" });
    }

    const now = new Date();
    now.setSeconds(0, 0);
    const startTime = new Date(existing[0].start_date);

    if (startTime < now) {
      return res.status(400).json({ error: "Cannot edit past reservations" });
    }

    const reservation = new ReservationImpl(
      req.body.item_id,
      userId,
      req.body.start_date,
      req.body.end_date
    );

    // IMPORTANT: set id so conflict check can exclude itself
    reservation.id = reservationId;

    // reuse validation pipeline
    await reservation.validateReservation();

    const startIso = reservationUtils.toMySQLDatetime(reservation.start_date);
    const endIso = reservationUtils.toMySQLDatetime(reservation.end_date);

    await db.query(
      `UPDATE reservations
       SET item_id = ?, start_date = ?, end_date = ?
       WHERE id = ?`,
      [reservation.item_id, startIso, endIso, reservationId]
    );

    res.json({ message: "Reservation updated successfully" });

  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
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


// Staff Routes
app.get("/staff/items", requireStaff, async (req, res) => {
  const [rows] = await db.query(`
    SELECT i.id, i.name, i.type
    FROM items i
    JOIN people p ON p.item_id = i.id
    WHERE p.user_id = ?
      AND i.active = TRUE
  `, [req.session.user.id]);
  res.json(rows);
});

// Get all availability (for staff dashboard)
app.get("/staff/availability-rules", requireStaff, async (req, res) => {
  const [rows] = await db.query(`
    SELECT 
      ar.*,
      i.name AS item_name
    FROM availability_rules ar
    JOIN items i ON ar.item_id = i.id
    JOIN people p ON p.item_id = i.id
    WHERE p.user_id = ?
  `, [req.session.user.id]);
  res.json(rows);
});


// Create availability
app.post("/staff/availability-rules", requireStaff, async (req, res) => {
  const { item_id, day_of_week, start_time, end_time } = req.body;

  const [rows] = await db.query(`
    SELECT 1 FROM people
    WHERE item_id = ? AND user_id = ?
  `, [item_id, req.session.user.id]);


  if (rows.length === 0) {
    return res.status(403).json({ error: "Unauthorized item" });
  }

  await db.query(`
    INSERT INTO availability_rules
    (item_id, day_of_week, start_time, end_time)
    VALUES (?, ?, ?, ?)
  `, [item_id, day_of_week, start_time, end_time]);

  res.json({ message: "Availability slot created" });
});

// Delete availability
app.delete("/staff/availability-rules/:id", requireStaff, async (req, res) => {
  await db.query(`
    DELETE ar FROM availability_rules ar
    JOIN people p ON ar.item_id = p.item_id
    WHERE ar.id = ? AND p.user_id = ?
  `, [req.params.id, req.session.user.id]);

  res.json({ message: "Deleted" });
});


app.get("/staff/upcoming-reservations", requireStaff, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        r.id,
        i.name AS item_name,
        u.email AS user_email,
        r.start_date,
        r.end_date
      FROM reservations r
      JOIN items i ON r.item_id = i.id
      JOIN users u ON r.user_id = u.id
      JOIN people p ON p.item_id = i.id
      WHERE p.user_id = ?
        AND r.start_date >= UTC_TIMESTAMP()
      ORDER BY r.start_date ASC
    `, [req.session.user.id]);

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


app.get('/admin/staff-users', requireAdmin, async (req, res) => {
  const [rows] = await db.query(`
    SELECT id, email FROM users WHERE is_staff = 1
  `);
  res.json(rows);
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

app.get("/admin/users-page", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "../admin_views/view-users.html"));
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

app.get("/profile", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "../protected/profile.html"));
});

app.get("/dashboard", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "../protected/dashboard.html"));
});

app.get("/edit-reservation", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "../protected/edit-reservation.html"));
});

app.get("/staff", requireStaff, (req, res) => {
  res.sendFile(path.join(__dirname, "../protected/staff.html"));
});

// --------- Serve frontend AFTER API ROUTES ---------

// Serve frontend AFTER
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req,res)=>{
  res.send("Reservation System Backend Running");
});

const PORT = 3000;
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
