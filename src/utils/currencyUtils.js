/**
 * Multi-Currency Utility
 * Provides symbols and formatting helpers for global currency support.
 */

export const CURRENCY_OPTIONS = [
  { label: 'Indian Rupee (INR)', value: 'INR', symbol: '₹' },
  { label: 'US Dollar (USD)', value: 'USD', symbol: '$' },
  { label: 'Euro (EUR)', value: 'EUR', symbol: '€' },
  { label: 'British Pound (GBP)', value: 'GBP', symbol: '£' },
  { label: 'Japanese Yen (JPY)', value: 'JPY', symbol: '¥' },
  { label: 'Canadian Dollar (CAD)', value: 'CAD', symbol: 'CA$' },
  { label: 'Australian Dollar (AUD)', value: 'AUD', symbol: 'A$' },
  { label: 'United Arab Emirates Dirham (AED)', value: 'AED', symbol: 'د.إ' },
  { label: 'Saudi Riyal (SAR)', value: 'SAR', symbol: 'SR' },
  { label: 'Singapore Dollar (SGD)', value: 'SGD', symbol: 'S$' },
  { label: 'Swiss Franc (CHF)', value: 'CHF', symbol: 'CHF' },
  { label: 'Chinese Yuan (CNY)', value: 'CNY', symbol: '¥' },
  { label: 'Hong Kong Dollar (HKD)', value: 'HKD', symbol: 'HK$' },
  { label: 'New Zealand Dollar (NZD)', value: 'NZD', symbol: 'NZ$' },
  { label: 'Swedish Krona (SEK)', value: 'SEK', symbol: 'kr' },
  { label: 'South Korean Won (KRW)', value: 'KRW', symbol: '₩' },
  { label: 'Turkish Lira (TRY)', value: 'TRY', symbol: '₺' },
  { label: 'Russian Ruble (RUB)', value: 'RUB', symbol: '₽' },
  { label: 'Brazilian Real (BRL)', value: 'BRL', symbol: 'R$' },
  { label: 'South African Rand (ZAR)', value: 'ZAR', symbol: 'R' },
  { label: 'Mexican Peso (MXN)', value: 'MXN', symbol: 'MX$' },
  { label: 'Malaysian Ringgit (MYR)', value: 'MYR', symbol: 'RM' },
  { label: 'Philippine Peso (PHP)', value: 'PHP', symbol: '₱' },
  { label: 'Thai Baht (THB)', value: 'THB', symbol: '฿' },
  { label: 'Indonesian Rupiah (IDR)', value: 'IDR', symbol: 'Rp' },
  { label: 'Vietnamese Dong (VND)', value: 'VND', symbol: '₫' },
  { label: 'Kuwaiti Dinar (KWD)', value: 'KWD', symbol: 'د.ك' },
  { label: 'Qatari Rial (QAR)', value: 'QAR', symbol: 'ر.ق' },
  { label: 'Bahraini Dinar (BHD)', value: 'BHD', symbol: '.د.ب' },
  { label: 'Omani Rial (OMR)', value: 'OMR', symbol: 'ر.ع.' },
];

/**
 * Returns the currency symbol for a given ISO code.
 * Defaults to ₹ if not found (for legacy support).
 */
export const getCurrencySymbol = (code) => {
  const option = CURRENCY_OPTIONS.find(o => o.value === code);
  return option ? option.symbol : '₹';
};

/**
 * Formats a numeric value with the appropriate currency symbol and locale.
 */
export const formatCurrency = (amount, code = 'INR') => {
  const symbol = getCurrencySymbol(code);
  const formattedValue = (amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formattedValue}`;
};
