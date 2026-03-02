const db = require('../db');
const bcrypt = require("bcrypt");

class userUtils {
    constructor() {
        throw new Error("This class cannot be instantiated");
    }

    static noFieldIsEmpty(user) {
        if (!user.email || !user.password) {
            throw new Error("All fields required");
        }
    }


    static async getUserIdFromEmail(email) {
        const [userResults] = await db.query("SELECT * FROM users WHERE email = ?", 
            [email]
        );

        const user_id = userResults[0].id;
        
        return user_id;
    }


    static validateNewEmail(email) {
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(com|org|edu|gov)$/i;
        return emailRegex.test(email);
    }


    static validateNewPassword(password) {
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return passwordRegex.test(password);
    }


    static hashPassword(password) {
        return bcrypt.hash(password, 10);
    }


    // Compare the provided password with the hashed password stored in the database
    static dycryptPassword(password, hashedPassword) {
        return bcrypt.compare(password, hashedPassword);
    }


    static async userExists(user_email) {
        const [userResults] = await db.query("SELECT * FROM users WHERE email = ?", 
            [user_email]
        );

        if (userResults.length === 0) {
            throw new Error("Invalid email or password");
        }
    }
}

module.exports = userUtils;