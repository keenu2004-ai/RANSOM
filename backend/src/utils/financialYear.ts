/**
 * Financial Year Utility (Indian FY: 1 April -> 31 March)
 */

export interface FinancialYearPeriod {
  startYear: number;
  endYear: number;
  label: string; // e.g., "FY 2026-27"
  startDate: string; // "2026-04-01"
  endDate: string; // "2027-03-31"
  displayRange: string; // "Apr 1, 2026 – Mar 31, 2027"
}

export function getCurrentFinancialYearStartYear(referenceDate: Date = new Date()): number {
  const month = referenceDate.getMonth() + 1; // 1-indexed (Jan = 1, Apr = 4)
  const year = referenceDate.getFullYear();
  return month >= 4 ? year : year - 1;
}

export function getFinancialYearPeriod(startYearInput?: number | string): FinancialYearPeriod {
  const startYear = startYearInput ? parseInt(String(startYearInput), 10) : getCurrentFinancialYearStartYear();
  const endYear = startYear + 1;
  const shortEnd = String(endYear).slice(-2);

  const startDate = `${startYear}-04-01`;
  const endDate = `${endYear}-03-31`;

  const label = `FY ${startYear}–${shortEnd}`;
  const displayRange = `Apr 1, ${startYear} – Mar 31, ${endYear}`;

  return {
    startYear,
    endYear,
    label,
    startDate,
    endDate,
    displayRange
  };
}

export function getFinancialYearMonths(startYear: number): { key: string; label: string; monthIndex: number; year: number }[] {
  const months = [
    { key: 'Apr', label: 'Apr', monthIndex: 4, year: startYear },
    { key: 'May', label: 'May', monthIndex: 5, year: startYear },
    { key: 'Jun', label: 'Jun', monthIndex: 6, year: startYear },
    { key: 'Jul', label: 'Jul', monthIndex: 7, year: startYear },
    { key: 'Aug', label: 'Aug', monthIndex: 8, year: startYear },
    { key: 'Sep', label: 'Sep', monthIndex: 9, year: startYear },
    { key: 'Oct', label: 'Oct', monthIndex: 10, year: startYear },
    { key: 'Nov', label: 'Nov', monthIndex: 11, year: startYear },
    { key: 'Dec', label: 'Dec', monthIndex: 12, year: startYear },
    { key: 'Jan', label: 'Jan', monthIndex: 1, year: startYear + 1 },
    { key: 'Feb', label: 'Feb', monthIndex: 2, year: startYear + 1 },
    { key: 'Mar', label: 'Mar', monthIndex: 3, year: startYear + 1 }
  ];
  return months;
}
