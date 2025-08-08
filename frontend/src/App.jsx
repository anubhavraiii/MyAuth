import { Navigate, Route, Routes, useNavigate } from "react-router-dom"
import { Toaster, toast } from "react-hot-toast";
import HomePage from "./pages/HomePage.jsx"
import LoginPage from "./pages/LoginPage.jsx"
import SignUpPage from "./pages/SignUpPage.jsx"
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx"
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx"
import VerifyEmailPage from "./pages/VerifyEmailPage.jsx"

import Navbar from "./components/Navbar.jsx"
import { Toaster } from "react-hot-toast"
import LoadingSpinner from "./components/LoadingSpinner.jsx"
import { useUserStore } from "./stores/useUserStore.js";
import { useEffect } from "react"


function App() {
  const { user, checkAuth, checkingAuth } = useUserStore();
  const navigate = useNavigate();

  useEffect(() => {
		checkAuth();
	}, [checkAuth]);

  // Handle Google auth callback
  useEffect(() => {
    const handleAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const authStatus = urlParams.get('auth');
      
      if (authStatus === 'success') {
          toast.success('Successfully signed in with Google!');
          await checkAuth();
          // Use navigate to clean the URL by removing the query parameter
          navigate('/', { replace: true });
      } else if (authStatus === 'error') {
          toast.error('Google sign-in failed. Please try again.');
          navigate('/login', { replace: true });
      }
    };

    handleAuthCallback();
	}, [checkAuth, navigate]);

  if (checkingAuth) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden">
 
      {/* background gradient */}
      <div className='absolute inset-0 overflow-hidden'>
				<div className='absolute inset-0'>
					<div className='absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.3)_0%,rgba(10,80,60,0.3)_45%,rgba(0,0,0,0.1)_100%)]' />
				</div>
			</div>

      <div className='relative z-50 pt-20'>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage/>} />

          <Route path="/signup" element={!user ? <SignUpPage /> : <Navigate to='/' />} />
          <Route path="/login" element={!user ? <LoginPage /> : <Navigate to='/' />} />

          <Route path="/forgot-password" element={!user ? <ForgotPasswordPage /> : <Navigate to='/' />} />
          <Route path="/reset-password/:token" element={!user ? <ResetPasswordPage /> : <Navigate to='/' />} />
          <Route path="/verify-email" element={!user ? <VerifyEmailPage /> : <Navigate to='/' />} />
        </Routes>
      </div>
      <Toaster />
    </div>
  )
}

export default App