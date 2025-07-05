import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, File } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { formatFileSize } from '../utils/format';

interface UploadCircleProps {
  selectedFiles: File[];
  onFilesSelected: (files: File[]) => void;
  onFileRemove: (index: number) => void;
}

export const UploadCircle: React.FC<UploadCircleProps> = ({
  selectedFiles,
  onFilesSelected,
  onFileRemove
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    onFilesSelected([...selectedFiles, ...files]);
  }, [selectedFiles, onFilesSelected]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      onFilesSelected([...selectedFiles, ...files]);
    }
  }, [selectedFiles, onFilesSelected]);

  const handleClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = handleFileInput;
    input.click();
  };

  return (
    <GlassCard className="p-6">
      <h2 className="text-xl font-bold mb-6" style={{ color: '#2C1B12' }}>Select Files</h2>
      
      <motion.div
        className={`
          relative w-64 h-64 mx-auto rounded-full border-2 border-dashed
          flex items-center justify-center cursor-pointer transition-colors
        `}
        style={{
          borderColor: isDragOver ? '#F6C148' : 'rgba(166, 82, 27, 0.3)',
          backgroundColor: isDragOver ? 'rgba(246, 193, 72, 0.1)' : 'transparent'
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="text-center">
          <motion.div
            animate={{ y: isDragOver ? -5 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Upload className="w-12 h-12 mx-auto mb-4" style={{ color: '#A6521B', opacity: 0.6 }} />
            <p className="font-medium mb-2" style={{ color: '#2C1B12', opacity: 0.8 }}>
              {isDragOver ? 'Drop files here' : 'Drop files or click to select'}
            </p>
            <p className="text-sm" style={{ color: '#2C1B12', opacity: 0.6 }}>
              Any file type, any size
            </p>
          </motion.div>
        </div>

        {/* Pulse animation when dragging */}
        {isDragOver && (
          <motion.div
            className="absolute inset-0 rounded-full border-2"
            style={{ borderColor: '#F6C148' }}
            animate={{ scale: [1, 1.1], opacity: [0.5, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.div>

      {/* Selected files */}
      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            className="mt-6 space-y-2 max-h-32 overflow-y-auto"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {selectedFiles.map((file, index) => (
              <motion.div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 p-2 bg-white/5 rounded-lg"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
              >
                <File className="w-4 h-4 flex-shrink-0" style={{ color: '#A6521B', opacity: 0.6 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: '#2C1B12' }}>{file.name}</p>
                  <p className="text-xs" style={{ color: '#2C1B12', opacity: 0.6 }}>{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileRemove(index);
                  }}
                  className="p-1 rounded transition-colors"
                  style={{ color: '#A6521B', opacity: 0.6 }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)';
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.opacity = '0.6';
                  }}
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};