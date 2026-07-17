// Format number in Indian style (lakhs, crores) - whole rupees, rounded accurately
export function formatIndianCurrency(num: number): string {
  const n = Math.round(Number(num) || 0);
  const sign = n < 0 ? '-' : '';
  const integer = Math.abs(n).toString();

  let lastThree = integer.substring(integer.length - 3);
  let otherNumbers = integer.substring(0, integer.length - 3);

  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }

  const result = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return sign + result;
}

/** Account names are stored and typed in capital letters by default. */
export function normalizeAccountName(name: string): string {
  return name.trim().toUpperCase();
}

// Format input value while typing to Indian currency format
export function formatInputCurrency(value: string): string {
  let val = value.replace(/,/g, '');
  val = val.replace(/[^0-9]/g, ''); // only digits

  if (val === '') return '';

  const numVal = parseInt(val, 10);
  if (isNaN(numVal)) return '';
  
  // Reuse the formatter logic for string construction
  const integer = numVal.toString();
  let lastThree = integer.substring(integer.length - 3);
  let otherNumbers = integer.substring(0, integer.length - 3);

  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }

  return otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
}

export function parseCurrency(value: string): number {
  return parseInt(value.replace(/,/g, ''), 10) || 0;
}

// Format a Date as YYYY-MM-DD using *local* calendar fields (no UTC shift).
export function formatISODateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Generate array of dates (YYYY-MM-DD) between start and end (inclusive)
// Uses UTC methods to avoid timezone issues when crossing DST or day boundaries locally
export function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  // Loop until current date is after end date
  // Using toISOString().split('T')[0] ensures we compare the YYYY-MM-DD part reliably
  while (current.toISOString().split('T')[0] <= end.toISOString().split('T')[0]) {
    dates.push(current.toISOString().split('T')[0]);
    // Increment day safely in UTC
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

// Format YYYY-MM-DD string to DD-MMM-YYYY (e.g. 12-NOV-2025)
// Safe for display, does not use Date object to avoid timezone shifts on simple date strings
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  const year = parts[0];
  const month = parseInt(parts[1], 10);
  const day = parts[2];
  
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  
  // Safety check
  if (month < 1 || month > 12) return dateStr;
  
  return `${day}-${monthNames[month - 1]}-${year}`;
}

// Helper for formatting Month-Year views (e.g. OCT-2023)
export function formatMonthYear(date: Date): string {
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${month}-${year}`;
}

/** Display phone in short Indian style: 98765 43210 */
export function formatPhoneShort(raw?: string): string {
  if (!raw?.trim()) return '—';
  const digits = raw.replace(/\D/g, '').slice(-10);
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return raw.trim();
}
