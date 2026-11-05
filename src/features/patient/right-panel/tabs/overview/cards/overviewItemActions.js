// Pure helpers for Overview row clicks. The cards own the drawers; this
// only decides which record a row points at and the shape that drawer expects.

const STOP_WORDS = new Set(['the', 'and', 'from', 'with', 'for', 'visit', 'flagged', 'last', 'this', 'that', 'was']);

export function findWorklistMember(members, patient) {
  if (!patient || !members?.length) return null;
  const ids = new Set([patient.id, patient.memberId, patient.patientId]
    .filter(v => v != null && v !== '')
    .map(String));
  const name = patient.name ? String(patient.name).trim().toLowerCase() : '';
  return members.find((m) => {
    if (!m) return false;
    const mids = [m.id, m.memberId, m.patientId, m.patient_id]
      .filter(v => v != null && v !== '')
      .map(String);
    if (mids.some(id => ids.has(id))) return true;
    return !!name && String(m.name || '').trim().toLowerCase() === name;
  }) || null;
}

// ICD-10 token (E11.65). HCC labels like "HCC 37" do not match.
export function icdFromText(text) {
  const match = String(text || '').match(/\b([A-TV-Z]\d{2}(?:\.[0-9A-Z]{1,4})?)\b/);
  return match ? match[1] : null;
}

// ScheduleDrawer stores and displays dates as MM-DD-YYYY.
export function toDrawerDate(date) {
  const s = String(date || '').trim();
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}-${slash[3]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[2]}-${iso[3]}-${iso[1]}`;
  const dashed = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashed) return `${dashed[1].padStart(2, '0')}-${dashed[2].padStart(2, '0')}-${dashed[3]}`;
  return s;
}

export function toDrawerTime(time) {
  return String(time || '').trim().replace(/\b(AM|PM)\b/g, m => m.toLowerCase());
}

// Prefer the calendar row (it has an id, so status and edits persist).
// Banner appointments without a match still open, as a view of that visit.
export function appointmentForDrawer(banner, { patientId, patientName, appointments } = {}) {
  const date = toDrawerDate(banner?.date);
  const type = String(banner?.type || '').trim().toLowerCase();
  const time = toDrawerTime(banner?.time);
  const stored = (appointments || []).find((row) => {
    if (patientId && row.patient_id && String(row.patient_id) !== String(patientId)) return false;
    if (type && String(row.appointment_type_name || '').trim().toLowerCase() !== type) return false;
    if (date && toDrawerDate(row.date) !== date) return false;
    const rowTime = toDrawerTime(row.time_start);
    if (time && rowTime && rowTime !== time) return false;
    return true;
  });
  if (stored) return stored;
  return {
    patient_id: patientId || null,
    patient_name: patientName || '',
    appointment_type_name: banner?.type || '',
    date,
    time_start: time,
    primary_user: banner?.provider || '',
    reason_for_visit: banner?.program || '',
    status: banner?.status || 'Scheduled',
  };
}

export function gapForHighlight(highlight, gaps) {
  const words = (String(highlight?.title || '').toLowerCase().match(/[a-z][a-z0-9]{2,}/g) || [])
    .filter(w => !STOP_WORDS.has(w));
  if (!words.length) return null;
  return (gaps || []).find((g) => {
    const hay = `${g.title || ''} ${g.code || ''} ${g.detail || ''}`.toLowerCase();
    return words.some(w => hay.includes(w));
  }) || null;
}

export function openOverviewGap(gap, ctx) {
  if (!gap) return false;
  if (gap.category === 'hcc') {
    if (ctx.hccLoading) {
      ctx.showToast?.('Diagnosis gaps are still loading');
      return false;
    }
    const member = findWorklistMember(ctx.hccMembers, ctx.patient);
    if (!member) {
      ctx.showToast?.("This patient isn't on the HCC worklist");
      return false;
    }
    const code = icdFromText(`${gap.title || ''} ${gap.detail || ''}`) || icdFromText(gap.code);
    ctx.openDiagPanel?.(member.id, code ? { highlightCode: code } : {});
    return true;
  }
  if (ctx.hedisLoading) {
    ctx.showToast?.('Care gaps are still loading');
    return false;
  }
  const member = findWorklistMember(ctx.hedisMembers, ctx.patient);
  const gapCode = String(gap.code || '').split(/\s|\u2014|-/)[0].trim();
  if (!member || !gapCode) {
    ctx.showToast?.("This care gap isn't on the HEDIS worklist");
    return false;
  }
  ctx.setCareGap?.({ member, gapCode, year: new Date().getFullYear() });
  return true;
}
