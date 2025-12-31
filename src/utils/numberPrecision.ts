/**
 * Round a number to 2 decimal places
 * @param value - The number to round
 * @returns Rounded number with 2 decimal places
 */
export const roundToTwoDecimals = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) {
    return 0;
  }
  return Math.round((numValue + Number.EPSILON) * 100) / 100;
};

/**
 * Format a number to 2 decimal places as a string
 * @param value - The number to format
 * @returns Formatted string with 2 decimal places
 */
export const formatToTwoDecimals = (value: number | string | null | undefined): string => {
  return roundToTwoDecimals(value).toFixed(2);
};

/**
 * Round all numeric values in an object to 2 decimal places
 * Recursively processes nested objects and arrays
 * @param obj - Object, array, or value to process
 * @returns Object with all numbers rounded to 2 decimals
 */
export const roundObjectNumbers = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'number') {
    return roundToTwoDecimals(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => roundObjectNumbers(item));
  }
  
  if (typeof obj === 'object') {
    const rounded: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        rounded[key] = roundObjectNumbers(obj[key]);
      }
    }
    return rounded;
  }
  
  return obj;
};

/**
 * Format wallet amount with 2 decimal places and thousand separators
 * @param value - The wallet amount to format (number, string, null, or undefined)
 * @returns Formatted string with 2 decimal places (e.g., "$1,234.56" or "$0.00")
 */
export const formatWalletAmount = (value: number | string | null | undefined): string => {
  const numValue = roundToTwoDecimals(value);
  return numValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

