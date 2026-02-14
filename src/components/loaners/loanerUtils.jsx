import { differenceInDays, parseISO, isValid } from "date-fns";

export function computeLoanerFields(loaner) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let expectedDate = null;
  if (loaner.expected_return_date) {
    expectedDate = typeof loaner.expected_return_date === 'string' 
      ? parseISO(loaner.expected_return_date) 
      : new Date(loaner.expected_return_date);
  }

  const daysUntilDue = expectedDate && isValid(expectedDate) 
    ? differenceInDays(expectedDate, today) 
    : null;
  
  const daysOverdue = daysUntilDue !== null && daysUntilDue < 0 
    ? Math.abs(daysUntilDue) 
    : 0;
  
  const fineExposure = daysOverdue * 50;

  let riskStatus = "Safe";
  if (daysOverdue > 0) {
    riskStatus = "Overdue";
  } else if (daysUntilDue !== null && daysUntilDue <= 3 && daysUntilDue >= 0) {
    riskStatus = "Due Soon";
  }

  const associateRepDisplay = loaner.associate_rep?.trim() 
    ? loaner.associate_rep 
    : "Account's assoc";

  return {
    ...loaner,
    days_until_due: daysUntilDue,
    days_overdue: daysOverdue,
    fine_exposure: fineExposure,
    risk_status: riskStatus,
    associate_rep_display: associateRepDisplay
  };
}

export function sortLoanersByRisk(loaners) {
  const riskOrder = { "Overdue": 0, "Due Soon": 1, "Safe": 2 };
  
  return [...loaners].sort((a, b) => {
    // 1. Risk status (Overdue first)
    const riskDiff = riskOrder[a.risk_status] - riskOrder[b.risk_status];
    if (riskDiff !== 0) return riskDiff;
    
    // 2. Fine exposure (highest first)
    const fineDiff = (b.fine_exposure || 0) - (a.fine_exposure || 0);
    if (fineDiff !== 0) return fineDiff;
    
    // 3. Expected return date (earliest first)
    const dateA = a.expected_return_date ? new Date(a.expected_return_date) : new Date('9999-12-31');
    const dateB = b.expected_return_date ? new Date(b.expected_return_date) : new Date('9999-12-31');
    return dateA - dateB;
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