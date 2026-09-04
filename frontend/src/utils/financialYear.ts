/**
 * Frontend Indian Financial Year Utility (1 April -> 31 March)
 */

export interface FinancialYearPeriod {
  startYear: number;
  endYear: number;
  label: string; // e.g. "FY 2026 – 27"
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

  const label = `FY ${startYear} – ${shortEnd}`;
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
