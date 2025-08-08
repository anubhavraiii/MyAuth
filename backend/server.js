import express from 'express';
import dotenv from 'dotenv';
dotenv.config(); 
import cookieParser from 'cookie-parser';
import path from 'path';
import passport from './lib/passport.js';
import cors from 'cors';

import authRoutes from './routes/auth.route.js';

import { connectDB } from './lib/db.js';


const app = express();

const PORT = process.env.PORT || 5000;

const __dirname = path.resolve();

app.use(cors({
    origin: process.env.CLIENT_URL, // Allow requests from your frontend URL
    credentials: true // Allow cookies to be sent
}));

app.use(express.json({ limit: "10mb" })); // allow express to parse JSON data
app.use(cookieParser()); // to parse cookies from the request

// Initialize Passport
app.use(passport.initialize());

app.use("/api/auth", authRoutes);

if (process.env.NODE_ENV === "production") {
	app.use(express.static(path.join(__dirname, "/frontend/dist")));

	app.get(/(.*)/, (req, res) => {
		res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
	});
}

app.listen(PORT, () => {
  console.log('Server is running on http://localhost:' + PORT);
  connectDB();
});