import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Name is required"]
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim : true
    },
    password: {
        type: String,
        required: function() {
            // Password is not required if signing up with Google
            return this.authProvider !== 'google';
        },
        minlength: [6, "Password must be at least 6 characters long"]
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationPin: {
        type: String
    },
    emailVerificationPinExpires: {
        type: Date
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true // Allows multiple documents to have a null value for this field
    },
    profilePicture: {
        type: String,
        default: ""
    },
    authProvider: {
        type: String,
        enum: ["local", "google"],
        default: "local"
    },
    role:{
        type: String,
        enum: ["customer", "admin"],
        default: "customer"
    },
    passwordResetToken: {
        type: String
    },
    passwordResetExpires: {
        type: Date
    },
    failedLoginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    }
}, {
    timestamps: true // createdAt and updatedAt fields
})

// Middleware to hash password before saving
userSchema.pre("save", async function(next) {
    // Only hash the password if it has been modified (or is new) and is not empty
    if(!this.isModified("password") || !this.password) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
})

// Method to compare entered password with the hashed password in the database
userSchema.methods.comparePassword = async function(password) {
    // If the user signed up with Google, they won't have a local password
    if (!this.password) return false;
    return await bcrypt.compare(password, this.password);
}

const User = mongoose.model("User", userSchema);

export default User;