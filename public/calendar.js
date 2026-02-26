document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    var calendar = new FullCalendar.Calendar(calendarEl, {

        views: {
            dayGridMonth: { // name of view
                titleFormat: { year: 'numeric', month: '2-digit', day: '2-digit'}
            }
        }

    

    });

    calendar.render();
});

