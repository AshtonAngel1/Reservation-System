const db = require('../db');

function formatDateForFullCalendar(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

async function getAvailability(item_id, start_date, end_date) {

  const startDate = new Date(start_date);
  const endDate = new Date(end_date);

  // Get rules
  const [rules] = await db.query(
    `SELECT * FROM availability_rules WHERE item_id = ?`,
    [item_id]
  );

  if (!rules.length) return [];

  // Get exceptions
  const [exceptions] = await db.query(
    `SELECT * FROM availability_exceptions WHERE item_id = ?`,
    [item_id]
  );

  // Get reservations
  const [reservations] = await db.query(
    `SELECT start_date, end_date FROM reservations
     WHERE item_id = ?
     AND end_date >= ?
     AND start_date <= ?`,
    [item_id, start_date, end_date]
  );

  let slots = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {

    const dayOfWeek = d.getDay();

    const rule = rules.find(r => r.day_of_week === dayOfWeek);
    if (!rule) continue;

    const [startH, startM] = rule.start_time.split(':');
    const [endH, endM] = rule.end_time.split(':');

    const slotStart = new Date(d);
    slotStart.setHours(startH, startM, 0, 0);

    const slotEnd = new Date(d);
    slotEnd.setHours(endH, endM, 0, 0);

    // Check exceptions
    const blockedByException = exceptions.some(ex => {
      if (ex.is_available) return false;

      const exStart = new Date(ex.start_datetime);
      const exEnd = new Date(ex.end_datetime);

      return slotStart < exEnd && slotEnd > exStart;
    });

    if (blockedByException) continue;

    // Check reservations
    const blockedByReservation = reservations.some(res => {
      const resStart = new Date(res.start_date);
      const resEnd = new Date(res.end_date);

      return slotStart < resEnd && slotEnd > resStart;
    });

    if (blockedByReservation) continue;

    slots.push({
      start: formatDateForFullCalendar(slotStart),
      end: formatDateForFullCalendar(slotEnd)
    });
  }

  return slots;
}


async function getAvailabilityByType(item_type, start_date, end_date) {
  // 1. Get all items of this type
  const [items] = await db.query(
    `SELECT id, name FROM items WHERE type = ?`,
    [item_type]
  );

  if (!items.length) return [];

  const itemIds = items.map(i => i.id);

  // 2. Get rules for these items
  const [rules] = await db.query(
    `SELECT * FROM availability_rules 
     WHERE item_id IN (?) 
     AND (valid_from IS NULL OR valid_from <= ?) 
     AND (valid_until IS NULL OR valid_until >= ?)`,
    [itemIds, start_date, end_date]
  );

  // 3. Get exceptions
  const [exceptions] = await db.query(
    `SELECT * FROM availability_exceptions
     WHERE item_id IN (?)
     AND start_datetime <= ?
     AND end_datetime >= ?`,
    [itemIds, end_date, start_date]
  );

  let events = [];

  // 4. Build events from rules
  for (const rule of rules) {
    const item = items.find(i => i.id === rule.item_id);

    let current = new Date(start_date);
    const end = new Date(end_date);

    while (current <= end) {
      if (current.getDay() === rule.day_of_week) {
        const start = new Date(current);
        const endTime = new Date(current);

        const [sh, sm] = rule.start_time.split(':');
        const [eh, em] = rule.end_time.split(':');

        start.setHours(sh, sm, 0, 0);
        endTime.setHours(eh, em, 0, 0);

        // 5. Skip if exception makes it unavailable
        const isBlocked = exceptions.some(ex => {
          return (
            ex.item_id === rule.item_id &&
            new Date(ex.start_datetime) <= endTime &&
            new Date(ex.end_datetime) >= start &&
            ex.is_available === 0
          );
        });

        if (!isBlocked) {
          events.push({
            title: item.name,
            start: formatDate(start),
            end: formatDate(endTime),
            color: 'green',
            item_id: item.id
          });
        }
      }

      current.setDate(current.getDate() + 1);
    }
  }

  return events;
}

module.exports = { getAvailability, getAvailabilityByType };