const db = require('../db');

class reservationUtils {
    constructor() {
        throw new Error("This class cannot be instantiated");
    }

    // Validation checks for the reservation fields (No return values, equivalent to void function in Java)
    static noFieldIsEmpty(reservation) {
        if (!reservation.item_type || !reservation.item_id || !reservation.user_id || !reservation.start_date || !reservation.end_date) {
            throw new Error("All fields required");
        }
    }


    static endDateIsAfterStartDate(reservation) {
        if (new Date(reservation.end_date) <= new Date(reservation.start_date)) {
            throw new Error("End date must be after start date");
        }
    }


    static async checkForConflicts(reservation) {
        const [conflicts] = await db.query(
            "SELECT * FROM reservations WHERE item_type = ? AND item_id = ? AND start_date < ? AND end_date > ?",
            [reservation.item_type, reservation.item_id, reservation.end_date, reservation.start_date]
        );

        if (conflicts.length > 0) {
            throw new Error("This Item is already reserved during that time");
        }
    }

    getAllUserReservations(user_id) {
        const [reservations] = db.query(
            "SELECT * FROM reservations WHERE user_id = ?",
            [user_id]
        );

        return reservations;
    }


    // For view-reservation.html
    getReservations() {
        // Get all reservations from the database
        
    }
}

module.exports = reservationUtils;