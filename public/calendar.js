document.addEventListener('DOMContentLoaded', function() {
  const calendarEl = document.getElementById('calendar');
  const itemSelect = document.getElementById('itemSelect');
  const startInput = document.getElementById('startDate');
  const endInput = document.getElementById('endDate');

  function toDateTimeLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    validRange: { start: new Date() },

    // Click on an available slot event -> fill reservation form
    eventClick: function(info) {
      const start = new Date(info.event.start);
      const end = new Date(info.event.end);

      startInput.value = toDateTimeLocal(start);
      endInput.value = toDateTimeLocal(end);

      // trigger loadItems logic in reserve page
      startInput.dispatchEvent(new Event('change'));
      endInput.dispatchEvent(new Event('change'));

      const msg = document.getElementById("message");
      if (msg) msg.textContent = "Selected available slot from calendar.";
    },

    // Click on day -> create default 1-hour window at next hour
    dateClick: function(info) {
      const clickedDay = new Date(info.dateStr + "T00:00:00");
      const now = new Date();

      let start = new Date(clickedDay);
      if (
        clickedDay.getFullYear() === now.getFullYear() &&
        clickedDay.getMonth() === now.getMonth() &&
        clickedDay.getDate() === now.getDate()
      ) {
        start = new Date(now);
        start.setMinutes(0, 0, 0);
        start.setHours(start.getHours() + 1);
      } else {
        start.setHours(9, 0, 0, 0); // default 9 AM for future days
      }

      const end = new Date(start);
      end.setHours(end.getHours() + 1);

      startInput.value = toDateTimeLocal(start);
      endInput.value = toDateTimeLocal(end);

      startInput.dispatchEvent(new Event('change'));
      endInput.dispatchEvent(new Event('change'));
    },

    events: async function(fetchInfo, successCallback, failureCallback) {
      try {
        const item_id = itemSelect.value;

        if (!item_id) {
          successCallback([]);
          return;
        }

        const start_date = fetchInfo.startStr.split('T')[0];
        const endDate = new Date(fetchInfo.end);
        endDate.setDate(endDate.getDate() - 1);
        const end_date = endDate.toISOString().split('T')[0];

        const response = await fetch(
          `/availability?item_id=${item_id}&start_date=${start_date}&end_date=${end_date}`,
          { credentials: 'include' }
        );

        if (!response.ok) throw new Error('Failed to fetch availability');

        const data = await response.json();

        const events = (data.availableSlots || []).map(slot => ({
          title: 'Available (click to fill form)',
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

  if (itemSelect.value) {
    calendar.refetchEvents();
  }

  itemSelect.addEventListener('change', function() {
    calendar.refetchEvents();
  });
});
