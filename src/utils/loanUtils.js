import { differenceInMonths } from './dateUtils';

export { differenceInMonths };

export const calculateAmortizationSchedule = (account) => {
    if (!account) return [];
    
    // Specifically for Unified Loans (Loans, Borrowed, Lended)
    const tenure = parseInt(account.loanTenure || account.tenure || 0, 10);
    const principal = parseFloat(account.actualDisbursedPrincipal || account.disbursedPrincipal || account.loanPrincipal || account.principal || 0);
    const loanType = account.loanType || 'EMI'; 

    if (!principal || !tenure) return [];
    
    const rows = [];
    const startDate = new Date(account.loanStartDate || account.emiStartDate || new Date().toISOString());

    if (loanType === 'EMI') {
        const P = principal;
        const n = tenure;
        
        let emi = parseFloat(account.loanEmi || account.emiAmount || account.amount || account.emiAmountVal || 0);
        const annualRate = parseFloat(account.loanInterestRate || account.interestRate || 0);
        const r = annualRate / 1200;

        if (emi <= 0) {
            if (r > 0) {
                emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            } else {
                emi = P / n;
            }
        }

        const statusMap = typeof account.installmentStatus === 'string' ? JSON.parse(account.installmentStatus || '{}') : (account.installmentStatus || {});
        let currentBalance = P;
        
        for (let i = 1; i <= n; i++) {
            let interest = currentBalance * r;
            let pr = emi - interest;
            
            if (i === n) {
                pr = currentBalance;
                interest = Math.max(0, emi - pr);
            }

            const monthDate = new Date(startDate);
            monthDate.setMonth(startDate.getMonth() + i - 1);
            
            const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
            const status = statusMap[monthKey] || (i <= (account.paidMonths || 0) ? 'paid' : (account.isClosed === 1 ? 'foreclosed' : 'unpaid'));
            const isPaid = status === 'paid';
            const isForeclosed = status === 'foreclosed';
            
            rows.push({
                month: i,
                monthDate: new Date(monthDate),
                monthKey,
                date: monthDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
                emi,
                interest: interest,
                tax: 0,
                principal: pr,
                balance: Math.max(0, currentBalance - pr),
                totalOutflow: emi,
                isCompleted: isPaid,
                isForeclosed: isForeclosed
            });

            currentBalance -= pr;
        }
    } else if (loanType === 'ONE_TIME') {
        const P = principal;
        const n = tenure; 
        const annualRate = parseFloat(account.loanInterestRate || account.interestRate || 0);
        const totalInterest = P * (annualRate / 100) * (n / 12);
        
        const monthDate = new Date(startDate);
        monthDate.setMonth(startDate.getMonth() + n);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        
        rows.push({
            month: 'Final',
            monthDate: new Date(monthDate),
            monthKey,
            date: monthDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
            emi: P + totalInterest,
            interest: totalInterest,
            tax: 0,
            principal: P,
            balance: 0,
            totalOutflow: P + totalInterest,
            isCompleted: account.isClosed === 1,
            isForeclosed: false
        });
    }

    if (account.isClosed === 1 && loanType !== 'ONE_TIME') {
        const fcAmount = Number(account.loanClosureAmount || account.closureAmount || 0);
        if (fcAmount > 0) {
            rows.push({
                month: 'FC',
                monthDate: new Date(),
                date: 'Foreclosure Settlement',
                emi: 0,
                interest: 0,
                tax: 0,
                principal: fcAmount,
                balance: 0,
                totalOutflow: fcAmount,
                isCompleted: true,
                isForeclosure: true
            });
        }
    }
    return rows;
};

export const calculateEmiTotals = (schedule) => {
    if (!schedule || schedule.length === 0) return { interest: 0, tax: 0, total: 0 };
    return schedule.reduce((acc, row) => ({
        interest: acc.interest + (row.interest || 0),
        tax: acc.tax + (row.tax || 0),
        total: acc.total + (row.totalOutflow || 0)
    }), { interest: 0, tax: 0, total: 0 });
};

export const calculateTotalPayable = (account) => {
    if (!account) return 0;
    const schedule = calculateAmortizationSchedule(account);
    const totals = calculateEmiTotals(schedule);
    return totals.total;
};

export const calculateRemainingPayable = (account) => {
    if (!account || account.isClosed === 1) return 0;
    const schedule = calculateAmortizationSchedule(account);
    return schedule.filter(r => !r.isCompleted).reduce((sum, r) => sum + r.totalOutflow, 0);
};

export const calculateExtraCost = (account) => {
    if (!account) return 0;
    const totalPayable = calculateTotalPayable(account);
    const principal = parseFloat(account.actualDisbursedPrincipal || account.disbursedPrincipal || account.loanPrincipal || account.principal || 0);
    return Math.max(0, totalPayable - principal);
};

export const calculateExtraPercentage = (account) => {
    if (!account) return 0;
    const principal = parseFloat(account.actualDisbursedPrincipal || account.disbursedPrincipal || account.loanPrincipal || account.principal || 0);
    if (principal <= 0) return 0;
    const extra = calculateExtraCost(account);
    return (extra / principal) * 100;
};


export const getLoanStats = (item) => {
  if (!item) return { isLoan: false, remainingTotal: 0, closeTodayAmount: 0, emi: 0, totalInterest: 0, fineAmount: 0 };
  
  const isLoan = item.type === 'LOAN' || item.type === 'BORROWED' || item.type === 'LENDED';
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

  const loanType = item.loanType || 'ONE_TIME';
  const principal_original = parseFloat(item.actualDisbursedPrincipal || item.disbursedPrincipal || item.loanPrincipal || 0);
  const P_current = parseFloat(item.balance || item.principal || 0);
  const tenureValue = parseInt(item.loanTenure || item.tenure || 0, 10);
  
  if (!principal_original || !tenureValue) {
    return { 
      isLoan: true, 
      remainingTotal: P_current, 
      closeTodayAmount: P_current, 
      emi: 0, 
      totalInterest: 0, 
      fineAmount: 0 
    };
  }

  const schedule = calculateAmortizationSchedule(item);
  const totals = calculateEmiTotals(schedule);
  const remainingSchedule = schedule.filter(r => !r.isCompleted);
  const remainingTotal = remainingSchedule.reduce((sum, r) => sum + r.totalOutflow, 0);
  const totalInterest = schedule.reduce((sum, r) => sum + r.interest, 0);
  const emi_current = schedule.length > 0 ? (schedule[0].emi || 0) : 0;
  
  const paymentCount = parseInt(item.paidMonths || 0, 10);
  const finePaid = Number(item.loanFinePaid || 0);

  return {
    isLoan: true,
    isEmi: loanType === 'EMI',
    loanType,
    principal: P_current,
    principal_original,
    rate: item.loanInterestRate || 0,
    emi: emi_current,
    totalRepayable: item.isClosed === 1 ? 0 : remainingTotal,
    originalTotalPayable: totals.total,
    remainingTotal: item.isClosed === 1 ? 0 : remainingTotal,
    closeTodayAmount: item.isClosed === 1 ? 0 : remainingTotal,
    totalInterest,
    extraCost: Math.max(0, (totals.total - principal_original) + finePaid),
    tenureValue,
    paymentCount,
    totalPaid: totals.total - remainingTotal,
    remainingMonths: remainingSchedule.length,
    finePaid,
    extraPercentage: calculateExtraPercentage(item)
  };
};

