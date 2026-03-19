export function computeLoanerData(loaner) {
  return {
    ...loaner,
    risk_status: loaner.isOverdue
      ? "Overdue"
      : (loaner.daysUntilDue != null && loaner.daysUntilDue <= 7 ? "Due Soon" : "Safe"),
  };
}

export function sortLoaners(loaners) {
  const riskOrder = { "Overdue": 0, "Due Soon": 1, "Safe": 2 };
  
  return [...loaners].sort((a, b) => {
    const aRisk = riskOrder[a.risk_status] ?? 3;
    const bRisk = riskOrder[b.risk_status] ?? 3;
    
    if (aRisk !== bRisk) return aRisk - bRisk;
    
    const aFine = a.fineAmount || 0;
    const bFine = b.fineAmount || 0;
    if (aFine !== bFine) return bFine - aFine;
    
    const aDate = a.expectedReturnDate ? new Date(a.expectedReturnDate) : new Date(9999, 0);
    const bDate = b.expectedReturnDate ? new Date(b.expectedReturnDate) : new Date(9999, 0);
    return aDate - bDate;
  });
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}