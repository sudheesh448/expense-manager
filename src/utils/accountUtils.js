import { calculateAmortizationSchedule, calculateEmiTotals } from './emiUtils';

/**
 * Calculate the difference in months between two dates.
 * @param {Date} date1 Newer date
 * @param {Date} date2 Older date
 * @returns {number} Difference in months
 */
export const differenceInMonths = (date1, date2) => {
  let months = (date1.getFullYear() - date2.getFullYear()) * 12;
  months -= date2.getMonth();
  months += date1.getMonth();
  return months <= 0 ? 0 : months;
};

/**
 * Calculate comprehensive loan statistics including remaining balance, EMI, and interest.
 * @param {Object} item The account object containing loan details
 * @returns {Object} Loan statistics
 */
export const getLoanStats = (item) => {
  if (!item) return { isLoan: false, remainingTotal: 0, closeTodayAmount: 0, emi: 0, totalInterest: 0, fineAmount: 0 };
  
  const isLoan = item.type === 'LOAN' || item.type === 'BORROWED' || item.type === 'LENDED' || item.type === 'EMI';
  if (!isLoan) {
    return { 
      isLoan: false, 
      remainingTotal: item.balance || 0,
      closeTodayAmount: item.balance || 0,
      emi: 0,
      totalInterest: 0,
      fineAmount: 0
    };
  }

  const loanType = item.loanType || (item.type === 'EMI' ? 'EMI' : 'ONE_TIME');
  const principal_original = parseFloat(item.productPrice || item.loanPrincipal || item.principal || 0);
  const P_current = parseFloat(item.ccRemaining || item.balance || 0);
  const tenureValue = parseInt(item.loanTenure || item.tenure || item.emiTenureVal || 0, 10);
  
  if (!principal_original || !tenureValue) {
    return { 
      isLoan: true, 
      isEmi: loanType === 'EMI',
      remainingTotal: P_current, 
      closeTodayAmount: P_current, 
      emi: 0, 
      totalInterest: 0, 
      fineAmount: 0 
    };
  }

  const schedule = calculateAmortizationSchedule(item);
  const totals = calculateEmiTotals(schedule);
  
  const paymentCount = parseInt(item.paidMonths || item.paymentCount || 0, 10);
  const remainingSchedule = schedule.filter(r => !r.isCompleted);
  const remainingTotal = remainingSchedule.reduce((sum, r) => sum + r.totalOutflow, 0);
  const totalInterest = schedule.reduce((sum, r) => sum + r.interest, 0);
  
  const emi_current = schedule.length > 0 ? (schedule[0].emi || 0) : 0;
  
  // Close amount logic: for simplicity we use remaining payable. 
  // In a real app, this might subtract unaccrued interest.
  const closeTodayAmount = remainingTotal; 

  const finePaid = Number(item.loanFinePaid || item.loanfinepaid || 0);
  const extraCost = Math.max(0, (totals.total - principal_original) + finePaid);
  const extraPercentage = principal_original > 0 ? (extraCost / principal_original) * 100 : 0;

  const currentCcUsage = (item.isClosed === 1) ? 0 : (item.type === 'EMI' ? P_current : 0);

  return {
    isLoan,
    isEmi: loanType === 'EMI',
    loanType,
    principal: P_current, // Current outstanding
    principal_original,
    currentCcUsage,
    rate: item.loanInterestRate || item.interestRate || 0,
    emi: emi_current,
    totalRepayable: item.isClosed === 1 ? 0 : remainingTotal,
    originalTotalPayable: totals.total,
    remainingTotal: item.isClosed === 1 ? 0 : remainingTotal,
    closeTodayAmount: item.isClosed === 1 ? 0 : closeTodayAmount,
    totalInterest,
    extraCost,
    extraPercentage,
    tenureValue,
    paymentCount,
    totalPaid: totals.total - remainingTotal,
    finePaid,
    remainingMonths: remainingSchedule.length,
  };
};

/**
 * Generate a descriptive label for an account including its current/available balance.
 * Dedicated for use in dropdowns and selectors.
 * @param {Object} account The specific account to label
 * @param {Array} allAccounts Full list of accounts to calculate linked EMI impact for CCs
 * @param {string} currencySymbol The symbol to use (default: ₹)
 * @returns {string} 
 */
export const getAccountLabel = (account, allAccounts = [], currencySymbol = '₹') => {
  if (!account) return 'Unknown Account';
  
  if (account.type === 'CREDIT_CARD') {
    const emis = allAccounts.filter(acc => acc.type === 'EMI' && acc.linkedAccountId === account.id);
    const emiOutstanding = emis.reduce((sum, e) => sum + (getLoanStats(e).remainingTotal || 0), 0);
    const available = (account.creditLimit || 0) - ((account.balance || 0) + emiOutstanding);
    return `${account.name} (Avl: ${currencySymbol}${available.toLocaleString(undefined, { maximumFractionDigits: 0 })})`;
  }
  
  const balance = (account.type === 'LOAN' || account.type === 'BORROWED' || account.type === 'LENDED' || account.type === 'EMI')
    ? getLoanStats(account).remainingTotal
    : (account.balance || 0);
    
  return `${account.name} (${currencySymbol}${balance.toLocaleString(undefined, { maximumFractionDigits: 0 })})`;
};

/**
 * Generate the next N months as { label, monthKey }
 * @param {number} n Number of months to generate
 * @returns {Array} List of month objects
 */
export const getUpcomingMonths = (n = 24) => {
  const months = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const year  = d.getFullYear();
    const month = d.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    months.push({ monthKey, label: d.toLocaleString('default', { month: 'short', year: 'numeric' }) });
    d.setMonth(d.getMonth() + 1);
  }
  return months;
};
