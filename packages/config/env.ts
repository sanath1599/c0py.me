import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface EnvironmentConfig {
  NODE_ENV: string;
  PORT: number;
  MONGODB_URI: string;
  CLIENT_URL: string;
  JWT_SECRET?: string;
  CORS_ORIGIN: string;
}

export const getEnvironmentConfig = (): EnvironmentConfig => {
  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '5000', 10),
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/sharedrop',
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
    JWT_SECRET: process.env.JWT_SECRET,
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  };
};

export const isDevelopment = (): boolean => {
  return getEnvironmentConfig().NODE_ENV === 'development';
};

export const isProduction = (): boolean => {
  return getEnvironmentConfig().NODE_ENV === 'production';
};

export const isTest = (): boolean => {
  return getEnvironmentConfig().NODE_ENV === 'test';
}; 