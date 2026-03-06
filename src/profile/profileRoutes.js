const express = require("express");
const router = express.Router();
<<<<<<< HEAD
const db = require("../db");

// Middleware to require authentication
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "You must be logged in" });
  }
  next();
}

// =============================
// GET PROFILE INFO
// GET /profile/data
// =============================
router.get("/data", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [users] = await db.query(
      "SELECT id, email, bio FROM users WHERE id = ?",
      [userId]
    );

    res.json(users[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// UPDATE BIO
// PUT /profile/bio
// =============================
router.put("/bio", requireAuth, async (req, res) => {
  try {
    const { bio } = req.body;
    const userId = req.session.user.id;
=======
const db = require("../db"); // adjust path if your db.js is elsewhere

// Get user profile
router.get("/", async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get user info
    const [userResult] = await db.query(
      "SELECT id, email, bio FROM users WHERE id = ?",
      [userId]
    );
    const user = userResult[0];

    // Get reservations
    const [reservations] = await db.query(
      `SELECT r.id, i.name AS item_name, i.type AS item_type,
              r.start_date, r.end_date
       FROM reservations r
       JOIN items i ON r.item_id = i.id
       WHERE r.user_id = ?
       ORDER BY r.start_date ASC`,
      [userId]
    );

    // Split reservations into past, today, future
    const today = new Date();
    const past = [];
    const todayRes = [];
    const future = [];

    reservations.forEach(r => {
      const start = new Date(r.start_date);
      const end = new Date(r.end_date);
      if (end < today) past.push(r);
      else if (start <= today && end >= today) todayRes.push(r);
      else future.push(r);
    });

    res.json({ user, past, today: todayRes, future });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update bio
router.post("/bio", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { bio } = req.body;
>>>>>>> main

    await db.query(
      "UPDATE users SET bio = ? WHERE id = ?",
      [bio, userId]
    );

    res.json({ message: "Bio updated successfully" });
<<<<<<< HEAD

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// GET PROFILE RESERVATIONS
// GET /profile/reservations
// =============================
router.get("/reservations", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [reservations] = await db.query(`
      SELECT r.*, i.name AS item_name
      FROM reservations r
      JOIN items i ON r.item_id = i.id
      WHERE r.user_id = ?
      ORDER BY r.start_date ASC
    `, [userId]);

    const today = new Date().toISOString().split("T")[0];

    const past = [];
    const current = [];
    const future = [];

    reservations.forEach(r => {
      if (r.end_date < today) {
        past.push(r);
      } else if (r.start_date <= today && r.end_date >= today) {
        current.push(r);
      } else {
        future.push(r);
      }
    });

    res.json({ past, current, future });

  } catch (err) {
    res.status(500).json({ error: err.message });
=======
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
>>>>>>> main
  }
});

module.exports = router;
