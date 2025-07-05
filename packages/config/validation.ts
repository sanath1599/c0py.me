import { VALIDATION_CONSTANTS } from './constants';

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
}

export class ConfigValidator {
  static validatePort(port: number): ConfigValidationResult {
    const errors: string[] = [];
    
    if (typeof port !== 'number' || port <= 0) {
      errors.push('Port must be a positive number');
    }
    
    if (port < 1024 || port > 65535) {
      errors.push('Port must be between 1024 and 65535');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateMongoDBUri(uri: string): ConfigValidationResult {
    const errors: string[] = [];
    
    if (!uri || typeof uri !== 'string') {
      errors.push('MongoDB URI must be a non-empty string');
    }
    
    if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
      errors.push('MongoDB URI must start with mongodb:// or mongodb+srv://');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateClientUrl(url: string): ConfigValidationResult {
    const errors: string[] = [];
    
    if (!url || typeof url !== 'string') {
      errors.push('Client URL must be a non-empty string');
    }
    
    try {
      new URL(url);
    } catch {
      errors.push('Client URL must be a valid URL');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateJwtSecret(secret?: string): ConfigValidationResult {
    const errors: string[] = [];
    
    if (secret && typeof secret !== 'string') {
      errors.push('JWT secret must be a string');
    }
    
    if (secret && secret.length < 32) {
      errors.push('JWT secret must be at least 32 characters long');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
} 