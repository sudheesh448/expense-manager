const P = 10000;
const n = 10;
const emiAmount = 1500;
const loanServiceCharge = 0;
const loanPrincipal = 10000;

const r = 0;
let emi = P / n;
let monthlyInterest = 0;

if (emiAmount > 0) {
    emi = emiAmount;
    monthlyInterest = Math.max(0, (emi * n - P) / n);
}
let calcOriginalTotal = 0;
for (let i = 1; i <= n; i++) {
    calcOriginalTotal += emi;
}
console.log("Original Total Payable:", calcOriginalTotal);
console.log("Extra cost:", Math.max(0, calcOriginalTotal - loanPrincipal));
