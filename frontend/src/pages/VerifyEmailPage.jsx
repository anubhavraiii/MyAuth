import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { MailCheck, Loader } from "lucide-react";
import { useUserStore } from "../stores/useUserStore";
import { toast } from "react-hot-toast";

const VerifyEmailPage = () => {
    const [pin, setPin] = useState(new Array(4).fill(""));
    const inputRefs = useRef([]);
    const navigate = useNavigate();
    const location = useLocation();
    const emailToVerify = location.state?.email;

    const [isResending, setIsResending] = useState(false); 
    const { verifyEmail, loading, resendVerificationPin } = useUserStore();

    useEffect(() => {
        if (!emailToVerify) {
            toast.error("No email to verify. Please sign up first.");
            navigate("/signup");
        }
    }, [emailToVerify, navigate]);

    const handleChange = (e, index) => {
        const { value } = e.target;
        if (isNaN(value)) return;

        const newPin = [...pin];
        newPin[index] = value;
        setPin(newPin);

        // Move to next input
        if (value && index < 3) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === "Backspace" && !pin[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const verificationPin = pin.join("");
        if (verificationPin.length !== 4) {
            return toast.error("Please enter the complete 4-digit PIN.");
        }

        const success = await verifyEmail(emailToVerify, verificationPin);
        if (success) {
            navigate("/");
        }
    };

    const handleResendPin = async () => {
        setIsResending(true);
        await resendVerificationPin(emailToVerify);
        setIsResending(false);
    };

    return (
        <div className='flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
            <motion.div
                className='sm:mx-auto sm:w-full sm:max-w-md'
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
            >
                <h2 className='mt-6 text-center text-3xl font-extrabold text-emerald-400'>Verify Your Email</h2>
                <p className="mt-2 text-center text-sm text-gray-400">
                    We've sent a 4-digit PIN to <span className="font-medium text-emerald-300">{emailToVerify}</span>
                </p>
            </motion.div>

            <motion.div
                className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
            >
                <div className='bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10'>
                    <form onSubmit={handleSubmit} className='space-y-6'>
                        <div>
                            <label className='block text-sm font-medium text-gray-300 text-center'>
                                Enter your PIN
                            </label>
                            <div className='mt-1 flex justify-center gap-3'>
                                {pin.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(el) => (inputRefs.current[index] = el)}
                                        type="text"
                                        maxLength="1"
                                        value={digit}
                                        onChange={(e) => handleChange(e, index)}
                                        onKeyDown={(e) => handleKeyDown(e, index)}
                                        className="w-12 h-12 bg-gray-700 border border-gray-600 rounded-md text-center text-2xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                ))}
                            </div>
                        </div>

                        <button
                            type='submit'
                            className='w-full flex justify-center py-2 px-4 border border-transparent 
                            rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600
                             hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2
                              focus:ring-emerald-500 transition duration-150 ease-in-out disabled:opacity-50'
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader className='mr-2 h-5 w-5 animate-spin' aria-hidden='true' />
                                    Verifying...
                                </>
                            ) : (
                                <>
                                    <MailCheck className='mr-2 h-5 w-5' aria-hidden='true' />
                                    Verify Account
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-4 text-center">
                        <p className="text-sm text-gray-400">
                            Didn't receive the email?{" "}
                            <button
                                type="button"
                                onClick={handleResendPin}
                                disabled={isResending}
                                className="font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isResending ? "Sending..." : "Resend PIN"}
                            </button>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default VerifyEmailPage;