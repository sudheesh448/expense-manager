import { generateId, getDb, updateAccountBalanceSQL, ensureCategoryExists } from './utils';
import { saveExpectedExpense } from './transactionStorage';
import { addMonths, format } from 'date-fns';

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

/**
 * Save loan-specific details.
 * Handles displacement transaction and expected expense generation.
 */
export const saveLoanInfo = async (database, id, data) => {
  if (!database || !id) return;

  let emiAmount = data.emiAmount || data.loanEmi || null;
  if (data.loanType === 'EMI' && !emiAmount) {
    emiAmount = calculateEmiValue(data.loanPrincipal, data.loanInterestRate, data.loanTenure);
  }

  const sql = `INSERT INTO loans (
    id, userId, type, loanType, name, disbursedPrincipal, principal, interestRate, tenure, 
    startDate, emiStartDate, emiAmount,
    finePercentage, serviceCharge, processingFee, taxPercentage, loanFinePaid, 
    paidMonths, installmentStatus, isClosed, closureAmount
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  await database.runAsync(sql, [
    id,
    data.userId,
    data.type,
    data.loanType || 'ONE_TIME',
    data.name,
    Number(data.loanPrincipal || 0),
    Number(data.loanPrincipal || 0),
    Number(data.loanInterestRate || 0),
    Number(data.loanTenure || 0),
    data.loanStartDate || new Date().toISOString(),
    data.emiStartDate || null,
    emiAmount,
    Number(data.loanFinePercentage || 0),
    Number(data.loanServiceCharge || 0),
    Number(data.loanProcessingFee || 0),
    Number(data.loanTaxPercentage || 0),
    Number(data.loanFinePaid || 0),
    Number(data.paidMonths || 0),
    JSON.stringify(data.installmentStatus || {}),
    data.isClosed ? 1 : 0,
    data.loanClosureAmount || null
  ]);

  // Disbursement logic: if targetAccountId is provided, credit the bank
  if (data.targetAccountId) {
    const P = Number(data.loanPrincipal || 0);
    const fee = Number(data.loanProcessingFee || 0);
    const creditedAmount = P - fee;

    if (creditedAmount > 0) {
      const txId = generateId();
      await database.runAsync(
        'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [txId, data.userId, 'INCOME', creditedAmount, data.loanStartDate || new Date().toISOString(), data.targetAccountId, `Loan Disbursement: ${data.name} (Less Processing Fee: ${fee})`, id]
      );
      await updateAccountBalanceSQL(database, data.targetAccountId, creditedAmount, 'INCOME', true);
    }
  }

  if (data.loanType === 'EMI') {
    await generateLoanExpectedExpenses(database, id, { ...data, emiAmount });
  }
};

/**
 * Update loan-specific details.
 */
export const updateLoanInfo = async (database, id, data) => {
  if (!database || !id) return;

  let emiAmount = data.emiAmount || data.loanEmi || null;
  if (data.loanType === 'EMI' && !emiAmount) {
    emiAmount = calculateEmiValue(data.loanPrincipal, data.loanInterestRate, data.loanTenure);
  }

  const sql = `UPDATE loans SET 
    name = ?, disbursedPrincipal = ?, principal = ?, interestRate = ?, tenure = ?, 
    startDate = ?, emiStartDate = ?, emiAmount = ?, loanType = ?,
    finePercentage = ?, serviceCharge = ?, processingFee = ?, taxPercentage = ?, 
    loanFinePaid = ?, paidMonths = ?, isClosed = ?, closureAmount = ?, installmentStatus = ?
    WHERE id = ?`;
    
  await database.runAsync(sql, [
    data.name,
    Number(data.loanPrincipal || 0),
    Number(data.principal || data.loanPrincipal || 0),
    Number(data.loanInterestRate || 0),
    Number(data.loanTenure || 0),
    data.loanStartDate,
    data.emiStartDate || null,
    emiAmount,
    data.loanType || 'ONE_TIME',
    Number(data.loanFinePercentage || 0),
    Number(data.loanServiceCharge || 0),
    Number(data.loanProcessingFee || 0),
    Number(data.loanTaxPercentage || 0),
    Number(data.loanFinePaid || 0),
    Number(data.paidMonths || 0),
    data.isClosed ? 1 : 0,
    data.loanClosureAmount || null,
    JSON.stringify(data.installmentStatus || {}),
    id
  ]);

  // Regenerate expected expenses if it's an EMI loan
  if (data.loanType === 'EMI') {
    await database.runAsync('UPDATE expected_expenses SET isDeleted = 1 WHERE linkedAccountId = ? AND isDone = 0', [id]);
    await generateLoanExpectedExpenses(database, id, { ...data, emiAmount });
  }
};

/**
 * Generate future installments in expected_expenses table.
 */
export const generateLoanExpectedExpenses = async (database, id, data) => {
  const n = parseInt(data.loanTenure || 0, 10);
  if (n <= 0) return;

  const emiAmount = Number(data.emiAmount || data.loanEmi || 0);
  if (emiAmount <= 0) return;

  const start = new Date(data.emiStartDate || data.loanStartDate || new Date().toISOString());
  const category = await ensureCategoryExists(data.userId, 'Loan Payment', 'loan_pay', 1);

  for (let i = 0; i < n; i++) {
    const forecastDate = addMonths(start, i);
    const monthKey = format(forecastDate, 'yyyy-MM');
    
    // Check if it already exists for this months to avoid duplicates (though we deletes unpaid above)
    const exists = await database.getFirstAsync(
      'SELECT id FROM expected_expenses WHERE userId = ? AND linkedAccountId = ? AND monthKey = ? AND isDeleted = 0',
      [data.userId, id, monthKey]
    );

    if (!exists) {
      await saveExpectedExpense(data.userId, {
        monthKey,
        name: `Loan: ${data.name} (${i + 1}/${n})`,
        amount: emiAmount,
        isDone: 0,
        categoryId: category.id,
        type: 'EXPENSE',
        linkedAccountId: id,
        anchorDay: start.getDate()
      });
    }
  }
};

/**
 * Record a principal prepayment and recalculate future EMIs.
 */
export const recordPrincipalPrepayment = async (database, accountId, bankAccountId, amount, userId) => {
  if (!database || !accountId || amount <= 0) return;

  const account = await database.getFirstAsync('SELECT * FROM loans WHERE id = ?', [accountId]);
  if (!account) return;

  const newPrincipal = Math.max(0, (account.principal || 0) - amount);
  // disbursedPrincipal remains unchanged (Original)

  // Calculate remaining months
  const paidMonthsCount = parseInt(account.paidMonths || 0, 10);
  const totalTenure = parseInt(account.tenure || 0, 10);
  const remainingMonths = totalTenure - paidMonthsCount;

  let newEmi = account.emiAmount;
  if (account.loanType === 'EMI' && remainingMonths > 0) {
    newEmi = calculateEmiValue(newPrincipal, account.interestRate, remainingMonths);
  }

  // Update loan record
  await database.runAsync(
    'UPDATE loans SET principal = ?, emiAmount = ? WHERE id = ?',
    [newPrincipal, newEmi, accountId]
  );

  // Record transaction
  const txId = generateId();
  const category = await ensureCategoryExists(userId, 'Loan Payment', 'loan_pay', 1);
  await database.runAsync(
    'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, userId, 'LOAN_PREPAYMENT', amount, new Date().toISOString(), bankAccountId, `Principal Prepayment: ${account.name}`, accountId, category.id]
  );

  // Update bank balance
  if (bankAccountId) {
    await updateAccountBalanceSQL(database, bankAccountId, amount, 'EXPENSE', false);
  }

  // Sync expected expenses for remaining months
  if (account.loanType === 'EMI') {
    await database.runAsync('UPDATE expected_expenses SET isDeleted = 1 WHERE linkedAccountId = ? AND isDone = 0', [accountId]);
    await generateLoanExpectedExpenses(database, accountId, { 
      ...account, 
      loanPrincipal: newPrincipal, 
      loanTenure: remainingMonths, // We regenerate only for remaining
      emiStartDate: account.emiStartDate || account.startDate,
      emiAmount: newEmi 
    });
  }

  return true;
};

/**
 * Record a loan fine.
 */
export const recordLoanFine = async (database, accountId, bankAccountId, amount, userId) => {
  if (!database || !accountId || amount <= 0) return;

  const account = await database.getFirstAsync('SELECT * FROM loans WHERE id = ?', [accountId]);
  if (!account) return;

  // Record transaction
  const txId = generateId();
  const category = await ensureCategoryExists(userId, 'Loan Payment', 'loan_pay', 1);
  await database.runAsync(
    'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, userId, 'loan fine', amount, new Date().toISOString(), bankAccountId, `Fine/Penalty: ${account.name}`, accountId, category.id]
  );

  // Update loan record
  await database.runAsync(
    'UPDATE loans SET loanFinePaid = COALESCE(loanFinePaid, 0) + ? WHERE id = ?',
    [amount, accountId]
  );

  // Update bank balance
  if (bankAccountId) {
    await updateAccountBalanceSQL(database, bankAccountId, amount, 'EXPENSE', false);
  }

  return true;
};

/**
 * Foreclose a loan.
 */
export const forecloseLoan = async (database, accountId, bankAccountId, amount, userId) => {
  if (!database || !accountId || amount <= 0) return;

  const account = await database.getFirstAsync('SELECT * FROM loans WHERE id = ?', [accountId]);
  if (!account) return;

  // Record transaction
  const txId = generateId();
  const category = await ensureCategoryExists(userId, 'Loan Payment', 'loan_pay', 1);
  await database.runAsync(
    'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, userId, 'LOAN_FORECLOSURE', amount, new Date().toISOString(), bankAccountId, `Loan Foreclosure: ${account.name}`, accountId, category.id]
  );

  // Update loan record
  await database.runAsync(
    'UPDATE loans SET principal = 0, isClosed = 1, closureAmount = ? WHERE id = ?',
    [amount, accountId]
  );

  // Update bank balance
  if (bankAccountId) {
    await updateAccountBalanceSQL(database, bankAccountId, amount, 'EXPENSE', false);
  }

  // Delete all future expected expenses for this loan
  await database.runAsync('UPDATE expected_expenses SET isDeleted = 1 WHERE linkedAccountId = ? AND isDone = 0', [accountId]);

  return true;
};

/**
 * Pay a loan installment.
 */
export const payLoanInstallment = async (database, accountId, bankAccountId, amount, monthKey, userId) => {
  if (!database || !accountId || amount <= 0) return;

  const account = await database.getFirstAsync('SELECT * FROM loans WHERE id = ?', [accountId]);
  if (!account) throw new Error("Loan Account not found");

  // Calculate principal/interest split for this payment
  const P = Number(account.principal || 0);
  const R = Number(account.interestRate || 0);
  const monthlyRate = R / 1200;
  
  const interestPortion = P * monthlyRate;
  const principalPortion = Math.max(0, Math.min(P, amount - interestPortion));
  
  const newPrincipal = Math.max(0, P - principalPortion);
  // disbursedPrincipal remains unchanged

  // Update status object
  const status = JSON.parse(account.installmentStatus || '{}');
  if (monthKey) status[monthKey] = 'paid';
  const newPaidMonths = (account.paidMonths || 0) + 1;

  // Record transaction
  const txId = generateId();
  const category = await ensureCategoryExists(userId, 'Loan Payment', 'loan_pay', 1);
  await database.runAsync(
    'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, userId, 'LOAN_REPAYMENT', amount, new Date().toISOString(), bankAccountId, `Loan EMI: ${account.name} (${monthKey})`, accountId, category.id]
  );

  // Update loan record
  await database.runAsync(
    'UPDATE loans SET principal = ?, paidMonths = ?, installmentStatus = ? WHERE id = ?',
    [newPrincipal, newPaidMonths, JSON.stringify(status), accountId]
  );

  // Update bank balance
  if (bankAccountId) {
    await updateAccountBalanceSQL(database, bankAccountId, amount, 'EXPENSE', false);
  }

  // Mark expected expense as done
  if (monthKey) {
    await database.runAsync(
      'UPDATE expected_expenses SET isDone = 1, isDeleted = 0 WHERE userId = ? AND monthKey = ? AND linkedAccountId = ? AND isDone = 0',
      [userId, monthKey, accountId]
    );
  }

  return true;
};
