const express = require("express");
const db = require('../db');
const { createEvents } = require("ics");
const router = express.Router();

router.post("/reservations/export", async (req, res) => {
  try {
    const { reservationIds } = req.body;

    if (!reservationIds || reservationIds.length === 0) {
      return res.status(400).json({ error: "No reservation IDs provided" });
    }

    //console.log("Incoming IDs:", reservationIds);

    const placeholders = reservationIds.map(() => "?").join(",");

    const [reservations] = await db.query(
      `SELECT * FROM reservations 
       WHERE id IN (${placeholders}) 
       AND user_id = ? 
       AND end_date >= NOW()`,
      [...reservationIds, req.session.user.id]
    );

    //console.log("DB Results:", reservations);

    // Convert reservations into ICS format
    const events = reservations.map(r => {
      const start = new Date(r.start_date);
      const end = new Date(r.end_date);

      return {
        title: `Reservation for Item ${r.item_id}`,
        start: [
          start.getFullYear(),
          start.getMonth() + 1,
          start.getDate(),
          start.getHours(),
          start.getMinutes()
        ],
        end: [
          end.getFullYear(),
          end.getMonth() + 1,
          end.getDate(),
          end.getHours(),
          end.getMinutes()
        ],
        description: `Reservation ID: ${r.id}`,
        status: "CONFIRMED",
        busyStatus: "BUSY"
      };
    });

    createEvents(events, (error, value) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to generate calendar file" });
      }

      res.setHeader("Content-Type", "text/calendar");
      res.setHeader("Content-Disposition", "attachment; filename=reservations.ics");
      res.send(value);
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;