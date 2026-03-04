const db = require('../db')


// Define possible booking hours
const WORKING_HOURS = {
  start: 9,  // 9 AM
  end: 17   // 5 PM
};

// Generate 1-hour slots for a given date
function generateTimeSlots(date) {
  const slots = [];
  for (let hour = WORKING_HOURS.start; hour < WORKING_HOURS.end; hour++) {
    const start = `${date} ${hour.toString().padStart(2, '0')}:00:00`;
    const end = `${date} ${(hour + 1).toString().padStart(2, '0')}:00:00`;
    slots.push({ start, end });
  }
  return slots;
}

async function getAvailability (itemId, date) {

  const reservations = await db.query('SELECT start_date, end_date FROM reservations where item_id = ? AND DATE(start_date) = ?', [itemId, date]);
    
  const allSlots = generateTimeSlots(date);
  const availableSlots = allSlots.filter(slot => {
  return !reservations.some(res =>
    slot.start < res.end_date && res.start_date < slot.end
    );
  });

return availableSlots;
}

module.exports = {getAvailability};


