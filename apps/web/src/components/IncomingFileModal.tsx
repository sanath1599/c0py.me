import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { File as FileIcon, User, X, Download, XCircle, Shield, FileText, Clock } from 'lucide-react';
import { formatFileSize } from '../utils/format';
import { trackPrivacyEvents } from '../utils/analytics';

interface IncomingFileModalProps {
  isOpen: boolean;
  file: {
    id: string;
    from: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  } | null;
  onAccept: (fileHandle?: FileSystemFileHandle) => void;
  onReject: () => void;
}

export const IncomingFileModal: React.FC<IncomingFileModalProps> = ({
  isOpen,
  file,
  onAccept,
  onReject,
}) => {
  if (!isOpen || !file) return null;

  // Prefer fromName if available, fallback to from
  const senderName = (file as any).fromName || file.from;
  
  // Check if File System Access API is available
  // Note: iOS Safari and most mobile browsers don't support this API
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const hasFileSystemAccess = 'showSaveFilePicker' in window && 
                              window.isSecureContext && 
                              !isIOS; // iOS doesn't support File System Access API

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px] z-0" />
          {/* Modal Card */}
          <motion.div
            className="w-full max-w-md mx-4 z-10"
            initial={{ scale: 0.96, opacity: 0, y: 32 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 32 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          >
            <GlassCard className="pt-10 pb-8 px-6 min-h-[340px] relative flex flex-col items-center">
              {/* Glassy Icon */}
              <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/40 bg-white/30 backdrop-blur-[12px] mb-4 relative overflow-hidden">
                <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: 'linear-gradient(120deg,rgba(255,255,255,0.25) 0%,rgba(255,255,255,0.05) 100%)', zIndex: 1 }} />
                <FileIcon size={44} className="text-orange-700 z-10" />
              </div>
              {/* Sender */}
              <div className="mb-2 text-center">
                <h2 className="text-xl font-bold mb-1" style={{ color: '#2C1B12' }}>{file.fileName}</h2>
                <span className="text-xs font-bold tracking-widest text-orange-700 drop-shadow-sm">Incoming File</span>
                <p className="text-sm text-orange-800 font-medium mb-1 mt-2">From: {senderName}</p>
                <p className="text-xs text-orange-700/80">{formatFileSize(file.fileSize)}</p>
                {!hasFileSystemAccess && (
                  <p className="text-xs text-orange-600/70 mt-2 px-2 py-1 bg-orange-50/50 rounded">
                    {isIOS || isMobile 
                      ? 'File will download automatically after transfer completes'
                      : 'File will be saved to browser storage (choose download location after transfer)'}
                  </p>
                )}
              </div>
              {/* Actions */}
              <div className="flex gap-4 mt-8 w-full">
                <button
                  onClick={async () => {
                    trackPrivacyEvents.fileReceived(file.fileType);
                    
                    // Try to get file handle using File System Access API
                    let fileHandle: FileSystemFileHandle | undefined;
                    
                    console.log('🔍 Checking for File System Access API support...');
                    console.log('   showSaveFilePicker available:', 'showSaveFilePicker' in window);
                    console.log('   isSecureContext:', window.isSecureContext);
                    console.log('   protocol:', window.location.protocol);
                    console.log('   hostname:', window.location.hostname);
                    
                    // File System Access API requires HTTPS (or localhost)
                    const isSecure = window.isSecureContext || 
                                    window.location.protocol === 'https:' || 
                                    window.location.hostname === 'localhost' ||
                                    window.location.hostname === '127.0.0.1';
                    
                    if ('showSaveFilePicker' in window && isSecure) {
                      try {
                        console.log('📂 Opening file save dialog...');
                        const fileExtension = file.fileName.split('.').pop() || '';
                        const mimeType = file.fileType || 'application/octet-stream';
                        
                        fileHandle = await (window as any).showSaveFilePicker({
                          suggestedName: file.fileName,
                          types: fileExtension ? [{
                            description: 'File',
                            accept: { [mimeType]: [`.${fileExtension}`] }
                          }] : undefined
                        });
                        console.log('✅ User selected save location:', fileHandle.name);
                      } catch (error: any) {
                        // User cancelled or error occurred
                        if (error.name === 'AbortError') {
                          console.log('⚠️ User cancelled file save dialog');
                          return; // Don't proceed if user cancelled
                        } else {
                          console.error('❌ Error getting file handle:', error);
                          console.error('   Error name:', error.name);
                          console.error('   Error message:', error.message);
                          // Continue without file handle - will use memory/IndexedDB fallback
                        }
                      }
                    } else {
                      if (isIOS) {
                        console.log('ℹ️ iOS detected - File System Access API not supported');
                        console.log('   File will be downloaded automatically after transfer completes');
                      } else if (isMobile) {
                        console.log('ℹ️ Mobile device detected - File System Access API may not be supported');
                        console.log('   File will be downloaded automatically after transfer completes');
                      } else {
                        console.warn('⚠️ File System Access API not available');
                        console.warn('   Browser may not support showSaveFilePicker');
                        console.warn('   File will be saved to memory/IndexedDB instead');
                      }
                    }
                    
                    // Always proceed - on mobile/iOS, file will be downloaded after completion
                    onAccept(fileHandle);
                  }}
                  className="flex-1 py-3 rounded-xl bg-white/40 border border-orange-200 text-orange-900 font-bold text-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all hover:scale-105 backdrop-blur-[8px] relative overflow-hidden"
                  style={{ boxShadow: '0 4px 24px 0 #F6C14844' }}
                >
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/60 backdrop-blur-[6px] mr-2 shadow border border-white/30">
                    <FileIcon size={20} className="text-orange-700" />
                  </span>
                  Accept & Save
                  <span className="pointer-events-none absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(120deg,rgba(255,255,255,0.18) 0%,rgba(255,255,255,0.05) 100%)' }} />
                </button>
                <button
                  onClick={() => {
                    trackPrivacyEvents.fileRejected(file.fileType);
                    onReject();
                  }}
                  className="flex-1 py-3 rounded-xl bg-white/30 border border-orange-100 text-orange-700 font-bold text-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all hover:scale-105 backdrop-blur-[8px] relative overflow-hidden"
                >
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/50 backdrop-blur-[6px] mr-2 shadow border border-white/30">
                    <FileIcon size={20} className="text-orange-400" />
                  </span>
                  Reject
                  <span className="pointer-events-none absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(120deg,rgba(255,255,255,0.18) 0%,rgba(255,255,255,0.05) 100%)' }} />
                </button>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 