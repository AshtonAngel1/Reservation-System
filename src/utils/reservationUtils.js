const db = require('../db');

class reservationUtils {
    constructor() {
        throw new Error("This class cannot be instantiated");
    }

    // Validation checks for the reservation fields (No return values, equivalent to void function in Java)
    static noFieldIsEmpty(reservation) {
        if (!reservation.item_id || !reservation.user_id || !reservation.start_date || !reservation.end_date) {
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
            "SELECT * FROM reservations WHERE item_id = ? AND id != ? AND start_date < ? AND end_date > ?",
            [reservation.item_id, reservation.id, reservation.start_date, reservation.end_date]
        );

        if (conflicts.length > 0) {
            throw new Error("This Item is already reserved during that time");
        }
    }

    static startDateNotInPast(reservation) {
        const now = new Date();
        now.setSeconds(0, 0); // minute precision to avoid same-minute false negatives
        const startDate = new Date(reservation.start_date);

        if (startDate < now) {
            throw new Error("Start date cannot be in the past");
        }
    }

    static reservationCannotExceedOneWeek(reservation) {
        const startDate = new Date(reservation.start_date);
        const endDate = new Date(reservation.end_date);

        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 7) {
            throw new Error("Reservation cannot exceed one week");
        }
    }

    static async getAllUserReservations(user_id) {
        const [reservations] = await db.query(
            "SELECT * FROM reservations WHERE user_id = ?",
            [user_id]
        );

        return reservations;
    }

    static async checkAvailabilityWindow(reservation) {
        let query = "SELECT * FROM availability_slots WHERE item_id = ? AND start_time <= ? AND end_time >= ?";
        let params = [
            reservation.item_id,
            reservation.start_date,
            reservation.end_date
        ];

        if (reservation.id) {
            query += " AND id != ?";
            params.push(reservation.id);
        }

        const [rows] = await db.query(query, params);

        if (rows.length === 0) {
            throw new Error("Reservation outside availability window.");
        }
    }


    // For view-reservation.html
    getReservations() {
        // Get all reservations from the database

    }
}

module.exports = reservationUtils;
