document.addEventListener('DOMContentLoaded', function() {
  const calendarEl = document.getElementById('calendar');
  const itemType = document.getElementById('itemType');
  const itemSelect = document.getElementById('itemSelect');
  const startInput = document.getElementById('startDate');
  const endInput = document.getElementById('endDate');
  const itemColors = {};

  function getColorForItem(itemId) {
    if (!itemColors[itemId]) {
      const colors = [
        "#4CAF50", "#2196F3", "#FF9800", "#9C27B0",
        "#E91E63", "#00BCD4", "#8BC34A", "#FF5722"
      ];
      itemColors[itemId] = colors[Object.keys(itemColors).length % colors.length];
    }
    return itemColors[itemId];
  }
  function toDateTimeLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    height: 'auto',
    slotMinTime: "00:00:00",
    slotMaxTime: "24:00:00",
    allDaySlot: false,
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
      if (msg) msg.textContent = `Selected: ${info.event.title}`;
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
        const item_type = itemType.value;

        if (!item_type) {
          successCallback([]);
          return;
        }

        const start_date = fetchInfo.startStr.split('T')[0];
        const end_date = fetchInfo.endStr.split('T')[0];

        const response = await fetch(
          `/availability?item_type=${item_type}&start_date=${start_date}&end_date=${end_date}`,
          { credentials: 'include' }
        );

        if (!response.ok) throw new Error('Failed to fetch availability');

        const data = await response.json();

        const events = (data.availableSlots || []).map(slot => ({
          title: `${slot.title} (Available)`,
          start: slot.start,
          end: slot.end,
          backgroundColor: getColorForItem(slot.item_id),
          borderColor: getColorForItem(slot.item_id)
        }));

        successCallback(events);
      } catch (err) {
        console.error(err);
        failureCallback(err);
      }
    },
    eventDidMount: function(info) {
      info.el.title = info.event.title;
    }
  });

  calendar.render();

  if (itemSelect.value) {
    calendar.refetchEvents();
  }

  itemSelect.addEventListener('change', function() {
    calendar.refetchEvents();
  });

  if (itemType.value) {
    calendar.refetchEvents();
  }

  itemType.addEventListener('change', function() {
    calendar.refetchEvents();
  });


});
