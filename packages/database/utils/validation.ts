export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class DatabaseValidator {
  static validateUserId(userId: string): ValidationResult {
    const errors: string[] = [];
    
    if (!userId || typeof userId !== 'string') {
      errors.push('User ID must be a non-empty string');
    }
    
    if (userId.length < 3) {
      errors.push('User ID must be at least 3 characters long');
    }
    
    if (userId.length > 50) {
      errors.push('User ID must be less than 50 characters');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateFileName(fileName: string): ValidationResult {
    const errors: string[] = [];
    
    if (!fileName || typeof fileName !== 'string') {
      errors.push('File name must be a non-empty string');
    }
    
    if (fileName.length > 255) {
      errors.push('File name must be less than 255 characters');
    }
    
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(fileName)) {
      errors.push('File name contains invalid characters');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateFileSize(fileSize: number): ValidationResult {
    const errors: string[] = [];
    
    if (typeof fileSize !== 'number' || fileSize <= 0) {
      errors.push('File size must be a positive number');
    }
    
    // 1GB limit
    const maxSize = 1024 * 1024 * 1024;
    if (fileSize > maxSize) {
      errors.push('File size must be less than 1GB');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateTransferStatus(status: string): ValidationResult {
    const validStatuses = ['pending', 'accepted', 'rejected', 'completed', 'failed'];
    const errors: string[] = [];
    
    if (!validStatuses.includes(status)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
} 