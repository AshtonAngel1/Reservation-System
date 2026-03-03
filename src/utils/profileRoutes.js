const express = require("express");
const router = express.Router();
const db = require("../db"); 

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

    await db.query(
      "UPDATE users SET bio = ? WHERE id = ?",
      [bio, userId]
    );
    
    res.json({ message: "Bio updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
