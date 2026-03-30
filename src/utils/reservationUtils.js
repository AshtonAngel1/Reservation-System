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

    // Modified for New Availability tables
    static async checkAvailabilityWindow(reservation) {
        const itemId = reservation.item_id;
        
        const start = new Date(reservation.start_date);
        const end = new Date(reservation.end_date);

        if (start.toDateString() != end.toDateString()) {
            throw new Error("Reservations must be within a single day.");
        }
        
        // MySQL DAYOFWEEK: Sunday = 1, JS getDay(): Sunday = 0
        const dayOfWeek = start.getDay(); // 0–6

        function toTimeString(date) {
            return date.toTimeString().slice(0, 8);
        }

        const startTime = toTimeString(start);
        const endTime = toTimeString(end);


        // Check matching availability rule (when the item is available)
        const [rules] = await db.query(`
            SELECT * FROM availability_rules
            WHERE item_id = ?
            AND day_of_week = ?
            AND start_time <= ?
            AND end_time >= ?
            AND (valid_from IS NULL OR valid_from <= DATE(?))
            AND (valid_until IS NULL OR valid_until >= DATE(?))
        `, [itemId, dayOfWeek, startTime, endTime, start, end]);


        // Check  blocking exceptions
        const [blocked] = await db.query(`
            SELECT 1
            FROM availability_exceptions
            WHERE item_id = ?
            AND is_available = FALSE
            AND start_datetime < ?
            AND end_datetime > ?
            LIMIT 1
        `, [itemId, end, start]);

        if (blocked.length > 0) {
            throw new Error("Reservation falls within an unavailable time window.");
        }

        // Override if wanted an extra day available (extended hours)
        const [overrides] = await db.query(`
            SELECT 1
            FROM availability_exceptions
            WHERE item_id = ?
            AND is_available = TRUE
            AND start_datetime < ?
            AND end_datetime > ?
            LIMIT 1
        `, [itemId, end, start]);

        if (rules.length === 0 && overrides.length === 0) {
            throw new Error("Reseration outside availability window.")
        }
    }


    static toMySQLDatetime(isoString) {
        const date = new Date(isoString);
        
        return date.getUTCFullYear() + '-' +
            String(date.getUTCMonth() + 1).padStart(2, '0') + '-' +
            String(date.getUTCDate()).padStart(2, '0') + ' ' +
            String(date.getUTCHours()).padStart(2, '0') + ':' +
            String(date.getUTCMinutes()).padStart(2, '0') + ':' +
            String(date.getUTCSeconds()).padStart(2, '0');
    }


    static toLocalInputValue(utcString) {
        const date = new Date(utcString);

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }


    // For view-reservation.html
    getReservations() {
        // Get all reservations from the database

    }
}

module.exports = reservationUtils;
