import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Zap, Globe } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { LionIcon } from '../components/LionIcon';

interface LandingPageProps {
  onGetStarted: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F9F8F5' }}>
      <div className="max-w-4xl w-full">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Animated logo */}
          <motion.div
            className="mb-8"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
              <img src="/c0py.me-logo.gif" alt="c0py.me" className="w-20 h-20" />
            </div>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            className="text-5xl md:text-6xl font-bold mb-4"
            style={{ color: '#2C1B12' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            ShareDrop
            <span style={{ color: '#A6521B' }}> by c0py.me</span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            className="text-xl md:text-2xl mb-8"
            style={{ color: '#2C1B12', opacity: 0.8 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            Secure, open-source, peer-to-peer file sharing
          </motion.p>

          {/* CTA Button */}
          <motion.button
            onClick={onGetStarted}
            className="inline-flex items-center gap-3 px-8 py-4 text-white text-lg font-semibold rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105"
            style={{ 
              backgroundColor: '#F6C148',
              boxShadow: '0 25px 50px -12px rgba(166, 82, 27, 0.25)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#A6521B';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#F6C148';
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Get Started
            <ArrowRight size={20} />
          </motion.button>
        </motion.div>

        {/* Features */}
        <motion.div
          className="grid md:grid-cols-3 gap-6 mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
        >
          <GlassCard className="p-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4" style={{ color: '#F6C148' }} />
            <h3 className="text-xl font-bold mb-2" style={{ color: '#2C1B12' }}>Secure</h3>
            <p style={{ color: '#2C1B12', opacity: 0.7 }}>
              End-to-end encrypted transfers with no files stored on servers
            </p>
          </GlassCard>

          <GlassCard className="p-6 text-center">
            <Zap className="w-12 h-12 mx-auto mb-4" style={{ color: '#F6C148' }} />
            <h3 className="text-xl font-bold mb-2" style={{ color: '#2C1B12' }}>Fast</h3>
            <p style={{ color: '#2C1B12', opacity: 0.7 }}>
              Direct peer-to-peer connections for maximum transfer speeds
            </p>
          </GlassCard>

          <GlassCard className="p-6 text-center">
            <Globe className="w-12 h-12 mx-auto mb-4" style={{ color: '#F6C148' }} />
            <h3 className="text-xl font-bold mb-2" style={{ color: '#2C1B12' }}>Universal</h3>
            <p style={{ color: '#2C1B12', opacity: 0.7 }}>
              Works across all devices and platforms with just a web browser
            </p>
          </GlassCard>
        </motion.div>

        {/* Footer */}
        <motion.div
          className="text-center"
          style={{ color: '#2C1B12', opacity: 0.6 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
        >
          <p className="mb-2">
            MIT Licensed • Built with React, WebRTC, and Socket.IO
          </p>
          <div className="flex justify-center gap-4 text-sm">
            <span className="px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)', color: '#A6521B' }}>React 18</span>
            <span className="px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)', color: '#A6521B' }}>WebRTC</span>
            <span className="px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)', color: '#A6521B' }}>Socket.IO</span>
            <span className="px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)', color: '#A6521B' }}>TypeScript</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};