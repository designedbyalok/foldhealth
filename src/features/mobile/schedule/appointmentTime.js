// Appointments store `date` as MM-DD-YYYY and times as "8:30 am".

export function appointmentStart(appt) {
  return toDate(appt?.date, appt?.time_start);
}

export function appointmentEnd(appt) {
  return toDate(appt?.date, appt?.time_end);
}

function toDate(dateStr, timeStr) {
  if (!dateStr) return null;
  const [mo, dd, yyyy] = String(dateStr).split('-').map(Number);
  if (!mo || !dd || !yyyy) return null;
  const m = String(timeStr || '').match(/(\d+):(\d+)\s*(am|pm)/i);
  let h = m ? Number(m[1]) : 0;
  const min = m ? Number(m[2]) : 0;
  if (m) {
    const pm = m[3].toLowerCase() === 'pm';
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  return new Date(yyyy, mo - 1, dd, h, min);
}

/** A Date as the appointments table's MM-DD-YYYY. */
export function toApptDate(d) {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
}
