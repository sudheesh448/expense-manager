/**
 * Specialized storage for credit card account details.
 */

/**
 * Save credit card-specific details.
 * Handles both the basic account registry and the specialized extension.
 */
export const saveCreditCardInfo = async (database, id, data) => {
  if (!database || !id) return;

  const limit = Number(data.creditLimit || 0);
  const usage = Number(data.balance || data.currentUsage || 0);

  const sql = 'INSERT INTO credit_cards (id, userId, type, name, creditLimit, currentUsage, remainingLimit, cardNumber, cvv, expiry, billingDay, dueDay) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  await database.runAsync(sql, [
    id,
    data.userId,
    'CREDIT_CARD',
    data.name || '',
    limit,
    usage,
    limit - usage,
    data.cardNumber || null,
    data.cvv || null,
    data.expiry || null,
    data.billingDay || null,
    data.dueDay || null
  ]);
};

/**
 * Update credit card-specific details.
 */
export const updateCreditCardInfo = async (database, id, data) => {
  if (!database || !id) return;

  const limit = Number(data.creditLimit || 0);
  const usage = Number(data.balance || data.currentUsage || 0);

  const sql = 'UPDATE credit_cards SET name = ?, creditLimit = ?, currentUsage = ?, remainingLimit = ?, cardNumber = ?, cvv = ?, expiry = ?, billingDay = ?, dueDay = ? WHERE id = ?';
  await database.runAsync(sql, [
    data.name || '',
    limit,
    usage,
    limit - usage,
    data.cardNumber || null,
    data.cvv || null,
    data.expiry || null,
    data.billingDay || null,
    data.dueDay || null,
    id
  ]);
};


/**
 * Fetch the name of a credit card by its account ID.
 */
export const getAccountNameById = async (database, id) => {
  if (!database || !id) return null;
  const row = await database.getFirstAsync('SELECT name FROM credit_cards WHERE id = ?', [id]);
  return row ? row.name : null;
};
