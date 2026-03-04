const express = require('express');
const router = express.Router();
const AvailabilityService = require('./availabilityService');

router.get('/availability', async (req, res) => {
  try {
    const { item_id, date } = req.query;

    if (!item_id || !date) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const slots = await AvailabilityService.getAvailability(item_id, date);
    res.json({ availableSlots: slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

module.exports = router;