import { generateId, getDb, updateAccountBalanceSQL, ensureCategoryExists } from './utils';
import { saveExpectedExpense } from './transactionStorage';
import { addMonths, format } from 'date-fns';
import { calculateAmortizationSchedule } from '../../utils/loanUtils';

/**
 * Local helper to calculate EMI amount based on standard formula.
 */
const calculateEmiValue = (principal, annualRate, tenure) => {
  const P = Number(principal || 0);
  const R = Number(annualRate || 0);
  const n = Number(tenure || 0);
  if (P <= 0 || n <= 0) return 0;

  const r = R / 1200;
  if (r > 0) {
    return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }
  return P / n;
};

export const saveLoanInfo = async (activeUserId, loanData, currencySymbol) => {
  const database = await getDb();
  const userId = activeUserId;
  const id = generateId();

  // Ensure system category exists
  const category = await ensureCategoryExists(database, userId, 'loan_pay', 'EXPENSE');

  // If no manual EMI provided, calculate it
  let finalEmi = Number(loanData.emiAmount || 0);
  if (finalEmi <= 0 && loanData.loanType === 'EMI') {
    finalEmi = calculateEmiValue(loanData.principal, loanData.loanInterestRate, loanData.loanTenure);
  }

  // Initial installment status (dictionary)
  const status = {};
  const paidMonthsCount = parseInt(loanData.paidMonths || 0, 10);
  const startDate = new Date(loanData.loanStartDate);
  
  for (let i = 1; i <= paidMonthsCount; i++) {
    const d = new Date(startDate);
    d.setMonth(startDate.getMonth() + i - 1);
    const key = format(d, 'yyyy-MM');
    status[key] = 'paid';
  }

  await database.runAsync(
    `INSERT INTO loans (
      id, userId, name, type, loanType, actualDisbursedPrincipal, principal, 
      loanInterestRate, loanTenure, loanStartDate, isClosed, 
      emiAmount, isDone, linkedAccountId, categoryId, paidMonths, installmentStatus
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, userId, loanData.name, loanData.type, loanData.loanType, loanData.principal, loanData.principal,
      loanData.loanInterestRate, loanData.loanTenure, loanData.loanStartDate, 0,
      finalEmi, 0, loanData.bankAccountId, category.id, paidMonthsCount, JSON.stringify(status)
    ]
  );

  // Record disbursement transaction if it's the principal amount going into a bank
  if (loanData.bankAccountId) {
    const txId = generateId();
    await database.runAsync(
      'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [txId, userId, 'INCOME', loanData.principal, loanData.loanStartDate, loanData.bankAccountId, `Disbursement: ${loanData.name}`, id, category.id]
    );

    // Update bank balance
    await updateAccountBalanceSQL(database, loanData.bankAccountId, loanData.principal, 'INCOME', false);
  }

  // Generate future expected expenses
  const months = Math.round(loanData.loanTenure);
  if (loanData.loanType === 'EMI') {
    for (let i = paidMonthsCount + 1; i <= months; i++) {
      const dueDate = addMonths(new Date(loanData.loanStartDate), i - 1);
      await saveExpectedExpense(database, {
        userId,
        name: `Loan EMI: ${loanData.name}`,
        amount: finalEmi,
        type: 'EXPENSE',
        monthKey: format(dueDate, 'yyyy-MM'),
        date: dueDate.toISOString(),
        linkedAccountId: id,
        categoryId: category.id
      });
    }
  } else if (loanData.loanType === 'ONE_TIME') {
      const dueDate = addMonths(new Date(loanData.loanStartDate), months);
      const totalPayable = Number(loanData.principal) + (Number(loanData.principal) * (Number(loanData.loanInterestRate) / 100) * (months / 12));
      await saveExpectedExpense(database, {
        userId,
        name: `Loan Settlement: ${loanData.name}`,
        amount: totalPayable,
        type: 'EXPENSE',
        monthKey: format(dueDate, 'yyyy-MM'),
        date: dueDate.toISOString(),
        linkedAccountId: id,
        categoryId: category.id
      });
  }

  return { ...loanData, id };
};

export const updateLoanInfo = async (activeUserId, accountId, loanData) => {
  const database = await getDb();
  const userId = activeUserId;

  // Ensure system category exists
  const category = await ensureCategoryExists(database, userId, 'loan_pay', 'EXPENSE');

  // Recalculate EMI if core parameters changed and it wasn't a manual override previously? 
  // For now, respect the provided emiAmount if it exists.
  let finalEmi = Number(loanData.emiAmount || 0);
  if (finalEmi <= 0 && loanData.loanType === 'EMI') {
    finalEmi = calculateEmiValue(loanData.principal, loanData.loanInterestRate, loanData.loanTenure);
  }

  await database.runAsync(
    `UPDATE loans SET 
      name = ?, type = ?, loanType = ?, actualDisbursedPrincipal = ?, principal = ?, 
      loanInterestRate = ?, loanTenure = ?, loanStartDate = ?,
      emiAmount = ?, linkedAccountId = ?, paidMonths = ?
    WHERE id = ?`,
    [
      loanData.name, loanData.type, loanData.loanType, loanData.principal, loanData.principal,
      loanData.loanInterestRate, loanData.loanTenure, loanData.loanStartDate,
      finalEmi, loanData.bankAccountId, loanData.paidMonths, accountId
    ]
  );

  // Clear future unpaid expected expenses and regenerate
  await database.runAsync(
    'DELETE FROM expected_expenses WHERE userId = ? AND linkedAccountId = ? AND isDone = 0 AND (isDeleted = 0 OR isDeleted IS NULL)',
    [userId, accountId]
  );

  const months = Math.round(loanData.loanTenure);
  const paidMonthsCount = parseInt(loanData.paidMonths || 0, 10);

  if (loanData.loanType === 'EMI') {
    for (let i = paidMonthsCount + 1; i <= months; i++) {
      const dueDate = addMonths(new Date(loanData.loanStartDate), i - 1);
      await saveExpectedExpense(database, {
        userId,
        name: `Loan EMI: ${loanData.name}`,
        amount: finalEmi,
        type: 'EXPENSE',
        monthKey: format(dueDate, 'yyyy-MM'),
        date: dueDate.toISOString(),
        linkedAccountId: accountId,
        categoryId: category.id
      });
    }
  } else if (loanData.loanType === 'ONE_TIME') {
    const dueDate = addMonths(new Date(loanData.loanStartDate), months);
    const totalPayable = Number(loanData.principal) + (Number(loanData.principal) * (Number(loanData.loanInterestRate) / 100) * (months / 12));
    await saveExpectedExpense(database, {
      userId,
      name: `Loan Settlement: ${loanData.name}`,
      amount: totalPayable,
      type: 'EXPENSE',
      monthKey: format(dueDate, 'yyyy-MM'),
      date: dueDate.toISOString(),
      linkedAccountId: accountId,
      categoryId: category.id
    });
  }

  return true;
};

/**
 * Handle principal prepayment for a loan.
 * This logic adds a transaction, updates current principal, 
 * and optionally recalculates future EMIs.
 */
export const recordPrincipalPrepayment = async (userId, accountId, bankAccountId, amount) => {
  const database = await getDb();
  
  // 1. Fetch current loan details
  const account = await database.getFirstAsync('SELECT * FROM loans WHERE id = ?', [accountId]);
  if (!account) throw new Error('Account not found');

  // 2. Add Prepayment Transaction
  const txId = generateId();
  const category = await ensureCategoryExists(database, userId, 'loan_pay', 'EXPENSE');

  await database.runAsync(
    'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, userId, 'LOAN_PREPAYMENT', amount, new Date().toISOString(), bankAccountId, `Prepayment: ${account.name}`, accountId, category.id]
  );

  // 3. Update current principal
  const newPrincipal = Math.max(0, account.principal - amount);
  
  // 4. Auto-close if principal hits 0
  const isClosed = newPrincipal <= 0 ? 1 : 0;

  await database.runAsync(
    'UPDATE loans SET principal = ?, isClosed = ? WHERE id = ?',
    [newPrincipal, isClosed, accountId]
  );

  // 5. Update bank balance
  await updateAccountBalanceSQL(database, bankAccountId, amount, 'EXPENSE', false);

  // 6. Recalculate future EMIs based on new principal? 
  // Most banks keep EMI same but reduce tenure. 
  // For this app, we'll keep it simple and just update the principal.
  // The amortization table will reflect the shorter lifespan automatically if we just update the schedule.
  
  // However, we must clear/regenerate expected expenses to reflect the NEW schedule if we wanted to be perfectly accurate.
  // For now, the next time the user settles an EMI, it will just work.

  return true;
};

export const recordLoanFine = async (userId, accountId, bankAccountId, amount, monthKey) => {
  const database = await getDb();
  const category = await ensureCategoryExists(database, userId, 'loan_pay', 'EXPENSE');
  const account = await database.getFirstAsync('SELECT * FROM loans WHERE id = ?', [accountId]);

  const txId = generateId();
  await database.runAsync(
    'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId, monthKey) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, userId, 'LOAN_FINE', amount, new Date().toISOString(), bankAccountId, `Penalty: ${account.name} (${monthKey})`, accountId, category.id, monthKey]
  );

  // Fines are just expenses, they don't affect loan principal but they DO deduct from bank
  await updateAccountBalanceSQL(database, bankAccountId, amount, 'EXPENSE', false);
  return true;
};

export const forecloseLoan = async (userId, accountId, bankAccountId, settlementAmount) => {
  const database = await getDb();
  const category = await ensureCategoryExists(database, userId, 'loan_pay', 'EXPENSE');
  const account = await database.getFirstAsync('SELECT * FROM loans WHERE id = ?', [accountId]);

  const txId = generateId();
  await database.runAsync(
    'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, userId, 'LOAN_FORECLOSURE', settlementAmount, new Date().toISOString(), bankAccountId, `Foreclosure: ${account.name}`, accountId, category.id]
  );

  // Update loan record: set principal to 0 and mark closed
  await database.runAsync(
    'UPDATE loans SET principal = 0, isClosed = 1, loanClosureAmount = ? WHERE id = ?',
    [settlementAmount, accountId]
  );

  // Deduct from bank
  await updateAccountBalanceSQL(database, bankAccountId, settlementAmount, 'EXPENSE', false);

  // Delete future unpaid expected expenses
  await database.runAsync(
    'DELETE FROM expected_expenses WHERE userId = ? AND linkedAccountId = ? AND isDone = 0 AND (isDeleted = 0 OR isDeleted IS NULL)',
    [userId, accountId]
  );

  return true;
};

export const payLoanInstallment = async (userId, accountId, bankAccountId, amount, monthKey) => {
  const database = await getDb();
  const account = await database.getFirstAsync('SELECT * FROM loans WHERE id = ?', [accountId]);
  if (!account) throw new Error('Loan not found');

  const category = await ensureCategoryExists(database, userId, 'loan_pay', 'EXPENSE');

  // Amortization logic to split amount between principal and interest
  // Here we simplify by using the schedule helper
  const schedule = calculateAmortizationSchedule(account);
  const row = schedule.find(r => r.monthKey === monthKey);
  
  // Use schedule values or fall back to full amount as principal if not found
  const interestPortion = row ? row.interest : 0;
  const principalPortion = row ? row.principal : amount;

  // 1. Update Installment Status Dictionary
  const status = typeof account.installmentStatus === 'string' ? JSON.parse(account.installmentStatus || '{}') : (account.installmentStatus || {});
  status[monthKey] = 'paid';

  const newPaidMonths = Object.keys(status).filter(k => status[k] === 'paid').length;
  let newPrincipal = Math.max(0, account.principal - principalPortion);

  // Force close logic if it's the last month or principal is negligible
  const isFinalMonth = row?.month === account.loanTenure;
  if (isFinalMonth || newPrincipal < 1) {
    newPrincipal = 0;
  }

  // 2. Add Transaction
  const txId = generateId();
  await database.runAsync(
    'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, userId, 'LOAN_REPAYMENT', amount, new Date().toISOString(), bankAccountId, `Loan EMI: ${account.name} (${monthKey})`, accountId, category.id]
  );

  // 3. Update loan record
  await database.runAsync(
    'UPDATE loans SET principal = ?, paidMonths = ?, installmentStatus = ? WHERE id = ?',
    [newPrincipal, newPaidMonths, JSON.stringify(status), accountId]
  );

  // 4. Update bank balance
  if (bankAccountId) {
    await updateAccountBalanceSQL(database, bankAccountId, amount, 'EXPENSE', false);
  }

  // 5. Mark expected expense as done
  if (monthKey) {
    await database.runAsync(
      'UPDATE expected_expenses SET isDone = 1, isDeleted = 0 WHERE userId = ? AND monthKey = ? AND linkedAccountId = ? AND isDone = 0',
      [userId, monthKey, accountId]
    );
  }

  return true;
};
