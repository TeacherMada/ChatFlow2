import React, { useState, useEffect } from 'react';
import { MessageSquare, Facebook, CheckCircle2, Zap, Shield, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login({ onLogin }: any) {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        onLogin(event.data.user);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLogin]);

  const handleFacebookLogin = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/facebook/url');
      const data = await res.json();
      
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      window.open(
        data.url,
        'oauth_popup',
        `width=${width},height=${height},top=${top},left=${left}`
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Zap, text: "Visual Flow Builder" },
    { icon: Shield, text: "Secure & Scalable" },
    { icon: BarChart3, text: "Real-time Analytics" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="flex justify-center"
        >
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl shadow-lg flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
        </motion.div>
        <motion.h2 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-6 text-center text-3xl font-extrabold text-gray-900"
        >
          Sign in to ChatFlow
        </motion.h2>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-2 text-center text-sm text-gray-600"
        >
          Automate your Messenger marketing in minutes.
        </motion.p>
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white py-8 px-4 shadow-xl shadow-indigo-100/50 sm:rounded-xl sm:px-10 border border-gray-100">
          <div className="space-y-6">
            <button
              onClick={handleFacebookLogin}
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#1877F2] hover:bg-[#166fe5] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1877F2] disabled:opacity-50 transition-all transform hover:scale-[1.02] active:scale-[0.98] items-center gap-3"
            >
              <Facebook className="w-5 h-5" />
              {isLoading ? 'Connecting...' : 'Continue with Facebook'}
            </button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Trusted by marketers</span>
              </div>
            </div>

            <div className="grid gap-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>{feature.text}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-center text-gray-400 mt-6">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
