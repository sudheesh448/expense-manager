/**
 * Specialized storage for bank account details.
 */

/**
 * Save bank-specific details.
 * Handles both the basic account registry and the bank-specific extension.
 */
export const saveBankInfo = async (database, id, data) => {
  if (!database || !id) return;
  
  const sql = 'INSERT INTO bank_accounts (id, userId, type, name, balance, ifsc, accountNumber, customerId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  await database.runAsync(sql, [
    id,
    data.userId,
    'BANK',
    data.name || '',
    Number(data.balance || 0),
    data.ifsc || null,
    data.accountNumber || null,
    data.customerId || null
  ]);
};

/**
 * Update bank-specific details.
 */
export const updateBankInfo = async (database, id, data) => {
  if (!database || !id) return;

  const sql = 'UPDATE bank_accounts SET name = ?, balance = ?, ifsc = ?, accountNumber = ?, customerId = ? WHERE id = ?';
  await database.runAsync(sql, [
    data.name || '',
    Number(data.balance || 0),
    data.ifsc || null,
    data.accountNumber || null,
    data.customerId || null,
    id
  ]);
};

