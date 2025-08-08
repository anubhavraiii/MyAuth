import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import {redis} from "../lib/redis.js"; 
import crypto from 'crypto';
import sendEmail from "../lib/sendEmail.js";

const MAX_FAILED_ATTEMPTS = 3;
const LOCK_TIME = 15 * 60 * 1000;

const generateVerificationPin = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

const generateToken = (userId) => {
    const accessToken = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "15m"
    });

    const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: "7d"
    });

    return { accessToken, refreshToken };
}

// refresh token is stored in upstash/redis with a 7 day expiration
const storeRefreshToken = async (userId, refreshToken) => {
    await redis.set(`refresh_token:${userId}`, refreshToken, "EX", 7 * 24 * 60 * 60);
}

const setCookies = (res, accessToken, refreshToken) => {
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict", 
        maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict", 
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
}

export const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        let user = await User.findOne({ email });

        if (user && user.isVerified) {
            return res.status(400).json({ message: "User already exists and is verified." });
        }

        const verificationPin = generateVerificationPin();

        if (user && !user.isVerified) {
            // User exists but is not verified, update PIN and resend email
            user.password = password; // Update password in case they forgot it
            user.name = name;
            user.emailVerificationPin = verificationPin;
            user.emailVerificationPinExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
            await user.save();
        } else {
            // Create a new unverified user
            user = await User.create({
                name,
                email,
                password,
                emailVerificationPin: verificationPin,
                emailVerificationPinExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
            });
        }

        // Send verification email
        const message = `Your email verification PIN is: ${verificationPin}\nThis PIN will expire in 10 minutes.`;
        await sendEmail({
            email: user.email,
            subject: 'Verify Your Email Address',
            message
        });

        // DO NOT log the user in yet.
        res.status(201).json({ message: "Signup successful. Please check your email for a verification PIN.", email: user.email });

    } catch (error) {
        console.log("Error in signup controller", error.message);
        return res.status(500).json({message: error.message});
    }
}

export const verifyEmail = async (req, res) => {
    try {
        const { email, pin } = req.body;
        const user = await User.findOne({ 
            email, 
            emailVerificationPin: pin,
            emailVerificationPinExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired verification PIN." });
        }

        user.isVerified = true;
        user.emailVerificationPin = undefined;
        user.emailVerificationPinExpires = undefined;
        await user.save();

        // Now log the user in
        const { accessToken, refreshToken } = generateToken(user._id);
        await storeRefreshToken(user._id, refreshToken);
        setCookies(res, accessToken, refreshToken);

        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profilePicture: user.profilePicture,
            authProvider: user.authProvider
        });

    } catch (error) {
        console.log("Error in verifyEmail controller", error.message);
        res.status(500).json({ message: "Server Error" });
    }
}

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        if (user.lockUntil && user.lockUntil > Date.now()) {
            const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
            return res.status(403).json({ message: `Account locked. Please try again in ${remainingTime} minutes.` });
        }

        //Check if the password is correct
        const isPasswordCorrect = await user.comparePassword(password);

        if (!isPasswordCorrect) {
            user.failedLoginAttempts += 1;
            
            if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
                user.lockUntil = Date.now() + LOCK_TIME;
                //user.failedLoginAttempts = 0; // Reset after locking
                await user.save();
                return res.status(403).json({ message: `Account locked for 15 minutes due to too many failed attempts.` });
            }
            
            await user.save();
            return res.status(400).json({ message: "Invalid email or password" });
        }

        //If login is successful, reset failed attempts and unlock account
        user.failedLoginAttempts = 0;
        user.lockUntil = undefined;
        await user.save();

        // Check if the user is verified
        if (!user.isVerified) {
            // Generate a new PIN and save it to the user
            const verificationPin = generateVerificationPin();
            user.emailVerificationPin = verificationPin;
            user.emailVerificationPinExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
            await user.save();

            // Send the new PIN via email
            const message = `We noticed you tried to log in. Your new email verification PIN is: ${verificationPin}\nThis PIN will expire in 10 minutes.`;
            await sendEmail({
                email: user.email,
                subject: 'Your New Verification PIN',
                message
            });

            // 3. Respond to the frontend to trigger the redirect
            return res.status(403).json({ 
                message: "Please verify your email. We've sent a new PIN.", 
                notVerified: true,
                email: user.email
            });
        }

        const { accessToken, refreshToken } = generateToken(user._id);
        await storeRefreshToken(user._id, refreshToken);
        setCookies(res, accessToken, refreshToken);
        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profilePicture: user.profilePicture,
            authProvider: user.authProvider
        });
    } catch (error) {
        console.log("Error in login controller", error.message);
		res.status(500).json({ message: error.message });
    }
}

export const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET); // decode refresh token
            await redis.del(`refresh_token:${decoded.userId}`); // Delete refresh token from Redis
        }

        res.clearCookie("accessToken"); // Clear access token cookie    
        res.clearCookie("refreshToken"); // Clear refresh token cookie
        res.json({ message: "Logged out successfully" });

    } catch (error) {
        console.log("Error in logout controller", error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
}

export const refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ message: "No refresh token provided" });
        }

        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET); // decode refresh token
        const storedToken = await redis.get(`refresh_token:${decoded.userId}`); // Get refresh token from Redis

        if( storedToken !== refreshToken) {
            return res.status(403).json({ message: "Invalid refresh token" });
        }   

        const accessToken = jwt.sign({ userId: decoded.userId }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "15m"
        });

        res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000 // 15 minutes
        });

        res.json({ message: "Access token refreshed successfully" });
    } catch (error) {
        console.log("Error in refreshToken controller", error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
}

export const getProfile = async (req, res) => {
	try {
		res.json(req.user);
	} catch (error) {
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

// Google OAuth Success Handler
export const googleAuthSuccess = async (req, res) => {
    try {
        const user = req.user;
        const { accessToken, refreshToken } = generateToken(user._id);
        await storeRefreshToken(user._id, refreshToken);
        
        setCookies(res, accessToken, refreshToken);
        
        // Redirect to frontend with success
        res.redirect(`${process.env.CLIENT_URL}?auth=success`);
    } catch (error) {
        console.log("Error in googleAuthSuccess controller", error.message);
        res.redirect(`${process.env.CLIENT_URL}?auth=error`);
    }
};

// Google OAuth Failure Handler
export const googleAuthFailure = (req, res) => {
    res.redirect(`${process.env.CLIENT_URL}?auth=error`);
};

export const forgotPassword = async (req, res) => {
    try {
        // 1) Get user based on POSTed email
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            // Send a generic success message to prevent email enumeration
            return res.status(200).json({ message: 'If a user with that email exists, a token has been sent.' });
        }

        // 2) Generate the random reset token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // 3) Hash token and save to user document
        user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        await user.save({ validateBeforeSave: false });

        // 4) Send it to user's email
        const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
        const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Your password reset token (valid for 10 min)',
                message
            });

            res.status(200).json({ message: 'Token sent to email!' });
        } catch (err) {
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false });

            console.error("EMAIL ERROR:", err);
            return res.status(500).json({ message: 'There was an error sending the email. Try again later!' });
        }
    } catch (error) {
        console.log("Error in forgotPassword controller", error.message);
        res.status(500).json({ message: "Server Error" });
    }
};

export const resetPassword = async (req, res) => {
    try {
        // 1) Get user based on the token
        const hashedToken = crypto.createHash('sha256').update(req.body.token).digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        // 2) If token has not expired, and there is a user, set the new password
        if (!user) {
            return res.status(400).json({ message: 'Token is invalid or has expired' });
        }

        if (req.body.password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        // 3) Log the user in, send JWT
        const { accessToken, refreshToken } = generateToken(user._id);
        await storeRefreshToken(user._id, refreshToken);
        setCookies(res, accessToken, refreshToken);

        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        });

    } catch (error) {
        console.log("Error in resetPassword controller", error.message);
        res.status(500).json({ message: "Server Error" });
    }
};

export const resendVerificationPin = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: "This email is already verified." });
        }

        const verificationPin = generateVerificationPin();
        user.emailVerificationPin = verificationPin;
        user.emailVerificationPinExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        const message = `Your new email verification PIN is: ${verificationPin}\nThis PIN will expire in 10 minutes.`;
        await sendEmail({
            email: user.email,
            subject: 'Your New Verification PIN',
            message
        });

        res.status(200).json({ message: "A new verification PIN has been sent to your email." });

    } catch (error) {
        console.log("Error in resendVerificationPin controller", error.message);
        res.status(500).json({ message: "Server Error" });
    }
};