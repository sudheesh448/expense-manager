import { format, parseISO } from 'date-fns';

/**
 * Formats a UTC ISO string into a local display string based on the user's timezone.
 * @param {string} utcString - The UTC ISO string from the database.
 * @param {string} timezone - The target timezone (e.g., 'UTC', 'Asia/Kolkata').
 * @param {string} formatStr - The date-fns format string.
 */
export const formatInTZ = (utcString, timezone = 'UTC', formatStr = 'dd MMM yyyy, hh:mm a') => {
  if (!utcString) return '';
  try {
    const date = parseISO(utcString);
    
    // If timezone is UTC or matching device, standard format is fine
    if (timezone === 'UTC') return format(date, formatStr);

    // Use Intl.DateTimeFormat to get the localized parts for the specific timezone
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    const p = {};
    parts.forEach(part => { p[part.type] = part.value; });

    // Construct a local date object from the parts (this is a bit of a hack but works across targets)
    // Note: p.month is 1-indexed in Intl
    const localDate = new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    
    return format(localDate, formatStr);
  } catch (error) {
    console.error('Date formatting error:', error);
    return utcString;
  }
};

/**
 * Converts a local Date object to a UTC ISO string for storage.
 * @param {Date} localDate - The Date object from a picker.
 * @param {string} timezone - The user's selected timezone.
 */
export const toUTC = (localDate, timezone = 'UTC') => {
  if (!localDate) return new Date().toISOString();
  
  // If timezone is UTC, just return toISOString
  if (timezone === 'UTC') return localDate.toISOString();

  // For non-UTC, we need to adjust the localDate by its offset relative to the target timezone
  // However, simpler is to just use the Date object's own UTC methods if it was picked in local time.
  // BUT the user might be picking a time intended for a DIFFERENT timezone.
  // Standard requirement: "All saves in UTC".
  // date.toISOString() ALWAYS returns the UTC equivalent of the Date object.
  return localDate.toISOString();
};

export const TIMEZONE_OPTIONS = [
  { label: '(UTC-12:00) International Date Line West', value: 'Etc/GMT+12' },
  { label: '(UTC-11:00) Coordinated Universal Time-11', value: 'Pacific/Niue' },
  { label: '(UTC-10:00) Hawaii', value: 'Pacific/Honolulu' },
  { label: '(UTC-09:30) Marquesas Islands', value: 'Pacific/Marquesas' },
  { label: '(UTC-09:00) Alaska', value: 'America/Anchorage' },
  { label: '(UTC-08:00) Pacific Time (US & Canada)', value: 'America/Los_Angeles' },
  { label: '(UTC-07:00) Mountain Time (US & Canada)', value: 'America/Denver' },
  { label: '(UTC-06:00) Central Time (US & Canada)', value: 'America/Chicago' },
  { label: '(UTC-05:00) Eastern Time (US & Canada)', value: 'America/New_York' },
  { label: '(UTC-04:00) Atlantic Time (Canada)', value: 'America/Halifax' },
  { label: '(UTC-03:30) Newfoundland', value: 'America/St_Johns' },
  { label: '(UTC-03:00) Brasilia', value: 'America/Sao_Paulo' },
  { label: '(UTC-02:00) Coordinated Universal Time-02', value: 'Atlantic/South_Georgia' },
  { label: '(UTC-01:00) Azores', value: 'Atlantic/Azores' },
  { label: '(UTC+00:00) Greenwich Mean Time : London', value: 'Europe/London' },
  { label: '(UTC+01:00) Central European Time : Paris', value: 'Europe/Paris' },
  { label: '(UTC+02:00) Eastern European Time : Athens', value: 'Europe/Athens' },
  { label: '(UTC+03:00) Moscow, St. Petersburg', value: 'Europe/Moscow' },
  { label: '(UTC+03:30) Tehran', value: 'Asia/Tehran' },
  { label: '(UTC+04:00) Abu Dhabi, Muscat', value: 'Asia/Dubai' },
  { label: '(UTC+04:30) Kabul', value: 'Asia/Kabul' },
  { label: '(UTC+05:00) Islamabad, Karachi', value: 'Asia/Karachi' },
  { label: '(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi', value: 'Asia/Kolkata' },
  { label: '(UTC+05:45) Kathmandu', value: 'Asia/Kathmandu' },
  { label: '(UTC+06:00) Astana, Dhaka', value: 'Asia/Dhaka' },
  { label: '(UTC+06:30) Yangon (Rangoon)', value: 'Asia/Yangon' },
  { label: '(UTC+07:00) Bangkok, Hanoi, Jakarta', value: 'Asia/Bangkok' },
  { label: '(UTC+08:00) Beijing, Hong Kong, Singapore', value: 'Asia/Singapore' },
  { label: '(UTC+08:45) Eucla', value: 'Australia/Eucla' },
  { label: '(UTC+09:00) Osaka, Sapporo, Tokyo', value: 'Asia/Tokyo' },
  { label: '(UTC+09:30) Adelaide', value: 'Australia/Adelaide' },
  { label: '(UTC+10:00) Canberra, Melbourne, Sydney', value: 'Australia/Sydney' },
  { label: '(UTC+10:30) Lord Howe Island', value: 'Australia/Lord_Howe' },
  { label: '(UTC+11:00) Solomon Is., New Caledonia', value: 'Pacific/Guadalcanal' },
  { label: '(UTC+12:00) Auckland, Wellington', value: 'Pacific/Auckland' },
  { label: '(UTC+12:45) Chatham Islands', value: 'Pacific/Chatham' },
  { label: '(UTC+13:00) Nuku\'alofa', value: 'Pacific/Tongatapu' },
  { label: '(UTC+14:00) Kiritimati', value: 'Pacific/Kiritimati' },
  { label: '(UTC+00:00) Coordinated Universal Time', value: 'UTC' }
];

/**
 * Finds the closest matching timezone from the 38 standard options.
 * Useful when the system returns an alias (e.g., Asia/Calcutta vs Asia/Kolkata).
 */
export const findNearestTimezone = (tzId) => {
  if (!tzId) return 'UTC';
  
  // Try exact match first
  const exact = TIMEZONE_OPTIONS.find(o => o.value === tzId);
  if (exact) return tzId;

  try {
    // Try offset match
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tzId,
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(new Date());
    const targetOffset = parts.find(p => p.type === 'timeZoneName')?.value;

    if (targetOffset) {
      // Find option with matching offset in label
      const match = TIMEZONE_OPTIONS.find(o => o.label.includes(`(${targetOffset})`));
      if (match) return match.value;
    }
  } catch (e) {}

  return 'UTC';
};

/**
 * Calculate the difference in months between two dates.
 * @param {Date} date1 Newer date
 * @param {Date} date2 Older date
 * @returns {number} Difference in months
 */
export const differenceInMonths = (date1, date2) => {
    let months = (date1.getFullYear() - date2.getFullYear()) * 12;
    months -= date2.getMonth();
    months += date1.getMonth();
    return months <= 0 ? 0 : months;
};

