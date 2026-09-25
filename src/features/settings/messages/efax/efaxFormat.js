// US fax numbers: stored and shown as "(619) 555-1234".
export const efaxDigits = (s) => String(s || '').replace(/\D/g, '');

export function formatEfaxNumber(input) {
  let d = efaxDigits(input);
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export const isValidEfaxNumber = (s) => efaxDigits(s).length === 10;
