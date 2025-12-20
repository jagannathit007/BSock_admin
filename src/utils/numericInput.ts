/**
 * Utility function to handle numeric input changes
 * Filters input to only allow numbers and decimal points
 * @param value - The input value
 * @param allowDecimals - Whether to allow decimal points (default: true)
 * @param allowNegative - Whether to allow negative numbers (default: false)
 * @returns Filtered numeric string
 */
export const handleNumericInput = (
  value: string,
  allowDecimals: boolean = true,
  allowNegative: boolean = false
): string => {
  // Remove all non-numeric characters except decimal point and minus sign
  let filtered = value;
  
  if (allowDecimals && allowNegative) {
    // Allow numbers, one decimal point, and one minus sign at the start
    filtered = value.replace(/[^\d.-]/g, '');
    // Ensure only one decimal point
    const parts = filtered.split('.');
    if (parts.length > 2) {
      filtered = parts[0] + '.' + parts.slice(1).join('');
    }
    // Ensure minus sign is only at the start
    if (filtered.includes('-')) {
      const minusIndex = filtered.indexOf('-');
      if (minusIndex !== 0) {
        filtered = filtered.replace(/-/g, '');
      }
      // Only allow one minus sign
      if ((filtered.match(/-/g) || []).length > 1) {
        filtered = '-' + filtered.replace(/-/g, '');
      }
    }
  } else if (allowDecimals) {
    // Allow numbers and one decimal point
    filtered = value.replace(/[^\d.]/g, '');
    // Ensure only one decimal point
    const parts = filtered.split('.');
    if (parts.length > 2) {
      filtered = parts[0] + '.' + parts.slice(1).join('');
    }
  } else if (allowNegative) {
    // Allow numbers and one minus sign at the start
    filtered = value.replace(/[^\d-]/g, '');
    // Ensure minus sign is only at the start
    if (filtered.includes('-')) {
      const minusIndex = filtered.indexOf('-');
      if (minusIndex !== 0) {
        filtered = filtered.replace(/-/g, '');
      }
      // Only allow one minus sign
      if ((filtered.match(/-/g) || []).length > 1) {
        filtered = '-' + filtered.replace(/-/g, '');
      }
    }
  } else {
    // Only allow digits
    filtered = value.replace(/[^\d]/g, '');
  }
  
  return filtered;
};

/**
 * Validates if a string is a valid number
 * @param value - The value to validate
 * @param min - Minimum value (optional)
 * @param max - Maximum value (optional)
 * @returns Object with isValid boolean and error message
 */
export const validateNumericValue = (
  value: string,
  min?: number,
  max?: number
): { isValid: boolean; error?: string } => {
  if (value === '' || value === null || value === undefined) {
    return { isValid: false, error: 'Value is required' };
  }
  
  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return { isValid: false, error: 'Must be a valid number' };
  }
  
  if (min !== undefined && numValue < min) {
    return { isValid: false, error: `Must be at least ${min}` };
  }
  
  if (max !== undefined && numValue > max) {
    return { isValid: false, error: `Must be at most ${max}` };
  }
  
  return { isValid: true };
};

