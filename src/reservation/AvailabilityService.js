const db = require('../db')


// Define possible booking hours
const WORKING_HOURS = {
  start: 0,  
  end: 24   
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

function formatDateForFullCalendar(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // months are 0-indexed
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

async function getAvailability(item_id, start_date, end_date) {
  // Ensure dates are YYYY-MM-DD
  const startDateOnly = start_date.split('T')[0];
  const endDateOnly = end_date.split('T')[0];

  // Get all slots within the range (inclusive of start and end)
  const [slots] = await db.query(
    `SELECT start_time, end_time
     FROM availability_slots
     WHERE item_id = ? AND start_time >= ? AND start_time < ?`,
    [item_id, startDateOnly + ' 00:00:00', endDateOnly + ' 23:59:59']
  );

  if (!slots.length) {
    console.log('No availability slots in DB for this item/date range');
    return [];
  }

  // Get all reservations overlapping the range
  const [reservations] = await db.query(
    `SELECT start_date, end_date
     FROM reservations
     WHERE item_id = ? AND end_date >= ? AND start_date <= ?`,
    [item_id, startDateOnly + ' 00:00:00', endDateOnly + ' 23:59:59']
  );

  // Filter slots that overlap any reservation
  const availableSlots = slots.filter(slot => {
    const slotStart = new Date(slot.start_time + "Z").getTime();
    const slotEnd = new Date(slot.end_time + "Z").getTime();

    return !reservations.some(res => {
      const resStart = new Date(res.start_date + "Z").getTime();
      const resEnd = new Date(res.end_date + "Z").getTime();
      return slotStart < resEnd && resStart < slotEnd;
    });
  });

  return availableSlots.map(slot => ({
    start: formatDateForFullCalendar(slot.start_time),
    end: formatDateForFullCalendar(slot.end_time)
  }));
}

module.exports = { getAvailability };


