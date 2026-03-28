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
    const startDate = new Date(account.emiStartDate || account.loanStartDate || account.startDate || new Date().toISOString());

    if (loanType === 'EMI') {
        const P = principal;
        const n = tenure;
        
        let emi = parseFloat(account.loanEmi || account.emiAmount || account.amount || account.emiAmountVal || 0);
        const annualRate = parseFloat(account.loanInterestRate || account.interestRate || 0);
        const taxRate = parseFloat(account.loanTaxPercentage || account.taxPercentage || 0);
        const r = annualRate / 1200;

        if (emi <= 0) {
            if (r > 0) {
                emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            } else {
                emi = P / n;
            }
        }

        const prepayments = typeof account.prepayments === 'string' ? JSON.parse(account.prepayments || '[]') : (account.prepayments || []);
        const statusMap = typeof account.installmentStatus === 'string' ? JSON.parse(account.installmentStatus || '{}') : (account.installmentStatus || {});
        let currentBalance = P;
        
        for (let i = 1; i <= n; i++) {
            // Apply prepayments that occurred during or before this installment period
            // To simplify, we'll check for prepayments whose date falls within this month's cycle
            const monthDate = new Date(startDate);
            monthDate.setMonth(startDate.getMonth() + i - 1);
            const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
            
            // Find prepayments for this month key (or earlier if not already applied)
            // But actually, we just need to know if the balance has already been reduced.
            // In the storage, we subtract prepayment from 'principal' immediately.
            // But the schedule is built from the ORIGINAL principal.
            // So we must subtract prepayments from P as we go.
            
            const monthPrepayments = prepayments.filter(p => {
                const pDate = new Date(p.date);
                const pKey = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
                return pKey === monthKey;
            }).reduce((sum, p) => sum + p.amount, 0);

            let interest = Math.max(0, currentBalance * r);
            let pr = emi - interest;
            
            if (currentBalance <= 0) break; // Loan already settled early

            if (i === n || (currentBalance - pr) < 1) {
                pr = currentBalance;
                interest = Math.max(0, emi - pr);
                if (interest > currentBalance * r) interest = currentBalance * r; // Cap interest
            }
            
            const tax = interest * (taxRate / 100);
            const totalOutflow = emi + tax;

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
                tax: tax,
                principal: pr,
                balance: Math.max(0, currentBalance - pr),
                totalOutflow: totalOutflow,
                isCompleted: isPaid,
                isForeclosed: isForeclosed,
                prepayment: monthPrepayments
            });

            // Adjust balance for NEXT month: subtract principal component AND any prepayments made this month
            currentBalance -= (pr + monthPrepayments);
            
            if (currentBalance < 0.01) break; // Terminate early if principal is gone
        }
    } else if (loanType === 'ONE_TIME') {
        const prepayments = typeof account.prepayments === 'string' ? JSON.parse(account.prepayments || '[]') : (account.prepayments || []);
        const P = principal;
        const n = tenure; 
        const annualRate = parseFloat(account.loanInterestRate || account.interestRate || 0);
        const taxRate = parseFloat(account.loanTaxPercentage || account.taxPercentage || 0);
        
        let totalInterest = 0;
        let currentBalance = P;
        const start = new Date(startDate);
        const end = new Date(startDate);
        end.setMonth(start.getMonth() + n);

        // Calculate interest based on reducing balance due to prepayments
        // We split the tenure into months and check balance each month
        for (let i = 1; i <= n; i++) {
            const mStart = new Date(start);
            mStart.setMonth(start.getMonth() + i - 1);
            const mEnd = new Date(start);
            mEnd.setMonth(start.getMonth() + i);
            const monthKey = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, '0')}`;

            const monthPrepayments = prepayments.filter(p => {
                const pDate = new Date(p.date);
                const pKey = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
                return pKey === monthKey;
            }).reduce((sum, p) => sum + p.amount, 0);

            // Interest for this month: balance * (rate/100) * (1/12)
            const monthInterest = currentBalance * (annualRate / 100) * (1 / 12);
            totalInterest += Math.max(0, monthInterest);
            currentBalance -= monthPrepayments;
            if (currentBalance < 0.01) break;
        }

        const totalTax = totalInterest * (taxRate / 100);
        const finalP = Math.max(0, currentBalance);
        
        const monthDate = new Date(startDate);
        monthDate.setMonth(startDate.getMonth() + n);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        
        rows.push({
            month: 'Final',
            monthDate: new Date(monthDate),
            monthKey,
            date: monthDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
            emi: finalP + totalInterest + totalTax,
            interest: totalInterest,
            tax: totalTax,
            principal: finalP,
            balance: 0,
            totalOutflow: finalP + totalInterest + totalTax,
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
      isEmi: loanType === 'EMI',
      loanType,
      principal: P_current, 
      principal_original: principal_original || P_current, 
      rate: item.loanInterestRate || 0,
      emi: 0, 
      totalRepayable: item.isClosed === 1 ? 0 : P_current,
      originalTotalPayable: principal_original || P_current,
      remainingTotal: item.isClosed === 1 ? 0 : P_current,
      closeTodayAmount: item.isClosed === 1 ? 0 : P_current,
      totalInterest: 0, 
      extraCost: 0,
      tenureValue: tenureValue || 0,
      paymentCount: parseInt(item.paidMonths || 0, 10),
      totalPaid: 0,
      remainingMonths: 0,
      finePaid: Number(item.loanFinePaid || 0),
      extraPercentage: 0,
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

