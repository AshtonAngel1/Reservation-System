document.addEventListener('DOMContentLoaded', function() {
  const calendarEl = document.getElementById('calendar');

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    validRange: {
      start: new Date()
    },
    events: async function(fetchInfo, successCallback, failureCallback) {
      try {
        const item_id = document.getElementById('itemSelect').value;

        if (!item_id) {
          successCallback([]);
          return;
        }

        const start_date = fetchInfo.startStr.split('T')[0];
        //const end_date = fetchInfo.endStr.split('T')[0];
        const endDate = new Date(fetchInfo.end);
        endDate.setDate(endDate.getDate() - 1);
        const end_date = endDate.toISOString().split('T')[0];

        const response = await fetch(`/availability?item_id=${item_id}&start_date=${start_date}&end_date=${end_date}`, {
          credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to fetch availability');

        const data = await response.json();

        const events = (data.availableSlots || []).map(slot => ({
          title: 'Available',
          start: slot.start,
          end: slot.end,
          color: 'green'
        }));

        successCallback(events);

      } catch (err) {
        console.error(err);
        failureCallback(err);
      }
    }
  });

  calendar.render();

  if (document.getElementById('itemSelect').value) {
    calendar.refetchEvents();
  }
  
  document.getElementById('itemSelect').addEventListener('change', function() {
    calendar.refetchEvents();
  });
});
