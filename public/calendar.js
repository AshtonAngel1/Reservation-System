document.addEventListener('DOMContentLoaded', async function() { //TODO: figure out how to make it work without hardcoded 
  var calendarEl = document.getElementById('calendar');

  // Fetch availability from backend
  try {
    const response = await fetch('http://localhost:3000/availability?item_id=1&date=2026-03-05');
    const data = await response.json();

    // Map your availableSlots to FullCalendar events
    const events = data.availableSlots.map(slot => ({
      title: 'Available',
      start: slot.start,
      end: slot.end,
      backgroundColor: 'green',
      borderColor: 'green'
    }));

    var calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      events: events
    });

    calendar.render();

  } catch (err) {
    console.error('Failed to fetch availability:', err);
  }
});
// document.addEventListener('DOMContentLoaded', function() {
//     const calendarEl = document.getElementById('calendar');

//     const calendar = new FullCalendar.Calendar(calendarEl, {
//         initialView: 'dayGridMonth', // shows hourly slots
//         events: async function(fetchInfo, successCallback, failureCallback) {
//             try {
//                 const item_id = document.getElementById('itemSelect').value || 1; // dynamically get selected item
//                 const startDate = fetchInfo.startStr.split('T')[0]; // send only YYYY-MM-DD to backend

//                 // Call your availability API
//                 const response = await fetch(`/availability?item_id=${item_id}&date=${startDate}`, {
//                     credentials: 'include'
//                 });

//                 if (!response.ok) throw new Error('Failed to fetch availability');

//                 const data = await response.json();

//                 // Convert to FullCalendar events
//                 const events = data.availableSlots.map(slot => ({
//                     title: 'Available',
//                     start: slot.start,
//                     end: slot.end,
//                     color: '#28a745'
//                 }));

//                 successCallback(events);

//             } catch (err) {
//                 console.error(err);
//                 failureCallback(err);
//             }
//         }
//     });

//     calendar.render();
// });