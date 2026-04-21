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
        const startUTC = new Date(reservation.start_date);
        const endUTC = new Date(reservation.end_date);

        if (isNaN(startUTC) || isNaN(endUTC)) {
            throw new Error("Invalid date format");
        }

        const startSQL = toMySQLDateTime(startUTC);
        const endSQL = toMySQLDateTime(endUTC);

        // console.log("Checking overlap:");
        // console.log("Start:", startSQL);
        // console.log("End:", endSQL);

        const [conflicts] = await db.query(
            `SELECT id, start_date, end_date
            FROM reservations
            WHERE item_id = ?
            AND status = 'active'
            AND (? < end_date AND ? > start_date)
            LIMIT 1`,
            [reservation.item_id, startSQL, endSQL]
        );

        if (conflicts.length > 0) {
            throw new Error("This Item is already reserved during that time");
        }

        function toMySQLDateTime(date) {
            return date.toISOString().slice(0, 19).replace("T", " ");
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
        
        const startUTC = new Date(reservation.start_date);
        const endUTC = new Date(reservation.end_date);

        // Convert to local time for availability rule checking
        const timezone = "America/chicago";

        const startLocal = new Date(startUTC.toLocaleString("en-US", { timeZone: timezone }));
        const endLocal = new Date(endUTC.toLocaleString("en-US", { timeZone: timezone }));

        const sameDay =
            startLocal.getFullYear() === endLocal.getFullYear() &&
            startLocal.getMonth() === endLocal.getMonth() &&
            startLocal.getDate() === endLocal.getDate();

        if (!sameDay) {
            throw new Error("Reservations must be within a single day.");
        }
        
        // MySQL DAYOFWEEK: Sunday = 1, JS getDay(): Sunday = 0
        const dayOfWeek = startLocal.getDay(); // 0–6

        function toTimeString(date) {
            return date.toTimeString().slice(0, 8);
        }

        const startTime = toTimeString(startLocal);
        const endTime = toTimeString(endLocal);

        const startDateOnly = startLocal.toISOString().slice(0, 10);
        const endDateOnly = endLocal.toISOString().slice(0, 10);

        // Check matching availability rule (when the item is available)
        const [rules] = await db.query(`
            SELECT * FROM availability_rules
            WHERE item_id = ?
            AND day_of_week = ?
            AND start_time <= ?
            AND end_time >= ?
            AND (valid_from IS NULL OR valid_from <= DATE(?))
            AND (valid_until IS NULL OR valid_until >= DATE(?))
        `, [itemId, dayOfWeek, startTime, endTime, startDateOnly, endDateOnly]);


        // Check  blocking exceptions
        const [blocked] = await db.query(`
            SELECT 1
            FROM availability_exceptions
            WHERE item_id = ?
            AND is_available = FALSE
            AND start_datetime < ?
            AND end_datetime > ?
            LIMIT 1
        `, [itemId, endUTC, startUTC]);

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
        `, [itemId, endUTC, startUTC]);

        if (rules.length === 0 && overrides.length === 0) {
            throw new Error("Reservation outside availability window.");
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
