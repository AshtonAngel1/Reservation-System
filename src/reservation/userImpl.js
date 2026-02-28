const db = require('../db');
const userUtils = require('../utils/userUtils');

class userImpl {
    #id; // # makes the variable private
    #email;
    #password;
    //username;
    //bio;
    //profile_picture;
    
    constructor(id = null, email, password) {
        this.#id = id;
        //this.username = username;
        //this.bio = bio;
        //this.profile_picture = profile_picture;
        this.#email = email;
        this.#password = password;
    }


    validateNewUser() {
        userUtils.noFieldIsEmpty(this);

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
        userUtils.noFieldIsEmpty(this);
        userUtils.userExists(this.#email);

        const [userResults] = await db.query("SELECT * FROM users WHERE id = ?", 
            [this.#id]
        );

        const hashedPassword = userResults[0].password;

        // Check if the provided password matches the hashed password in the database
        if (!await userUtils.dycryptPassword(this.#password, hashedPassword)) {
            throw new Error("Invalid email or password");
        }

        this.#id = userResults[0].id;
        return {
            id: this.#id,
            email: this.#email
        };
    }

    
    async registerUser() {
        this.validateNewUser();

        try {

            const hashedPassword = await userUtils.hashPassword(this.#password);
            const [result] = await db.query(
                "INSERT INTO users (email, password) VALUES (?, ?)",
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