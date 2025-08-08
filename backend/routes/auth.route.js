import express from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, signup, refreshToken, getProfile, googleAuthSuccess, googleAuthFailure, forgotPassword, resetPassword, verifyEmail, resendVerificationPin } from '../controllers/auth.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';
import passport from '../lib/passport.js';

const router = express.Router();

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5, // Limit each IP to 5 requests per windowMs
	message: 'Too many requests from this IP, please try again after 15 minutes',
});

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.post("/refresh-token", refreshToken);
router.get("/profile", protectRoute, getProfile);

router.post("/forgot-password",authLimiter, forgotPassword);
router.post("/reset-password",authLimiter, resetPassword);

router.post("/verify-email", verifyEmail);
router.post("/resend-verification-pin", resendVerificationPin);

// Google OAuth routes
router.get("/google", 
    passport.authenticate("google", { 
        scope: ["profile", "email"] 
    })
);

router.get("/google/callback",
    passport.authenticate("google", { 
        failureRedirect: "/auth/google/failure",
        session: false 
    }),
    googleAuthSuccess
);

router.get("/google/failure", googleAuthFailure);

export default router;