const db = require('../db');
const userUtils = require('../utils/userUtils');

class userImpl {
    #id; // # makes the variable private
    #email;
    #password;
    //username;
    //bio;
    //profile_picture;
    
    constructor(email, password, id = null) {
        this.#id = id;
        //this.username = username;
        //this.bio = bio;
        //this.profile_picture = profile_picture;
        this.#email = email;
        this.#password = password;
    }


    validateNewUser() {
        userUtils.noFieldIsEmpty(this.#email, this.#password);

        if (!userUtils.validateNewEmail(this.#email)) {
                throw new Error("Invalid email format");
            }

        if (!userUtils.validateNewPassword(this.#password)) {
            throw new Error(
                "Password must be at least 8 characters long and include a letter, number, and special character"
            );
        }
    }


    async validateUserLogIn() {
        userUtils.noFieldIsEmpty(this.#email, this.#password);
        const [userResults] = await db.query(
            "SELECT id, email, passwordHash, is_admin FROM users WHERE email = ?",
            [this.#email]
        );

        if (userResults.length === 0) {
            throw new Error("Invalid email or password");
        }

        const user = userResults[0];

        // Check if the provided password matches the hashed password in the database
        if (!await userUtils.decryptPassword(this.#password, user.passwordHash)) {
            throw new Error("Invalid email or password");
        }

        this.#id = user.id;
        return {
            id: user.id,
            email: user.email,
            is_admin: user.is_admin === 1
        };
    }

    
    async registerUser() {
        this.validateNewUser();

        try {

            const hashedPassword = await userUtils.hashPassword(this.#password);
            const [result] = await db.query(
                "INSERT INTO users (email, passwordHash) VALUES (?, ?)",
                [this.#email, hashedPassword]
            );

            // Initialize the user_id
            this.#id = result.insertId;

            return this.#id;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error("User already exists");
            }

            throw error;
        }
    }

    // To be added methods: editUsername(), editBio(), editProfilePicture()
    

    // Maybe for if we want to allow the user to delete their account, look into
    static async deleteUser(user_id) {
    }

}

module.exports = userImpl;