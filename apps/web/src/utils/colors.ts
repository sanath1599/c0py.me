export const AVATAR_COLORS = [
  '#F6C148', '#A6521B', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
];

export const EMOJIS = [
  '🦁', '😀', '😎', '🤖', '🦄', '🐱', '🐶', '🦊', '🐼', '🐸',
  '🌟', '🔥', '⚡', '🌈', '🎯', '🎨', '🎭', '🎪', '🎸', '🚀'
];

export const getRandomColor = () => {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
};

export const getRandomEmoji = () => {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
};