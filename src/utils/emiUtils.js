export const differenceInMonths = (date1, date2) => {
    let months = (date1.getFullYear() - date2.getFullYear()) * 12;
    months -= date2.getMonth();
    months += date1.getMonth();
    return months <= 0 ? 0 : months;
};

export const calculateAmortizationSchedule = (account) => {
    if (!account) return [];
    
    // Support both 'emis' and 'loans' table property names
    const tenure = parseInt(account.tenure || account.emiTenureVal || account.loanTenure || 0, 10);
    const principal = parseFloat(account.productPrice || account.loanPrincipal || account.principal || 0);
    const loanType = account.loanType || 'EMI'; // Default to EMI for backward compatibility

    if (!principal || !tenure) return [];
    
    const rows = [];
    const startDate = new Date(account.emiStartDate || account.loanStartDate || new Date().toISOString());

    if (loanType === 'EMI' || account.type === 'EMI') {
        const P = principal;
        const n = tenure;
        
        // Use manual override emiAmount if available
        let emi = parseFloat(account.emiAmount || account.amount || account.emiAmountVal || account.loanEmi || 0);
        
        const annualRate = parseFloat(account.loanInterestRate || account.interestRate || 0);
        const r = annualRate / 1200;

        // Calculate standard EMI if not provided via override
        if (emi <= 0) {
            if (r > 0) {
                emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            } else {
                emi = P / n;
            }
        }

        const processingFee = parseFloat(account.processingFee || account.loanServiceCharge || account.loanProcessingFee || 0);
        const statusMap = typeof account.installmentStatus === 'string' ? JSON.parse(account.installmentStatus || '{}') : (account.installmentStatus || {});
        
        let currentBalance = P;
        
        for (let i = 1; i <= n; i++) {
            let interest = currentBalance * r;
            let pr = emi - interest;
            
            // Adjust last installment for rounding
            if (i === n) {
                pr = currentBalance;
                interest = Math.max(0, emi - pr);
            }

            let rowTotalOutflow = emi;
            let scRowAmount = 0;
            
            // Note: processingFee is usually paid upfront (disbursement), 
            // but we show it in first installment if requested or if it hits bank then.
            // User requested processing fee subtracted from disbursement, so it's already handled there.
            // We'll show it in amortization if it wasn't subtracted, but here we'll keep it clean.

            const monthDate = new Date(startDate);
            monthDate.setMonth(startDate.getMonth() + i - 1);
            
            const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
            const status = statusMap[monthKey] || (i <= (account.paidMonths || account.paymentCount || 0) ? 'paid' : (account.isClosed === 1 ? 'foreclosed' : 'unpaid'));
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
                totalOutflow: rowTotalOutflow,
                serviceChargePaid: scRowAmount,
                isCompleted: isPaid,
                isForeclosed: isForeclosed
            });

            currentBalance -= pr;
        }
    } else if (loanType === 'ONE_TIME') {
        const P = principal;
        const n = tenure; // Months until one-time payment
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
            serviceChargePaid: 0,
            isCompleted: account.isClosed === 1,
            isForeclosed: false
        });
    }

    if (account.isClosed === 1 && loanType !== 'ONE_TIME') {
        const fcAmount = Number(account.emiClosureAmount || account.loanClosureAmount || account.closureAmount || 0);
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
    const principal = parseFloat(account.productPrice || account.loanPrincipal || account.principal || 0);
    return Math.max(0, totalPayable - principal);
};

export const calculateExtraPercentage = (account) => {
    if (!account) return 0;
    const cost = calculateExtraCost(account);
    const principal = parseFloat(account.productPrice || account.loanPrincipal || account.principal || 0);
    if (principal <= 0) return 0;
    return (cost / principal) * 100;
};
