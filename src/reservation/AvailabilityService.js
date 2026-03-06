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

// async function getAvailability (itemId, date) {

//   const reservations = await db.query('SELECT start_date, end_date FROM reservations where item_id = ? AND DATE(start_date) = ?', [itemId, date]);
    
//   const allSlots = generateTimeSlots(date);
//   const availableSlots = allSlots.filter(slot => {
//   return !reservations.some(res =>
//     slot.start < res.end_date && res.start_date < slot.end
//     );
//   });

// return availableSlots;
// }

function formatDateForFullCalendar(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // months are 0-indexed
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

async function getAvailability(item_id, date) {
  // Ensure date is in YYYY-MM-DD format
  const dateOnly = date.split('T')[0];

  // Get all slots for this item on that date
  const [slots] = await db.query(
    `SELECT start_time, end_time
     FROM availability_slots
     WHERE item_id = ? AND DATE(start_time) = ?`,
    [item_id, dateOnly]
  );

  if (slots.length === 0) {
    console.log('No availability slots in DB for this item/date');
    
    return [];
  }

  // Get reservations for this item on that date
  const [reservations] = await db.query(
    `SELECT start_date, end_date
     FROM reservations
     WHERE item_id = ? AND DATE(start_date) = ?`,
    [item_id, dateOnly]
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

  

  const result = availableSlots.map(slot => ({
  start: formatDateForFullCalendar(slot.start_time),
  end: formatDateForFullCalendar(slot.end_time)
}));

console.log(result);
return result;
}

module.exports = { getAvailability };





module.exports = {getAvailability};


