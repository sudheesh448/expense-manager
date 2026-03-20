import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

let db = null;
let dbPromise = null;

const getDb = async () => {
  if (db) return db;
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('expenses_secure.db');
  }
  db = await dbPromise;
  return db;
};

const generateId = () => Math.random().toString(36).substring(2, 9);

let initPromise = null;

export const initDatabase = async () => {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      const database = await getDb();

      if (Platform.OS !== 'web') {
        await database.execAsync('PRAGMA journal_mode = WAL;');
      }

      await database.execAsync(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL, 
        username TEXT NOT NULL, 
        pin TEXT NOT NULL, 
        biometricsEnabled INTEGER DEFAULT 0,
        themePreference TEXT DEFAULT 'light',
        fontScale TEXT DEFAULT 'medium',
        forecastMonths INTEGER DEFAULT 6,
        autoBackupEnabled INTEGER DEFAULT 0,
        lastBackupTimestamp TEXT DEFAULT NULL,
        dashboardGraphs TEXT DEFAULT '{"monthlyTrends":true,"totalSavings":true,"totalCcOutstanding":true,"nonEmiCcOutstanding":true,"monthlyExpenseSplit":true,"totalLiabilities":true}',
        customGraphs TEXT DEFAULT '[]',
        graphOrder TEXT DEFAULT '[]'
      );`);

      await database.execAsync(`CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL, 
        userId TEXT NOT NULL, 
        name TEXT NOT NULL, 
        type TEXT NOT NULL, 
        balance REAL NOT NULL,
        billingDay INTEGER, 
        dueDay INTEGER, 
        emiAmount REAL, 
        emiDay INTEGER,
        isDeleted INTEGER DEFAULT 0,
        sipAmount REAL DEFAULT NULL,
        categoryId TEXT DEFAULT NULL,
        loanPrincipal REAL DEFAULT NULL,
        loanInterestRate REAL DEFAULT NULL,
        loanTenure INTEGER DEFAULT NULL,
        loanStartDate TEXT DEFAULT NULL,
        loanFinePercentage REAL DEFAULT NULL,
        isEmi INTEGER DEFAULT 0,
        lastBalanceUpdateDate TEXT DEFAULT NULL,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );`);

      await database.execAsync(`CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL, 
        userId TEXT NOT NULL, 
        type TEXT NOT NULL, 
        amount REAL NOT NULL, 
        date TEXT NOT NULL,
        accountId TEXT NOT NULL, 
        toAccountId TEXT, 
        note TEXT,
        categoryId TEXT,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );`);

      await database.execAsync(`CREATE TABLE IF NOT EXISTS expected_expenses (
        id TEXT PRIMARY KEY NOT NULL, 
        userId TEXT NOT NULL, 
        monthKey TEXT NOT NULL, 
        name TEXT NOT NULL, 
        amount REAL NOT NULL, 
        isDone INTEGER DEFAULT 0,
        categoryId TEXT DEFAULT NULL,
        type TEXT DEFAULT 'EXPENSE',
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );`);

      await database.execAsync(`CREATE TABLE IF NOT EXISTS emis (
        id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, accountId TEXT NOT NULL,
        amount REAL NOT NULL, emiDate INTEGER NOT NULL, tenure INTEGER NOT NULL,
        paidMonths INTEGER DEFAULT 0, note TEXT,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(accountId) REFERENCES accounts(id) ON DELETE CASCADE
      );`);

      await database.execAsync(`CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );`);

      // Account logs table for audit history
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS account_logs (
          id TEXT PRIMARY KEY,
          userId TEXT,
          accountId TEXT,
          action TEXT,
          details TEXT,
          timestamp TEXT
        )
      `);

      // Recurring payments table
      try {
        await database.execAsync(`CREATE TABLE IF NOT EXISTS recurring_payments (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          accountId TEXT NOT NULL,
          cycleDays INTEGER NOT NULL,
          nextDueDate TEXT NOT NULL,
          note TEXT,
          isActive INTEGER DEFAULT 1,
          scheduleType TEXT DEFAULT 'DYNAMIC',
          anchorDay INTEGER DEFAULT NULL,
          status TEXT DEFAULT 'ACTIVE',
          pausedMonths TEXT DEFAULT '[]',
          categoryId TEXT DEFAULT NULL,
          type TEXT DEFAULT 'EXPENSE',
          linkedAccountId TEXT DEFAULT NULL
        );`);
      } catch (e) {
        console.warn('recurring_payments table creation:', e.message);
      }

      // Migrations
      const runMigration = async (sql) => {
        try { 
          await database.execAsync(sql); 
        } catch (e) { 
          // console.warn('Migration failed (likely already applied):', sql.substring(0, 50));
        }
      };

      await runMigration('ALTER TABLE recurring_payments ADD COLUMN linkedAccountId TEXT DEFAULT NULL;');
      await runMigration('ALTER TABLE transactions ADD COLUMN categoryId TEXT;');
      await runMigration("ALTER TABLE users ADD COLUMN themePreference TEXT DEFAULT 'light';");
      await runMigration("ALTER TABLE users ADD COLUMN fontScale TEXT DEFAULT 'medium';");
      await runMigration('ALTER TABLE accounts ADD COLUMN isDeleted INTEGER DEFAULT 0;');
      await runMigration('ALTER TABLE accounts ADD COLUMN sipAmount REAL DEFAULT NULL;');
      await runMigration('ALTER TABLE accounts ADD COLUMN loanFinePercentage REAL DEFAULT NULL;');
      await runMigration('ALTER TABLE accounts ADD COLUMN isEmi INTEGER DEFAULT 0;');
      await runMigration("ALTER TABLE recurring_payments ADD COLUMN scheduleType TEXT DEFAULT 'DYNAMIC';");
      await runMigration('ALTER TABLE recurring_payments ADD COLUMN anchorDay INTEGER DEFAULT NULL;');
      await runMigration("ALTER TABLE recurring_payments ADD COLUMN status TEXT DEFAULT 'ACTIVE';");
      await runMigration("ALTER TABLE recurring_payments ADD COLUMN pausedMonths TEXT DEFAULT '[]';");
      await runMigration('ALTER TABLE accounts ADD COLUMN categoryId TEXT DEFAULT NULL;');
      await runMigration('ALTER TABLE recurring_payments ADD COLUMN categoryId TEXT DEFAULT NULL;');
      await runMigration('ALTER TABLE expected_expenses ADD COLUMN categoryId TEXT DEFAULT NULL;');
      await runMigration("ALTER TABLE expected_expenses ADD COLUMN type TEXT DEFAULT 'EXPENSE';");
      await runMigration("ALTER TABLE users ADD COLUMN forecastMonths INTEGER DEFAULT 6;");
      await runMigration("ALTER TABLE recurring_payments ADD COLUMN type TEXT DEFAULT 'EXPENSE';");
      await runMigration("ALTER TABLE users ADD COLUMN autoBackupEnabled INTEGER DEFAULT 0;");
      await runMigration("ALTER TABLE users ADD COLUMN lastBackupTimestamp TEXT DEFAULT NULL;");
      await runMigration('ALTER TABLE accounts ADD COLUMN loanPrincipal REAL DEFAULT NULL;');
      await runMigration('ALTER TABLE accounts ADD COLUMN loanInterestRate REAL DEFAULT NULL;');
      await runMigration('ALTER TABLE accounts ADD COLUMN loanTenure INTEGER DEFAULT NULL;');
      await runMigration('ALTER TABLE accounts ADD COLUMN loanStartDate TEXT DEFAULT NULL;');
      await runMigration('ALTER TABLE accounts ADD COLUMN lastBalanceUpdateDate TEXT DEFAULT NULL;');
      await runMigration(`ALTER TABLE users ADD COLUMN dashboardGraphs TEXT DEFAULT '{"monthlyTrends":true,"totalSavings":true,"totalCcOutstanding":true,"nonEmiCcOutstanding":true,"monthlyExpenseSplit":true,"totalLiabilities":true}';`);
      await runMigration("ALTER TABLE users ADD COLUMN customGraphs TEXT DEFAULT '[]';");
      await runMigration("ALTER TABLE users ADD COLUMN graphOrder TEXT DEFAULT '[]';");


      return true;
    } catch (error) {
      console.error('CRITICAL: Database Init Error:', error);
      initPromise = null;
      throw error;
    }
  })();
  
  return initPromise;
};


// --- USER METHODS ---
export const getUsers = async () => {
  const database = await getDb();
  return await database.getAllAsync('SELECT * FROM users');
};

export const saveUser = async (username, pin) => {
  const database = await getDb();
  const id = generateId();
  await database.runAsync('INSERT INTO users (id, username, pin, biometricsEnabled) VALUES (?, ?, ?, 0)', [id, username, pin]);
  return { id, username, pin, biometricsEnabled: 0 };
};

export const updateUserBiometrics = async (userId, enabled) => {
  const database = await getDb();
  await database.runAsync('UPDATE users SET biometricsEnabled = ? WHERE id = ?', [enabled ? 1 : 0, userId]);
};

export const updateThemePreference = async (userId, theme) => {
  const database = await getDb();
  await database.runAsync('UPDATE users SET themePreference = ? WHERE id = ?', [theme, userId]);
};

export const getUserTheme = async (userId) => {
  const database = await getDb();
  const user = await database.getFirstAsync('SELECT themePreference FROM users WHERE id = ?', [userId || '']);
  return user ? user.themePreference || 'light' : 'light';
};

export const getUserFontScale = async (userId) => {
  const database = await getDb();
  const user = await database.getFirstAsync('SELECT fontScale FROM users WHERE id = ?', [userId || '']);
  return user ? user.fontScale || 'medium' : 'medium';
};

export const updateFontScale = async (userId, scale) => {
  const database = await getDb();
  await database.runAsync('UPDATE users SET fontScale = ? WHERE id = ?', [scale, userId]);
};

export const getDashboardGraphs = async (userId) => {
  const database = await getDb();
  const user = await database.getFirstAsync('SELECT dashboardGraphs, graphOrder FROM users WHERE id = ?', [userId || '']);
  const defaultGraphs = { 
    monthlyTrends: true, 
    totalSavings: true, 
    totalCcOutstanding: true, 
    nonEmiCcOutstanding: true,
    monthlyExpenseSplit: true,
    totalLiabilities: true
  };
  
  let graphs = defaultGraphs;
  let order = [];
  
  if (user) {
    if (user.dashboardGraphs) {
      try {
        graphs = { ...defaultGraphs, ...JSON.parse(user.dashboardGraphs) };
      } catch (e) {}
    }
    if (user.graphOrder) {
      try {
        order = JSON.parse(user.graphOrder) || [];
      } catch (e) {}
    }
  }

  return { graphs, order };
};

export const updateDashboardGraphs = async (userId, graphs, order) => {
  const database = await getDb();
  await database.runAsync(
    'UPDATE users SET dashboardGraphs = ?, graphOrder = ? WHERE id = ?', 
    [JSON.stringify(graphs), JSON.stringify(order), userId || '']
  );
};

// --- ACCOUNT METHODS (Filtered logically by User) ---
export const getAccounts = async (userId) => {
  if (!userId) return [];
  try {
    const database = await getDb();
    const sql = `
      SELECT a.*, 
             (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t.toAccountId = a.id AND (t.type = 'EXPENSE' OR t.type = 'TRANSFER')) as totalPaid
      FROM accounts a 
      WHERE a.userId = ? AND (a.isDeleted IS NULL OR a.isDeleted = 0)
    `;
    return await database.getAllAsync(sql, [userId]);
  } catch (error) {
    console.error('Error fetching accounts', error);
    return [];
  }
};

// Returns ALL accounts including soft-deleted — used for transaction name lookups
export const getAllAccountsForLookup = async (userId) => {
  if (!userId) return [];
  try {
    const database = await getDb();
    return await database.getAllAsync('SELECT * FROM accounts WHERE userId = ?', [userId]);
  } catch (error) {
    return [];
  }
};

export const softDeleteAccount = async (accountId) => {
  try {
    const database = await getDb();
    const acc = await database.getFirstAsync('SELECT * FROM accounts WHERE id = ?', [accountId]);
    if (acc) {
      if (acc.type === 'EMI') {
        const recurring = await database.getFirstAsync(
          'SELECT accountId, id FROM recurring_payments WHERE linkedAccountId = ?',
          [accountId]
        );
        if (recurring && acc.balance > 0) {
          const settlementAmount = acc.balance;
          const sourceCcId = recurring.accountId;
          
          // 1. Record Settlement Transaction
          const txId = generateId();
          await database.runAsync(
            'INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [txId, acc.userId, 'TRANSFER', settlementAmount, new Date().toISOString(), sourceCcId, accountId, `EMI Closure Settlement: ${acc.name}`, acc.categoryId]
          );
          
          // 2. Restore CC limit
          await updateAccountBalanceSQL(database, sourceCcId, settlementAmount, 'INCOME', false);
        }
      }

      const logId = generateId();
      await database.runAsync(
        'INSERT INTO account_logs (id, userId, accountId, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
        [logId, acc.userId, accountId, 'DELETED', `Account "${acc.name}" closed/deleted.`, new Date().toISOString()]
      );
      // Clean up linked recurring payments (for Loans/SIPs)
      await deleteRecurringByAccountId(accountId);
    }
    await database.runAsync('UPDATE accounts SET isDeleted = 1 WHERE id = ?', [accountId]);
  } catch (error) {
    console.error('Error deleting account', error);
  }
};

export const getAccountLogs = async (userId) => {
  if (!userId) return [];
  try {
    const database = await getDb();
    return await database.getAllAsync('SELECT * FROM account_logs WHERE userId = ? ORDER BY timestamp DESC LIMIT 100', [userId]);
  } catch (error) {
    console.error('Error fetching account logs', error);
    return [];
  }
};

export const saveAccount = async (userId, accountData) => {
  if (!userId) throw new Error("Missing Auth User ID");
  try {
    const database = await getDb();
    const id = generateId();
    const balance = Number(accountData.balance || 0);
    const sql = `INSERT INTO accounts (id, userId, name, type, balance, billingDay, dueDay, emiAmount, emiDay, sipAmount, categoryId, loanPrincipal, loanInterestRate, loanTenure, loanStartDate, loanFinePercentage, isEmi, lastBalanceUpdateDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await database.runAsync(sql, [
      id, userId, accountData.name, accountData.type, balance,
      accountData.billingDay || null, accountData.dueDay || null,
      accountData.emiAmount || null, accountData.emiDay || null,
      accountData.sipAmount || null,
      accountData.categoryId || null,
      accountData.loanPrincipal || null,
      accountData.loanInterestRate || null,
      accountData.loanTenure || null,
      accountData.loanStartDate || null,
      accountData.loanFinePercentage || null,
      accountData.isEmi || 0,
      accountData.lastBalanceUpdateDate || accountData.loanStartDate || null
    ]);

    // Log the creation
    const logId = generateId();
    await database.runAsync(
      'INSERT INTO account_logs (id, userId, accountId, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [logId, userId, id, 'CREATED', `Account "${accountData.name}" (${accountData.type}) created with initial balance ₹${balance}.`, new Date().toISOString()]
    );

    return { id, userId, ...accountData, balance };
  } catch (error) {
    console.error('Error saving account', error);
    throw error;
  }
};

export const updateAccount = async (accountData) => {
  try {
    const database = await getDb();
    const oldAcc = await database.getFirstAsync('SELECT * FROM accounts WHERE id = ?', [accountData.id]);
    if (!oldAcc) throw new Error("Account not found");

    const merged = { ...oldAcc };
    Object.keys(accountData).forEach(key => {
      if (accountData[key] !== undefined && accountData[key] !== null) {
        merged[key] = accountData[key];
      }
    });

    const balance = Number(merged.balance || 0);

    const sql = `UPDATE accounts SET name = ?, type = ?, balance = ?, billingDay = ?, dueDay = ?, emiAmount = ?, emiDay = ?, sipAmount = ?, categoryId = ?, loanPrincipal = ?, loanInterestRate = ?, loanTenure = ?, loanStartDate = ?, loanFinePercentage = ?, isEmi = ?, lastBalanceUpdateDate = ? WHERE id = ?`;
    await database.runAsync(sql, [
      merged.name || oldAcc.name, 
      merged.type || oldAcc.type, 
      balance,
      merged.billingDay !== undefined ? merged.billingDay : oldAcc.billingDay,
      merged.dueDay !== undefined ? merged.dueDay : oldAcc.dueDay,
      merged.emiAmount !== undefined ? merged.emiAmount : oldAcc.emiAmount,
      merged.emiDay !== undefined ? merged.emiDay : oldAcc.emiDay,
      merged.sipAmount !== undefined ? merged.sipAmount : oldAcc.sipAmount,
      merged.categoryId !== undefined ? merged.categoryId : oldAcc.categoryId,
      merged.loanPrincipal !== undefined ? merged.loanPrincipal : oldAcc.loanPrincipal,
      merged.loanInterestRate !== undefined ? merged.loanInterestRate : oldAcc.loanInterestRate,
      merged.loanTenure !== undefined ? merged.loanTenure : oldAcc.loanTenure,
      merged.loanStartDate !== undefined ? merged.loanStartDate : oldAcc.loanStartDate,
      merged.loanFinePercentage !== undefined ? merged.loanFinePercentage : oldAcc.loanFinePercentage,
      merged.isEmi !== undefined ? (merged.isEmi ? 1 : 0) : oldAcc.isEmi,
      merged.lastBalanceUpdateDate !== undefined ? merged.lastBalanceUpdateDate : oldAcc.lastBalanceUpdateDate,
      merged.id
    ]);

    // Log the update
    const deltas = [];
    const fields = ['name', 'balance', 'loanPrincipal', 'loanInterestRate', 'loanTenure'];
    fields.forEach(f => {
      if (accountData[f] !== undefined && accountData[f] !== oldAcc[f]) {
        const oldVal = oldAcc[f];
        const newVal = accountData[f];
        if (f === 'balance') deltas.push(`Balance changed from ₹${Number(oldVal).toFixed(2)} to ₹${Number(newVal).toFixed(2)}`);
        else if (f === 'name') deltas.push(`Name changed from "${oldVal}" to "${newVal}"`);
        else if (f === 'loanPrincipal') deltas.push(`Loan principal changed from ₹${Number(oldVal).toFixed(2)} to ₹${Number(newVal).toFixed(2)}`);
        else deltas.push(`${f} changed from ${oldVal} to ${newVal}`);
      }
    });

    if (deltas.length > 0) {
      const logId = generateId();
      await database.runAsync(
        'INSERT INTO account_logs (id, userId, accountId, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
        [logId, oldAcc.userId, merged.id, 'UPDATED', deltas.join('; '), new Date().toISOString()]
      );
    }
    return { ...merged, balance };
  } catch (error) {
    console.error('Error updating account', error);
    throw error;
  }
};

// --- CATEGORIES METHODS ---
export const getCategories = async (userId, type = 'EXPENSE') => {
  if (!userId) return [];
  try {
    const database = await getDb();
    return await database.getAllAsync('SELECT * FROM categories WHERE userId = ? AND type = ?', [userId, type]);
  } catch (error) {
    console.error('Error fetching categories', error);
    return [];
  }
};

export const saveCategory = async (userId, name, type = 'EXPENSE') => {
  if (!userId) throw new Error("Missing Auth User ID");
  try {
    const database = await getDb();
    const id = generateId();
    await database.runAsync('INSERT INTO categories (id, userId, name, type) VALUES (?, ?, ?, ?)', [id, userId, name, type]);
    return { id, userId, name, type };
  } catch (error) {
    console.error('Error saving category', error);
    throw error;
  }
};

// --- EXPECTED EXPENSES METHODS ---
export const getExpectedExpenses = async (userId) => {
  if (!userId) return [];
  try {
    const database = await getDb();
    return await database.getAllAsync('SELECT * FROM expected_expenses WHERE userId = ?', [userId]);
  } catch (error) {
    console.error('Error fetching expected expenses', error);
    return [];
  }
};

export const saveExpectedExpense = async (userId, data) => {
  if (!userId) throw new Error("Missing Auth User ID");
  try {
    const database = await getDb();
    const id = generateId();
    const amount = Number(data.amount || 0);
    const sql = `INSERT INTO expected_expenses (id, userId, monthKey, name, amount, isDone, categoryId, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    await database.runAsync(sql, [id, userId, data.monthKey, data.name, amount, data.isDone ? 1 : 0, data.categoryId || null, data.type || 'EXPENSE']);
    return { id, userId, ...data, amount, isDone: data.isDone ? 1 : 0, type: data.type || 'EXPENSE' };
  } catch (error) {
    console.error('Error saving expected expense', error);
    throw error;
  }
};

export const updateExpectedExpenseStatus = async (id, isDone) => {
  try {
    const database = await getDb();
    await database.runAsync('UPDATE expected_expenses SET isDone = ? WHERE id = ?', [isDone ? 1 : 0, id]);
  } catch (error) {
    console.error('Error updating expected expense status', error);
    throw error;
  }
};

export const deleteExpectedExpense = async (id) => {
  try {
    const database = await getDb();
    await database.runAsync('DELETE FROM expected_expenses WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error deleting expected expense', error);
    throw error;
  }
};

export const payExpectedExpense = async (userId, expenseId, fromAccountId) => {
  try {
    const database = await getDb();
    await database.execAsync('BEGIN TRANSACTION;');
    
    const exp = await database.getFirstAsync('SELECT * FROM expected_expenses WHERE id = ?', [expenseId]);
    if (!exp || exp.isDone === 1) {
       await database.execAsync('ROLLBACK;');
       return;
    }
    
    await database.runAsync('UPDATE expected_expenses SET isDone = 1 WHERE id = ?', [expenseId]);
    
    const id = generateId();
    const paymentDate = new Date();
    const dateISO = paymentDate.toISOString();
    
    if (exp.type === 'INCOME') {
      // Record as INCOME transaction
      const sqlTx = `INSERT INTO transactions (id, userId, type, amount, date, accountId, note, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      await database.runAsync(sqlTx, [
        id, userId, 'INCOME', exp.amount, dateISO,
        fromAccountId, `Settle Expected Income: ${exp.name}`, exp.categoryId || null
      ]);
      await updateAccountBalanceSQL(database, fromAccountId, exp.amount, 'INCOME', false);
    } else {
      // Find associated recurring payment to check for linkedAccountId
      const recurring = await database.getFirstAsync(
        `SELECT * FROM recurring_payments WHERE userId = ? AND name = ?`,
        [userId, exp.name]
      );
      const linkedAccountId = recurring?.linkedAccountId;

      const sipAccount = !linkedAccountId ? await database.getFirstAsync("SELECT * FROM accounts WHERE type = 'SIP' AND name = ?", [exp.name]) : null;

      if (linkedAccountId || sipAccount) {
        // It's a linked account (EMI/Loan) or SIP
        const targetId = linkedAccountId || sipAccount.id;
        const note = linkedAccountId ? `EMI Payment: ${exp.name}` : `SIP Payment: ${exp.name}`;
        const sqlTx = `INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await database.runAsync(sqlTx, [
          id, userId, 'TRANSFER', exp.amount, dateISO,
          fromAccountId, targetId, note, exp.categoryId || null
        ]);
        await updateAccountBalanceSQL(database, fromAccountId, exp.amount, 'TRANSFER', false);
        await updateAccountBalanceSQL(database, targetId, exp.amount, 'TRANSFER', true);

        // If it's a loan EMI, recalculate the next EMI amount if requested
        if (linkedAccountId) {
          const loan = await database.getFirstAsync('SELECT * FROM accounts WHERE id = ?', [linkedAccountId]);
          if (loan && loan.isEmi === 1 && loan.balance > 0) {
            // Recalculate EMI based on new balance and remaining tenure
            const P = loan.balance;
            const r = (loan.loanInterestRate || 0) / 1200;
            const start = new Date(loan.loanStartDate);
            const now = new Date();
            let monthsPassed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
            if (monthsPassed < 0) monthsPassed = 0;
            const remainingMonths = Math.max(1, (loan.loanTenure * 12) - monthsPassed);

            let newEmi = P / remainingMonths;
            if (r > 0) {
              newEmi = (P * r * Math.pow(1 + r, remainingMonths)) / (Math.pow(1 + r, remainingMonths) - 1);
            }
            
            await database.runAsync(
              'UPDATE accounts SET loanStartDate = ? WHERE id = ?',
              [dateISO, linkedAccountId]
            );

            await database.runAsync(
              'UPDATE recurring_payments SET amount = ? WHERE id = ?',
              [newEmi, recurring.id]
            );
            // Also update future expected_expenses for this recurring name
            await database.runAsync(
              'UPDATE expected_expenses SET amount = ? WHERE name = ? AND userId = ? AND isDone = 0',
              [newEmi, recurring.name, userId]
            );
          }
        }

        // --- CC EMI LIMIT RESTORATION ---
        // If it's an EMI account, it's linked to a Credit Card (recurring.accountId).
        // Standard loan recurring.accountId might be a bank, but for CC EMI it's always the CC.
        const targetAcc = await database.getFirstAsync('SELECT type FROM accounts WHERE id = ?', [targetId]);
        if (targetAcc && targetAcc.type === 'EMI') {
          // Restore the CC limit (decrease used balance)
          await updateAccountBalanceSQL(database, recurring.accountId, exp.amount, 'TRANSFER', false);
        }
      } else {
        // Standard recurring expense
        const sqlTx = `INSERT INTO transactions (id, userId, type, amount, date, accountId, note, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        await database.runAsync(sqlTx, [
          id, userId, 'EXPENSE', exp.amount, dateISO,
          fromAccountId, `Paid Expected: ${exp.name}`, exp.categoryId || null
        ]);
        await updateAccountBalanceSQL(database, fromAccountId, exp.amount, 'EXPENSE', false);
      }
    }
    
    await database.execAsync('COMMIT;');

    // ── Dynamic recurring recalculation (outside transaction) ──
    const recurring = await database.getFirstAsync(
      `SELECT * FROM recurring_payments WHERE userId = ? AND name = ? AND isActive = 1 AND scheduleType = 'DYNAMIC'`,
      [userId, exp.name]
    );

    if (recurring) {
      const dueDate  = new Date(recurring.nextDueDate);
      // If paid early: base from plan expiry; if paid on time/late: base from today
      const base = paymentDate <= dueDate ? dueDate : paymentDate;
      const newNextDue = new Date(base.getTime() + recurring.cycleDays * 24 * 60 * 60 * 1000);

      await database.runAsync(
        'UPDATE recurring_payments SET nextDueDate = ? WHERE id = ?',
        [newNextDue.toISOString(), recurring.id]
      );

      // Remove stale future entries and regenerate
      await database.runAsync(
        `DELETE FROM expected_expenses WHERE userId = ? AND name = ? AND isDone = 0`,
        [userId, recurring.name]
      );
      await generateRecurringExpenses(userId, { ...recurring, nextDueDate: newNextDue.toISOString() });
    }

  } catch (err) {
    console.error('Error paying expected expense', err);
    throw err;
  }
};


// --- EMI METHODS ---
export const getEmis = async (userId) => {
  if (!userId) return [];
  try {
    const database = await getDb();
    return await database.getAllAsync('SELECT * FROM emis WHERE userId = ?', [userId]);
  } catch (error) {
    console.error('Error fetching EMIs', error);
    return [];
  }
};

export const saveEmi = async (userId, emiData) => {
  if (!userId) throw new Error("Missing Auth User ID");
  try {
    const database = await getDb();
    const id = generateId();
    const principal = Number(emiData.amount || 0);
    const tenure = Number(emiData.tenure || 1);
    const rate = Number(emiData.interestRate || 0);

    const totalInterest = (principal * rate / 100) * (tenure / 12);
    const totalLiability = principal + totalInterest;
    const monthlyInstallment = totalLiability / tenure;

    await database.execAsync('BEGIN TRANSACTION;');
    
    // 1. Create a dedicated EMI account
    const emiAccountId = generateId();
    const emiAccSql = `INSERT INTO accounts (id, userId, name, type, balance, loanPrincipal, loanInterestRate, loanTenure, loanStartDate, isEmi, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await database.runAsync(emiAccSql, [
      emiAccountId, userId, `EMI: ${emiData.note || 'Purchase'}`, 'EMI', 
      totalLiability, principal, rate, tenure, new Date().toISOString(), 1, emiData.categoryId || null
    ]);

    // 2. Create the legacy EMI record (for compatibility if needed)
    const sql = `INSERT INTO emis (id, userId, accountId, amount, emiDate, tenure, paidMonths, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    await database.runAsync(sql, [id, userId, emiData.accountId, monthlyInstallment, emiData.emiDate, tenure, 0, emiData.note || '']);
    
    // 3. Create a linked recurring payment
    await saveRecurringPayment(userId, {
      name: `EMI: ${emiData.note || 'Purchase'}`,
      amount: monthlyInstallment,
      type: 'EXPENSE',
      scheduleType: 'FIXED',
      anchorDay: emiData.emiDate,
      cycleDays: 0,
      nextDueDate: new Date().toISOString(),
      note: 'EMI',
      accountId: emiData.accountId, // Source (Credit Card)
      linkedAccountId: emiAccountId // Target (EMI Account)
    });

    // 4. Record as an initial "EXPENSE" in the CC (deduct from limit)
    const account = await database.getFirstAsync('SELECT type, balance FROM accounts WHERE id = ?', [emiData.accountId]);
    if (account && account.type === 'CREDIT_CARD') {
      const newCCBalance = (account.balance || 0) + totalLiability; // For CC, + means more spent (less limit)
      await database.runAsync('UPDATE accounts SET balance = ? WHERE id = ?', [newCCBalance, emiData.accountId]);
    }
    
    await database.execAsync('COMMIT;');
    return { id, emiAccountId };
  } catch (error) {
    console.error('Error saving EMI', error);
    const database = await getDb();
    await database.execAsync('ROLLBACK;');
    throw error;
  }
};

export const payEmi = async (userId, emiId, fromAccountId) => {
  try {
    const database = await getDb();
    await database.execAsync('BEGIN TRANSACTION;');
    
    const emi = await database.getFirstAsync('SELECT * FROM emis WHERE id = ?', [emiId]);
    if (!emi || emi.paidMonths >= emi.tenure) {
       await database.execAsync('ROLLBACK;');
       return;
    }
    
    await database.runAsync('UPDATE emis SET paidMonths = paidMonths + 1 WHERE id = ?', [emiId]);
    
    const id = generateId();
    const date = new Date().toISOString();
    const sqlTx = `INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    await database.runAsync(sqlTx, [
      id, userId, 'TRANSFER', emi.amount, date, 
      fromAccountId, emi.accountId, `Paid EMI: ${emi.note || 'Loan'}`
    ]);
    
    await updateAccountBalanceSQL(database, fromAccountId, emi.amount, 'TRANSFER', false);
    
    const account = await database.getFirstAsync('SELECT type, balance FROM accounts WHERE id = ?', [emi.accountId]);
    if (account && account.type === 'CREDIT_CARD') {
      const newLimit = account.balance + emi.amount;
      await database.runAsync('UPDATE accounts SET balance = ? WHERE id = ?', [newLimit, emi.accountId]);
    } else {
      await updateAccountBalanceSQL(database, emi.accountId, emi.amount, 'TRANSFER', true);
    }
    
    await database.execAsync('COMMIT;');
  } catch (err) {
    console.error('Error paying EMI', err);
    const database = await getDb();
    await database.execAsync('ROLLBACK;');
    throw err;
  }
};

export const getTransactions = async (userId) => {
  if (!userId) return [];
  try {
    const database = await getDb();
    return await database.getAllAsync('SELECT * FROM transactions WHERE userId = ?', [userId]);
  } catch (error) {
    console.error('Error fetching transactions', error);
    return [];
  }
};

export const saveTransaction = async (userId, transactionData) => {
  if (!userId) throw new Error("Missing Auth User ID");
  try {
    const database = await getDb();
    const id = generateId();
    const amount = Number(transactionData.amount);
    const date = transactionData.date || new Date().toISOString();
    
    await database.execAsync('BEGIN TRANSACTION;');
    
    // Check if categoryId is expected. Since we altered the table dynamically, we might need a generic fallback format but sqlite handles null.
    let sqlTx = '';
    let params = [];
    
    // Check if categoryId exists in the schema to safely bind
    try {
      sqlTx = `INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      params = [id, userId, transactionData.type, amount, date, transactionData.accountId, transactionData.toAccountId || null, transactionData.note || '', transactionData.categoryId || null];
      await database.runAsync(sqlTx, params);
    } catch (e) {
      // Fallback if categoryId isn't on table yet somehow
      sqlTx = `INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      params = [id, userId, transactionData.type, amount, date, transactionData.accountId, transactionData.toAccountId || null, transactionData.note || ''];
      await database.runAsync(sqlTx, params);
    }
    
    await updateAccountBalanceSQL(database, transactionData.accountId, amount, transactionData.type, false);
    
    if ((transactionData.type === 'TRANSFER' || transactionData.type === 'PAYMENT' || transactionData.type === 'EXPENSE') && transactionData.toAccountId) {
      await updateAccountBalanceSQL(database, transactionData.toAccountId, amount, transactionData.type, true);
    }
    
    await database.execAsync('COMMIT;');
    return { id, userId, date, ...transactionData, amount };
  } catch (error) {
    console.error('Error saving transaction', error);
    const database = await getDb();
    await database.execAsync('ROLLBACK;');
    throw error;
  }
};

const updateAccountBalanceSQL = async (database, accountId, amount, type, isDestination) => {
  const account = await database.getFirstAsync('SELECT type, balance, loanInterestRate, loanStartDate, lastBalanceUpdateDate FROM accounts WHERE id = ?', [accountId]);
  if (!account) return;

  let newBalance = account.balance;
  let newLastUpdate = new Date().toISOString();

  const isLoanLike = account.type === 'LOAN' || account.type === 'BORROWED' || account.type === 'LENDED';

  // Interest is calculated dynamically in the UI for display and settlement.
  // We keep balance as the remaining principal.

  if (account.type === 'CREDIT_CARD') {
    if (!isDestination && (type === 'EXPENSE' || type === 'TRANSFER')) {
      newBalance = Math.max(0, newBalance - amount);
    } else if (isDestination && type === 'PAYMENT') {
      newBalance += amount;
    }
  } else if (!isDestination) {
    if (account.type === 'LOAN' || account.type === 'BORROWED') {
      if (type === 'EXPENSE' || type === 'TRANSFER') newBalance += amount;
      else if (type === 'PAYMENT' || type === 'INCOME' || type === 'REPAY_LOAN' || type === 'REPAY_BORROWED') newBalance = Math.max(0, newBalance - amount);
    } else {
      // BANK, INVESTMENT, SIP, LENDED
      if (type === 'INCOME' || type === 'TRANSFER_IN') newBalance += amount;
      else if (type === 'EXPENSE' || type === 'TRANSFER' || type === 'PAYMENT' || type === 'REPAY_LENDED' || type === 'LEND_MONEY' || type === 'COLLECT_REPAYMENT') newBalance -= amount;
    }
  } else {
    // isDestination = true
    if (account.type === 'LOAN' || account.type === 'BORROWED') {
      newBalance = Math.max(0, newBalance - amount);
    } else {
      // BANK, INVESTMENT, SIP, LENDED
      newBalance += amount;
    }
  }

  await database.runAsync('UPDATE accounts SET balance = ?, lastBalanceUpdateDate = ? WHERE id = ?', [newBalance, newLastUpdate, accountId]);
};

// Reverse the balance impact of a transaction exactly
const reverseTransactionBalance = async (database, tx) => {
  const fromAcc = await database.getFirstAsync('SELECT type, balance FROM accounts WHERE id = ?', [tx.accountId]);
  if (fromAcc) {
    let bal = fromAcc.balance;
    if (fromAcc.type === 'CREDIT_CARD') {
      // Reverse: expense/transfer on CC had subtracted → add back
      if (tx.type === 'EXPENSE' || tx.type === 'TRANSFER') bal += tx.amount;
    } else if (fromAcc.type === 'LOAN' || fromAcc.type === 'BORROWED') {
      if (tx.type === 'EXPENSE' || tx.type === 'TRANSFER') bal -= tx.amount;
      else if (tx.type === 'PAYMENT' || tx.type === 'INCOME' || tx.type === 'REPAY_LOAN' || tx.type === 'REPAY_BORROWED') bal += tx.amount;
    } else if (fromAcc.type === 'LENDED') {
      // LENDED is asset: lend money (transfer/expense) decreased bank but INCREASED lended? 
      // Wait, reverse: if it was a source (Lended -> Bank), it had subtracted. Add back.
      if (tx.type === 'TRANSFER' || tx.type === 'COLLECT_REPAYMENT' || tx.type === 'EXPENSE') bal += tx.amount;
      else if (tx.type === 'INCOME') bal -= tx.amount;
    } else {
      if (tx.type === 'INCOME') bal -= tx.amount;
      else if (tx.type === 'EXPENSE' || tx.type === 'TRANSFER' || tx.type === 'PAYMENT') bal += tx.amount;
    }
    await database.runAsync('UPDATE accounts SET balance = ? WHERE id = ?', [bal, tx.accountId]);
  }

  if (tx.toAccountId && (tx.type === 'TRANSFER' || tx.type === 'PAYMENT')) {
    const toAcc = await database.getFirstAsync('SELECT type, balance FROM accounts WHERE id = ?', [tx.toAccountId]);
    if (toAcc) {
      let bal = toAcc.balance;
      if (toAcc.type === 'CREDIT_CARD') {
        // Reverse: payment to CC had added → subtract back
        if (tx.type === 'PAYMENT') bal = Math.max(0, bal - tx.amount);
      } else if (toAcc.type === 'LOAN' || toAcc.type === 'BORROWED') {
        bal += tx.amount;
      } else if (toAcc.type === 'LENDED') {
        // Destination Lended (Bank -> Lended): had added. Subtract back.
        bal -= tx.amount;
      } else {
        bal -= tx.amount;
      }
      await database.runAsync('UPDATE accounts SET balance = ? WHERE id = ?', [bal, tx.toAccountId]);
    }
  }
};

// Delete a transaction: reverse balance, log SYSTEM record, remove original
export const deleteTransaction = async (userId, tx) => {
  const database = await getDb();
  try {
    await database.execAsync('BEGIN TRANSACTION;');

    await reverseTransactionBalance(database, tx);

    const sid = generateId();
    await database.runAsync(
      `INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note) VALUES (?,?,?,?,?,?,?,?)`,
      [sid, userId, 'SYSTEM', tx.amount, new Date().toISOString(), tx.accountId, tx.toAccountId || null,
       `⚙ Deleted: ${tx.note || 'Untitled'} (₹${tx.amount})`]
    );

    await database.runAsync('DELETE FROM transactions WHERE id = ?', [tx.id]);

    await database.execAsync('COMMIT;');
  } catch (e) {
    await database.execAsync('ROLLBACK;');
    throw e;
  }
};

// Update a transaction: adjust only the DIFFERENCE in amount, update record, log SYSTEM record
export const updateTransaction = async (userId, oldTx, newData) => {
  const database = await getDb();
  try {
    await database.execAsync('BEGIN TRANSACTION;');

    const diff = oldTx.amount - newData.amount; // positive = reduced, negative = increased

    if (diff !== 0) {
      // Only adjust the account if the account type isn't CREDIT_CARD
      const acc = await database.getFirstAsync('SELECT type, balance FROM accounts WHERE id = ?', [oldTx.accountId]);
      if (acc && acc.type !== 'CREDIT_CARD') {
        let newBalance = acc.balance;

        if (acc.type === 'LOAN') {
          // Loan balance works inversely: EXPENSE/TRANSFER raises it
          if (oldTx.type === 'EXPENSE' || oldTx.type === 'TRANSFER') {
            newBalance -= diff; // amount reduced → loan balance decreases (less owed)
          } else if (oldTx.type === 'INCOME' || oldTx.type === 'PAYMENT') {
            newBalance += diff;
          }
        } else {
          if (oldTx.type === 'INCOME') {
            // Income reduced → remove the diff from balance
            newBalance -= diff;
          } else if (oldTx.type === 'EXPENSE' || oldTx.type === 'TRANSFER' || oldTx.type === 'PAYMENT') {
            // Expense reduced → add diff back to balance; increased → deduct diff
            newBalance += diff;
          }
        }
        await database.runAsync('UPDATE accounts SET balance = ? WHERE id = ?', [newBalance, oldTx.accountId]);
      }
    }

    // Update the transaction record
    await database.runAsync(
      `UPDATE transactions SET type=?, amount=?, accountId=?, toAccountId=?, note=?, date=? WHERE id=?`,
      [newData.type, newData.amount, newData.accountId, newData.toAccountId || null,
       newData.note, newData.date, oldTx.id]
    );

    // Write SYSTEM record showing what changed
    const sid = generateId();
    let diffNote;
    if (diff !== 0) {
      const sign = diff > 0 ? `+₹${diff.toFixed(2)} returned` : `-₹${Math.abs(diff).toFixed(2)} deducted`;
      diffNote = `⚙ Adjusted: "${oldTx.note || 'Untitled'}" ₹${oldTx.amount} → ₹${newData.amount} (${sign})`;
    } else {
      diffNote = `⚙ Edited: "${oldTx.note || 'Untitled'}" note changed`;
    }
    await database.runAsync(
      `INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note) VALUES (?,?,?,?,?,?,?,?)`,
      [sid, userId, 'SYSTEM', Math.abs(diff), new Date().toISOString(), newData.accountId, null, diffNote]
    );

    await database.execAsync('COMMIT;');
  } catch (e) {
    await database.execAsync('ROLLBACK;');
    throw e;
  }
};




export const resetDatabase = async () => {
  const database = await getDb();
  await database.execAsync(`DROP TABLE IF EXISTS users;`);
  await database.execAsync(`DROP TABLE IF EXISTS accounts;`);
  await database.execAsync(`DROP TABLE IF EXISTS transactions;`);
  await database.execAsync(`DROP TABLE IF EXISTS expected_expenses;`);
  await database.execAsync(`DROP TABLE IF EXISTS emis;`);
  await database.execAsync(`DROP TABLE IF EXISTS categories;`);
  await database.execAsync(`DROP TABLE IF EXISTS recurring_payments;`);
  
  // CRITICAL: Reset the initPromise so that initDatabase actually runs the CREATE statements again
  initPromise = null;
  await initDatabase();
};

export const getForecastDuration = async (userId) => {
  const database = await getDb();
  const row = await database.getFirstAsync('SELECT forecastMonths FROM users WHERE id = ?', [userId]);
  return row?.forecastMonths || 6;
};

export const updateForecastDuration = async (userId, months) => {
  const database = await getDb();
  await database.runAsync('UPDATE users SET forecastMonths = ? WHERE id = ?', [months, userId]);
};

// ── RECURRING PAYMENTS ────────────────────────────────────────────────────

const generateRecurringExpenses = async (userId, payment, durationMonths = 6) => {
  const database = await getDb();
  const today = new Date();
  const horizon = new Date(today.getFullYear(), today.getMonth() + durationMonths + 1, 0);

  const existing = await database.getAllAsync(
    `SELECT monthKey FROM expected_expenses WHERE userId = ? AND name = ? AND isDone = 0`,
    [userId, payment.name]
  );
  const existingMonths = new Set(existing.map(e => e.monthKey));

  if (payment.scheduleType === 'FIXED') {
    for (let i = 0; i <= durationMonths; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, payment.anchorDay || 1);
      if (d > horizon) break;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!existingMonths.has(monthKey)) {
        await database.runAsync(
          `INSERT INTO expected_expenses (id, userId, monthKey, name, amount, isDone, categoryId, type) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
          [generateId(), userId, monthKey, payment.name, payment.amount, payment.categoryId || null, payment.type || 'EXPENSE']
        );
        existingMonths.add(monthKey);
      }
    }
  } else {
    let current = new Date(payment.nextDueDate);
    while (current <= horizon) {
      const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      if (!existingMonths.has(monthKey)) {
        await database.runAsync(
          `INSERT INTO expected_expenses (id, userId, monthKey, name, amount, isDone, categoryId, type) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
          [generateId(), userId, monthKey, payment.name, payment.amount, payment.categoryId || null, payment.type || 'EXPENSE']
        );
        existingMonths.add(monthKey);
      }
      current = new Date(current.getTime() + (payment.cycleDays || 30) * 24 * 60 * 60 * 1000);
    }
  }
};

export const generateAllRecurringExpenses = async (userId) => {
  const database = await getDb();
  const duration = await getForecastDuration(userId);
  const payments = await database.getAllAsync('SELECT * FROM recurring_payments WHERE userId = ?', [userId]);
  for (const p of payments) {
    await generateRecurringExpenses(userId, p, duration);
  }
};

export const saveRecurringPayment = async (userId, data) => {
  if (!userId) throw new Error('Missing user ID');
  const database = await getDb();
  const id = generateId();
  const scheduleType = data.scheduleType || 'DYNAMIC';
  const anchorDay   = data.anchorDay   || null;
  const categoryId  = data.categoryId  || null;
  const type        = data.type        || 'EXPENSE';
  await database.runAsync(
    `INSERT INTO recurring_payments (id, userId, name, amount, accountId, cycleDays, nextDueDate, note, isActive, scheduleType, anchorDay, categoryId, type, linkedAccountId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    [id, userId, data.name, Number(data.amount), data.accountId,
     Number(data.cycleDays) || 0, data.nextDueDate || new Date().toISOString(),
     data.note || '', scheduleType, anchorDay, categoryId, type, data.linkedAccountId || null]
  );
  const saved = { id, userId, ...data, isActive: 1, scheduleType, anchorDay, categoryId, type, linkedAccountId: data.linkedAccountId || null };
  
  // Log creation
  const logId = generateId();
  await database.runAsync(
    'INSERT INTO account_logs (id, userId, accountId, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
    [logId, userId, id, 'CREATED', `Recurring item "${data.name}" (₹${data.amount}) created.`, new Date().toISOString()]
  );

  await generateRecurringExpenses(userId, saved);
  return saved;
};

export const getRecurringPayments = async (userId) => {
  if (!userId) return [];
  const database = await getDb();
  return await database.getAllAsync(
    `SELECT * FROM recurring_payments WHERE userId = ? AND isActive = 1 ORDER BY nextDueDate ASC`,
    [userId]
  );
};

export const deleteRecurringPayment = async (recurringId) => {
  const database = await getDb();
  const r = await database.getFirstAsync('SELECT * FROM recurring_payments WHERE id = ?', [recurringId]);
  if (r) {
    // Log deletion
    const logId = generateId();
    await database.runAsync(
      'INSERT INTO account_logs (id, userId, accountId, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [logId, r.userId, recurringId, 'DELETED', `Recurring item "${r.name}" deleted.`, new Date().toISOString()]
    );

    await database.runAsync(
      `DELETE FROM expected_expenses WHERE userId = ? AND name = ? AND isDone = 0`,
      [r.userId, r.name]
    );
  }
  await database.runAsync('UPDATE recurring_payments SET isActive = 0 WHERE id = ?', [recurringId]);
};

export const deleteRecurringByAccountId = async (accountId) => {
  if (!accountId) return;
  const database = await getDb();
  const recs = await database.getAllAsync('SELECT id FROM recurring_payments WHERE linkedAccountId = ?', [accountId]);
  for (const r of recs) {
    await deleteRecurringPayment(r.id);
  }
};

// ── Stop: mark STOPPED, delete all future entries ────────────────────────
export const stopRecurringPayment = async (recurringId) => {
  const database = await getDb();
  const r = await database.getFirstAsync('SELECT * FROM recurring_payments WHERE id = ?', [recurringId]);
  if (!r) return;

  // Log "Stopped"
  const logId = generateId();
  await database.runAsync(
    'INSERT INTO account_logs (id, userId, accountId, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
    [logId, r.userId, recurringId, 'UPDATED', `Recurring item "${r.name}" marks as STOPPED.`, new Date().toISOString()]
  );
  await database.runAsync(
    `DELETE FROM expected_expenses WHERE userId = ? AND name = ? AND isDone = 0`,
    [r.userId, r.name]
  );
  await database.runAsync(
    `UPDATE recurring_payments SET status = 'STOPPED', pausedMonths = '[]' WHERE id = ?`,
    [recurringId]
  );
};

// ── Restart (from STOPPED): regenerate all future entries ────────────────
export const restartRecurringPayment = async (recurringId) => {
  const database = await getDb();
  const r = await database.getFirstAsync('SELECT * FROM recurring_payments WHERE id = ?', [recurringId]);
  if (!r) return;

  // Log "Restarted"
  const logId = generateId();
  await database.runAsync(
    'INSERT INTO account_logs (id, userId, accountId, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
    [logId, r.userId, recurringId, 'UPDATED', `Recurring item "${r.name}" marks as RESTARTED.`, new Date().toISOString()]
  );

  await database.runAsync(
    `UPDATE recurring_payments SET status = 'ACTIVE', pausedMonths = '[]' WHERE id = ?`,
    [recurringId]
  );
  await generateRecurringExpenses(r.userId, { ...r, status: 'ACTIVE', pausedMonths: '[]' });
};

// ── Pause: remove expected_expenses for selected months ──────────────────
export const pauseRecurringMonths = async (recurringId, monthKeys) => {
  const database = await getDb();
  const r = await database.getFirstAsync('SELECT * FROM recurring_payments WHERE id = ?', [recurringId]);
  if (!r) return;

  // Log "Paused months"
  const logId = generateId();
  await database.runAsync(
    'INSERT INTO account_logs (id, userId, accountId, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
    [logId, r.userId, recurringId, 'UPDATED', `Recurring item "${r.name}" paused for months: ${monthKeys.join(', ')}.`, new Date().toISOString()]
  );

  const existing  = JSON.parse(r.pausedMonths || '[]');
  const allPaused = [...new Set([...existing, ...monthKeys])];
  for (const mk of monthKeys) {
    await database.runAsync(
      `DELETE FROM expected_expenses WHERE userId = ? AND name = ? AND monthKey = ? AND isDone = 0`,
      [r.userId, r.name, mk]
    );
  }
  const newStatus = allPaused.length > 0 ? 'PAUSED' : 'ACTIVE';
  await database.runAsync(
    `UPDATE recurring_payments SET status = ?, pausedMonths = ? WHERE id = ?`,
    [newStatus, JSON.stringify(allPaused), recurringId]
  );
};

// ── Resume paused months: recreate entries for selected months ───────────
export const resumeRecurringMonths = async (recurringId, monthKeysToResume) => {
  const database = await getDb();
  const r = await database.getFirstAsync('SELECT * FROM recurring_payments WHERE id = ?', [recurringId || '']);
  if (!r) return;
  for (const mk of monthKeysToResume) {
    const has = await database.getFirstAsync(
      `SELECT id FROM expected_expenses WHERE userId = ? AND name = ? AND monthKey = ?`,
      [r.userId || '', r.name || '', mk || '']
    );
    if (!has) {
      await database.runAsync(
        `INSERT INTO expected_expenses (id, userId, monthKey, name, amount, isDone, categoryId) VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [generateId(), r.userId || '', mk || '', r.name || '', r.amount || 0, r.categoryId || null]
      );
    }
  }
  const existing = JSON.parse(r.pausedMonths || '[]');
  const remaining = existing.filter(m => !monthKeysToResume.includes(m));
  const newStatus = remaining.length > 0 ? 'PAUSED' : 'ACTIVE';
  await database.runAsync(
    `UPDATE recurring_payments SET status = ?, pausedMonths = ? WHERE id = ?`,
    [newStatus, JSON.stringify(remaining), recurringId]
  );
};


// Mark a recurring payment as paid: log EXPENSE transaction + advance nextDueDate
export const completeRecurringPayment = async (userId, payment) => {
  const database = await getDb();
  try {
    await database.execAsync('BEGIN TRANSACTION;');

    const now = new Date().toISOString();

    // Log the EXPENSE/TRANSFER transaction
    const txId = generateId();
    const isTransfer = !!payment.linkedAccountId;
    const type = isTransfer ? 'TRANSFER' : 'EXPENSE';
    const note = isTransfer ? `EMI Payment: ${payment.name}` : `🔁 ${payment.name}`;

    await database.runAsync(
      `INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note, categoryId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [txId, userId, type, payment.amount, now, payment.accountId,
       payment.linkedAccountId || null, note, payment.categoryId || null]
    );

    // Deduct from the bank account balance
    await updateAccountBalanceSQL(database, payment.accountId, payment.amount, type, false);
    // If transfer, add to target (reduces loan debt)
    if (isTransfer) {
      await updateAccountBalanceSQL(database, payment.linkedAccountId, payment.amount, type, true);
      
      // Recalculate EMI
      const loan = await database.getFirstAsync('SELECT * FROM accounts WHERE id = ?', [payment.linkedAccountId]);
      if (loan && loan.isEmi === 1 && loan.balance > 0) {
        const P = loan.balance;
        const r = (loan.loanInterestRate || 0) / 1200;
        const start = new Date(loan.loanStartDate);
        const nowD = new Date();
        let monthsPassed = (nowD.getFullYear() - start.getFullYear()) * 12 + (nowD.getMonth() - start.getMonth());
        if (monthsPassed < 0) monthsPassed = 0;
        const remainingMonths = Math.max(1, (loan.loanTenure * 12) - monthsPassed);

        let newEmi = P / remainingMonths;
        if (r > 0) {
          newEmi = (P * r * Math.pow(1 + r, remainingMonths)) / (Math.pow(1 + r, remainingMonths) - 1);
        }
        
        await database.runAsync(
          'UPDATE accounts SET loanStartDate = ? WHERE id = ?',
          [now, payment.linkedAccountId]
        );

        await database.runAsync(
          'UPDATE recurring_payments SET amount = ? WHERE id = ?',
          [newEmi, payment.id]
        );
        // Also update future expected_expenses
        await database.runAsync(
          'UPDATE expected_expenses SET amount = ? WHERE name = ? AND userId = ? AND isDone = 0',
          [newEmi, payment.name, userId]
        );
      }
    }

    // --- CC EMI LIMIT RESTORATION ---
    if (isTransfer) {
      const targetAcc = await database.getFirstAsync('SELECT type FROM accounts WHERE id = ?', [payment.linkedAccountId]);
      if (targetAcc && targetAcc.type === 'EMI') {
        // Restore the CC limit (decrease used balance)
        // payment.accountId is the source CC for the legacy EMI, or the Bank for the new one?
        // Actually, for RecurringPayment of CC EMI, accountId is the CC.
        await updateAccountBalanceSQL(database, payment.accountId, payment.amount, 'TRANSFER', false);
      }
    }

    // Advance nextDueDate
    const cycleDays = payment.cycleDays || 30; // Fallback
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + cycleDays);
    await database.runAsync(
      'UPDATE recurring_payments SET nextDueDate = ? WHERE id = ?',
      [nextDate.toISOString(), payment.id]
    );

    await database.execAsync('COMMIT;');
    return { txId, nextDueDate: nextDate.toISOString() };
  } catch (e) {
    await database.execAsync('ROLLBACK;');
    throw e;
  }
};

// Returns per-name stats for recurring payments, keyed by recurring payment name.
// Matches transactions recorded by payExpectedExpense: note = 'Paid Expected: <name>'
export const getRecurringStats = async (userId, recurringNames) => {
  if (!userId || !recurringNames || recurringNames.length === 0) return {};
  const database = await getDb();
  const currentYear = new Date().getFullYear().toString();
  const map = {};

  for (const name of recurringNames) {
    const namePattern = `%${name}%`;
    const row = await database.getFirstAsync(
      `SELECT
         SUM(amount)  AS totalPaid,
         SUM(CASE WHEN strftime('%Y', date) = ? THEN amount ELSE 0 END) AS yearPaid,
         COUNT(*)     AS timesTotal
       FROM transactions
       WHERE userId = ? AND note LIKE ?`,
      [currentYear, userId, namePattern]
    );
    map[name] = {
      totalPaid:  row?.totalPaid  || 0,
      yearPaid:   row?.yearPaid   || 0,
      timesTotal: row?.timesTotal || 0,
    };
  }
  return map;
};
export const getAvailableHistory = async (userId) => {
  if (!userId) return [];
  try {
    const database = await getDb();
    const currentMonth = new Date().toISOString().substring(0, 7);
    
    // Union of months from transactions and expected_expenses
    const query = `
      SELECT DISTINCT substr(date, 1, 7) as monthKey FROM transactions WHERE userId = ?
      UNION
      SELECT DISTINCT monthKey FROM expected_expenses WHERE userId = ?
      UNION
      SELECT ? as monthKey
      ORDER BY monthKey ASC
    `;
    const rows = await database.getAllAsync(query, [userId || '', userId || '', currentMonth || '']);
    return rows.map(r => r.monthKey).filter(Boolean);
  } catch (error) {
    console.error('Error fetching available history', error);
    return [new Date().toISOString().substring(0, 7)];
  }
};
export const getMonthlyComparisonData = async (userId) => {
  if (!userId) return [];
  const database = await getDb();
  const history = await getAvailableHistory(userId);
  
  const query = `
    SELECT 
      substr(date, 1, 7) as monthKey,
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as expense
    FROM transactions
    WHERE userId = ?
    GROUP BY monthKey
  `;
  
  try {
    const rows = await database.getAllAsync(query, [userId || '']);
    const dataMap = {};
    rows.forEach(r => {
      dataMap[r.monthKey] = {
        income: r.income || 0,
        expense: r.expense || 0,
        savings: Math.max(0, (r.income || 0) - (r.expense || 0))
      };
    });
    
    return history.map(mKey => {
      const d = dataMap[mKey] || { income: 0, expense: 0, savings: 0 };
      const dateObj = new Date(parseInt(mKey.split('-')[0]), parseInt(mKey.split('-')[1]) - 1, 1);
      return {
        monthKey: mKey,
        label: dateObj.toLocaleString('default', { month: 'short' }),
        year: mKey.split('-')[0],
        ...d
      };
    });
  } catch (error) {
    console.error('Error in getMonthlyComparisonData:', error);
    return [];
  }
};

export const getMonthlyCategorySplit = async (userId, monthKey) => {
  if (!userId || !monthKey) return [];
  const database = await getDb();
  const query = `
    SELECT 
      COALESCE(c.name, 'Others') as category, 
      SUM(t.amount) as amount
    FROM transactions t
    LEFT JOIN categories c ON t.categoryId = c.id
    WHERE t.userId = ? AND t.type = 'EXPENSE' AND t.date LIKE ?
    GROUP BY category
    ORDER BY amount DESC
  `;
  
  try {
    const rows = await database.getAllAsync(query, [userId || '', (monthKey || '') + '%']);
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80', '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'];
    return rows.map((r, i) => ({
      ...r,
      color: colors[i % colors.length]
    }));
  } catch (error) {
    console.error('Error in getMonthlyCategorySplit:', error);
    return [];
  }
};

export const getCustomGraphs = async (userId) => {
  if (!userId) return [];
  try {
    const database = await getDb();
    const user = await database.getFirstAsync('SELECT customGraphs FROM users WHERE id = ?', [userId || '']);
    if (!user || !user.customGraphs) return [];
    return JSON.parse(user.customGraphs || '[]') || [];
  } catch (e) {
    console.error('Error fetching custom graphs', e);
    return [];
  }
};

export const saveCustomGraphs = async (userId, graphs) => {
  if (!userId) return;
  try {
    const database = await getDb();
    await database.runAsync('UPDATE users SET customGraphs = ? WHERE id = ?', [JSON.stringify(graphs), userId || '']);
  } catch (e) {
    console.error('Error saving custom graphs', e);
  }
};

export const getCustomGraphData = async (userId, categoryIds, monthKey) => {
  if (!userId || !categoryIds || categoryIds.length === 0 || !monthKey) return [];
  const database = await getDb();
  const placeholders = categoryIds.map(() => '?').join(',');
  const query = `
    SELECT 
      c.name as category, 
      SUM(t.amount) as amount
    FROM transactions t
    JOIN categories c ON t.categoryId = c.id
    WHERE t.userId = ? AND t.type = 'EXPENSE' AND t.date LIKE ? AND c.id IN (${placeholders})
    GROUP BY c.id
    ORDER BY amount DESC
  `;
  
  try {
    const rows = await database.getAllAsync(query, [userId || '', (monthKey || '') + '%', ...categoryIds.map(id => id || '')]);
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80', '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'];
    return rows.map((r, i) => ({
      ...r,
      color: colors[i % colors.length]
    }));
  } catch (error) {
    console.error('Error in getCustomGraphData:', error);
    return [];
  }
};

export const exportData = async (userId) => {
  if (!userId) return null;
  await initDatabase();
  const database = await getDb();
  // Tables to export
  const tables = ['users', 'accounts', 'transactions', 'expected_expenses', 'emis', 'categories', 'recurring_payments', 'account_logs'];
  const backup = { 
    version: 2, 
    timestamp: new Date().toISOString(), 
    userId,
    data: {} 
  };
  
  try {
    for (const table of tables) {
      // Check if table exists first (some might be legacy or conditional)
      const idColumn = table === 'users' ? 'id' : 'userId';
      const rows = await database.getAllAsync(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, [userId || '']);
      backup.data[table] = rows;
    }
    return JSON.stringify(backup, null, 2);
  } catch (error) {
    console.error('Error in exportData:', error);
    throw error;
  }
};

export const importData = async (userId, jsonString) => {
  if (!userId || !jsonString) return;
  await initDatabase();
  const database = await getDb();
  const backup = JSON.parse(jsonString);
  
  if (!backup.data) throw new Error('Invalid backup format');

  // The actual userId to restore comes from the backup itself
  const restoreUserId = backup.userId;
  if (!restoreUserId) throw new Error('Backup has no userId — cannot restore safely.');

  // Identity Check: If we are logged in as a specific user, ensure the backup belongs to them.
  // 'RESTORE' is used on the Login screen where no user is yet established.
  if (userId !== 'RESTORE' && backup.userId !== userId) {
    throw new Error('This backup belongs to a different user and cannot be restored here.');
  }
  
  try {
    await database.withTransactionAsync(async () => {
      // Delete only data belonging to this user (safe for multi-user setups)
      const userScopedTables = ['transactions', 'expected_expenses', 'emis', 'accounts', 'categories', 'recurring_payments', 'account_logs'];
      
      for (const table of userScopedTables) {
        await database.runAsync(`DELETE FROM ${table} WHERE userId = ?`, [restoreUserId]);
      }
      // Delete the user row itself last
      await database.runAsync(`DELETE FROM users WHERE id = ?`, [restoreUserId]);
      
      // Insert new data
      for (const [table, rows] of Object.entries(backup.data)) {
        if (!rows || rows.length === 0) continue;
        
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(',');
        const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;
        
        for (const row of rows) {
          // Force disable biometrics if it's a user row
          if (table === 'users') {
            row.biometricsEnabled = 0;
          }
          const values = columns.map(c => row[c] === undefined ? null : row[c]);
          await database.runAsync(sql, values);
        }
      }
    });
  } catch (error) {
    console.error('Error in importData:', error);
    throw error;
  }
};

export const getAutoBackupSettings = async (userId) => {
  const database = await getDb();
  const row = await database.getFirstAsync('SELECT autoBackupEnabled, lastBackupTimestamp FROM users WHERE id = ?', [userId || '']);
  return {
    enabled: row?.autoBackupEnabled === 1,
    lastTimestamp: row?.lastBackupTimestamp || null
  };
};

export const updateAutoBackupSettings = async (userId, enabled) => {
  const database = await getDb();
  await database.runAsync('UPDATE users SET autoBackupEnabled = ? WHERE id = ?', [enabled ? 1 : 0, userId]);
};

const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`;

export const performAutoBackup = async (userId) => {
  if (!userId) return;
  
  const settings = await getAutoBackupSettings(userId);
  if (!settings.enabled) return;

  const now = new Date();
  if (settings.lastTimestamp) {
    const last = new Date(settings.lastTimestamp);
    const diff = now.getTime() - last.getTime();
    if (diff < 24 * 60 * 60 * 1000) return; // Wait 24h
  }

  try {
    // Ensure directory exists
    const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
    }

    // Export data
    const json = await exportData(userId);
    const fileName = `auto_backup_${now.getTime()}.json`;
    const fileUri = BACKUP_DIR + fileName;
    await FileSystem.writeAsStringAsync(fileUri, json);

    // Update timestamp
    const database = await getDb();
    await database.runAsync('UPDATE users SET lastBackupTimestamp = ? WHERE id = ?', [now.toISOString(), userId]);

    // Cleanup: Keep only 2 latest
    const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
    const backupFiles = files.filter(f => f.startsWith('auto_backup_')).sort((a, b) => {
      const timeA = parseInt(a.replace('auto_backup_', '').replace('.json', ''), 10);
      const timeB = parseInt(b.replace('auto_backup_', '').replace('.json', ''), 10);
      return timeB - timeA; // Descending
    });

    if (backupFiles.length > 2) {
      for (let i = 2; i < backupFiles.length; i++) {
        await FileSystem.deleteAsync(BACKUP_DIR + backupFiles[i], { idempotent: true });
      }
    }
    console.log('Auto-backup completed successfully');
  } catch (error) {
    console.error('Auto-backup failed:', error);
  }
};

export const listSystemBackups = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
    if (!dirInfo.exists) return [];
    
    const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
    const backupFiles = files.filter(f => f.startsWith('auto_backup_')).sort((a, b) => {
      const timeA = parseInt(a.replace('auto_backup_', '').replace('.json', ''), 10);
      const timeB = parseInt(b.replace('auto_backup_', '').replace('.json', ''), 10);
      return timeB - timeA; // Latest first
    });

    const results = [];
    for (const f of backupFiles) {
      const fileUri = BACKUP_DIR + f;
      const content = await FileSystem.readAsStringAsync(fileUri);
      const backupData = JSON.parse(content);
      const timestamp = parseInt(f.replace('auto_backup_', '').replace('.json', ''), 10);
      results.push({
        name: new Date(timestamp).toLocaleString(),
        uri: fileUri,
        timestamp,
        content // Returning content to avoid double read in UI
      });
    }
    return results;
  } catch (error) {
    console.error('List system backups failed:', error);
    return [];
  }
};
