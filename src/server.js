// Import libraries
const db = require('./db');
const express = require("express");
const path = require("path");
const userImpl = require('./reservation/userImpl');
const ReservationImpl = require('./reservation/reservationImpl');
const {
  startNotificationScheduler,
  notifyStaffOfNewReservation,
  notifyReservationCancellation
} = require('./notificationService');

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

//Ics Routes (maybe change)
const icsRoutes = require("./ics/icsRoutes");
app.use("/", icsRoutes);
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

// Inventory (allow deactivated items)
app.get("/inventory", requireAdmin, async (req, res) => {
  try {
    const [items] = await db.query(`
      SELECT i.id,
             i.name,
             i.type,
             i.active,
             r.capacity,
             r.location,
             p.first_name,
             p.last_name,
             p.role,
             rs.resource_type
      FROM items i
      LEFT JOIN rooms r ON i.id = r.item_id
      LEFT JOIN people p ON i.id = p.item_id
      LEFT JOIN resources rs ON i.id = rs.item_id
      ORDER BY i.type, i.name
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
      "SELECT COUNT(*) AS upcoming FROM reservations WHERE user_id = ? AND end_date >= UTC_TIMESTAMP() AND status = 'active'",
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

    function datetimeLocalToUTC(datetimeLocal) {
      const local = new Date(datetimeLocal);
      return new Date(local.getTime() - local.getTimezoneOffset() * 60000);
    }

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

    const startLocal = new Date(start);
    const endLocal = new Date(end);

    if (isNaN(startLocal) || isNaN(endLocal)) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    // SAME-DAY CHECK IN LOCAL TIME (what the user expects)
    const sameDay =
      startLocal.getFullYear() === endLocal.getFullYear() &&
      startLocal.getMonth() === endLocal.getMonth() &&
      startLocal.getDate() === endLocal.getDate();

    if (!sameDay) {
      return res.status(400).json({ error: "Must be same-day reservation" });
    }

    // Convert to UTC for DB comparisons
    const startUTC = datetimeLocalToUTC(start);
    const endUTC = datetimeLocalToUTC(end);

    function toMySQL(datetime) {
      return datetime.toISOString().slice(0, 19).replace("T", " ");
    }

    const startUTCStr = toMySQL(startUTC);
    const endUTCStr = toMySQL(endUTC);

    const dayOfWeek = startLocal.getDay(); // use LOCAL day for availability rules

    const startTime = startLocal.toTimeString().slice(0, 8);
    const endTime = endLocal.toTimeString().slice(0, 8);

    const startDateOnly = startUTC.toISOString().slice(0, 10);

    // console.log("LOCAL:", startLocal, endLocal);
    // console.log("UTC:", startUTC, endUTC);

    const [rows] = await db.query(`
      SELECT i.id, i.name, i.type
      FROM items i

      LEFT JOIN availability_rules ar
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
        AND r.status = 'active'

      WHERE i.type = ?
      AND i.active = TRUE
      AND (
        override.id IS NOT NULL
        OR (
          ar.id IS NOT NULL
          AND override.id IS NULL
        )
      )
      AND block.id IS NULL
      AND r.id IS NULL

      GROUP BY i.id
    `, [
      dayOfWeek,
      startTime,
      endTime,
      startDateOnly,
      startDateOnly,

      startUTCStr,
      endUTCStr,

      startUTCStr,
      endUTCStr,

      startUTCStr,
      endUTCStr,
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

const searchRoute = require('./search/searchRoutes')
app.use('/search', searchRoute)


//Availability Route

const availabilityRoutes = require('./reservation/availabilityRoutes');
const reservationUtils = require('./utils/reservationUtils');
app.use('/availability', requireAuth, availabilityRoutes)

// Helpers for soft delete and restore of items and users

async function softDeleteItem(id) {
  await ensureNoFutureReservations(id);

  await db.query(
    `UPDATE items 
     SET active = FALSE, deleted_at = UTC_TIMESTAMP()
     WHERE id = ?`,
    [id]
  );
}

async function restoreItem(id) {
  await db.query(
    `UPDATE items
     SET active = TRUE,
         deleted_at = NULL
     WHERE id = ?`,
    [id]
  );
}

async function ensureNoFutureReservations(itemId) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM reservations
     WHERE item_id = ?
       AND end_date > UTC_TIMESTAMP()
       AND (status IS NULL OR status != 'canceled')`,
    [itemId]
  );

  if (rows[0].count > 0) {
    throw new Error("Cannot deactivate item with upcoming reservations.");
  }
}

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
    await softDeleteItem(req.params.id);
    res.json({ message: "Room soft deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
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
    await softDeleteItem(req.params.id);
    res.json({ message: "Resource soft deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
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
    await softDeleteItem(req.params.id);
    res.json({ message: "Person soft deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// Delete and Restore routes
// app.delete("/inventory/:id", requireAdmin, async (req, res) => {
//   try {
//     await softDeleteItem(req.params.id);
//     res.json({ message: "Item deactivated" });
//   } catch (err) {
//     console.error(err);
//     res.status(400).json({ message: err.message });
//   }
// });

// app.post("/inventory/:id/restore", requireAdmin, async (req, res) => {
//   try {
//     await restoreItem(req.params.id);
//     res.json({ message: "Item restored" });
//   } catch (err) {
//     console.error(err);
//     res.status(400).json({ message: err.message });
//   }
// });

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
        r.end_date,
        r.status,
        rv.rating AS my_rating,
        rv.comment AS my_rating_comment
      FROM reservations r
      JOIN items i ON r.item_id = i.id
      LEFT JOIN reviews rv
        ON rv.reservation_id = r.id
       AND rv.reviewer_user_id = r.user_id
      WHERE r.user_id = ?
        AND r.status = 'active'
      ORDER BY r.start_date ASC
    `, [req.session.user.id]);

    res.json(reservations);

  } catch (err) {
    console.error(err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Reviews table is not available yet.' });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// Get pending two-way review tasks for current user
async function getReviewTasksForUser(userId) {
  const [rows] = await db.query(
    `SELECT
      r.id AS reservation_id,
      r.user_id AS student_user_id,
      i.name AS item_name,
      p.user_id AS tutor_user_id,
      tutor.email AS tutor_email,
      student.email AS student_email
    FROM reservations r
    JOIN items i ON i.id = r.item_id
    LEFT JOIN people p ON p.item_id = i.id
    LEFT JOIN users tutor ON tutor.id = p.user_id
    LEFT JOIN users student ON student.id = r.user_id
    WHERE r.end_date <= UTC_TIMESTAMP()
      AND r.status = 'active'
      AND (
        r.user_id = ?
        OR p.user_id = ?
      )
      AND (
        (r.user_id = ? AND p.user_id IS NOT NULL)
        OR p.user_id = ?
      )
      AND NOT EXISTS (
        SELECT 1
        FROM reviews rv
        WHERE rv.reservation_id = r.id
          AND rv.reviewer_user_id = ?
      )`,
    [userId, userId, userId, userId, userId]
  );

  return rows
    .map((row) => {
      if (row.student_user_id === userId && row.tutor_user_id) {
        return {
          reservation_id: row.reservation_id,
          review_target_user_id: row.tutor_user_id,
          review_target_email: row.tutor_email,
          direction_label: 'Review your tutor',
          item_name: row.item_name,
        };
      }

      if (row.tutor_user_id === userId) {
        return {
          reservation_id: row.reservation_id,
          review_target_user_id: row.student_user_id,
          review_target_email: row.student_email,
          direction_label: 'Review your student',
          item_name: row.item_name,
        };
      }

      return null;
    })
    .filter((task) => task);
}

// Get reviews received by the current user
app.get('/api/reviews/received', requireAuth, async (req, res) => {
  try {
    const [received] = await db.query(
      `SELECT
        rv.id,
        rv.reservation_id,
        rv.reviewer_user_id,
        rv.review_target_user_id,
        rv.rating,
        rv.comment,
        rv.created_at,
        reviewer.email AS reviewer_email
      FROM reviews rv
      JOIN users reviewer ON reviewer.id = rv.reviewer_user_id
      WHERE rv.review_target_user_id = ?
      ORDER BY rv.created_at DESC`,
      [req.session.user.id]
    );

    res.json(received);
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Reviews table is not available yet.' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/reviews/pending', requireAuth, async (req, res) => {
  try {
    const tasks = await getReviewTasksForUser(req.session.user.id);
    res.json(tasks);
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Reviews table is not available yet.' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a review
app.post('/api/reviews', requireAuth, async (req, res) => {
  try {
    const { reservation_id, review_target_user_id, rating, comment } = req.body;

    if (!reservation_id || !review_target_user_id) {
      return res.status(400).json({ error: 'reservation_id and review_target_user_id are required' });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    const allowedTasks = await getReviewTasksForUser(req.session.user.id);
    const isAllowed = allowedTasks.some(
      (task) => task.reservation_id === Number(reservation_id) && task.review_target_user_id === Number(review_target_user_id)
    );

    if (!isAllowed) {
      return res.status(403).json({ error: 'You are not allowed to review this user for this reservation' });
    }

    await db.query(
      `INSERT INTO reviews (
        reservation_id,
        reviewer_user_id,
        review_target_user_id,
        rating,
        comment,
        created_at
      ) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [
        Number(reservation_id),
        req.session.user.id,
        Number(review_target_user_id),
        rating,
        comment || ''
      ]
    );

    res.status(201).json({ message: 'Review created' });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'You already submitted a review for this reservation' });
    }
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Reviews table is not available yet.' });
    }
    res.status(500).json({ error: 'Server error' });
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
      AND r.status = 'active'
      ORDER BY r.start_date ASC
    `, [req.session.user.id]);

    res.json(reservations);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// Admin view all reservations will need to be Updated
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
      WHERE u.active = TRUE
        AND r.status = 'active'

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
      WHERE u.active = TRUE
      GROUP BY u.id
      ORDER BY u.id ASC
    `);

    res.json(users);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


//Get all deleted users for admin view
app.get("/admin/users/deleted", requireAdmin, async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT 
        u.id,
        u.email,
        DATEDIFF(NOW(), u.created_at) AS days_registered,

        COUNT(r.id) AS total_reservations,

        SUM(CASE WHEN r.end_date < UTC_TIMESTAMP() THEN 1 ELSE 0 END) AS past_reservations,

        SUM(CASE WHEN r.start_date > UTC_TIMESTAMP() THEN 1 ELSE 0 END) AS upcoming_reservations,

        u.deleted_at

      FROM users u
      LEFT JOIN reservations r ON u.id = r.user_id
      WHERE u.active = FALSE
      GROUP BY u.id
      ORDER BY u.deleted_at DESC
    `);

    res.json(users);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    await db.query(
      `UPDATE users 
       SET active = FALSE, deleted_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [req.params.id]
    );

    res.json({ message: "User soft deleted" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Implement Restore user route
app.patch("/admin/users/:id/restore", requireAdmin, async (req, res) => {
  await db.query(
    `UPDATE users SET active = TRUE, deleted_at = NULL WHERE id = ?`,
    [req.params.id]
  );
  res.json({ message: "User restored" });
});

app.get("/admin/analytics", requireAdmin, async (req, res) => {
  try {
    const [registeredUsersResult] = await db.query(`
      SELECT COUNT(*) AS count FROM users WHERE active = TRUE
    `);

    const [allReservationsResult] = await db.query(`
      SELECT COUNT(*) AS count FROM reservations
    `);

    const [reservationsThisMonthResult] = await db.query(`
      SELECT COUNT(*) AS count
      FROM reservations r
      WHERE r.status = 'active'
        AND YEAR(r.start_date) = YEAR(UTC_TIMESTAMP())
        AND MONTH(r.start_date) = MONTH(UTC_TIMESTAMP())
    `);

    const [uniqueUsersThisMonthResult] = await db.query(`
      SELECT COUNT(DISTINCT r.user_id) AS count
      FROM reservations r
      WHERE r.status = 'active'
        AND YEAR(r.start_date) = YEAR(UTC_TIMESTAMP())
        AND MONTH(r.start_date) = MONTH(UTC_TIMESTAMP())
    `);

    const [topItems] = await db.query(`
      SELECT i.name, COUNT(*) AS total
      FROM reservations r
      JOIN items i ON i.id = r.item_id
      WHERE r.status = 'active'
        AND YEAR(r.start_date) = YEAR(UTC_TIMESTAMP())
        AND MONTH(r.start_date) = MONTH(UTC_TIMESTAMP())
      GROUP BY i.id, i.name
      ORDER BY total DESC
      LIMIT 3
    `);

    const [topStaff] = await db.query(`
      SELECT CONCAT(p.first_name, ' ', p.last_name) AS staff_name, COUNT(*) AS total
      FROM reservations r
      JOIN people p ON p.item_id = r.item_id
      WHERE r.status = 'active'
        AND YEAR(r.start_date) = YEAR(UTC_TIMESTAMP())
        AND MONTH(r.start_date) = MONTH(UTC_TIMESTAMP())
      GROUP BY p.item_id, p.first_name, p.last_name
      ORDER BY total DESC
      LIMIT 3
    `);

    const [topUsers] = await db.query(`
      SELECT u.email, COUNT(*) AS total
      FROM reservations r
      JOIN users u ON u.id = r.user_id
      WHERE r.status = 'active'
        AND YEAR(r.start_date) = YEAR(UTC_TIMESTAMP())
        AND MONTH(r.start_date) = MONTH(UTC_TIMESTAMP())
      GROUP BY u.id, u.email
      ORDER BY total DESC
      LIMIT 3
    `);

    const [totalCancellationsResult] = await db.query(`
      SELECT COUNT(*) AS count
      FROM reservations
      WHERE status = 'canceled'
    `);

    const [monthlyCancellationsResult] = await db.query(`
      SELECT COUNT(*) AS count
      FROM reservations
      WHERE status = 'canceled'
        AND deleted_at IS NOT NULL
        AND YEAR(deleted_at) = YEAR(UTC_TIMESTAMP())
        AND MONTH(deleted_at) = MONTH(UTC_TIMESTAMP())
    `);

    const [cancellationsByCategory] = await db.query(`
      SELECT 
        cancel_category AS category,
        COUNT(*) AS total
      FROM reservations
      WHERE status = 'canceled'
        AND deleted_at IS NOT NULL
        AND YEAR(deleted_at) = YEAR(UTC_TIMESTAMP())
        AND MONTH(deleted_at) = MONTH(UTC_TIMESTAMP())
      GROUP BY cancel_category
    `);

        let allTimeAverageRating = null;
    let monthlyAverageRating = null;
    let highestScoringReservationThisMonth = null;
    let lowestScoringReservationThisMonth = null;

    try {
      const [allTimeRatingResult] = await db.query(`
        SELECT ROUND(AVG(rv.rating), 2) AS avg_rating
        FROM reviews rv
      `);

      const [monthlyRatingResult] = await db.query(`
        SELECT ROUND(AVG(rv.rating), 2) AS avg_rating
        FROM reviews rv
        WHERE YEAR(rv.created_at) = YEAR(UTC_TIMESTAMP())
          AND MONTH(rv.created_at) = MONTH(UTC_TIMESTAMP())
      `);

      const [highestMonthlyReservation] = await db.query(`
        SELECT
          rv.reservation_id,
          ROUND(AVG(rv.rating), 2) AS average_rating,
          i.name AS item_name,
          u.email AS student_email
        FROM reviews rv
        JOIN reservations r ON r.id = rv.reservation_id
        JOIN items i ON i.id = r.item_id
        JOIN users u ON u.id = r.user_id
        WHERE YEAR(rv.created_at) = YEAR(UTC_TIMESTAMP())
          AND MONTH(rv.created_at) = MONTH(UTC_TIMESTAMP())
        GROUP BY rv.reservation_id, i.name, u.email
        ORDER BY average_rating DESC, rv.reservation_id ASC
        LIMIT 1
      `);

      const [lowestMonthlyReservation] = await db.query(`
        SELECT
          rv.reservation_id,
          ROUND(AVG(rv.rating), 2) AS average_rating,
          i.name AS item_name,
          u.email AS student_email
        FROM reviews rv
        JOIN reservations r ON r.id = rv.reservation_id
        JOIN items i ON i.id = r.item_id
        JOIN users u ON u.id = r.user_id
        WHERE YEAR(rv.created_at) = YEAR(UTC_TIMESTAMP())
          AND MONTH(rv.created_at) = MONTH(UTC_TIMESTAMP())
        GROUP BY rv.reservation_id, i.name, u.email
        ORDER BY average_rating ASC, rv.reservation_id ASC
        LIMIT 1
      `);

      allTimeAverageRating = allTimeRatingResult[0]?.avg_rating;
      monthlyAverageRating = monthlyRatingResult[0]?.avg_rating;
      highestScoringReservationThisMonth = highestMonthlyReservation[0] || null;
      lowestScoringReservationThisMonth = lowestMonthlyReservation[0] || null;
    } catch (reviewErr) {
      if (reviewErr.code !== 'ER_NO_SUCH_TABLE') {
        throw reviewErr;
      }
    }

    res.json({
      all_time_registered_users: registeredUsersResult[0].count,
      all_time_reservations: allReservationsResult[0].count,
      reservations_this_month: reservationsThisMonthResult[0].count,
      unique_users_this_month: uniqueUsersThisMonthResult[0].count,
      top_three_requested_items_this_month: topItems,
      top_three_staff_this_month: topStaff,
      top_three_users_this_month: topUsers,
      total_cancellations: totalCancellationsResult[0].count,
      cancellations_this_month: monthlyCancellationsResult[0].count,
      cancellations_this_month_by_category: cancellationsByCategory,
      all_time_average_rating: allTimeAverageRating,
      monthly_average_rating: monthlyAverageRating,
      highest_scoring_reservation_this_month: highestScoringReservationThisMonth,
      lowest_scoring_reservation_this_month: lowestScoringReservationThisMonth
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/admin/cancellations", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        r.id,
        i.name AS item_name,
        u.email AS user_email,
        r.start_date,
        r.end_date,
        r.cancel_reason,
        r.cancel_category,
        r.deleted_at
      FROM reservations r
      JOIN users u ON u.id = r.user_id
      JOIN items i ON i.id = r.item_id
      WHERE r.status = 'canceled'
      ORDER BY COALESCE(r.deleted_at, r.end_date) DESC
    `);

    res.json(rows);
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
    const newId = await reservation.addReservation();

    console.log("Reservation added successfully");

    notifyStaffOfNewReservation(newId).catch(err =>
      console.error('[Notifications] Staff alert failed:', err.message)
    );

    res.status(201).json({message: "Reservation created successfully"});


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
      WHERE r.id = ? AND r.user_id = ? AND r.status = 'active'
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

    notifyStaffOfNewReservation(reservationId).catch(err =>
      console.error('[Notifications] Staff alert on edit failed:', err.message)
    );

    res.json({ message: "Reservation updated successfully" });

  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

app.delete("/reservations/:id", requireAuth, async (req, res) => {
  try {
    await cancelReservationWithAudit({
      reservationId: req.params.id,
      canceledByUserId: req.session.user.id,
      reason: "Canceled by user",
      category: "user"
    });

    res.json({ message: "Reservation canceled" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

async function cancelReservationWithAudit({ reservationId, canceledByUserId, reason, category }) {
  await db.query(
    `UPDATE reservations
     SET status = 'canceled',
         deleted_at = UTC_TIMESTAMP(),
         canceled_by = ?,
         cancel_reason = ?,
         cancel_category = ?
     WHERE id = ?`,
    [canceledByUserId, reason, category, reservationId]
  );
}

// Admin cancellation route with reason (can delete past reservations)
app.post("/admin/reservations/:id/cancel", requireAdmin, async (req, res) => {
  try {
    const reservationId = req.params.id;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "Reason is required for admin cancellation" });
    }

    const [rows] = await db.query(
      `SELECT id, start_date
       FROM reservations
       WHERE id = ?
         AND status = 'active'
         `,
      [reservationId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Only current/future reservations can be canceled" });
    }

    await cancelReservationWithAudit({
      reservationId,
      canceledByUserId: req.session.user.id,
      reason: reason.trim(),
      category: "admin"
    });

    notifyReservationCancellation(reservationId, reason.trim(), "admin").catch(err =>
      console.error("[Notifications] Cancellation alert failed:", err.message)
    );

    res.json({ message: "Reservation canceled by admin" });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
});

app.post("/staff/reservations/:id/cancel", requireStaff, async (req, res) => {
  try {
    const reservationId = req.params.id;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "Reason is required for staff cancellation" });
    }

    const [rows] = await db.query(
      `SELECT r.id
       FROM reservations r
       JOIN items i ON r.item_id = i.id
       JOIN people p ON p.item_id = i.id
       WHERE r.id = ?
         AND p.user_id = ?
         AND r.status = 'active'
         AND r.end_date >= UTC_TIMESTAMP()`,
      [reservationId, req.session.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Reservation not found for this staff member or already past" });
    }

    await cancelReservationWithAudit({
      reservationId,
      canceledByUserId: req.session.user.id,
      reason: reason.trim(),
      category: "staff"
    });

    notifyReservationCancellation(reservationId, reason.trim(), "staff").catch(err =>
      console.error("[Notifications] Cancellation alert failed:", err.message)
    );

    res.json({ message: "Reservation canceled by staff" });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
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
        AND u.active = TRUE
        AND r.status = 'active'
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
    SELECT id, email FROM users WHERE is_staff = 1 AND active = TRUE
  `);
  res.json(rows);
});


app.delete("/admin/reservations/:id", requireAdmin, async (req, res) => {
  try {
    
        const reason = (req.body?.reason || "Canceled by admin").trim();
    await cancelReservationWithAudit({
      reservationId: req.params.id,
      canceledByUserId: req.session.user.id,
      reason,
      category: "admin"
    });
    notifyReservationCancellation(req.params.id, reason, "admin").catch(err =>
      console.error("[Notifications] Cancellation alert failed:", err.message)
    );
    res.json({ message: "Reservation canceled by admin" });

  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: "Server error: " + err.message });
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

app.get("/admin", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "../admin_views/admin.html"));
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

startNotificationScheduler();
const PORT = 3000;
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
