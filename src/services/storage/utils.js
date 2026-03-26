import * as SQLite from 'expo-sqlite';

let db = null;
let dbPromise = null;

export const getDb = async () => {
  if (db) return db;
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('expenses_secure.db');
  }
  try {
    db = await dbPromise;
    return db;
  } catch (error) {
    dbPromise = null;
    throw error;
  }
};

export const resetDbConnection = () => {
  db = null;
  dbPromise = null;
};

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const updateAccountBalanceSQL = async (database, accountId, amount, type, isDestination) => {
  const accSql = `
    SELECT 'BANK' as type, balance FROM bank_accounts WHERE id = ?
    UNION ALL
    SELECT 'CREDIT_CARD' as type, currentUsage as balance FROM credit_cards WHERE id = ?
    UNION ALL
    SELECT type, principal as balance FROM loans WHERE id = ?
    UNION ALL
    SELECT type, balance FROM investments WHERE id = ?
    UNION ALL
    SELECT 'EMI' as type, balance FROM emis WHERE id = ?
    UNION ALL
    SELECT 'SIP' as type, balance FROM sip_accounts WHERE id = ?
  `;
  const account = await database.getFirstAsync(accSql, [accountId, accountId, accountId, accountId, accountId, accountId]);
  if (!account) return;

  let newBalance = account.balance;
  let newLastUpdate = new Date().toISOString();

  if (account.type === 'CREDIT_CARD') {
    if (!isDestination && (type === 'EXPENSE' || type === 'TRANSFER' || type === 'CC_EXPENSE')) {
      newBalance = (newBalance || 0) + amount; // Usage increases
    } else if (isDestination && (type === 'PAYMENT' || type === 'INCOME' || type === 'TRANSFER' || type === 'CC_PAY' || type === 'EMI_LIMIT_RECOVERY' || type === 'EMI_PAYMENT')) {
      newBalance = Math.max(0, (newBalance || 0) - amount); // Usage decreases
    }
  } else if (!isDestination) {
    if (account.type === 'LOAN' || account.type === 'BORROWED' || account.type === 'EMI') {
      if (type === 'EXPENSE' || type === 'TRANSFER' || type === 'CC_EXPENSE') newBalance += amount;
      else if (type === 'PAYMENT' || type === 'INCOME' || type === 'REPAY_LOAN' || type === 'REPAY_BORROWED') newBalance = Math.max(0, newBalance - amount);
    } else {
      if (type === 'INCOME' || type === 'TRANSFER_IN') newBalance += amount;
      else if (type === 'EXPENSE' || type === 'TRANSFER' || type === 'PAYMENT' || type === 'REPAY_LENDED' || type === 'LEND_MONEY' || type === 'COLLECT_REPAYMENT') newBalance -= amount;
    }
  } else {
    if (account.type === 'LOAN' || account.type === 'BORROWED' || account.type === 'EMI') {
      newBalance = Math.max(0, newBalance - amount);
    } else {
      newBalance += amount;
    }
  }

  switch (account.type) {
    case 'BANK':
      await database.runAsync('UPDATE bank_accounts SET balance = ? WHERE id = ?', [newBalance, accountId]);
      break;
    case 'CREDIT_CARD': {
      const card = await database.getFirstAsync('SELECT creditLimit FROM credit_cards WHERE id = ?', [accountId]);
      const limit = card ? card.creditLimit : 0;
      await database.runAsync('UPDATE credit_cards SET currentUsage = ?, remainingLimit = ? WHERE id = ?', [newBalance, limit - newBalance, accountId]);
      break;
    }
    case 'LOAN':
    case 'BORROWED':
    case 'LENDED':
    case 'DEBT_REPAY':
      await database.runAsync('UPDATE loans SET principal = ? WHERE id = ?', [newBalance, accountId]);
      break;
    case 'INVESTMENT':
    case 'LUMP_SUM':
      await database.runAsync('UPDATE investments SET balance = ?, lastUpdate = ? WHERE id = ?', [newBalance, newLastUpdate, accountId]);
      break;
    case 'SIP_PAY':
    case 'SIP':
      await database.runAsync('UPDATE sip_accounts SET balance = ? WHERE id = ?', [newBalance, accountId]);
      break;
    case 'EMI':
      await database.runAsync('UPDATE emis SET balance = ? WHERE id = ?', [newBalance, accountId]);
      break;
  }
};

export const ensureCategoryExists = async (userId, name, type = 'EXPENSE', isSystem = 0) => {
  if (!userId) return null;
  const trimmedName = name.trim();
  try {
    const database = await getDb();
    const findSql = 'SELECT id, isDeleted FROM categories WHERE userId = ? AND LOWER(name) = LOWER(?)';
    const existing = await database.getFirstAsync(findSql, [userId, trimmedName]);

    if (existing) {
      if (existing.isDeleted === 1) {
        await database.runAsync('UPDATE categories SET isDeleted = 0 WHERE id = ?', [existing.id]);
      }
      return existing.id;
    }

    try {
      const id = generateId();
      await database.runAsync('INSERT INTO categories (id, userId, name, type, isSystem) VALUES (?, ?, ?, ?, ?)', [id, userId, trimmedName, type, isSystem]);
      return id;
    } catch (insertError) {
      if (insertError.message?.includes('UNIQUE')) {
        const recover = await database.getFirstAsync(findSql, [userId, trimmedName]);
        if (recover) return recover.id;
      }
      throw insertError;
    }
  } catch (error) {
    console.error('Error ensuring category:', error);
    return null;
  }
};
