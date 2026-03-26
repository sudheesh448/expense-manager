/**
 * Account Utilities - Common helper functions for accounts.
 */

/**
 * Generate a descriptive label for an account including its current/available balance.
 * Dedicated for use in dropdowns and selectors.
 * @param {Object} account The specific account to label
 * @param {string} currencySymbol User's currency symbol
 * @returns {string} Formatted label
 */
export const getAccountLabel = (account, currencySymbol = '₹') => {
  if (!account) return '';
  const balance = account.balance || account.currentUsage || 0;
  return `${account.name} (${currencySymbol}${balance.toLocaleString()})`;
};

/**
 * Get the next N months for pausing payments.
 * @param {number} count Number of months to return
 * @returns {Array} List of { label, key } objects
 */
export const getUpcomingMonths = (count = 12) => {
  const months = [];
  const start = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    months.push({
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    });
  }
  return months;
};

