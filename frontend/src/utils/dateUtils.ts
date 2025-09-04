/**
 * Date utilities for Thailand timezone conversion
 * 
 * This utility handles conversion from UTC (backend) to Thailand timezone (UTC+7)
 * 
 * Usage examples:
 * 
 * // Relative time (e.g., "2 ชั่วโมงที่แล้ว")
 * formatRelativeThailandTime('2024-01-15T10:00:00Z') // "2 ชั่วโมงที่แล้ว"
 * 
 * // Full date and time in Thai
 * formatThailandDateTime('2024-01-15T10:00:00Z') // "15 มกราคม 2567 เวลา 17:00"
 * 
 * // Date only
 * formatThailandDateOnly('2024-01-15T10:00:00Z') // "15/01/2567"
 * 
 * // Time only
 * formatThailandTime('2024-01-15T10:00:00Z') // "17:00"
 */

// Thailand timezone offset: UTC+7
const THAILAND_OFFSET = 7 * 60; // minutes

/**
 * Convert UTC date string to Thailand time
 * @param utcDateString - UTC date string from backend (e.g., "2024-01-15T10:00:00Z")
 * @returns Date object in Thailand timezone
 */
export function utcToThailandTime(utcDateString: string): Date {
  const utcDate = new Date(utcDateString);
  
  // Create a new date object and add Thailand offset
  const thailandDate = new Date(utcDate.getTime() + (THAILAND_OFFSET * 60 * 1000));
  
  return thailandDate;
}

/**
 * Format date for display in Thailand timezone
 * @param utcDateString - UTC date string from backend
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string in Thailand timezone
 */
export function formatThailandDate(
  utcDateString: string, 
  options: Intl.DateTimeFormatOptions = {}
): string {
  const thailandDate = utcToThailandTime(utcDateString);
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };
  
  return thailandDate.toLocaleString('th-TH', defaultOptions);
}

/**
 * Format relative time (e.g., "2 ชั่วโมงที่แล้ว") in Thailand timezone
 * @param utcDateString - UTC date string from backend
 * @returns Relative time string in Thai
 */
export function formatRelativeThailandTime(utcDateString: string): string {
  const thailandDate = utcToThailandTime(utcDateString);
  
  // Get current time in Thailand timezone
  const now = new Date();
  const thailandNow = new Date(now.getTime() + (THAILAND_OFFSET * 60 * 1000));
  

  
  // Calculate difference between Thailand times
  const diffInMs = thailandNow.getTime() - thailandDate.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  

  
  if (diffInMinutes < 1) {
    return 'ไม่กี่นาทีที่แล้ว';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} นาทีที่แล้ว`;
  } else if (diffInHours < 24) {
    return `${diffInHours} ชั่วโมงที่แล้ว`;
  } else if (diffInDays < 7) {
    return `${diffInDays} วันที่แล้ว`;
  } else if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `${weeks} สัปดาห์ที่แล้ว`;
  } else if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return `${months} เดือนที่แล้ว`;
  } else {
    const years = Math.floor(diffInDays / 365);
    return `${years} ปีที่แล้ว`;
  }
}

/**
 * Format time only (HH:MM) in Thailand timezone
 * @param utcDateString - UTC date string from backend
 * @returns Time string in HH:MM format
 */
export function formatThailandTime(utcDateString: string): string {
  const thailandDate = utcToThailandTime(utcDateString);
  
  return thailandDate.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Format date only (DD/MM/YYYY) in Thailand timezone
 * @param utcDateString - UTC date string from backend
 * @returns Date string in DD/MM/YYYY format
 */
export function formatThailandDateOnly(utcDateString: string): string {
  const thailandDate = utcToThailandTime(utcDateString);
  
  return thailandDate.toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Format full date and time in Thailand timezone
 * @param utcDateString - UTC date string from backend
 * @returns Full date and time string in Thai
 */
export function formatThailandDateTime(utcDateString: string): string {
  const thailandDate = utcToThailandTime(utcDateString);
  
  return thailandDate.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Check if date is today in Thailand timezone
 * @param utcDateString - UTC date string from backend
 * @returns boolean
 */
export function isTodayInThailand(utcDateString: string): boolean {
  const thailandDate = utcToThailandTime(utcDateString);
  const now = new Date();
  
  // Convert both to Thailand time for accurate comparison
  const thailandNow = new Date(now.getTime() + (THAILAND_OFFSET * 60 * 1000));
  
  return thailandDate.toDateString() === thailandNow.toDateString();
}

/**
 * Get current Thailand time
 * @returns Current date in Thailand timezone
 */
export function getCurrentThailandTime(): Date {
  const now = new Date();
  return new Date(now.getTime() + (THAILAND_OFFSET * 60 * 1000));
}
