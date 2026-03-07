const express = require("express");
const router = express.Router();
const db = require("../db");

// middleware --> ensure user is logged in
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

// get user profile
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // get user info + profile
    const [userResult] = await db.query(
      `SELECT bio, profile_picture 
       FROM user_profiles 
       WHERE user_id = ?`,
      [userId]
    );
    
    let user = userResult[0] || { bio: "", profile_picture: "/components/profile-pic.png" };
    
    // include email/id from session
    user.id = userId;
    user.email = req.session.user.email;

    // get reservations
    const [reservations] = await db.query(
      `SELECT r.id, i.name AS item_name, i.type AS item_type,
              r.start_date, r.end_date
       FROM reservations r
       JOIN items i ON r.item_id = i.id
       WHERE r.user_id = ?
       ORDER BY r.start_date ASC`,
      [userId]
    );

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

    res.json({
      user,
      past,
      today: todayRes,
      future
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// update bio
router.post("/bio", requireAuth, async (req, res) => {
  try {

    const userId = req.session.user.id;
    const { bio } = req.body;

    await db.query(
      `INSERT INTO user_profiles (user_id, bio)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE bio = VALUES(bio)`,
      [userId, bio]
    );

    res.json({ message: "Bio updated successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
