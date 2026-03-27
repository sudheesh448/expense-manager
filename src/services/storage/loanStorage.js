import { format } from 'date-fns';
import { calculateAmortizationSchedule } from '../../utils/loanUtils';
import { saveExpectedExpense } from './transactionStorage';
import { ensureCategoryExists, generateId, getDb, updateAccountBalanceSQL } from './utils';

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
  const category = await ensureCategoryExists(userId, 'loan_pay', 'EXPENSE');

  // If no manual EMI provided, calculate it
  let finalEmi = Number(loanData.emiAmount || 0);
  if (finalEmi <= 0 && loanData.loanType === 'EMI') {
    finalEmi = calculateEmiValue(loanData.principal, loanData.loanInterestRate, loanData.loanTenure);
  }

  // Add tax to EMI if applicable
  const taxRate = Number(loanData.loanTaxPercentage || 0);
  if (taxRate > 0 && loanData.loanType === 'EMI') {
    const monthlyInterest = Number(loanData.principal) * (Number(loanData.loanInterestRate) / 1200);
    finalEmi += (monthlyInterest * (taxRate / 100));
  }

  // Initial installment status (dictionary)
  const status = {};
  const paidMonthsCount = parseInt(loanData.paidMonths || 0, 10);
  const startDate = new Date(loanData.emiStartDate || loanData.loanStartDate || new Date().toISOString());

  for (let i = 1; i <= paidMonthsCount; i++) {
    const d = new Date(startDate);
    d.setMonth(startDate.getMonth() + i - 1);
    const key = format(d, 'yyyy-MM');
    status[key] = 'paid';
  }

  const P_original = Number(loanData.disbursedPrincipal || loanData.loanPrincipal || loanData.principal || loanData.balance || 0);
  const P_current = Number(loanData.principal || loanData.balance || P_original || 0);
  const rate = Number(loanData.loanInterestRate || loanData.interestRate || 0);
  const tenureValue = Number(loanData.loanTenure || loanData.tenure || 0);
  const start = loanData.loanStartDate || loanData.startDate || new Date().toISOString();

  await database.runAsync(
    `INSERT INTO loans (
      id, userId, name, type, loanType, disbursedPrincipal, principal, 
      interestRate, tenure, startDate, isClosed, 
      emiAmount, linkedAccountId, categoryId, paidMonths, installmentStatus,
      emiStartDate, taxPercentage, serviceCharge
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, userId, loanData.name, loanData.type, loanData.loanType || 'ONE_TIME',
      P_original, P_current, rate, tenureValue, start, 0,
      finalEmi, loanData.bankAccountId, category.id, paidMonthsCount, JSON.stringify(status),
      loanData.emiStartDate, loanData.loanTaxPercentage || 0, loanData.loanServiceCharge || 0
    ]
  );

  // Record disbursement transaction if it's the principal amount going into a bank
  if (loanData.bankAccountId) {
    const txId = generateId();
    const incomeCategory = await ensureCategoryExists(userId, 'loan income', 'loan income', 1);
    await database.runAsync(
      'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [txId, userId, 'loan income', loanData.principal, loanData.loanStartDate, loanData.bankAccountId, `Disbursement: ${loanData.name}`, id, incomeCategory.id]
    );

    // Update bank balance
    await updateAccountBalanceSQL(database, loanData.bankAccountId, loanData.principal, 'INCOME', false);
  }

  // Generate future expected expenses
  await syncLoanExpectedExpenses(userId, id);

  return { ...loanData, id };
};

export const updateLoanInfo = async (activeUserId, accountId, loanData) => {
  const database = await getDb();
  const userId = activeUserId;

  // Fetch existing to handle principal delta
  const oldRecord = await database.getFirstAsync('SELECT * FROM loans WHERE id = ?', [accountId]);
  if (!oldRecord) throw new Error('Loan not found');

  const oldDisbursed = Number(oldRecord.disbursedPrincipal || 0);
  const newDisbursed = Number(loanData.disbursedPrincipal || 0);
  const diff = newDisbursed - oldDisbursed;

  // Adjust current principal by the same delta
  const P_current = Number(oldRecord.principal || 0) + diff;
  const P_original = newDisbursed;

  // Ensure system category exists
  const category = await ensureCategoryExists(userId, 'loan_pay', 'EXPENSE');

  // Recalculate EMI if core parameters changed
  let finalEmi = Number(loanData.emiAmount || 0);
  if (finalEmi <= 0 && loanData.loanType === 'EMI') {
    finalEmi = calculateEmiValue(P_original, loanData.loanInterestRate, loanData.loanTenure);
  }

  // Add tax to EMI if applicable
  const taxRate = Number(loanData.loanTaxPercentage || 0);
  if (taxRate > 0 && loanData.loanType === 'EMI') {
    const monthlyInterest = Number(P_original) * (Number(loanData.loanInterestRate) / 1200);
    finalEmi += (monthlyInterest * (taxRate / 100));
  }

  const rate = Number(loanData.loanInterestRate || loanData.interestRate || 0);
  const tenureValue = Number(loanData.loanTenure || loanData.tenure || 0);
  const start = loanData.loanStartDate || loanData.startDate || new Date().toISOString();

  const months = Math.round(tenureValue);
  const paidMonthsCount = parseInt(loanData.paidMonths || 0, 10);
  const statusObj = {};
  const forecastStart = new Date(loanData.emiStartDate || loanData.loanStartDate || new Date().toISOString());

  for (let i = 1; i <= months; i++) {
    const d = new Date(forecastStart);
    d.setMonth(d.getMonth() + i - 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    statusObj[monthKey] = i <= paidMonthsCount ? 'paid' : 'unpaid';
  }

  await database.runAsync(
    `UPDATE loans SET 
      name = ?, type = ?, loanType = ?, disbursedPrincipal = ?, principal = ?, 
      interestRate = ?, tenure = ?, startDate = ?,
      emiAmount = ?, linkedAccountId = ?, paidMonths = ?,
      emiStartDate = ?, installmentStatus = ?, taxPercentage = ?, serviceCharge = ?
    WHERE id = ?`,
    [
      loanData.name, loanData.type, loanData.loanType || 'ONE_TIME',
      P_original, P_current, rate, tenureValue, start,
      finalEmi, loanData.bankAccountId, loanData.paidMonths,
      loanData.emiStartDate, JSON.stringify(statusObj), loanData.loanTaxPercentage || 0, loanData.loanServiceCharge || 0,
      accountId
    ]
  );

  // If there's a delta and a bank is selected, record adjustment transaction
  if (diff !== 0 && loanData.bankAccountId) {
    const txId = generateId();
    const incomeCategory = await ensureCategoryExists(userId, 'loan income', 'loan income', 1);
    await database.runAsync(
      'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [txId, userId, 'loan income', Math.abs(diff), new Date().toISOString(), loanData.bankAccountId, `Principal Adjustment: ${loanData.name}`, accountId, incomeCategory.id]
    );
    // If diff > 0, we got more money (Income flow). If diff < 0, it's a correction (Expense flow).
    const txTypeForBalance = diff > 0 ? 'loan income' : 'EXPENSE';
    await updateAccountBalanceSQL(database, loanData.bankAccountId, Math.abs(diff), txTypeForBalance, false);
  }

  // Regenerate starting from next installment
  await syncLoanExpectedExpenses(userId, accountId);

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
  const category = await ensureCategoryExists(userId, 'loan_pay', 'EXPENSE');

  await database.runAsync(
    'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, userId, 'LOAN_PRINCIPAL_PAYMENT', amount, new Date().toISOString(), bankAccountId, `Prepayment: ${account.name}`, accountId, category.id]
  );

  // 3. Update current principal and prepayment history
  const newPrincipal = Math.max(0, account.principal - amount);
  const prepayments = JSON.parse(account.prepayments || '[]');
  prepayments.push({ amount, date: new Date().toISOString() });

  // 4. Auto-close if principal hits 0
  const isClosed = newPrincipal <= 0 ? 1 : 0;

  await database.runAsync(
    'UPDATE loans SET principal = ?, isClosed = ?, prepayments = ? WHERE id = ?',
    [newPrincipal, isClosed, JSON.stringify(prepayments), accountId]
  );

  // 5. Update bank balance
  await updateAccountBalanceSQL(database, bankAccountId, amount, 'EXPENSE', false);

  // 6. Sync future expected expenses to reflect new schedule/tenure
  await syncLoanExpectedExpenses(userId, accountId);

  return true;
};

/**
 * Syncs future expected expenses with the current amortization schedule.
 * Use this after prepayments or interest rate changes.
 */
export const syncLoanExpectedExpenses = async (userId, accountId) => {
  const database = await getDb();
  const account = await database.getFirstAsync('SELECT * FROM loans WHERE id = ?', [accountId]);
  if (!account) return;

  const category = await ensureCategoryExists(userId, 'loan_pay', 'EXPENSE');
  const schedule = calculateAmortizationSchedule(account);
  const now = new Date();
  const currentMonthKey = format(now, 'yyyy-MM');

  // 1. Clear future UNPAID expected expenses for this loan
  await database.runAsync(
    'DELETE FROM expected_expenses WHERE userId = ? AND linkedAccountId = ? AND isDone = 0 AND monthKey >= ? AND (isDeleted = 0 OR isDeleted IS NULL)',
    [userId, accountId, currentMonthKey]
  );

  // 2. Regenerate from schedule
  const futureRows = schedule.filter(r => r.monthKey >= currentMonthKey && !r.isCompleted);

  if (account.loanType === 'EMI') {
    for (const row of futureRows) {
      await saveExpectedExpense(database, {
        userId,
        name: `Loan EMI: ${account.name}`,
        amount: row.totalOutflow,
        type: 'EXPENSE',
        monthKey: row.monthKey,
        date: row.monthDate.toISOString(),
        linkedAccountId: accountId,
        categoryId: category.id
      });
    }
  } else if (account.loanType === 'ONE_TIME') {
    const finalRow = schedule[schedule.length - 1];
    if (finalRow && !finalRow.isCompleted) {
      await saveExpectedExpense(database, {
        userId,
        name: `Loan Settlement: ${account.name}`,
        amount: finalRow.totalOutflow,
        type: 'EXPENSE',
        monthKey: finalRow.monthKey,
        date: finalRow.monthDate.toISOString(),
        linkedAccountId: accountId,
        categoryId: category.id
      });
    }
  }
};

export const recordLoanFine = async (userId, accountId, bankAccountId, amount, monthKey) => {
  const database = await getDb();
  const category = await ensureCategoryExists(userId, 'loan_pay', 'EXPENSE');
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
  const category = await ensureCategoryExists(userId, 'loan_pay', 'EXPENSE');
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

  const category = await ensureCategoryExists(userId, 'loan_pay', 'EXPENSE');

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
  const isClosed = (isFinalMonth || newPrincipal < 1) ? 1 : 0;
  if (isClosed) {
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
    'UPDATE loans SET principal = ?, paidMonths = ?, installmentStatus = ?, isClosed = ? WHERE id = ?',
    [newPrincipal, newPaidMonths, JSON.stringify(status), isClosed, accountId]
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
