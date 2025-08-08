import axios from "axios";

//const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const axiosInstance = axios.create({
	//baseURL: import.meta.mode === "development" ? "http://localhost:5000/api" : "/api",
	baseURL: import.meta.env.PROD 
        ? "https://myauth-backend.onrender.com/api" 
        : "http://localhost:5000/api",
	withCredentials: true, // send cookies to the server
});

export default axiosInstance;