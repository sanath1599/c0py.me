export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export interface ProgressBarProps {
  progress: number;
  className?: string;
  showPercentage?: boolean;
}

export interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'connecting';
  className?: string;
} 