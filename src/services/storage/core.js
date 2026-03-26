import { Platform } from 'react-native';
import { deleteRecurringByAccountId } from './recurringStorage';
import { generateId, getDb, updateAccountBalanceSQL } from './utils';
export { getDb };

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
        dashboardGraphs TEXT DEFAULT '{"monthlyTrends":true,"totalSavings":true,"ccUtilization":true,"totalCcOutstanding":true,"nonEmiCcOutstanding":true,"monthlyExpenseSplit":true,"totalLiabilities":true}',
        customGraphs TEXT DEFAULT '[]',
        graphOrder TEXT DEFAULT '[]',
        developerMode INTEGER DEFAULT 0,
        timezone TEXT DEFAULT '${Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}',
        currency TEXT DEFAULT '${Intl.NumberFormat?.().resolvedOptions?.().currency || 'INR'}'
      );`);

      await database.execAsync(`CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL,
        accountId TEXT NOT NULL, toAccountId TEXT, note TEXT, categoryId TEXT, linkedItemId TEXT,
        isDeleted INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );`);

      await database.execAsync(`CREATE TABLE IF NOT EXISTS expected_expenses (
        id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, monthKey TEXT NOT NULL, name TEXT NOT NULL, amount REAL NOT NULL,
        isDone INTEGER DEFAULT 0, categoryId TEXT, type TEXT DEFAULT 'EXPENSE', linkedAccountId TEXT, anchorDay INTEGER,
        isDeleted INTEGER DEFAULT 0,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );`);

      await database.execAsync(`CREATE TABLE IF NOT EXISTS bank_accounts (
        id TEXT PRIMARY KEY NOT NULL,
        userId TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'BANK',
        name TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 0,
        ifsc TEXT,
        accountNumber TEXT,
        customerId TEXT,
        isClosed INTEGER DEFAULT 0,
        isDeleted INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        categoryId TEXT,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );`);

      await database.execAsync(`CREATE TABLE IF NOT EXISTS credit_cards (
        id TEXT PRIMARY KEY NOT NULL,
        userId TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'CREDIT_CARD',
        name TEXT NOT NULL,
        creditLimit REAL NOT NULL DEFAULT 0,
        currentUsage REAL NOT NULL DEFAULT 0,
        remainingLimit REAL NOT NULL DEFAULT 0,
        cardNumber TEXT,
        cvv TEXT,
        expiry TEXT,
        billingDay INTEGER,
        dueDay INTEGER,
        isClosed INTEGER DEFAULT 0,
        isDeleted INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        categoryId TEXT,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );`);

      await database.execAsync(`CREATE TABLE IF NOT EXISTS loans (
        id TEXT PRIMARY KEY NOT NULL,
        userId TEXT NOT NULL,
        type TEXT NOT NULL, -- LOAN, BORROWED, DEBT_REPAY
        name TEXT NOT NULL,
        disbursedPrincipal REAL NOT NULL DEFAULT 0,
        principal REAL NOT NULL DEFAULT 0,
        interestRate REAL NOT NULL DEFAULT 0,
        tenure INTEGER NOT NULL DEFAULT 0,
        startDate TEXT NOT NULL,
        finePercentage REAL DEFAULT 0,
        serviceCharge REAL DEFAULT 0,
        taxPercentage REAL DEFAULT 0,
        loanFinePaid REAL DEFAULT 0,
        paidMonths INTEGER DEFAULT 0,
        isClosed INTEGER DEFAULT 0,
        closureAmount REAL,
        isDeleted INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        categoryId TEXT,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );`);

      await database.execAsync(`CREATE TABLE IF NOT EXISTS investments (
        id TEXT PRIMARY KEY NOT NULL,
        userId TEXT NOT NULL,
        type TEXT NOT NULL, -- SIP, LUMP_SUM
        name TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 0,
        sipAmount REAL DEFAULT 0,
        categoryId TEXT,
        lastUpdate TEXT,
        isClosed INTEGER DEFAULT 0,
        isDeleted INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );`);

      await database.execAsync(`CREATE TABLE IF NOT EXISTS emis (
        id TEXT PRIMARY KEY NOT NULL, 
        userId TEXT NOT NULL, 
        type TEXT NOT NULL DEFAULT 'EMI',
        name TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 0,
        amount REAL NOT NULL, 
        emiDate INTEGER NOT NULL, 
        tenure INTEGER NOT NULL,
        paidMonths INTEGER DEFAULT 0, 
        note TEXT, 
        isClosed INTEGER DEFAULT 0, 
        closureAmount REAL,
        linkedAccountId TEXT,
        loanFinePaid REAL DEFAULT 0,
        isDeleted INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        ccUsage REAL DEFAULT 0,
        productPrice REAL DEFAULT 0,
        processingFee REAL DEFAULT 0,
        ccRemaining REAL DEFAULT 0,
        emiStartDate TEXT,
        installmentStatus TEXT DEFAULT '{}',
        categoryId TEXT,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );`);

      await database.execAsync(`CREATE TABLE IF NOT EXISTS sip_accounts (
        id TEXT PRIMARY KEY NOT NULL,
        userId TEXT NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        sipDate INTEGER NOT NULL,
        startDate TEXT NOT NULL,
        categoryId TEXT,
        linkedAccountId TEXT,
        isClosed INTEGER DEFAULT 0,
        isDeleted INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        balance REAL DEFAULT 0,
        status TEXT DEFAULT 'ACTIVE',
        pausedMonths TEXT DEFAULT '[]',
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );`);

      await database.execAsync(`CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
        isDeleted INTEGER DEFAULT 0, isSystem INTEGER DEFAULT 0,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );`);


      // Enforce unique names for categories per user
      await database.execAsync('CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_unique_name ON categories (userId, name);');

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

      // 11. Migrations for decentralized schema (safe ALTER TABLEs)
      const tables = ['bank_accounts', 'credit_cards', 'loans', 'investments', 'emis', 'sip_accounts'];
      for (const table of tables) {
        try { await database.execAsync(`ALTER TABLE ${table} ADD COLUMN userId TEXT;`); } catch (e) { }
        try { await database.execAsync(`ALTER TABLE ${table} ADD COLUMN type TEXT;`); } catch (e) { }
        try { await database.execAsync(`ALTER TABLE ${table} ADD COLUMN isDeleted INTEGER DEFAULT 0;`); } catch (e) { }
        try { await database.execAsync(`ALTER TABLE ${table} ADD COLUMN createdAt TEXT DEFAULT CURRENT_TIMESTAMP;`); } catch (e) { }
      }

      // 12. SIP specific lifecycle columns
      try { await database.execAsync('ALTER TABLE sip_accounts ADD COLUMN status TEXT DEFAULT "ACTIVE";'); } catch (e) { }
      try { await database.execAsync('ALTER TABLE sip_accounts ADD COLUMN pausedMonths TEXT DEFAULT "[]";'); } catch (e) { }

      try { await database.execAsync('ALTER TABLE categories ADD COLUMN isSystem INTEGER DEFAULT 0;'); } catch (e) { }

      // Populate missing types for legacy data
      await database.runAsync("UPDATE bank_accounts SET type = 'BANK' WHERE type IS NULL;");
      await database.runAsync("UPDATE credit_cards SET type = 'CREDIT_CARD' WHERE type IS NULL;");
      await database.runAsync("UPDATE emis SET type = 'EMI' WHERE type IS NULL;");
      await database.runAsync("UPDATE loans SET type = 'LOAN' WHERE type IS NULL;");
      await database.runAsync("UPDATE investments SET type = 'INVESTMENT' WHERE type IS NULL;");
      // Since Loans/Investments can have multiple types, we only set if null and they have unique characteristics (or rely on existing 'type' column if it was there)
      // Actually, specialized 'type' was already part of those tables mostly.
      
      // 13. Retroactively update historical SIP transaction types
      await database.runAsync("UPDATE transactions SET type = 'SIP_PAY' WHERE type = 'EXPENSE' AND (note LIKE 'SIP %' OR note LIKE 'Paid Expected: SIP:%' OR note LIKE 'SIP Payment:%');");

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
        linkedAccountId TEXT DEFAULT NULL,
        isDeleted INTEGER DEFAULT 0
      );`);

      await database.execAsync(`CREATE TABLE IF NOT EXISTS category_budgets (
        id TEXT PRIMARY KEY NOT NULL,
        userId TEXT NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        categoryIds TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        isDeleted INTEGER DEFAULT 0,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );`);

      // Migration helper that checks if column exists
      const addColumn = async (table, column, type, defaultValue = null) => {
        try {
          const info = await database.getAllAsync(`PRAGMA table_info(${table})`);
          const exists = info.some(c => c.name === column);
          if (!exists) {
            let sql = `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`;
            if (defaultValue !== null) sql += ` DEFAULT ${defaultValue}`;
            await database.runAsync(sql);
          }
        } catch (e) {
          console.error(`Migration failed for ${table}.${column}:`, e);
        }
      };

      await addColumn('recurring_payments', 'linkedAccountId', 'TEXT');
      await addColumn('transactions', 'categoryId', 'TEXT');
      await addColumn('users', 'themePreference', 'TEXT', "'light'");
      await addColumn('users', 'fontScale', 'TEXT', "'medium'");
      await addColumn('recurring_payments', 'scheduleType', 'TEXT', "'DYNAMIC'");
      await addColumn('recurring_payments', 'anchorDay', 'INTEGER');
      await addColumn('recurring_payments', 'status', 'TEXT', "'ACTIVE'");
      await addColumn('recurring_payments', 'pausedMonths', 'TEXT', "'[]'");
      await addColumn('recurring_payments', 'categoryId', 'TEXT');
      await addColumn('expected_expenses', 'categoryId', 'TEXT');
      await addColumn('expected_expenses', 'type', 'TEXT', "'EXPENSE'");
      await addColumn('users', 'forecastMonths', 'INTEGER', 6);
      await addColumn('recurring_payments', 'type', 'TEXT', "'EXPENSE'");
      await addColumn('users', 'autoBackupEnabled', 'INTEGER', 0);
      await addColumn('users', 'lastBackupTimestamp', 'TEXT');
      await addColumn('expected_expenses', 'linkedAccountId', 'TEXT');
      await addColumn('emis', 'categoryId', 'TEXT');
      await addColumn('loans', 'categoryId', 'TEXT');
      await addColumn('bank_accounts', 'categoryId', 'TEXT');
      await addColumn('credit_cards', 'categoryId', 'TEXT');
      await addColumn('emis', 'isClosed', 'INTEGER', 0);
      await addColumn('emis', 'closureAmount', 'REAL');
      await addColumn('expected_expenses', 'anchorDay', 'INTEGER');
      await addColumn('bank_accounts', 'name', 'TEXT', "''");
      await addColumn('bank_accounts', 'balance', 'REAL', 0);
      await addColumn('credit_cards', 'name', 'TEXT', "''");
      await addColumn('credit_cards', 'creditLimit', 'REAL', 0);
      await addColumn('credit_cards', 'currentUsage', 'REAL', 0);
      await addColumn('credit_cards', 'remainingLimit', 'REAL', 0);
      await addColumn('emis', 'ccUsage', 'REAL', 0);
      await addColumn('emis', 'productPrice', 'REAL', 0);
      await addColumn('emis', 'processingFee', 'REAL', 0);
      await addColumn('emis', 'ccRemaining', 'REAL', 0);
      await addColumn('emis', 'emiStartDate', 'TEXT');
      await addColumn('emis', 'installmentStatus', 'TEXT', "'{}'");
      await addColumn('users', 'developerMode', 'INTEGER', 0);
      await addColumn('loans', 'loanFinePaid', 'REAL', 0);
      await addColumn('loans', 'loanType', 'TEXT', "'ONE_TIME'");
      await addColumn('loans', 'disbursementDate', 'TEXT');
      await addColumn('loans', 'emiStartDate', 'TEXT');
      await addColumn('loans', 'emiAmount', 'REAL');
      await addColumn('loans', 'processingFee', 'REAL', 0);
      await addColumn('loans', 'paidMonths', 'INTEGER', 0);
      await addColumn('loans', 'installmentStatus', 'TEXT', "'{}'");
      await addColumn('transactions', 'linkedItemId', 'TEXT');
      await addColumn('transactions', 'isDeleted', 'INTEGER', 0);
      await addColumn('transactions', 'createdAt', 'TEXT');
      await addColumn('expected_expenses', 'isDeleted', 'INTEGER', 0);
      await addColumn('categories', 'isDeleted', 'INTEGER', 0);
      await addColumn('recurring_payments', 'isDeleted', 'INTEGER', 0);
      await addColumn('transactions', 'monthKey', 'TEXT');
      await addColumn('users', 'timezone', 'TEXT', `'${Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}'`);
      await addColumn('users', 'currency', 'TEXT', `'${Intl.NumberFormat?.().resolvedOptions?.().currency || 'INR'}'`);
      await addColumn('sip_accounts', 'balance', 'REAL', 0);

      // These are updates to existing columns or complex defaults, not simple column additions
      const runMigration = async (sql) => {
        try { await database.execAsync(sql); } catch (e) { }
      };
      await runMigration('ALTER TABLE loans RENAME COLUMN balance TO disbursedPrincipal;');
      await addColumn('loans', 'installmentStatus', 'TEXT', "'{}'");
      await runMigration("ALTER TABLE users ADD COLUMN lastBackupTimestamp TEXT DEFAULT NULL;");
      await runMigration("UPDATE transactions SET createdAt = date WHERE createdAt IS NULL;");
      await runMigration(`ALTER TABLE users ADD COLUMN dashboardGraphs TEXT DEFAULT '{"monthlyTrends":true,"totalSavings":true,"ccUtilization":true,"totalCcOutstanding":true,"nonEmiCcOutstanding":true,"monthlyExpenseSplit":true,"totalLiabilities":true}';`);
      // Update existing JSON to include ccUtilization if missing (SQLite 3.31+ supports JSON functions)
      try {
        await database.runAsync("UPDATE users SET dashboardGraphs = json_insert(dashboardGraphs, '$.ccUtilization', true) WHERE json_extract(dashboardGraphs, '$.ccUtilization') IS NULL;");
      } catch (e) {
        // Fallback for older SQLite if json functions are missing
        await database.runAsync("UPDATE users SET dashboardGraphs = '{\"monthlyTrends\":true,\"totalSavings\":true,\"ccUtilization\":true,\"totalCcOutstanding\":true,\"nonEmiCcOutstanding\":true,\"monthlyExpenseSplit\":true,\"totalLiabilities\":true}' WHERE dashboardGraphs NOT LIKE '%ccUtilization%';");
      }
      await runMigration("ALTER TABLE users ADD COLUMN customGraphs TEXT DEFAULT '[]';");
      await runMigration("ALTER TABLE users ADD COLUMN graphOrder TEXT DEFAULT '[]';");

      await runMigration('ALTER TABLE expected_expenses ADD COLUMN linkedAccountId TEXT DEFAULT NULL;');
      await runMigration('ALTER TABLE emis ADD COLUMN isClosed INTEGER DEFAULT 0;');
      await runMigration('ALTER TABLE emis ADD COLUMN closureAmount REAL DEFAULT NULL;');
      await runMigration('ALTER TABLE expected_expenses ADD COLUMN anchorDay INTEGER DEFAULT NULL;');

      // One-time fix for initial UTC default mistake
      const systemTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      await database.runAsync("UPDATE users SET timezone = ? WHERE timezone = 'UTC' OR timezone IS NULL", [systemTZ]);

      // Cleanup: Remove redundant recurring payments for EMI accounts to avoid duplicates
      await database.runAsync(`
        UPDATE expected_expenses 
        SET isDeleted = 1
        WHERE isDone = 0 AND name IN (
          SELECT name FROM recurring_payments 
          WHERE linkedAccountId IN (SELECT id FROM accounts WHERE type = 'EMI' AND (isDeleted = 0 OR isDeleted IS NULL))
        )
      `);
      await database.runAsync(`
        UPDATE recurring_payments 
        SET isDeleted = 1
        WHERE linkedAccountId IN (SELECT id FROM accounts WHERE type = 'EMI' AND (isDeleted = 0 OR isDeleted IS NULL))
      `);

      return true;
    } catch (error) {
      initPromise = null;
    }
  })();

  return initPromise;
};

export const getAccounts = async (arg1, arg2) => {
  let database = arg1;
  let userId = arg2;

  // Polymorphic support: if arg1 is string/null and arg2 is undefined, arg1 is userId
  if (typeof arg1 === 'string' || !arg1) {
    if (arg2 === undefined) {
      userId = arg1;
      database = await getDb();
    }
  }

  if (!userId) return [];
  const sql = `
    WITH all_accounts AS (
      SELECT id, userId, type, isDeleted, createdAt FROM bank_accounts
      UNION ALL
      SELECT id, userId, type, isDeleted, createdAt FROM credit_cards
      UNION ALL
      SELECT id, userId, type, isDeleted, createdAt FROM loans
      UNION ALL
      SELECT id, userId, type, isDeleted, createdAt FROM investments
      UNION ALL
      SELECT id, userId, type, isDeleted, createdAt FROM emis
      UNION ALL
      SELECT id, userId, 'SIP' as type, isDeleted, createdAt FROM sip_accounts
    )
    SELECT a.*, 
           COALESCE(ba.name, cc.name, l.name, i.name, e.name, s.name) as name,
           COALESCE(ba.balance, cc.currentUsage, l.principal, i.balance, e.balance, s.balance, s.amount) as balance,
           cc.creditLimit,
           ba.ifsc, ba.accountNumber, ba.customerId,
           cc.cardNumber, cc.cvv, cc.expiry, cc.remainingLimit,
           l.principal as loanPrincipal, l.interestRate as loanInterestRate, l.tenure as loanTenure,
           l.startDate as loanStartDate, l.finePercentage as loanFinePercentage,
           l.loanType, l.emiStartDate as loanEmiStartDate, l.emiAmount as loanEmiAmount,
           l.serviceCharge as loanServiceCharge, l.taxPercentage as loanTaxPercentage,
            COALESCE(ba.isClosed, cc.isClosed, l.isClosed, i.isClosed, e.isClosed, s.isClosed) as isClosed,
            l.disbursedPrincipal as actualDisbursedPrincipal,
            l.closureAmount as loanClosureAmount,
            (COALESCE(l.loanFinePaid, 0) + COALESCE(e.loanFinePaid, 0)) as loanFinePaid,
            COALESCE(s.amount, i.sipAmount) as sipAmount, 
            i.lastUpdate as investmentLastUpdate,
            e.amount as emiAmountVal, e.emiDate as emiDateVal, e.tenure as emiTenureVal, e.paidMonths as emiPaidMonthsVal,
            e.ccUsage, e.productPrice, e.processingFee, e.ccRemaining, e.emiStartDate, 
            COALESCE(e.installmentStatus, l.installmentStatus) as installmentStatus,
            e.tenure as tenure, e.amount as amount,
            e.closureAmount as emiClosureAmount,
            e.linkedAccountId as linkedAccountId, e.linkedAccountId as sourceCcId,
            COALESCE(cc.billingDay, s.sipDate, (SELECT d.emiDate FROM emis d WHERE d.id = a.id)) as billingDay,
            cc.dueDay,
            COALESCE(s.categoryId, i.categoryId, e.categoryId, l.categoryId) as categoryId,
            COALESCE(s.status, 'ACTIVE') as status,
            COALESCE(s.pausedMonths, '[]') as pausedMonths,
            (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE (t.toAccountId = a.id OR t.linkedItemId = a.id) AND (t.type IN ('TRANSFER', 'PAYMENT', 'REPAY_LOAN', 'REPAY_BORROWED', 'EMI_PAYMENT', 'EMI_FINE', 'FINE', 'EXPENSE'))) as totalPaid,
            (SELECT COUNT(*) FROM transactions t WHERE (t.toAccountId = a.id OR t.linkedItemId = a.id) AND (t.type IN ('TRANSFER', 'PAYMENT', 'REPAY_LOAN', 'REPAY_BORROWED', 'EMI_PAYMENT', 'EXPENSE'))) as paymentCount,
            (SELECT combined.name 
             FROM (SELECT id, name FROM bank_accounts UNION ALL SELECT id, name FROM credit_cards) as combined
             WHERE combined.id = e.linkedAccountId) as linkedAccountName
    FROM all_accounts a 
    LEFT JOIN bank_accounts ba ON a.id = ba.id
    LEFT JOIN credit_cards cc ON a.id = cc.id
    LEFT JOIN loans l ON a.id = l.id
    LEFT JOIN investments i ON a.id = i.id
    LEFT JOIN emis e ON a.id = e.id
    LEFT JOIN sip_accounts s ON a.id = s.id
    WHERE a.userId = ? AND (a.isDeleted IS NULL OR a.isDeleted = 0)
    ORDER BY a.createdAt DESC
  `;
  const rows = await database.getAllAsync(sql, [userId || '']);

  // Manual resolution of linked accounts for robustness
  const nameMap = {};
  rows.forEach(r => { if (r.id) nameMap[r.id] = r.name; });

  return rows.map(r => {
    if (r.type === 'EMI' && r.linkedAccountId && !r.linkedAccountName) {
      r.linkedAccountName = nameMap[r.linkedAccountId] || null;
    }
    return r;
  });
};

export const getAccountLogs = async (arg1, arg2) => {
  let database = arg1;
  let userId = arg2;
  if (typeof arg1 === 'string' || !arg1) {
    userId = arg1;
    database = await getDb();
  }
  if (!userId) return [];
  return await database.getAllAsync('SELECT * FROM account_logs WHERE userId = ? ORDER BY timestamp DESC LIMIT 100', [userId || '']);
};

export const softDeleteAccount = async (arg1, arg2) => {
  let database = arg1;
  let accountId = arg2;
  if (typeof arg1 === 'string' || !arg1) {
    accountId = arg1;
    database = await getDb();
  }
  if (!accountId) return;
  try {
    const accSql = `
      WITH all_accounts AS (
        SELECT id, userId, type, isDeleted FROM bank_accounts
        UNION ALL
        SELECT id, userId, type, isDeleted FROM credit_cards
        UNION ALL
        SELECT id, userId, type, isDeleted FROM loans
        UNION ALL
        SELECT id, userId, type, isDeleted FROM investments
        UNION ALL
        SELECT id, userId, type, isDeleted FROM emis
        UNION ALL
        SELECT id, userId, type, isDeleted FROM sip_accounts
      )
      SELECT a.*, 
             COALESCE(ba.name, cc.name, l.name, i.name, e.name) as name,
             COALESCE(ba.balance, cc.currentUsage, l.disbursedPrincipal, i.balance, e.balance) as balance,
             e.linkedAccountId
      FROM all_accounts a 
      LEFT JOIN bank_accounts ba ON a.id = ba.id
      LEFT JOIN credit_cards cc ON a.id = cc.id
      LEFT JOIN loans l ON a.id = l.id
      LEFT JOIN investments i ON a.id = i.id
      LEFT JOIN emis e ON a.id = e.id
      WHERE a.id = ?
    `;
    const acc = await database.getFirstAsync(accSql, [accountId]);

    if (acc) {
      if (acc.type === 'EMI') {
        if (acc.linkedAccountId && acc.balance > 0) {
          const settlementAmount = acc.balance;
          const sourceCcId = acc.linkedAccountId;
          const txId = generateId();
          await database.runAsync(
            'INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note, linkedItemId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [txId, acc.userId, 'EMI_LIMIT_RECOVERY', settlementAmount, new Date().toISOString(), accountId, sourceCcId, `EMI Cancellation (Limit Recovery): ${acc.name}`, accountId]
          );
          await updateAccountBalanceSQL(database, sourceCcId, settlementAmount, 'EMI_LIMIT_RECOVERY', true);
        }
      } else if (acc.type === 'CREDIT_CARD') {
        const linkedEmisQuery = `
          SELECT id, name, userId
          FROM emis
          WHERE linkedAccountId = ? AND (isDeleted = 0 OR isDeleted IS NULL)
        `;
        const linkedEmis = await database.getAllAsync(linkedEmisQuery, [accountId]);
        for (const emi of linkedEmis) {
          await deleteRecurringByAccountId(database, emi.id);
          await database.runAsync('UPDATE expected_expenses SET isDeleted = 1 WHERE linkedAccountId = ?', [emi.id]);
          await database.runAsync('UPDATE emis SET isDeleted = 1 WHERE id = ?', [emi.id]);
        }
      }

      await deleteRecurringByAccountId(database, accountId);
      await database.runAsync('UPDATE expected_expenses SET isDeleted = 1 WHERE linkedAccountId = ?', [accountId]);

      const tables = ['bank_accounts', 'credit_cards', 'loans', 'investments', 'emis', 'sip_accounts'];
      for (const table of tables) {
        await database.runAsync(`UPDATE ${table} SET isDeleted = 1 WHERE id = ?`, [accountId]);
      }

      const logId = generateId();
      await database.runAsync(
        'INSERT INTO account_logs (id, userId, accountId, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
        [logId, acc.userId, accountId, 'DELETED', `Account "${acc.name}" closed/deleted.`, new Date().toISOString()]
      );
    }
  } catch (error) {
    console.error('Error soft deleting account', error);
  }
};

export const recordAccountFine = async (arg1, arg2, arg3, arg4, arg5, arg6, arg7) => {
  let database = arg1;
  let userId = arg2;
  let accountId = arg3;
  let amount = arg4;
  let bankAccountId = arg5;
  let monthKey = arg6;
  let currencySymbol = arg7 || '₹';

  if (typeof arg1 === 'string' || !arg1) {
    // If arg1 is string, it shifted: (userId, accountId, amount, bankAccountId, monthKey)
    userId = arg1;
    accountId = arg2;
    amount = arg3;
    bankAccountId = arg4;
    monthKey = arg5;
    currencySymbol = arg6 || '₹';
    database = await getDb();
  }
  try {
    const txId = generateId();
    const now = new Date().toISOString();
    await database.runAsync(
      'INSERT INTO transactions (id, userId, type, amount, date, accountId, linkedItemId, monthKey, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [txId, userId, 'EMI_FINE', amount, now, bankAccountId || null, accountId, monthKey || null, 'EMI Late Fine / Penalty']
    );

    const accountSql = `
      SELECT id, 'LOAN' as type FROM loans WHERE id = ?
      UNION ALL
      SELECT id, 'EMI' as type FROM emis WHERE id = ?
    `;
    const account = await database.getFirstAsync(accountSql, [accountId, accountId]);
    console.log('Recording fine for account:', account);

    if (account) {
      if (['LOAN', 'BORROWED', 'LENDED', 'DEBT_REPAY'].includes(account.type)) {
        await database.runAsync('UPDATE loans SET loanFinePaid = COALESCE(loanFinePaid, 0) + ? WHERE id = ?', [amount, accountId]);
      } else if (account.type === 'EMI') {
        const updateSql = 'UPDATE emis SET loanFinePaid = COALESCE(loanFinePaid, 0) + ? WHERE id = ?';
        await database.runAsync(updateSql, [amount, accountId]);
      }
    }

    if (bankAccountId) {
      await updateAccountBalanceSQL(database, bankAccountId, amount, 'EXPENSE', false);
    }

    const logId = generateId();
    await database.runAsync(
      'INSERT INTO account_logs (id, userId, accountId, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [logId, userId, accountId, 'FINE_ADDED', `Late fine of ${currencySymbol}${amount} recorded and paid for ${account ? account.type : 'Account'}.`, now]
    );
    return true;
  } catch (error) {
    console.error('Error recording account fine', error);
    throw error;
  }
};

export const getAllAccountsForLookup = async (userId) => {
  if (!userId) return [];
  const database = await getDb();
  const sql = `
    SELECT id, name, type FROM bank_accounts WHERE userId = ? AND (isDeleted = 0 OR isDeleted IS NULL)
    UNION ALL
    SELECT id, name, type FROM credit_cards WHERE userId = ? AND (isDeleted = 0 OR isDeleted IS NULL)
    UNION ALL
    SELECT id, name, type FROM loans WHERE userId = ? AND (isDeleted = 0 OR isDeleted IS NULL)
    UNION ALL
    SELECT id, name, type FROM investments WHERE userId = ? AND (isDeleted = 0 OR isDeleted IS NULL)
    UNION ALL
    SELECT id, name, type FROM emis WHERE userId = ? AND (isDeleted = 0 OR isDeleted IS NULL)
    ORDER BY name ASC
  `;
  try {
    return await database.getAllAsync(sql, [userId, userId, userId, userId, userId]);
  } catch (error) {
    console.error('Error fetching accounts for lookup', error);
    return [];
  }
};

export const resetInitPromise = () => { initPromise = null; };

export const getTables = async () => {
  const database = await getDb();
  const tables = await database.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'expo_%' ORDER BY name;");
  return tables.map(t => t.name);
};

export const getTableData = async (tableName) => {
  const database = await getDb();
  const columns = await database.getAllAsync(`PRAGMA table_info(${tableName});`);
  const rows = await database.getAllAsync(`SELECT * FROM ${tableName} LIMIT 200;`);
  return {
    columns: columns.map(c => c.name),
    rows
  };
};

export const getTableSchema = async (tableName) => {
  const database = await getDb();
  return await database.getAllAsync(`PRAGMA table_info(${tableName});`);
};

export const updateTableRecord = async (tableName, id, data) => {
  const database = await getDb();
  const fields = Object.keys(data);
  const values = Object.values(data);
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;
  await database.runAsync(sql, [...values, id]);
  return true;
};

export const deleteTableRecord = async (tableName, id) => {
  const database = await getDb();
  await database.runAsync(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
  return true;
};

export const deleteTableRecords = async (tableName, ids) => {
  const database = await getDb();
  if (!ids || ids.length === 0) return true;
  const placeholders = ids.map(() => '?').join(',');
  await database.runAsync(`DELETE FROM ${tableName} WHERE id IN (${placeholders})`, ids);
  return true;
};
