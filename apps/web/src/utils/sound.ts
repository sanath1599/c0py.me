// Sound utilities for notifications

// Base64 encoded chime bell sound (short, pleasant notification sound)
const CHIME_SOUND_BASE64 = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';

// Create audio element for chime sound
let chimeAudio: HTMLAudioElement | null = null;

export function playChime() {
  try {
    if (!chimeAudio) {
      chimeAudio = new Audio(CHIME_SOUND_BASE64);
      chimeAudio.volume = 0.3; // Set volume to 30%
    }
    
    // Reset and play
    chimeAudio.currentTime = 0;
    chimeAudio.play().catch(error => {
      console.warn('Could not play chime sound:', error);
    });
  } catch (error) {
    console.warn('Error playing chime sound:', error);
  }
}

// Play success sound (slightly different tone)
export function playSuccessSound() {
  try {
    if (!chimeAudio) {
      chimeAudio = new Audio(CHIME_SOUND_BASE64);
      chimeAudio.volume = 0.4; // Slightly louder for success
    }
    
    chimeAudio.currentTime = 0;
    chimeAudio.play().catch(error => {
      console.warn('Could not play success sound:', error);
    });
  } catch (error) {
    console.warn('Error playing success sound:', error);
  }
}

// Play error sound (lower pitch)
export function playErrorSound() {
  try {
    if (!chimeAudio) {
      chimeAudio = new Audio(CHIME_SOUND_BASE64);
      chimeAudio.volume = 0.2; // Quieter for errors
    }
    
    chimeAudio.currentTime = 0;
    chimeAudio.play().catch(error => {
      console.warn('Could not play error sound:', error);
    });
  } catch (error) {
    console.warn('Error playing error sound:', error);
  }
}

// Cleanup function
export function cleanupAudio() {
  if (chimeAudio) {
    chimeAudio.pause();
    chimeAudio = null;
  }
} 