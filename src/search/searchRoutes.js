const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const { q, type } = req.query;

  if (!q && !type) {
    return res.json([]);
  }

  let sql = `
    SELECT id, name, type
    FROM items
    WHERE 1=1
  `;

  const params = [];

  if (q) {
    sql += " AND LOWER(name) LIKE ?";
    params.push(`%${q.toLowerCase()}%`);
  }

  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }

  const [rows] = await db.query(sql, params);
  res.json(rows);
});

module.exports = router;