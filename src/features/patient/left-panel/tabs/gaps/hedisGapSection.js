import { STATUS_BADGE_VARIANT } from '../../../../hedis-worklist/HedisWorklistRow';
import { MEASURE_NAMES } from '../../../../hedis-worklist/ClinicalNotePanel.utils';
import { gapInstanceNo } from '../../../../hedis-worklist/gapInstances';
import { evidenceSummary, gapEvidence } from '../../../../hedis-worklist/gapEvidence';

// A HEDIS patient's real gaps as a CareGapSection: one row per gap, the
// latest instance. A gap added more than once keeps its other instances in
// `previous`, which expand under it on demand. Instances are numbered oldest
// first, the same way the worklist and Care Gap Details number them. Shared
// by the patient's Gaps widget and the care program Care Gaps step.
// `evidenceSources` (useGapEvidenceSources) adds, under each completed or
// closed instance, what closed it.
const isClosed = (status) => status === 'Completed' || String(status || '').startsWith('Closed');

export function hedisGapSection(member, evidenceSources) {
  const gaps = member?.gaps || [];
  if (!gaps.length) return null;
  const gapItem = (g, i) => {
    const no = gapInstanceNo(gaps, g);
    return {
      id: `hedis-${g.code}-${i}`,
      code: g.code,
      title: `${g.code} - ${MEASURE_NAMES[g.code] || g.code}`,
      status: g.status,
      statusVariant: STATUS_BADGE_VARIANT[g.status] || 'neutral',
      // Measurement year: stamped on gaps added in Fold, else the start year.
      year: g.measureYear ? String(g.measureYear) : (String(g.startDate || '').match(/\d{4}$/)?.[0] || ''),
      diagnosis: [
        no ? `Instance ${no}` : null,
        g.startDate ? `Opened ${g.startDate}` : null,
        g.closedDate ? `Closed ${g.closedDate}` : null,
      ].filter(Boolean).join(' • '),
      openInstanceNo: g.supersededAt ? no : null,
      evidence: isClosed(g.status) && evidenceSources ? evidenceSummary(gapEvidence(g, evidenceSources)) : '',
    };
  };
  const indexed = gaps.map((g, i) => ({ g, i }));
  const activeCodes = new Set(indexed.filter(({ g }) => !g.supersededAt).map(({ g }) => g.code));
  return {
    title: 'HEDIS Measures',
    items: indexed
      // A superseded gap only stands on its own if its measure has no open one.
      .filter(({ g }) => !g.supersededAt || !activeCodes.has(g.code))
      .map(({ g, i }) => ({
        ...gapItem(g, i),
        previous: g.supersededAt ? [] : indexed
          .filter(x => x.g.code === g.code && x.g.supersededAt)
          .map(x => gapItem(x.g, x.i)),
      })),
  };
}

// The HEDIS worklist row for a patient, matched by id, member id or name.
export function findHedisMember(hedisMembers, patientId, patientName) {
  return (hedisMembers || []).find(m => m
    && (m.id === patientId || (patientId != null && String(m.memberId) === String(patientId))
      || m.patientId === patientId || (patientName && m.name === patientName))) || null;
}
