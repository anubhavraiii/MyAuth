import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Loader, Send } from "lucide-react";
import { useUserStore } from "../stores/useUserStore";
import { toast } from "react-hot-toast";

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState("");
    const { forgotPassword, loading } = useUserStore();

    const handleSubmit = async (e) => {
        e.preventDefault();
        await forgotPassword(email);
        toast.success("If an account with that email exists, a password reset link has been sent.");
        setEmail("");
    };

    return (
        <div className='flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
            <motion.div
                className='sm:mx-auto sm:w-full sm:max-w-md'
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
            >
                <h2 className='mt-6 text-center text-3xl font-extrabold text-emerald-400'>Forgot Your Password?</h2>
                <p className="mt-2 text-center text-sm text-gray-400">
                    No problem. Enter your email address below and we'll send you a link to reset it.
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
                            <label htmlFor='email' className='block text-sm font-medium text-gray-300'>
                                Email address
                            </label>
                            <div className='mt-1 relative rounded-md shadow-sm'>
                                <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                                    <Mail className='h-5 w-5 text-gray-400' aria-hidden='true' />
                                </div>
                                <input
                                    id='email'
                                    type='email'
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className=' block w-full px-3 py-2 pl-10 bg-gray-700 border border-gray-600 
                                    rounded-md shadow-sm
                                     placeholder-gray-400 focus:outline-none focus:ring-emerald-500 
                                     focus:border-emerald-500 sm:text-sm'
                                    placeholder='name@example.com'
                                />
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
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className='mr-2 h-5 w-5' aria-hidden='true' />
                                    Send Reset Link
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

export default ForgotPasswordPage;