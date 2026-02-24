
class reservationUtils {
    constructor() {
        throw new Error("This class cannot be instantiated");
    }

    // Validation checks for the reservation fields (No return values, equivalent to void function in Java)
    static noFieldIsEmpty(reservation) {
        if (!reservation.item_type || !reservation.item_id || !reservation.user_id || !reservation.start_date || !reservation.end_date) {
            return res.status(400).json({ error: "All fields required" });
        }
    }


    static endDateIsAfterStartDate(reservation) {
        if (new Date(reservation.end_date) <= new Date(reservation.start_date)) {
            return res.status(400).json({ error: "End date must be after start date" });
        }
    }


    static async checkForConflicts(reservation) {
        const [conflicts] = await db.query(
            "SELECT * FROM reservations WHERE item_type = ? AND item_id = ? AND start_date < ? AND end_date > ?",
            [reservation.item_type, reservation.item_id, reservation.end_date, reservation.start_date]
        );

        if (conflicts.length > 0) {
            return res.status(400).json({ error: 
                "This Item is already reserved during that time" 
            });
        }
    }


    static async getUserIdFromEmail(user_email) {
        const [userResults] = await db.query("SELECT * FROM users WHERE email = ?", 
            [user_email]
        );

        if (userResults.length === 0) {
        return res.status(400).json({ error: "User not found" });
        }

        const user_id = userResults[0].id;
        
        return user_id;
    }

    getReservations() {
        // Get all reservations from the database
    }
}

module.exports = reservationUtils;