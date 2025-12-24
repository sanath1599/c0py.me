import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';

const ADMIN_PASSWORD = 'sharedrop2024'; // Secret password for admin access

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!password) {
      setError('Please enter the password');
      return;
    }

    setIsLoading(true);
    
    // Simulate a small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (password === ADMIN_PASSWORD) {
      // Store authentication in sessionStorage
      sessionStorage.setItem('admin_authenticated', 'true');
      navigate('/admin');
    } else {
      setError('Incorrect password. Access denied.');
      setPassword('');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ 
      background: 'linear-gradient(135deg, #F6C148 0%, #A6521B 100%)'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <GlassCard className="p-8">
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
              style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}
            >
              <Lock className="w-8 h-8" style={{ color: '#A6521B' }} />
            </motion.div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#2C1B12' }}>
              Admin Access
            </h1>
            <p className="text-sm" style={{ color: '#A6521B', opacity: 0.8 }}>
              Enter the secret password to access the admin dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: '#2C1B12' }}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  className="w-full px-4 py-3 pr-12 rounded-lg border-2 focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderColor: error ? '#ef4444' : 'rgba(166, 82, 27, 0.2)',
                    focusRingColor: '#A6521B',
                    color: '#2C1B12'
                  }}
                  placeholder="Enter admin password"
                  disabled={isLoading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 transition-colors"
                  style={{ color: '#A6521B' }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg text-sm"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full py-3 rounded-lg font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: isLoading ? '#999999' : '#A6521B'
              }}
              onMouseEnter={(e) => {
                if (!isLoading && password) {
                  e.currentTarget.style.backgroundColor = '#8B4513';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && password) {
                  e.currentTarget.style.backgroundColor = '#A6521B';
                }
              }}
            >
              {isLoading ? 'Verifying...' : 'Access Admin Dashboard'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/app')}
              className="text-sm hover:underline"
              style={{ color: '#A6521B', opacity: 0.8 }}
            >
              ← Back to App
            </button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};

