const db = require('../db');
const reservationUtils = require('../utils/reservationUtils');

class ReservationImpl {
    constructor(item_id, user_id, start_date, end_date) {
        // Convert the list to variables that will be passed in with the post request passed from the front end
        this.item_id = item_id;
        this.user_id = user_id;
        this.start_date = start_date;
        this.end_date = end_date;
    }


    async validateReservation() {
        // Add in validationchecks after methods are created
        reservationUtils.noFieldIsEmpty(this);
        reservationUtils.endDateIsAfterStartDate(this);
        await reservationUtils.checkForConflicts(this);
        await reservationUtils.checkAvailabilityWindow(this);
    }


    // Add the reservation to the database
    async addReservation() {
        try {
            const [result] = await db.query(
                "INSERT INTO reservations (item_id, user_id, start_date, end_date) VALUES (?, ?, ?, ?)",
                [this.item_id, this.user_id, this.start_date, this.end_date]
            );

        } catch (error) {
            console.error("Error adding reservation:", error);
            throw error;
        }
    }


    // Delete the reservation from the database
    async deleteReservation(reservation_id) {
        try {
            const [result] = await db.query(
                "DELETE FROM reservations WHERE id = ?",
                [reservation_id]
            );

            console.log("Reservation deleted successfully");
            return { message: "Reservation deleted successfully" };
        } catch (error) {
            console.error("Error deleting reservation:", error);
            throw error;
        }
    }

    // To be added methods: editreservation(), getreservation(), and getAllReservations()
}

module.exports = ReservationImpl;