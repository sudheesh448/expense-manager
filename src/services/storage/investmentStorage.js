/**
 * Save investment-specific details.
 * Handles both the basic account registry and the specialized extension.
 */
export const saveInvestmentInfo = async (database, id, data) => {
  if (!database || !id) return;

  const sql = `INSERT INTO investments (id, userId, type, name, balance, sipAmount, investedAmount, bankAccountId, categoryId, lastUpdate, isClosed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  await database.runAsync(sql, [
    id,
    data.userId,
    data.type,
    data.name,
    Number(data.balance || 0),
    Number(data.sipAmount || 0),
    Number(data.investedAmount || 0),
    data.bankAccountId || null,
    data.categoryId || null,
    new Date().toISOString(),
    data.isClosed ? 1 : 0
  ]);
};

/**
 * Update investment-specific details.
 */
export const updateInvestmentInfo = async (database, id, data) => {
  if (!database || !id) return;

  const sql = `UPDATE investments SET 
    name = ?, balance = ?, sipAmount = ?, investedAmount = ?, bankAccountId = ?, categoryId = ?, lastUpdate = ?, isClosed = ?
    WHERE id = ?`;
    
  await database.runAsync(sql, [
    data.name,
    Number(data.balance || 0),
    Number(data.sipAmount || 0),
    Number(data.investedAmount || 0),
    data.bankAccountId || null,
    data.categoryId || null,
    new Date().toISOString(),
    data.isClosed ? 1 : 0,
    id
  ]);
};

