const express = require('express');
const db = require('../db');
const router = express.Router();
const availabilityService = require('./AvailabilityService');
const reservationUtils = require('../utils/reservationUtils');

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

function datetimeLocalToUTCString(datetimeLocal) {
  // Parse as local time
  const localDate = new Date(datetimeLocal);

  // Convert to UTC by removing timezone offset
  const utcDate = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000);

  // Format for MySQL DATETIME
  return utcDate.toISOString().slice(0, 19).replace("T", " ");
}

router.get('/', async (req, res) => {
  try {
    const { item_id, item_type, start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    let slots;

    if (item_id) {
      slots = await availabilityService.getAvailability(item_id, start_date, end_date);
    } else if (item_type) {
      slots = await availabilityService.getAvailabilityByType(item_type, start_date, end_date);
    } else {
      return res.status(400).json({ error: 'Must provide item_id or item_type' });
    }

    res.json({ availableSlots: slots });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Create weekly availability
router.post("/rules", requireAdmin, async (req, res) => {
  try{
    const {
      item_id,
      day_of_week,
      start_time,
      end_time,
      vaild_from,
      valid_until
    } = req.body;

    if (item_id == null || day_of_week == null || !start_time || !end_time) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (day_of_week < 0 || day_of_week > 6) {
      return res.status(400).json({ error: "day_of_week must be 0-6" });
    }

    if (start_time >= end_time) {
      return res.status(400).json({ error: "Invalid time range" });
    }

    await db.query(`
      INSERT INTO availability_rules
      (item_id, day_of_week, start_time, end_time, vaild_from, valid_until)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [item_id, day_of_week, start_time, end_time, vaild_from || null, valid_until || null]);

    res.status(201).json({ error: "Rule created" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// Get the weekly availability
router.get("/rules/:item_id", requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM availability_rules
      WHERE item_id = ?
      ORDER BY day_of_week, start_time
    `, [req.params.item_id]);

    res.json(rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Delete availability
router.delete("/rules/:id", requireAdmin, async (req, res) => {
  try {
    await db.query(
      "DELETE FROM availability_rules WHERE id = ?",
      [req.params.id]
    );

    res.json({ message: "Rule deleted" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Create exceptions
router.post("/exceptions", requireAdmin, async (req, res) => {
  try{
    const {
      item_id,
      start_datetime,
      end_datetime,
      is_available
    } = req.body;

    if (item_id == null || !start_datetime || !end_datetime || is_available == null ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (new Date(start_datetime) >= new Date(end_datetime)) {
      return res.status(400).json({ error: "Invalid time range" });
    }

    const startIso = datetimeLocalToUTCString(start_datetime);
    const endIso = datetimeLocalToUTCString(end_datetime);

    await db.query(`
      INSERT INTO availability_exceptions
      (item_id, start_datetime, end_datetime, is_available)
      VALUES (?, ?, ?, ?)
    `, [item_id, startIso, endIso, is_available]);

    res.status(201).json({ error: "Exception created" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// Get exceptions
router.get("/exceptions/:item_id", requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM availability_exceptions
      WHERE item_id = ?
      ORDER BY start_datetime
    `, [req.params.item_id]);

    res.json(rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Delete exception
router.delete("/exceptions/:id", requireAdmin, async (req, res) => {
  try {
    await db.query(
      "DELETE FROM availability_exceptions WHERE id = ?",
      [req.params.id]
    );

    res.json({ message: "Exception deleted" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  const { q, type } = req.query;

  if (!q && !type) {
    return res.json([]); // empty search
  }
  

  let sql = `
    SELECT id, name, type
    FROM items
    WHERE 1=1
  `;

  const params = [];

  //  partial + case insensitive
  if (q) {
    sql += " AND LOWER(name) LIKE ?";
    params.push(`%${q.toLowerCase()}%`);
  }

  //  filter by type
  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }

  const [rows] = await db.query(sql, params);

  
  res.json(rows);
});

// Prevent calling /rules multiple times
router.post("/rules/bulk", requireAdmin, async (req, res) => {
  
  try {
    const { item_id, rules } = req.body;
    // rules = [{ day_of_week, start_time, end_time }, ...]

    if (!item_id || !Array.isArray(rules)) {
      return res.status(400).json({ error: "Invalid payload" });
    }


    await db.query(
      "DELETE FROM availability_rules WHERE item_id = ?",
      [item_id]
    )

    if (rules.length > 0) {
    
      const values = rules.map(r => [
        item_id,
        r.day_of_week,
        r.start_time,
        r.end_time,
        r.valid_from || null,
        r.valid_until || null
      ]);

      await db.query(`
        INSERT INTO availability_rules
        (item_id, day_of_week, start_time, end_time, valid_from, valid_until)
        VALUES ?
      `, [values]);
    }


    res.json({ message: "Weekly schedule replaced succesfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } 
});

module.exports = router;