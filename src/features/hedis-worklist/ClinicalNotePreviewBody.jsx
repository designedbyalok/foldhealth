import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import {
  MEASURE_NAMES,
  CBP_LOCATIONS,
  CBP_YES_NO,
  CBP_SYMPTOM_OPTIONS,
  EED_EXAM_TYPES,
  EED_EXAM_RESULTS,
  EED_EVIDENCE_TYPES,
  GAP_TEMPLATES,
  MEASURE_CPT,
  LEGACY_GAP_FIELDS,
  savedGapData,
} from './ClinicalNotePanel.utils';
import { contentOf, isFieldVisible } from '../../lib/noteTemplateRules';
import { resolvePerformedByLabel, LOCATION_OPTIONS as DSF_LOCATIONS } from './dsf/DsfEvidenceForms';
import { getItems, getResponseScale, totalScore, isPhq2Positive, phq9Branch, phq9BandLabel } from './dsf/dsfScoring';
import { DSF_CARE_PLANS } from './dsf/dsfCarePlans';
import styles from './ClinicalNotePreviewBody.module.css';
import { openSafeUrl } from '../../lib/openSafeUrl';

// Platform-wide date display is MM/DD/YYYY. Values come off the form as
// either an ISO YYYY-MM-DD string (native <input type="date">) or a Date-
// parseable string; anything else falls back to the raw value so the
// reader still sees SOMETHING rather than a silent "-". Split the ISO
// path manually so timezone doesn't shift the day boundary.
function formatMDY(value) {
  if (value == null || value === '') return value;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/**
 * ClinicalNotePreviewBody: read-only signed-note summary.
 *
 * Rendered inside the CareGapDetailDrawer's left workspace slot when the
 * user clicks the eye affordance on a Signed note. Mirrors Figma
 * 511:105429, sectioned key/value rows plus an Amend affordance that
 * routes back to the editable workspace.
 *
 * The payload it renders is whatever `upsertClinicalNote` persisted for
 * this member/gap: currently `{ dateOfService, audioOnly, audioVideo,
 * gaps: { <code>: <gapState> } }`. Unknown fields are skipped so future
 * form additions surface without touching this component.
 */
export function ClinicalNotePreviewBody({ memberId, gapCode, noteId }) {
  const notes = useAppStore(s => (memberId ? s.clinicalNotesByMember?.[memberId] : null)) || [];
  const note = useMemo(() => (
    // Prefer the exact note the eye affordance opened (noteId); fall back
    // to the freshest note that covers this gap, then to the freshest note
    // tied to this member so a viewer never sees "empty".
    (noteId ? notes.find(n => n.id === noteId) : null)
      || notes.find(n => (n.gapCodes || []).includes(gapCode))
      || notes[0]
      || null
  ), [notes, gapCode, noteId]);

  if (!note) {
    return (
      <div className={styles.emptyBody}>
        <Icon name="solar:notes-linear" size={36} color="var(--neutral-200)" />
        <p className={styles.emptyTitle}>No saved note yet for this gap.</p>
      </div>
    );
  }

  const payload = note.payload || {};
  const gapCodes = (note.gapCodes && note.gapCodes.length ? note.gapCodes : [gapCode]).filter(Boolean);
  const gapsPayload = payload.gaps || {};
  const telehealth = payload.audioOnly ? 'Audio-only visit: Verbal consent obtained.'
    : payload.audioVideo ? 'Audio-video visit: Verbal consent obtained.'
    : '-';
  // Non-Visit Notes carry either a free-form title/body (legacy shape)
  // or a template-driven `{ formId, answers }` shape. Normal Notes use
  // the same template-driven shape but a different formType tag; both
  // render as a flat schema summary here.
  const isNonVisit = note.formType === 'non_visit_note' || note.formType === 'normal_note';
  const templateAnswers = payload.answers && typeof payload.answers === 'object' ? payload.answers : null;
  const templateRow = useAppStore.getState().noteTemplatesById?.[note.formId] || null;
  const templateFields = templateAnswers && Array.isArray(templateRow?.schema?.items)
    ? templateRow.schema.items
    : null;

  if (isNonVisit) {
    return (
      <div className={styles.wrap}>
        {templateFields ? (
          <Section title={templateRow?.name || 'Note'}>
            <NonVisitAnswers fields={templateFields} answers={templateAnswers} />
          </Section>
        ) : (
          <Section title={payload.title || 'Note'}>
            <div className={styles.nonVisitBody}>{payload.body || '-'}</div>
          </Section>
        )}
        {gapCodes.length > 0 && (
          <Section title="Related Care Gaps">
            <div className={styles.nonVisitChipRow}>
              {gapCodes.map(c => (
                <span key={c} className={styles.nonVisitChip}>
                  {c}: {MEASURE_NAMES[c] ?? c}
                </span>
              ))}
            </div>
          </Section>
        )}
        <KV label="Written on" value={formatMDY(payload.dateOfService)} wide />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {/* Title + signer/reviewer subtitle are rendered by the pane header
          in CareGapDetailDrawer: the body focuses on section content only. */}
      <Section title="Date of Service & Telehealth Statement">
        <KV label="DOS" value={formatMDY(payload.dateOfService)} />
        <KV label="Telehealth Statement" value={telehealth} wide />
      </Section>

      {gapCodes.map(code => (
        <Section key={code} title={`${code} - ${MEASURE_NAMES[code] ?? code}`}>
          {code === 'CBP' && <CbpRows data={gapsPayload[code] || {}} />}
          {code === 'EED' && <EedRows data={gapsPayload[code] || {}} />}
          {code === 'DSF-A' && <DsfaRows data={gapsPayload[code] || {}} />}
          {code === 'DSF-B' && <DsfbRows data={gapsPayload[code] || {}} />}
          {code !== 'CBP' && code !== 'EED' && code !== 'DSF-A' && code !== 'DSF-B' && (
            <GenericRows code={code} data={gapsPayload[code] || {}} />
          )}
        </Section>
      ))}

      {(note.uploadedDocuments || []).length > 0 && (
        <Section title="Documents">
          {note.uploadedDocuments.map((doc, i) => (
            <div key={doc.id || i} className={styles.docRow}>
              <Icon name="solar:document-text-linear" size={16} color="var(--neutral-300)" />
              <span className={styles.docName}>{doc.filename || 'Uploaded Document'}</span>
              <button type="button" className={styles.docAction} onClick={() => openSafeUrl(doc.url)}>
                <Icon name="solar:eye-linear" size={16} color="var(--neutral-400)" />
              </button>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>
        {children}
      </div>
    </section>
  );
}

function KV({ label, value, wide, stacked }) {
  const display = value == null || value === '' ? '-' : String(value);
  if (stacked) {
    // Long-form questions (PHQ items) render label above answer so
    // neither has to fight a nowrap constraint. Kept inline in this
    // file so CBP/EED rows keep their compact side-by-side layout.
    return (
      <div className={styles.rowStacked}>
        <span className={styles.rowStackedLabel}>{label}</span>
        <span className={styles.rowStackedValue}>{display}</span>
      </div>
    );
  }
  return (
    <div className={wide ? styles.rowWide : styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowSep}>:</span>
      <span className={styles.rowValue}>{display}</span>
    </div>
  );
}

// Renders template-driven answers for a Non-Visit / Normal note. Each
// field prints as a KV row, using its stored value verbatim; select/
// radio values resolve back to their label from the field descriptor.
function NonVisitAnswers({ fields, answers }) {
  return fields.map((f) => {
    const raw = answers?.[f.key];
    let value = raw;
    if ((f.type === 'select' || f.type === 'radio') && Array.isArray(f.options)) {
      const hit = f.options.find(o => o.value === raw);
      if (hit) value = hit.label;
    } else if (f.type === 'checkbox') {
      value = raw === true ? 'Yes' : raw === false ? 'No' : value;
    } else if (f.type === 'date') {
      value = formatMDY(raw);
    }
    return <KV key={f.key} label={f.label || f.key} value={value} wide />;
  });
}

function GenericRows({ code, data: saved }) {
  const fields = GAP_TEMPLATES[code];
  if (!fields?.length) return <KV label="Evidence" value="-" wide />;
  const data = savedGapData(code, saved) || {};
  const hasAnyValue = fields.some(f => f.type !== 'content' && data[f.key] != null && data[f.key] !== '');
  if (!hasAnyValue) return <LegacyRows data={data} />;
  // Older payload keys the template doesn't cover and that weren't mapped
  // to a new field (e.g. an LSC Screening Date) still show, after the fields.
  const skip = new Set([...fields.map(f => f.key), ...(LEGACY_GAP_FIELDS[code] || []).map(l => l.from)]);
  const extras = Object.fromEntries(Object.entries(saved || {}).filter(([k]) => !skip.has(k)));
  return (
    <>
      {fields.filter(f => isFieldVisible(f, data)).map(f => {
        if (f.type === 'content') {
          const block = contentOf(f, data);
          return <CarePlanBlock key={f.key} title={block.title} bullets={block.bullets || []} />;
        }
        const raw = data[f.key];
        let display;
        if (f.type === 'checkbox') {
          display = f.checkboxLabel ? (raw ? f.checkboxLabel : null) : (raw ? 'Yes' : 'No');
        } else if ((f.type === 'select' || f.type === 'radio') && f.options) {
          display = f.options.find(o => o.value === raw)?.label || raw;
        } else if (f.type === 'date') {
          display = formatMDY(raw);
        } else {
          display = raw !== '' && raw != null && f.unit ? `${raw} ${f.unit}` : raw;
        }
        return <KV key={f.key} label={f.label} value={display} wide={!f.column} />;
      })}
      <LegacyRows data={extras} hideEmpty />
      {MEASURE_CPT[code] && <KV label="CPT Code" value={MEASURE_CPT[code]} wide />}
    </>
  );
}

// A note saved against an earlier version of the template: show whatever
// was stored, labelled from its keys, rather than an empty "-".
function LegacyRows({ data, hideEmpty }) {
  const entries = Object.entries(data || {})
    .filter(([k, v]) => k !== 'evidenceLabel' && k !== 'manuallyOff' && v !== '' && v != null && v !== false && typeof v !== 'object');
  if (!entries.length) return hideEmpty ? null : <KV label="Evidence" value="-" wide />;
  return entries.map(([k, v]) => (
    <KV
      key={k}
      label={k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}
      value={v === true ? 'Yes' : /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? formatMDY(v) : String(v)}
      wide
    />
  ));
}

function CbpRows({ data }) {
  const loc = CBP_LOCATIONS.find(o => o.value === data.location)?.label || data.location;
  const yn = (v) => CBP_YES_NO.find(o => o.value === v)?.label
    || CBP_SYMPTOM_OPTIONS.find(o => o.value === v)?.label
    || (v === 'med-list' ? 'Yes (medications listed)' : v);
  const bp = data.systolic && data.diastolic ? `${data.systolic} / ${data.diastolic} mmHg` : null;
  return (
    <>
      <KV label="Reading recorded Date" value={formatMDY(data.bpDate)} />
      <KV label="Blood Pressure" value={bp} />
      <KV label="Location Type" value={loc} />
      <KV label="Self-monitors BP regularly" value={yn(data.selfMonitors)} wide />
      <KV label="Taking BP meds as prescribed" value={yn(data.takingMeds)} wide />
      <KV label="Symptoms (BP < 100/60)" value={yn(data.symptomsLow)} wide />
      <KV label="Symptoms (BP > 140/90 and < 160/100)" value={yn(data.symptomsMid)} wide />
      <KV label="Symptoms (BP > 160/100)" value={yn(data.symptomsHigh)} wide />
    </>
  );
}

function EedRows({ data }) {
  const examType = EED_EXAM_TYPES.find(o => o.value === data.examType)?.label || data.examType;
  const evidenceType = EED_EVIDENCE_TYPES.includes(data.evidenceType) ? data.evidenceType : data.evidenceType;
  const result = EED_EXAM_RESULTS.includes(data.examResult) ? data.examResult : data.examResult;
  return (
    <>
      <KV label="Evidence Type" value={evidenceType} wide />
      <KV label="Exam Type" value={examType} />
      <KV label="Exam Date" value={formatMDY(data.examDate)} />
      <KV label="Examining Provider" value={data.examiningProvider} />
      <KV label="Exam Result" value={result} />
      <KV label="ICD-10 Diagnosis Code" value={data.icd10} wide />
      <KV label="Follow-up" value={summarizeFollowUp(data.followUp)} wide />
    </>
  );
}

function summarizeFollowUp(followUp) {
  if (!followUp || typeof followUp !== 'object') return null;
  const labels = Object.entries(followUp)
    .filter(([, v]) => v)
    .map(([k]) => FOLLOW_UP_LABEL[k] || k);
  return labels.length ? labels.join(', ') : null;
}

const FOLLOW_UP_LABEL = {
  referOphthalmology: 'Refer to ophthalmology',
  laserTreatment: 'Laser treatment recommended',
  antiVegf: 'Anti-VEGF therapy discussed',
  annualScheduled: 'Annual follow-up scheduled',
};

// DSF-A (PHQ-2). Reads the persisted `location`, `performedBy`, and
// nested `phq2 { item1, item2, savedAt }` and prints the per-item answer
// alongside the total + Positive/Negative label so a reviewer can audit
// scoring without re-opening the note for edit.
function DsfaRows({ data }) {
  const users = useAppStore(s => s.platformUsers);
  const loc = DSF_LOCATIONS.find(o => o.value === data.location)?.label || data.location;
  const provider = resolvePerformedByLabel(data.performedBy, users);
  const phq2 = data.phq2 || {};
  const items = getItems('phq2');
  const scale = getResponseScale('phq2');
  const answerLabel = (v) => (v == null ? '-' : scale.find(o => o.score === Number(v))?.value ?? String(v));
  const values = [phq2.item1, phq2.item2];
  const total = totalScore(values);
  const scoreLine = total === null
    ? null
    : `${total} point${total === 1 ? '' : 's'} (${isPhq2Positive(total) ? 'Positive for Depression' : 'Negative for Depression'})`;
  return (
    <>
      <KV label="Location" value={loc} />
      <KV label="Performed by" value={provider} />
      {/* The DSF-A section header already reads "DSF-A - Depression
          Screening (PHQ-2)", so prefixing every question row with
          "PHQ-2 · " is noise. Same treatment for PHQ-9 below. */}
      {items.map((it, i) => (
        <KV key={i} label={it.text || `Q${i + 1}`} value={answerLabel(values[i])} stacked />
      ))}
      <KV label="PHQ-2 Score" value={scoreLine} wide />
      {/* DSF-A owns the phq2Negative care plan when the score isn't
          Positive; a Positive PHQ-2 hands the plan to DSF-B, so DSF-A
          doesn't render a duplicate care plan here. Decline on DSF-A
          swaps in the decline plan, matching the edit surface. */}
      {(() => {
        const planKey = data.decline
          ? 'decline'
          : (total !== null && !isPhq2Positive(total))
            ? 'phq2Negative'
            : null;
        return planKey ? (
          <CarePlanBlock
            title={DSF_CARE_PLANS[planKey].title}
            bullets={DSF_CARE_PLANS[planKey].bullets}
            outreachNotes={data.carePlan?.outreachNotes}
          />
        ) : null;
      })()}
      <KV label="Decline follow-up" value={data.decline ? 'Yes' : 'No'} wide />
    </>
  );
}

// DSF-B (PHQ-9). Mirrors DsfaRows: visit fields (only when the note
// wasn't already carrying them via DSF-A), all 9 answers, total + band,
// the Mild sub-question when it applies, care-plan ack + outreach notes,
// and the standing Decline follow-up flag.
function DsfbRows({ data }) {
  const users = useAppStore(s => s.platformUsers);
  const loc = DSF_LOCATIONS.find(o => o.value === data.location)?.label || data.location;
  const provider = resolvePerformedByLabel(data.performedBy, users);
  const items = getItems('phq9');
  const scale = getResponseScale('phq9');
  const answerLabel = (v) => (v == null ? '-' : scale.find(o => o.score === Number(v))?.value ?? String(v));
  const values = data.phq9?.items || [];
  const total = totalScore(values.length === 9 ? values : []);
  const bandLabel = total === null ? null : phq9BandLabel(phq9Branch(total));
  const scoreLine = total === null ? null : `${total} point${total === 1 ? '' : 's'}${bandLabel ? ` (${bandLabel})` : ''}`;
  const subMild = data.phq9?.subMildAnswer;
  const outreachNotes = data.carePlan?.outreachNotes;
  return (
    <>
      {data.location && <KV label="Location" value={loc} />}
      {data.performedBy && <KV label="Performed by" value={provider} />}
      {items.map((it, i) => (
        <KV key={i} label={it.text || `Q${i + 1}`} value={answerLabel(values[i])} stacked />
      ))}
      <KV label="PHQ-9 Score" value={scoreLine} wide />
      {subMild && (
        <KV
          label="Mild follow-up · Prior episode or symptoms > 3 mo"
          value={subMild === 'yes' ? 'Yes' : 'No'}
          wide
        />
      )}
      {/* Care Plan surfaces once the score is committed AND a branch
          resolves: decline always wins, then the band-driven plan
          picks up. Outreach Notes render inside the panel (not as a
          separate KV) so the reviewer reads the plan and its notes as
          a single unit, matching the edit surface. */}
      {(() => {
        let planKey = null;
        if (data.decline) planKey = 'decline';
        else if (data.phq9?.savedAt && total !== null) {
          const branch = phq9Branch(total);
          if (branch === 'minimal') planKey = 'phq9Minimal';
          else if (branch === 'mild' && subMild === 'yes') planKey = 'phq9MildYes';
          else if (branch === 'mild' && subMild === 'no') planKey = 'phq9MildNo';
          else if (branch === 'moderate') planKey = 'phq9Moderate';
          else if (branch === 'severe') planKey = 'phq9Severe';
        }
        return planKey ? (
          <CarePlanBlock
            title={DSF_CARE_PLANS[planKey].title}
            bullets={DSF_CARE_PLANS[planKey].bullets}
            outreachNotes={outreachNotes}
          />
        ) : (
          outreachNotes ? <KV label="Outreach Notes" value={outreachNotes} wide /> : null
        );
      })()}
      <KV label="Decline follow-up" value={data.decline ? 'Yes' : 'No'} wide />
    </>
  );
}

// Boxed care-plan block used in the DSF read-only preview. Mirrors the
// edit surface's CarePlanOutcomePanel (title + disc-marker bullets +
// optional outreach notes) so a reviewer sees the recommended plan and
// any per-encounter notes as one unit, without having to switch to the
// editable workspace to check what was saved.
function CarePlanBlock({ title, bullets, outreachNotes }) {
  return (
    <div className={styles.carePlanBlock}>
      <div className={styles.carePlanBlockTitle}>{title}</div>
      <ul className={styles.carePlanBlockBullets}>
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
      {outreachNotes && (
        <div className={styles.carePlanBlockOutreach}>
          <span className={styles.carePlanBlockOutreachLabel}>Outreach Notes</span>
          <span className={styles.carePlanBlockOutreachValue}>{outreachNotes}</span>
        </div>
      )}
    </div>
  );
}

