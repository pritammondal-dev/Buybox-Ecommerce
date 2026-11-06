/**
 * Deterministic Date Formatting Utility for Buybox E-Commerce
 *
 * Enforces business defaults:
 * - Locale: 'en-IN' (Day/Month/Year ordering)
 * - Timezone: 'Asia/Kolkata' (IST - UTC+5:30)
 *
 * Ensures identical SSR server markup and client hydration output,
 * eliminating environment-dependent date mismatches.
 */

export const DEFAULT_LOCALE = "en-IN";
export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * Safely parses any date input into a valid Date object or null.
 *
 * @param {string | number | Date | null | undefined} dateInput
 * @returns {Date | null}
 */
export function parseDate(dateInput) {
  if (
    dateInput === null ||
    dateInput === undefined ||
    dateInput === "" ||
    (typeof dateInput === "string" && dateInput.trim() === "")
  ) {
    return null;
  }

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * Checks whether an input represents a valid parseable date.
 *
 * @param {any} dateInput
 * @returns {boolean}
 */
export function isValidDate(dateInput) {
  return parseDate(dateInput) !== null;
}

/**
 * Deterministically formats a date with an explicitly specified locale and timezone.
 * Defaults to 'en-IN' and 'Asia/Kolkata'.
 *
 * @param {string | number | Date | null | undefined} dateInput
 * @param {Intl.DateTimeFormatOptions} [options={}]
 * @param {string} [locale=DEFAULT_LOCALE]
 * @param {string} [timeZone=DEFAULT_TIMEZONE]
 * @returns {string | null} Formatted date string, or null if input is missing or invalid.
 */
export function formatDate(
  dateInput,
  options = {},
  locale = DEFAULT_LOCALE,
  timeZone = DEFAULT_TIMEZONE
) {
  const date = parseDate(dateInput);
  if (!date) {
    return null;
  }

  const resolvedLocale = locale || DEFAULT_LOCALE;
  const resolvedTimeZone = options?.timeZone || timeZone || DEFAULT_TIMEZONE;

  try {
    const formatter = new Intl.DateTimeFormat(resolvedLocale, {
      timeZone: resolvedTimeZone,
      ...options,
    });
    return formatter.format(date);
  } catch {
    // Fallback if Intl fails or environment lacks full ICU data
    try {
      const utcMs = date.getTime();
      const istMs = utcMs + 5.5 * 60 * 60 * 1000;
      const istDate = new Date(istMs);
      const day = istDate.getUTCDate();
      const month = istDate.getUTCMonth() + 1;
      const year = istDate.getUTCFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return null;
    }
  }
}

/**
 * Formatter for campaign card end dates.
 * Produces deterministic day/month/year strings in en-IN and Asia/Kolkata (e.g. "11/3/2026").
 * Returns null for missing or invalid dates.
 *
 * @param {string | number | Date | null | undefined} dateInput
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string | null}
 */
export function formatCampaignEndDate(dateInput, options) {
  return formatDate(dateInput, options, DEFAULT_LOCALE, DEFAULT_TIMEZONE);
}

export default formatDate;
