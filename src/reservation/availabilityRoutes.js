const express = require('express');
const router = express.Router();
const availabilityService = require('./AvailabilityService');

router.get('/', async (req, res) => {
  try {
    const { item_id, start_date, end_date } = req.query;

    if (!item_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const slots = await availabilityService.getAvailability(item_id, start_date, end_date);
    res.json({ availableSlots: slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

module.exports = router;