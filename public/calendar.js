



document.addEventListener('DOMContentLoaded', async function() {  //TODO make this listen to event (dropdown on make a reservation page)
    const calendarEl = document.getElementById('calendar');

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth', // or 'timeGridDay' if you want hours visible
        events: async function(fetchInfo, successCallback, failureCallback) {
            try {

                const item_id = 4;

                // Get date string in YYYY-MM-DD format from calendar view
                //const date = fetchInfo.startStr.slice(0, 10);
                const date = "2026-03-06"

                const response = await fetch(`/availability?item_id=${item_id}&date=${date}`, {
                    credentials: 'include'
                });
                console.log(response)
                if (!response.ok) throw new Error('Failed to fetch availability');

                const data = await response.json();

                // Transform API response to FullCalendar events
                const events = data.availableSlots.map(slot => ({
                    title: 'Available',
                    start: slot.start, // already ISO format: YYYY-MM-DDTHH:mm:ss
                    end: slot.end,
                    color: '#28a745' // green
                }));

                successCallback(events);

            } catch (err) {
                console.error(err);
                failureCallback(err);
            }
        }
    });

    calendar.render();
});