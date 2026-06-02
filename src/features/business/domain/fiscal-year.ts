export function fiscalPeriodDates(fiscalYear: number, fiscalYearStart: number): { startsOn: Date; endsOn: Date; name: string } {
  const startMonthIndex = fiscalYearStart - 1;
  const startYear = fiscalYearStart === 1 ? fiscalYear : fiscalYear - 1;
  const startsOn = new Date(Date.UTC(startYear, startMonthIndex, 1));
  const nextPeriodStart = new Date(Date.UTC(startYear + 1, startMonthIndex, 1));
  const endsOn = new Date(nextPeriodStart.getTime() - 24 * 60 * 60 * 1000);
  const name = fiscalYearStart === 1 ? String(fiscalYear) : startYear + "/" + fiscalYear;
  return { startsOn, endsOn, name };
}
