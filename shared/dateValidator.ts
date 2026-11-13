export interface DateValidationResult {
  isValid: boolean;
  errorCode:
    | 'MISSING_DATE'
    | 'INVALID_FORMAT'
    | 'INVALID_LEAP_YEAR'
    | 'NON_EXISTENT_DATE'
    | 'FUTURE_DATE'
    | null;
  message: string;
  normalizedDate: string | null;
  year?: number;
  month?: number;
  day?: number;
  todayLocal?: string;
}

/**
 * Dynamically calculates today's calendar date from the system's local clock
 * without UTC timezone shift bugs.
 */
export function getLocalTodayDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
}

/**
 * Strict semantic calendar-date validator:
 * - Accepts only YYYY-MM-DD format
 * - Validates real calendar dates & leap years
 * - Compares against dynamic local today's date without timezone offset bugs
 */
export function validateCalendarDate(
  dateStr: string | undefined | null,
  referenceNow: Date = new Date()
): DateValidationResult {
  const todayLocal = getLocalTodayDateString(referenceNow);

  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {
    return {
      isValid: false,
      errorCode: 'MISSING_DATE',
      message: 'Complaint date is required in YYYY-MM-DD format.',
      normalizedDate: null,
      todayLocal,
    };
  }

  const trimmed = dateStr.trim();
  const formatMatch = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(trimmed);
  if (!formatMatch) {
    return {
      isValid: false,
      errorCode: 'INVALID_FORMAT',
      message: 'Invalid date format. Use YYYY-MM-DD.',
      normalizedDate: null,
      todayLocal,
    };
  }

  const year = Number(formatMatch[1]);
  const month = Number(formatMatch[2]);
  const day = Number(formatMatch[3]);

  if (year < 1900 || month < 1 || month > 12 || day < 1) {
    return {
      isValid: false,
      errorCode: 'NON_EXISTENT_DATE',
      message: 'The entered date does not exist.',
      normalizedDate: null,
      year,
      month,
      day,
      todayLocal,
    };
  }

  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return {
      isValid: false,
      errorCode: 'INVALID_LEAP_YEAR',
      message: 'Please enter a valid leap-year date.',
      normalizedDate: null,
      year,
      month,
      day,
      todayLocal,
    };
  }

  const maxDay = getDaysInMonth(year, month);
  if (day > maxDay) {
    return {
      isValid: false,
      errorCode: 'NON_EXISTENT_DATE',
      message: 'The entered date does not exist.',
      normalizedDate: null,
      year,
      month,
      day,
      todayLocal,
    };
  }

  const todayYear = referenceNow.getFullYear();
  const todayMonth = referenceNow.getMonth() + 1;
  const todayDay = referenceNow.getDate();

  const inputNumeric = year * 10000 + month * 100 + day;
  const todayNumeric = todayYear * 10000 + todayMonth * 100 + todayDay;

  if (inputNumeric > todayNumeric) {
    return {
      isValid: false,
      errorCode: 'FUTURE_DATE',
      message: 'Future dates are not allowed.',
      normalizedDate: null,
      year,
      month,
      day,
      todayLocal,
    };
  }

  return {
    isValid: true,
    errorCode: null,
    message: 'Valid calendar date.',
    normalizedDate: trimmed,
    year,
    month,
    day,
    todayLocal,
  };
}
