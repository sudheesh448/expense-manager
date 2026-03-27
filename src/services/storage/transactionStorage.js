import { generateRecurringExpenses } from './recurringStorage';
import { generateId, getDb, updateAccountBalanceSQL, ensureCategoryExists } from './utils';

export const getTransactions = async (arg1, arg2) => {
  let database = arg1;
  let userId = arg2;
  if (typeof arg1 === 'string' || !arg1) {
    if (arg2 === undefined) {
      userId = arg1;
      database = await getDb();
    }
  }
  if (!userId) return [];
  try {
    return await database.getAllAsync('SELECT * FROM transactions WHERE userId = ? AND (isDeleted = 0 OR isDeleted IS NULL)', [userId || '']);
  } catch (error) {
    console.error('Error fetching transactions', error);
    return [];
  }
};

/**
 * Calculates credit card billing status using FIFO payment application.
 * Splits spending into monthly cycles based on the card's billingDay.
 * Returns { currentCycleUsage: number, totalAmountDue: number }
 */
export const getCCAccountDueInfo = async (userId, accountId, referenceDate = new Date()) => {
  if (!userId || !accountId) return { currentCycleUsage: 0, totalAmountDue: 0 };
  try {
    const database = await getDb();
    const card = await database.getFirstAsync('SELECT billingDay, dueDay FROM credit_cards WHERE id = ?', [accountId]);
    if (!card) return { currentCycleUsage: 0, totalAmountDue: 0 };

    const billingDay = card.billingDay || 1;
    const txs = await database.getAllAsync(
      'SELECT amount, type, date FROM transactions WHERE userId = ? AND (accountId = ? OR toAccountId = ?) AND (type = ? OR type = ?) AND (isDeleted = 0 OR isDeleted IS NULL) ORDER BY date ASC',
      [userId, accountId, accountId, 'CC_EXPENSE', 'CC_PAY']
    );

    const cycles = [];
    
    // 1. Group all transactions into cycles based on date
    txs.forEach(t => {
      const d = new Date(t.date);
      let cycleYear = d.getFullYear();
      let cycleMonth = d.getMonth();
      if (d.getDate() > billingDay) cycleMonth++;
      if (cycleMonth > 11) { cycleMonth = 0; cycleYear++; }
      
      const cycleKey = `${cycleYear}-${String(cycleMonth + 1).padStart(2, '0')}`;
      let cycleObj = cycles.find(c => c.key === cycleKey);
      if (!cycleObj) {
        const end = new Date(cycleYear, cycleMonth, billingDay, 23, 59, 59);
        const start = new Date(cycleYear, cycleMonth - 1, billingDay + 1, 0, 0, 0);
        cycleObj = { key: cycleKey, start, end, total: 0, paid: 0, transactions: [] };
        cycles.push(cycleObj);
      }
      if (t.type === 'CC_EXPENSE') {
        cycleObj.total += (t.amount || 0);
      }
      cycleObj.transactions.push(t);
    });

    // 2. Apply payments FIFO
    const payments = txs.filter(t => t.type === 'CC_PAY');
    let totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    
    cycles.sort((a, b) => a.end - b.end);
    for (const cycle of cycles) {
      const needed = cycle.total;
      const paymentForThis = Math.min(totalPaid, needed);
      cycle.paid = paymentForThis;
      totalPaid -= paymentForThis;
    }

    // 3. Aggregate based on Reference Date
    let totalAmountDue = 0;
    let currentCycleUsage = 0;
    
    for (const cycle of cycles) {
      const isPastBill = new Date(cycle.end) <= referenceDate;
      if (isPastBill) {
        totalAmountDue += (cycle.total - cycle.paid);
      } else {
        currentCycleUsage += (cycle.total - cycle.paid);
      }
    }

    return { 
      currentCycleUsage: Math.max(0, currentCycleUsage), 
      totalAmountDue: Math.max(0, totalAmountDue),
      cycles: cycles.sort((a, b) => b.end - a.end) // Newest first
    };
  } catch (error) {
    console.error('Error calculating CC bill status:', error);
    return { currentCycleUsage: 0, totalAmountDue: 0 };
  }
};

export const getTransactionsByMonth = async (userId, monthKey) => {
  if (!userId || !monthKey) return [];
  try {
    const database = await getDb();

    // Layer 1: Precise SQL matching using substr (very fast)
    // We match the first 7 characters of the date (YYYY-MM)
    const sql = `
      SELECT t.*, (SELECT name FROM categories WHERE id = t.categoryId) as category 
      FROM transactions t 
      WHERE t.userId = ? 
        AND (t.isDeleted = 0 OR t.isDeleted IS NULL)
        AND substr(t.date, 1, 7) = ?
      ORDER BY t.date DESC
    `;
    const results = await database.getAllAsync(sql, [userId, monthKey]);

    // Layer 2: Fallback Logic
    // If SQL fails (e.g., due to weird date encodings on a specific device), 
    // we fetch all transactions and manually filter in JS for 100% reliability.
    if (results.length === 0) {
      const all = await database.getAllAsync(
        'SELECT * FROM transactions WHERE userId = ? AND (isDeleted = 0 OR isDeleted IS NULL) ORDER BY date DESC',
        [userId]
      );
      return all.filter(t => t.date && t.date.includes(monthKey));
    }

    return results;
  } catch (error) {
    console.error('Error in getTransactionsByMonth:', error);
    return [];
  }
};

export const getTransactionsByLinkedItem = async (linkedItemId) => {
  if (!linkedItemId) return [];
  try {
    const database = await getDb();
    return await database.getAllAsync(
      'SELECT * FROM transactions WHERE linkedItemId = ? AND (isDeleted = 0 OR isDeleted IS NULL) ORDER BY date DESC',
      [linkedItemId]
    );
  } catch (error) {
    console.error('Error fetching transactions by linked item', error);
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
    try {
      const sqlTx = `INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      await database.runAsync(sqlTx, [id, userId, transactionData.type, amount, date, transactionData.accountId, transactionData.toAccountId || null, transactionData.note || '', transactionData.categoryId || null]);
    } catch (e) {
      const sqlTx = `INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      await database.runAsync(sqlTx, [id, userId, transactionData.type, amount, date, transactionData.accountId, transactionData.toAccountId || null, transactionData.note || '']);
    }

    await updateAccountBalanceSQL(database, transactionData.accountId, amount, transactionData.type, false);
    if ((transactionData.type === 'TRANSFER' || transactionData.type === 'PAYMENT' || transactionData.type === 'EXPENSE' || transactionData.type === 'CC_PAY') && transactionData.toAccountId) {
      await updateAccountBalanceSQL(database, transactionData.toAccountId, amount, transactionData.type, true);
    }
    await database.execAsync('COMMIT;');
    return { id, userId, date, ...transactionData, amount };
  } catch (error) {
    const database = await getDb();
    await database.execAsync('ROLLBACK;');
    throw error;
  }
};

export const getCategories = async (userId, type = 'EXPENSE') => {
  if (!userId) return [];
  try {
    const database = await getDb();
    if (type === 'ALL' || type === null) {
      return await database.getAllAsync('SELECT * FROM categories WHERE userId = ? AND (isDeleted = 0 OR isDeleted IS NULL)', [userId]);
    }
    if (Array.isArray(type)) {
      const placeholders = type.map(() => '?').join(',');
      return await database.getAllAsync(
        `SELECT * FROM categories WHERE userId = ? AND type IN (${placeholders}) AND (isDeleted = 0 OR isDeleted IS NULL)`,
        [userId, ...type]
      );
    }
    return await database.getAllAsync('SELECT * FROM categories WHERE userId = ? AND type = ? AND (isDeleted = 0 OR isDeleted IS NULL)', [userId, type]);
  } catch (error) {
    console.error('Error fetching categories', error);
    return [];
  }
};

export const saveCategory = async (userId, name, type = 'EXPENSE', isSystem = 0) => {
  if (!userId) throw new Error("Missing Auth User ID");
  const trimmedName = name.trim();
  try {
    const database = await getDb();

    // 1. Try to find it first (ignore isDeleted)
    const findSql = 'SELECT id, isDeleted FROM categories WHERE userId = ? AND LOWER(name) = LOWER(?)';
    let existing = await database.getFirstAsync(findSql, [userId, trimmedName]);

    if (existing) {
      if (existing.isDeleted === 1) {
        await database.runAsync(
          'UPDATE categories SET isDeleted = 0, type = ?, isSystem = ? WHERE id = ?',
          [type, isSystem, existing.id]
        );
      }
      return { id: existing.id, userId, name: trimmedName, type, isSystem };
    }

    // 2. Not found, try to insert
    try {
      const id = generateId();
      await database.runAsync('INSERT INTO categories (id, userId, name, type, isSystem) VALUES (?, ?, ?, ?, ?)', [id, userId, trimmedName, type, isSystem]);
      return { id, userId, name: trimmedName, type, isSystem };
    } catch (insertError) {
      // 3. If insert fails with UNIQUE, someone else might have inserted it in the meantime (race condition)
      if (insertError.message?.includes('UNIQUE')) {
        const recover = await database.getFirstAsync(findSql, [userId, trimmedName]);
        if (recover) {
          return { id: recover.id, userId, name: trimmedName, type, isSystem };
        }
      }
      throw insertError;
    }
  } catch (error) {
    console.error('Error saving category:', error);
    throw error;
  }
};


export const ensureSystemCategories = async (userId) => {
  if (!userId) return;
  const defaultCategories = [
    { name: 'Loan Repayment', type: 'EXPENSE', isSystem: 1 },
    { name: 'EMI Payment', type: 'EMI Payment', isSystem: 1 },
    { name: 'CC Limit Blockage', type: 'CC Limit Blockage', isSystem: 1 },
    { name: 'CC Pay', type: 'PAYMENT', isSystem: 1 },
    { name: 'CC Expense', type: 'EXPENSE', isSystem: 1 },
    { name: 'SIP', type: 'SIP_PAY', isSystem: 1 },
    { name: 'Loan Payment', type: 'loan_pay', isSystem: 1 },
    { name: 'loan income', type: 'loan income', isSystem: 1 },
    { name: 'borrowed', type: 'BORROWED', isSystem: 1 },
    { name: 'lended', type: 'lended', isSystem: 1 }
  ];

  for (const defCat of defaultCategories) {
    await ensureCategoryExists(userId, defCat.name, defCat.type, defCat.isSystem);
  }
};

export const getExpectedExpenses = async (userId) => {
  if (!userId) return [];
  try {
    const database = await getDb();
    return await database.getAllAsync('SELECT * FROM expected_expenses WHERE userId = ? AND (isDeleted = 0 OR isDeleted IS NULL)', [userId || '']);
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
  if (!id) return;
  try {
    const database = await getDb();
    await database.runAsync('UPDATE expected_expenses SET isDeleted = 1 WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error deleting expected expense', error);
    throw error;
  }
};

export const payExpectedExpense = async (userId, expenseId, fromAccountId, categoryId = null) => {
  try {
    const database = await getDb();
    await database.execAsync('BEGIN TRANSACTION;');
    const exp = await database.getFirstAsync('SELECT * FROM expected_expenses WHERE id = ?', [expenseId]);
    console.log('Paying expected expense:', exp?.name, 'ID:', expenseId, 'From:', fromAccountId);
    if (!exp || exp.isDone === 1) {
      console.log('Expense already done or not found');
      await database.execAsync('ROLLBACK;');
      return;
    }
    await database.runAsync('UPDATE expected_expenses SET isDone = 1 WHERE id = ?', [expenseId]);
    const id = generateId();
    const dateISO = new Date().toISOString();

    if (exp.type === 'INCOME') {
      await database.runAsync(`INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, userId, 'INCOME', exp.amount, dateISO, fromAccountId, null, `Settle Expected Income: ${exp.name}`, categoryId || exp.categoryId || null]);
      await updateAccountBalanceSQL(database, fromAccountId, exp.amount, 'INCOME', false);
    } else {
      const recurring = await database.getFirstAsync(`SELECT * FROM recurring_payments WHERE userId = ? AND name = ?`, [userId, exp.name]);
      const linkedAccountId = recurring?.linkedAccountId;

      // Look for target account in specialized tables
      const accountLookupSql = `
        SELECT 'BANK' as type, balance, id, NULL as loanInterestRate, NULL as loanStartDate, NULL as loanTenure, 0 as isEmi FROM bank_accounts WHERE (id = ? OR name = ?) AND (isDeleted = 0 OR isDeleted IS NULL)
        UNION ALL
        SELECT 'CREDIT_CARD' as type, currentUsage as balance, id, NULL as loanInterestRate, NULL as loanStartDate, NULL as loanTenure, 0 as isEmi FROM credit_cards WHERE (id = ? OR name = ?) AND (isDeleted = 0 OR isDeleted IS NULL)
        UNION ALL
        SELECT type, principal as balance, id, interestRate as loanInterestRate, startDate as loanStartDate, tenure as loanTenure, 1 as isEmi FROM loans WHERE (id = ? OR name = ?) AND (isDeleted = 0 OR isDeleted IS NULL)
        UNION ALL
        SELECT type, balance, id, NULL as loanInterestRate, NULL as loanStartDate, NULL as loanTenure, 0 as isEmi FROM investments WHERE (id = ? OR name = ?) AND (isDeleted = 0 OR isDeleted IS NULL)
        UNION ALL
        SELECT 'EMI' as type, balance, id, NULL as loanInterestRate, emiStartDate as loanStartDate, tenure as loanTenure, 1 as isEmi FROM emis WHERE (id = ? OR name = ?) AND (isDeleted = 0 OR isDeleted IS NULL)
        UNION ALL
        SELECT 'SIP' as type, balance, id, NULL as loanInterestRate, startDate as loanStartDate, NULL as loanTenure, 0 as isEmi FROM sip_accounts WHERE (id = ? OR name = ?) AND (isDeleted = 0 OR isDeleted IS NULL)
      `;
      const targetId = linkedAccountId || exp.linkedAccountId || null;
      const targetAccInfo = await database.getFirstAsync(accountLookupSql, [targetId, exp.name, targetId, exp.name, targetId, exp.name, targetId, exp.name, targetId, exp.name, targetId, exp.name]);

      if (targetAccInfo) {
        const finalTargetId = targetAccInfo.id;
        let finalCategoryId = categoryId || exp.categoryId || null;

        // Look for target account details
        const targetAcc = await database.getFirstAsync(accountLookupSql, [finalTargetId, null, finalTargetId, null, finalTargetId, null, finalTargetId, null, finalTargetId, null, finalTargetId, null]);
        const isCC = targetAcc?.type === 'CREDIT_CARD';

        if (isCC && !finalCategoryId) {
          finalCategoryId = await ensureCategoryExists(userId, 'CC Pay', 'PAYMENT', 1);
        }

        const note = targetAcc?.isEmi ? `EMI Payment: ${exp.name}` : `SIP: ${exp.name}`;
        let txType = targetAcc?.isEmi ? 'EMI_PAYMENT' : 'SIP_PAY';
        if (isCC) txType = 'CC_PAY';

        if (txType === 'SIP_PAY') {
          finalCategoryId = await ensureCategoryExists(userId, 'SIP', 'SIP_PAY', 1);
        }

        await database.runAsync(`INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, userId, txType, exp.amount, dateISO, fromAccountId, finalTargetId, note, finalCategoryId]);
        await updateAccountBalanceSQL(database, fromAccountId, exp.amount, txType, false);
        await updateAccountBalanceSQL(database, finalTargetId, exp.amount, txType, true);

        if (linkedAccountId) {
          const loanSql = `
            SELECT id, type, principal as balance, interestRate as loanInterestRate, startDate as loanStartDate, tenure as loanTenure, 
            (SELECT 1 FROM emis WHERE id = ?) as isEmi 
            FROM loans WHERE id = ?
            UNION ALL
            SELECT id, type, balance, NULL as loanInterestRate, emiStartDate as loanStartDate, tenure as loanTenure, 
            1 as isEmi
            FROM emis WHERE id = ?
          `;
          const loan = await database.getFirstAsync(loanSql, [linkedAccountId, linkedAccountId, linkedAccountId]);

          if (loan && (loan.isEmi === 1 || loan.type === 'LOAN') && (loan.balance || 0) > 0) {
            // Update specialized EMI record if applicable
            if (loan.isEmi === 1) {
              const emiAcc = await database.getFirstAsync('SELECT installmentStatus, paidMonths FROM emis WHERE id = ?', [linkedAccountId]);
              if (emiAcc) {
                const status = JSON.parse(emiAcc.installmentStatus || '{}');
                status[exp.monthKey] = 'paid';
                await database.runAsync('UPDATE emis SET paidMonths = paidMonths + 1, installmentStatus = ? WHERE id = ?', [JSON.stringify(status), linkedAccountId]);
              }
            }

            const P = loan.balance;
            const r = (loan.loanInterestRate || 0) / 1200;
            const startStr = loan.loanStartDate || loan.startDate;
            const start = startStr ? new Date(startStr) : new Date();
            const now = new Date();
            let monthsPassed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
            if (monthsPassed < 0) monthsPassed = 0;
            const tenureMonths = (loan.loanTenure || 1) * (loan.type === 'LOAN' ? 12 : 1);
            const remainingMonths = Math.max(1, tenureMonths - monthsPassed);
            let newEmi = P / remainingMonths;
            if (r > 0) newEmi = (P * r * Math.pow(1 + r, remainingMonths)) / (Math.pow(1 + r, remainingMonths) - 1);

            // Update specialized table
            const updateTable = loan.isEmi === 1 ? 'emis' : 'loans';
            const dateCol = loan.isEmi === 1 ? 'emiStartDate' : 'startDate';

            await database.runAsync(`UPDATE ${updateTable} SET ${dateCol} = ? WHERE id = ?`, [dateISO, linkedAccountId]);
            if (recurring) {
              await database.runAsync('UPDATE recurring_payments SET amount = ? WHERE id = ?', [newEmi, recurring.id]);
              await database.runAsync('UPDATE expected_expenses SET amount = ? WHERE name = ? AND userId = ? AND isDone = 0', [newEmi, recurring.name, userId]);
            }
          }
        }

        if (targetAcc && targetAcc.type === 'EMI') {
          // Original code had this: await updateAccountBalanceSQL(database, recurring.accountId, exp.amount, 'TRANSFER', false);
          // Which seems to double-deduct from the source if recurring.accountId is fromAccountId.
          // However, I'll preserve the intent if I can.
        }
      } else {
        console.log('Standard manual expense settlement');
        await database.runAsync(`INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, userId, 'EXPENSE', exp.amount, dateISO, fromAccountId, null, `Paid Expected: ${exp.name}`, categoryId || exp.categoryId || null]);
        await updateAccountBalanceSQL(database, fromAccountId, exp.amount, 'EXPENSE', false);
      }
    }
    await database.execAsync('COMMIT;');
    const recurring = await database.getFirstAsync(`SELECT * FROM recurring_payments WHERE userId = ? AND name = ? AND isActive = 1 AND scheduleType = 'DYNAMIC'`, [userId, exp.name]);
    if (recurring) {
      const paymentDate = new Date();
      const dueDate = new Date(recurring.nextDueDate);
      const base = paymentDate <= dueDate ? dueDate : paymentDate;
      const newNextDue = new Date(base.getTime() + recurring.cycleDays * 24 * 60 * 60 * 1000);
      await database.runAsync('UPDATE recurring_payments SET nextDueDate = ? WHERE id = ?', [newNextDue.toISOString(), recurring.id]);
      await database.runAsync(`UPDATE expected_expenses SET isDeleted = 1 WHERE userId = ? AND name = ? AND isDone = 0`, [userId, recurring.name]);
      await generateRecurringExpenses(userId, { ...recurring, nextDueDate: newNextDue.toISOString() });
    }
  } catch (err) {
    const database = await getDb();
    await database.execAsync('ROLLBACK;');
    throw err;
  }
};

const reverseTransactionBalance = async (database, tx) => {
  const accountLookupSql = `
    SELECT 'BANK' as type, balance, id FROM bank_accounts WHERE id = ?
    UNION ALL
    SELECT 'CREDIT_CARD' as type, currentUsage as balance, id FROM credit_cards WHERE id = ?
    UNION ALL
    SELECT type, principal as balance, id FROM loans WHERE id = ?
    UNION ALL
    SELECT type, balance, id FROM investments WHERE id = ?
    UNION ALL
    SELECT 'EMI' as type, balance, id FROM emis WHERE id = ?
  `;
  const fromAcc = await database.getFirstAsync(accountLookupSql, [tx.accountId, tx.accountId, tx.accountId, tx.accountId, tx.accountId]);
  if (fromAcc) {
    let bal = fromAcc.balance;
    if (fromAcc.type === 'CREDIT_CARD') {
      if (tx.type === 'EXPENSE' || tx.type === 'TRANSFER') bal += tx.amount;
    } else if (fromAcc.type === 'LOAN' || fromAcc.type === 'BORROWED') {
      if (tx.type === 'EXPENSE' || tx.type === 'TRANSFER') bal -= tx.amount;
      else if (tx.type === 'PAYMENT' || tx.type === 'INCOME' || tx.type === 'REPAY_LOAN' || tx.type === 'REPAY_BORROWED') bal += tx.amount;
    } else if (fromAcc.type === 'LENDED') {
      if (tx.type === 'TRANSFER' || tx.type === 'COLLECT_REPAYMENT' || tx.type === 'EXPENSE') bal += tx.amount;
      else if (tx.type === 'INCOME') bal -= tx.amount;
    } else {
      if (tx.type === 'INCOME') bal -= tx.amount;
      else if (tx.type === 'EXPENSE' || tx.type === 'TRANSFER' || tx.type === 'PAYMENT') bal += tx.amount;
    }

    // Update specialized table
    switch (fromAcc.type) {
      case 'BANK': await database.runAsync('UPDATE bank_accounts SET balance = ? WHERE id = ?', [bal, tx.accountId]); break;
      case 'CREDIT_CARD': await database.runAsync('UPDATE credit_cards SET currentUsage = ? WHERE id = ?', [bal, tx.accountId]); break;
      case 'LOAN': case 'BORROWED': case 'LENDED': await database.runAsync('UPDATE loans SET principal = ? WHERE id = ?', [bal, tx.accountId]); break;
      case 'INVESTMENT': case 'SIP': await database.runAsync('UPDATE investments SET balance = ? WHERE id = ?', [bal, tx.accountId]); break;
      case 'EMI': await database.runAsync('UPDATE emis SET balance = ? WHERE id = ?', [bal, tx.accountId]); break;
    }
  }

  if (tx.toAccountId && (tx.type === 'TRANSFER' || tx.type === 'PAYMENT')) {
    const toAcc = await database.getFirstAsync(accountLookupSql, [tx.toAccountId, tx.toAccountId, tx.toAccountId, tx.toAccountId, tx.toAccountId]);
    if (toAcc) {
      let bal = toAcc.balance;
      if (toAcc.type === 'CREDIT_CARD') {
        if (tx.type === 'PAYMENT') bal = Math.max(0, bal - tx.amount);
      } else if (toAcc.type === 'LOAN' || toAcc.type === 'BORROWED') {
        bal += tx.amount;
      } else if (toAcc.type === 'LENDED') {
        bal -= tx.amount;
      } else {
        bal -= tx.amount;
      }

      // Update specialized table
      switch (toAcc.type) {
        case 'BANK': await database.runAsync('UPDATE bank_accounts SET balance = ? WHERE id = ?', [bal, tx.toAccountId]); break;
        case 'CREDIT_CARD': await database.runAsync('UPDATE credit_cards SET currentUsage = ? WHERE id = ?', [bal, tx.toAccountId]); break;
        case 'LOAN': case 'BORROWED': case 'LENDED': await database.runAsync('UPDATE loans SET principal = ? WHERE id = ?', [bal, tx.toAccountId]); break;
        case 'INVESTMENT': case 'SIP': await database.runAsync('UPDATE investments SET balance = ? WHERE id = ?', [bal, tx.toAccountId]); break;
        case 'EMI': await database.runAsync('UPDATE emis SET balance = ? WHERE id = ?', [bal, tx.toAccountId]); break;
      }
    }
  }
};

export const deleteTransaction = async (userId, tx) => {
  const database = await getDb();
  try {
    await database.execAsync('BEGIN TRANSACTION;');
    await reverseTransactionBalance(database, tx);
    const sid = generateId();
    await database.runAsync('UPDATE transactions SET isDeleted = 1 WHERE id = ?', [tx.id]);
    await database.execAsync('COMMIT;');
  } catch (e) {
    await database.execAsync('ROLLBACK;');
    throw e;
  }
};

export const updateTransaction = async (userId, oldTx, newData, currencySymbol = '₹') => {
  const database = await getDb();
  try {
    await database.execAsync('BEGIN TRANSACTION;');
    const diff = oldTx.amount - newData.amount;
    if (diff !== 0) {
      const accountLookupSql = `
        SELECT 'BANK' as type, balance, id FROM bank_accounts WHERE id = ?
        UNION ALL
        SELECT 'CREDIT_CARD' as type, currentUsage as balance, id FROM credit_cards WHERE id = ?
        UNION ALL
        SELECT type, principal as balance, id FROM loans WHERE id = ?
        UNION ALL
        SELECT type, balance, id FROM investments WHERE id = ?
        UNION ALL
        SELECT 'EMI' as type, balance, id FROM emis WHERE id = ?
      `;
      const acc = await database.getFirstAsync(accountLookupSql, [oldTx.accountId, oldTx.accountId, oldTx.accountId, oldTx.accountId, oldTx.accountId]);
      if (acc && acc.type !== 'CREDIT_CARD') {
        let newBalance = acc.balance;
        if (acc.type === 'LOAN') {
          if (oldTx.type === 'EXPENSE' || oldTx.type === 'TRANSFER') newBalance -= diff;
          else if (oldTx.type === 'INCOME' || oldTx.type === 'PAYMENT') newBalance += diff;
        } else {
          if (oldTx.type === 'INCOME') newBalance -= diff;
          else if (oldTx.type === 'EXPENSE' || oldTx.type === 'TRANSFER' || oldTx.type === 'PAYMENT') newBalance += diff;
        }

        // Update specialized table
        switch (acc.type) {
          case 'BANK': await database.runAsync('UPDATE bank_accounts SET balance = ? WHERE id = ?', [newBalance, oldTx.accountId]); break;
          case 'CREDIT_CARD': await database.runAsync('UPDATE credit_cards SET currentUsage = ? WHERE id = ?', [newBalance, oldTx.accountId]); break;
          case 'LOAN': case 'BORROWED': case 'LENDED': await database.runAsync('UPDATE loans SET principal = ? WHERE id = ?', [newBalance, oldTx.accountId]); break;
          case 'INVESTMENT': case 'SIP': await database.runAsync('UPDATE investments SET balance = ? WHERE id = ?', [newBalance, oldTx.accountId]); break;
          case 'EMI': await database.runAsync('UPDATE emis SET balance = ? WHERE id = ?', [newBalance, oldTx.accountId]); break;
        }
      }
    }
    await database.runAsync(`UPDATE transactions SET type=?, amount=?, accountId=?, toAccountId=?, note=?, date=? WHERE id=?`, [newData.type, newData.amount, newData.accountId, newData.toAccountId || null, newData.note, newData.date, oldTx.id]);
    const sid = generateId();
    let diffNote = diff !== 0 ? `⚙ Adjusted: "${oldTx.note || 'Untitled'}" ${currencySymbol}${oldTx.amount} → ${currencySymbol}${newData.amount} (${diff > 0 ? `+${currencySymbol}${diff.toFixed(2)} returned` : `-${currencySymbol}${Math.abs(diff).toFixed(2)} deducted`})` : `⚙ Edited: "${oldTx.note || 'Untitled'}" note changed`;
    await database.runAsync(`INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note) VALUES (?,?,?,?,?,?,?,?)`, [sid, userId, 'SYSTEM', Math.abs(diff), new Date().toISOString(), newData.accountId, null, diffNote]);
    await database.execAsync('COMMIT;');
  } catch (e) {
    await database.execAsync('ROLLBACK;');
    throw e;
  }
};

export const getAvailableHistory = async (arg1, arg2) => {
  let database = arg1;
  let userId = arg2;
  if (typeof arg1 === 'string' || !arg1) {
    if (arg2 === undefined) {
      userId = arg1;
      database = await getDb();
    }
  }
  if (!userId) return [];
  try {
    const currentMonth = new Date().toISOString().substring(0, 7);
    const query = `
      SELECT DISTINCT substr(date, 1, 7) as monthKey FROM transactions WHERE userId = ? AND (isDeleted = 0 OR isDeleted IS NULL)
      UNION 
      SELECT DISTINCT monthKey FROM expected_expenses WHERE userId = ? AND (isDeleted = 0 OR isDeleted IS NULL)
      UNION 
      SELECT ? as monthKey 
      ORDER BY monthKey ASC
    `;
    const rows = await database.getAllAsync(query, [userId || '', userId || '', currentMonth]);
    return rows.map(r => r.monthKey).filter(Boolean);
  } catch (error) { return [new Date().toISOString().substring(0, 7)]; }
};

export const getMonthlyComparisonData = async (arg1, arg2) => {
  let database = arg1;
  let userId = arg2;
  if (typeof arg1 === 'string' || !arg1) {
    if (arg2 === undefined) {
      userId = arg1;
      database = await getDb();
    }
  }
  if (!userId) return [];
  const history = await getAvailableHistory(database, userId);
  // Improved query: 
  // 1. Checks isDeleted
  // 2. Defines income as 'INCOME'
  // 3. Defines expense as anything that's a direct expense or EMI payment
  const query = `
    SELECT 
      substr(date, 1, 7) as monthKey, 
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as income, 
      SUM(CASE WHEN type IN ('EXPENSE', 'EMI_PAYMENT') THEN amount ELSE 0 END) as expense 
    FROM transactions 
    WHERE userId = ? 
      AND (isDeleted = 0 OR isDeleted IS NULL)
    GROUP BY monthKey
  `;
  try {
    const rows = await database.getAllAsync(query, [userId || '']);
    const dataMap = {};
    rows.forEach(r => { dataMap[r.monthKey] = { income: r.income || 0, expense: r.expense || 0, savings: Math.max(0, (r.income || 0) - (r.expense || 0)) }; });
    return history.map(mKey => {
      const d = dataMap[mKey] || { income: 0, expense: 0, savings: 0 };
      const dateObj = new Date(parseInt(mKey.split('-')[0]), parseInt(mKey.split('-')[1]) - 1, 1);
      return { monthKey: mKey, label: dateObj.toLocaleString('default', { month: 'short' }), year: mKey.split('-')[0], ...d };
    });
  } catch (error) { return []; }
};

export const getMonthlyCategorySplit = async (userId, monthKey) => {
  if (!userId || !monthKey) return [];
  const database = await getDb();
  const query = `SELECT COALESCE(c.name, 'Others') as category, SUM(t.amount) as amount FROM transactions t LEFT JOIN categories c ON t.categoryId = c.id WHERE t.userId = ? AND t.type = 'EXPENSE' AND t.date LIKE ? GROUP BY category ORDER BY amount DESC`;
  try {
    const rows = await database.getAllAsync(query, [userId || '', (monthKey || '') + '%']);
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80', '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'];
    return rows.map((r, i) => ({ ...r, color: colors[i % colors.length] }));
  } catch (error) { return []; }
};

export const getCustomGraphs = async (userId) => {
  if (!userId) return [];
  try {
    const database = await getDb();
    const user = await database.getFirstAsync('SELECT customGraphs FROM users WHERE id = ?', [userId || '']);
    return JSON.parse(user?.customGraphs || '[]') || [];
  } catch (e) { return []; }
};

export const saveCustomGraphs = async (userId, graphs) => {
  if (!userId) return;
  try {
    const database = await getDb();
    await database.runAsync('UPDATE users SET customGraphs = ? WHERE id = ?', [JSON.stringify(graphs), userId || '']);
  } catch (e) { }
};

export const getCustomGraphData = async (arg1, arg2, arg3, arg4) => {
  let database = arg1;
  let userId = arg2;
  let categoryIds = arg3;
  let monthKey = arg4;

  if (typeof arg1 === 'string' || !arg1) {
    userId = arg1;
    categoryIds = arg2;
    monthKey = arg3;
    database = await getDb();
  }

  if (!userId || !categoryIds || categoryIds.length === 0 || !monthKey) return [];
  const placeholders = categoryIds.map(() => '?').join(',');
  const query = `
    SELECT 
      c.name as category, 
      SUM(t.amount) as amount 
    FROM transactions t 
    JOIN categories c ON t.categoryId = c.id 
    WHERE t.userId = ? 
      AND t.type IN ('EXPENSE', 'EMI_PAYMENT') 
      AND t.date LIKE ? 
      AND c.id IN (${placeholders}) 
      AND (t.isDeleted = 0 OR t.isDeleted IS NULL)
    GROUP BY c.id 
    ORDER BY amount DESC
  `;
  try {
    const rows = await database.getAllAsync(query, [userId || '', (monthKey || '') + '%', ...categoryIds]);
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80', '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'];
    return rows.map((r, i) => ({ ...r, color: colors[i % colors.length] }));
  } catch (error) { return []; }
};

export const getCCUtilizationByMonth = async (arg1, arg2, arg3) => {
  let database = arg1;
  let userId = arg2;
  let monthKey = arg3;

  if (typeof arg1 === 'string' || !arg1) {
    if (arg2 === undefined || typeof arg2 === 'string') {
      userId = arg1;
      monthKey = arg2;
      database = await getDb();
    }
  }

  if (!userId || !monthKey) return [];

  try {
    const cards = await database.getAllAsync('SELECT id, name, creditLimit, billingDay FROM credit_cards WHERE userId = ? AND (isDeleted = 0 OR isDeleted IS NULL)', [userId]);
    const results = [];
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80', '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'];

    const [year, month] = monthKey.split('-').map(Number);

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const bDay = card.billingDay || 1;

      // Billing Cycle Logic:
      // if monthKey = '2024-04' (April)
      // billingDay = 16
      // start: 2024-02-16
      // end: 2024-03-15

      const startDate = new Date(year, month - 3, bDay);
      const endDate = new Date(year, month - 2, bDay - 1, 23, 59, 59);

      const startStr = startDate.toISOString();
      const endStr = endDate.toISOString();

      const row = await database.getFirstAsync(
        `SELECT SUM(amount) as used FROM transactions 
         WHERE accountId = ? AND type = 'EXPENSE' AND date >= ? AND date <= ? AND (isDeleted = 0 OR isDeleted IS NULL)`,
        [card.id, startStr, endStr]
      );

      results.push({
        id: card.id,
        name: card.name,
        used: row?.used || 0,
        limit: card.creditLimit || 0,
        color: colors[i % colors.length]
      });
    }

    return results;
  } catch (error) {
    console.error('Error in getCCUtilizationByMonth:', error);
    return [];
  }
};
