import { create } from 'zustand';
import axios from '../lib/axios';
import {toast} from 'react-hot-toast';

export const useUserStore = create((set, get) => ({
    user: null,
    loading: false,
    checkingAuth: true,

    signup: async (formData) => {
        set({ loading: true });
        if (formData.password !== formData.confirmPassword) {
			set({ loading: false });
			return toast.error("Passwords do not match");
		}
		try {
			const res = await axios.post("/auth/signup", formData);
            // we don't set user, just return success and email for redirection
			return { success: true, email: res.data.email }; 
		} catch (error) {
			toast.error(error.response.data.message || "An error occurred");
            return { success: false };
		} finally {
            set({ loading: false });
        }
    },

	verifyEmail: async (email, pin) => {
        set({ loading: true });
        try {
            const res = await axios.post("/auth/verify-email", { email, pin });
            set({ user: res.data });
            toast.success("Email verified successfully! You are now logged in.");
            return true; // Indicate success
        } catch (error) {
            toast.error(error.response.data.message || "Verification failed");
            return false; // Indicate failure
        } finally {
            set({ loading: false });
        }
    },

    login: async (email, password) => {
		set({ loading: true });
		try {
			const res = await axios.post("/auth/login", { email, password });
			set({ user: res.data, loading: false });
            return { success: true };
		} catch (error) {
			set({ loading: false });
            if (error.response && error.response.data && error.response.data.message) {
                toast.error(error.response.data.message);
            } else {
                toast.error("An unexpected error occurred.");
            }

            if (error.response?.data?.notVerified) {
                return { success: false, notVerified: true, email: error.response.data.email };
            }
            
            return { success: false };
		}
	},

    logout: async () => {
		try {
			await axios.post("/auth/logout");
			set({ user: null });
		} catch (error) {
			toast.error(error.response?.data?.message || "An error occurred during logout");
		}
	},

    checkAuth: async () => {
		set({ checkingAuth: true });
		try {
			const response = await axios.get("/auth/profile");
			set({ user: response.data, checkingAuth: false });
		} catch (error) {
			console.log(error.message);
			set({ checkingAuth: false, user: null });
		}
	},

	refreshToken: async () => {
		// Prevent multiple simultaneous refresh attempts
		if (get().checkingAuth) return;

		set({ checkingAuth: true });
		try {
			const response = await axios.post("/auth/refresh-token");
			set({ checkingAuth: false });
			return response.data;
		} catch (error) {
			set({ user: null, checkingAuth: false });
			throw error;
		}
	},

    forgotPassword: async (email) => {
        set({ loading: true });
        try {
            await axios.post("/auth/forgot-password", { email });
        } catch (error) {
            toast.error(error.response.data.message || "An error occurred");
        } finally {
            set({ loading: false });
        }
    },

    resetPassword: async (token, password) => {
        set({ loading: true });
        try {
            const res = await axios.post("/auth/reset-password", { token, password });
            set({ user: res.data }); // Log the user in
            toast.success("Password has been reset successfully!");
        } catch (error) {
            toast.error(error.response.data.message || "An error occurred");
        } finally {
            set({ loading: false });
        }
    },

	resendVerificationPin: async (email) => {
        try {
            const res = await axios.post("/auth/resend-verification-pin", { email });
            toast.success(res.data.message);
        } catch (error) {
            toast.error(error.response.data.message || "Failed to resend PIN");
        }
    }
}))

let refreshPromise = null;

axios.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config;
		if (error.response?.status === 401 && !originalRequest._retry) {
			originalRequest._retry = true;

			try {
				// If a refresh is already in progress, wait for it to complete
				if (refreshPromise) {
					await refreshPromise;
					return axios(originalRequest);
				}

				// Start a new refresh process
				refreshPromise = useUserStore.getState().refreshToken();
				await refreshPromise;
				refreshPromise = null;

				return axios(originalRequest);
			} catch (refreshError) {
				// If refresh fails, redirect to login or handle as needed
				useUserStore.getState().logout();
				return Promise.reject(refreshError);
			}
		}
		return Promise.reject(error);
	}
);