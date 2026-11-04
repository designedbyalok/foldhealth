// DSF-A (PHQ-2) and DSF-B (PHQ-9) evidence forms: bespoke measure
// components rendered by the same three CareGapDetail dispatch sites
// that already wire EED / CBP / templated gaps. They plug into the
// existing consolidated Clinical Note engine (`useClinicalNotePanel`)
// via `v.updateGap(code, patch)` and `v.gapState[code]`, no new drawer
// state to plumb through.
//
// Scoring, item text, and interpretation cutoffs are read from the
// shared validated-instruments module through ./dsfScoring so the
// clinical content stays in one source of truth. Verbatim care-plan
// bullets come from ./dsfCarePlans.
import { useEffect, useMemo } from 'react';
// (No side effects here: derived flags like carePlanAcknowledged are
// computed on the read side inside isMandatoryComplete instead of being
// mirrored into the payload.)
import { Banner } from '../../../components/Banner/Banner';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { CheckboxTick } from '../../../components/CheckboxTick/CheckboxTick';
import { Select } from '../../../components/Select/Select';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { useAppStore } from '../../../store/useAppStore';
import { getItems, getResponseScale, isPhq2Positive, phq9Branch, phq9BandLabel, totalScore } from './dsfScoring';
import { DSF_CARE_PLANS } from './dsfCarePlans';
import styles from './DsfEvidenceForms.module.css';

// "Performed by" option row: Avatar + name + clinical role stacked
// beneath, so the dropdown reads the same way as every other people-
// picker in the app.
function PerformedByRow({ initials, name, role }) {
  return (
    <span className={styles.performedByOption}>
      {/* Radio glyph inherits its checked style from the option's
          aria-selected attribute (set by Select on the active row) so
          the picker doesn't need to thread a "selected" prop down. */}
      <span aria-hidden="true" className={styles.performedByRadio} />
      <Avatar variant="staff" size="XS" initials={initials || (name || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()} />
      <span className={styles.performedByText}>
        <span className={styles.performedByName}>{name}</span>
        {role && <span className={styles.performedByRole}>{role}</span>}
      </span>
    </span>
  );
}

// Trigger-only render for the selected user. The dropdown's stacked
// two-line row doesn't fit the trigger's single-line control (the
// role wrapped onto its own line beneath the name and pushed the
// select outline down). Collapse it into "Name (Role)" so the
// selected value reads as one line while the picker options keep
// their richer stacked layout.
function PerformedByTrigger({ initials, name, role }) {
  return (
    <span className={styles.performedByOption}>
      <Avatar variant="staff" size="XS" initials={initials || (name || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()} />
      <span className={styles.performedByTrigger}>
        <span className={styles.performedByName}>{name}</span>
        {role && <span className={styles.performedByRoleInline}>({role})</span>}
      </span>
    </span>
  );
}

// "Performed by" is the real system-user roster from platformUsers
// (Supabase `profiles`). Fetched once per session via
// fetchPlatformUsers; a per-caller useEffect kicks it off when this
// form mounts so a fresh drawer doesn't render an empty select.
//
// When `selectedValue` matches a user, that user is pinned to the top
// of the list with a hairline separator underneath (a Select header
// row with an empty label), and the rest of the roster follows in its
// original order. Keeps the current pick reachable without scrolling
// on a long roster.
function usePerformedByOptions(selectedValue) {
  const users = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);
  const buildOption = (u) => {
    const role = (u.clinicalRoles || []).join(', ');
    return {
      value: u.id,
      label: <PerformedByRow initials={u.initials} name={u.name} role={role} />,
      // Compact trigger render: the stacked row breaks the single-
      // line Select control, so the selected value collapses to
      // "Name (Role)" inline. Dropdown options still use `label`
      // (stacked) via Select's triggerLabel-then-label fallback.
      triggerLabel: <PerformedByTrigger initials={u.initials} name={u.name} role={role} />,
      // Plain-text alias so Select's client-side search matches on
      // both the user's name and their clinical role.
      searchText: `${u.name} ${role}`.trim(),
    };
  };
  return useMemo(() => {
    const roster = users || [];
    const selectedUser = selectedValue
      ? roster.find(u => String(u.id) === String(selectedValue))
      : null;
    if (!selectedUser) return roster.map(buildOption);
    const rest = roster.filter(u => u !== selectedUser).map(buildOption);
    return [
      buildOption(selectedUser),
      // Empty-label header row → hairline separator via Select's
      // .groupHeader border-top. `value` must be unique among options
      // so React's list key stays stable.
      { type: 'header', value: '__performed-by-divider', label: '' },
      ...rest,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, selectedValue]);
}

// Look up a stored `performedBy` value against the live platformUsers
// so signed / submitted notes render the human name. Falls back to the
// raw value (typically the user id) so an unresolved lookup is visible
// rather than blank.
export function resolvePerformedByLabel(value, users) {
  if (!value) return '';
  const hit = (users || []).find(u => String(u.id) === String(value));
  return hit?.name || String(value);
}

export const LOCATION_OPTIONS = [
  { value: 'telehealth', label: 'Telehealth visit' },
  { value: 'home',       label: 'Home' },
];

// ── Shared primitives ────────────────────────────────────────────────

function FieldStack({ children }) {
  return <div className={styles.fieldStack}>{children}</div>;
}
function FieldLabel({ children, required }) {
  return (
    <div className={styles.fieldLabel}>
      {children}
      {required && <span className={styles.required}>•</span>}
    </div>
  );
}
function FieldError({ children }) {
  return <div className={styles.fieldError}>{children}</div>;
}

// PHQ-style questionnaire: each question is a numbered heading with
// its response options stacked vertically underneath. The parent owns
// state; this component just reads/writes an array of numbers. Point
// values are intentionally hidden from the option labels, the score
// interpretation lives in the summary card below the questionnaire.
function LikertMatrix({ scoreKey, values, onChange, locked }) {
  const items = getItems(scoreKey);
  const scale = getResponseScale(scoreKey);
  const setAt = (idx, val) => {
    if (locked) return;
    const next = Array.isArray(values) ? [...values] : items.map(() => null);
    next[idx] = val;
    onChange(next);
  };
  return (
    <div className={[styles.questionnaire, locked ? styles.questionnaireLocked : ''].filter(Boolean).join(' ')}>
      {items.map((item, idx) => (
        <div key={item.code} className={styles.questionBlock}>
          <div className={styles.questionText}>
            <span className={styles.questionNumber}>{idx + 1}.</span>
            {item.text}
          </div>
          <div className={styles.optionStack}>
            {scale.map(opt => (
              <RadioButton
                key={opt.score}
                checked={values?.[idx] === opt.score}
                onChange={() => setAt(idx, opt.score)}
                label={opt.value}
                disabled={locked}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// The Care Plan outcome panel: reused for every DSF branch. The
// bulleted body is static clinical guidance the reviewer follows in
// the encounter; commit lives on the note-level Sign & Save (and the
// PHQ-2 / PHQ-9 Save Score on their own cards). No per-panel checkbox,
// an all-or-nothing tick on top of static reference text reads as
// clickwrap rather than a real attestation. Optional Outreach Notes
// textarea captures any per-encounter commentary.
function CarePlanOutcomePanel({ title, bullets, outreachNotes, onOutreachNotesChange }) {
  return (
    <div className={styles.carePlanPanel}>
      <div className={styles.carePlanTitle}>{title}</div>
      <ul className={styles.carePlanBullets}>
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
      <div className={styles.carePlanFooter}>
        <Textarea
          title="Outreach Notes"
          value={outreachNotes || ''}
          onValueChange={(text) => onOutreachNotesChange(text)}
          placeholder="Optional notes from the encounter..."
          rows={3}
        />
      </div>
    </div>
  );
}

// ── DSF-A (PHQ-2) ───────────────────────────────────────────────────

export function DsfaEvidenceForm({ v, data, submitted, onOpenPhq9Gap }) {
  // Reviewer flow (opened from a sign-off task) is strictly read-only:
  // no updateGap writes, radios/select locked, author-only affordances
  // (Save Score, success bar) hidden. Author flows keep
  // the full interactive surface.
  const readOnly = !!v.isReviewFlow;
  const onUpdate = readOnly ? () => {} : (patch) => v.updateGap('DSF-A', patch);
  const err = (field) => submitted && !data[field];
  const performedByOptions = usePerformedByOptions(data.performedBy);
  const phq2Values = useMemo(() => {
    const items = getItems('phq2');
    const stored = data.phq2 || {};
    return items.map((_, i) => stored[`item${i + 1}`] ?? null);
  }, [data.phq2]);
  const isHome = data.location === 'home';
  // Consent lives on the note-level shared DOS card (v.audioOnly /
  // v.audioVideo). We surface a hint in this form when Location is
  // Telehealth and neither box is ticked, but the checkboxes themselves
  // are NOT re-rendered here (the shared DOS card owns them).
  const consentSatisfied = isHome || !!v.audioOnly || !!v.audioVideo;
  const bothPhq2Answered = phq2Values.every(v2 => v2 !== null && v2 !== undefined);
  // DSF-A is only locked once THIS note has committed a Save on a
  // Positive PHQ-2 (which is also the moment DSF-B is created). A
  // fresh note starts unlocked regardless of whether DSF-B may exist
  // for the member from an earlier flow, and Negative scoring keeps
  // the form editable forever (no save step, no lock).
  const phq2Saved = !!data.phq2?.savedAt;
  // Prefer the persisted totalScore / outcome once saved so the badge
  // survives a re-open even if items hydrate late. Recompute live
  // otherwise.
  const liveTotalPhq2 = totalScore(phq2Values);
  const phq2Total = phq2Saved && typeof data.phq2?.totalScore === 'number'
    ? data.phq2.totalScore
    : liveTotalPhq2;
  const positive = phq2Saved && data.phq2?.outcome
    ? data.phq2.outcome === 'positive'
    : isPhq2Positive(phq2Total);

  // Positive PHQ-2 gates DSF-B creation on an explicit Save click so a
  // mis-tick at 3 points doesn't spawn a gap. Negative flows show the
  // wellness care plan inline without a Save step.
  const handleSavePhq2Score = () => {
    if (!bothPhq2Answered || !positive || phq2Saved) return;
    const savedAt = new Date().toISOString();
    const nextPhq2 = {
      ...(data.phq2 || {}),
      totalScore: phq2Total,
      outcome: positive ? 'positive' : 'negative',
      savedAt,
    };
    // Save locks PHQ-2, stamps the score + outcome for durable reads
    // on re-open, marks DSF-A Ready for Review (so the note picker
    // includes it automatically), and opens the linked DSF-B gap.
    onUpdate({ phq2: nextPhq2, manuallyOff: false });
    if (typeof onOpenPhq9Gap === 'function') {
      // Hand the fresh phq2 through so openDsfbGap can persist the
      // draft immediately. Reading it from the hook's gapState here
      // would come back stale (onUpdate's setState hasn't flushed yet).
      onOpenPhq9Gap({ savedAt, phq2: nextPhq2 });
    }
  };

  return (
    <div className={styles.form}>
      {/* EHR-sync info banner lives on the left pane's NoteContextPane;
          no duplicate needed on the evidence side. */}
      <FieldStack>
        <FieldLabel required>Location</FieldLabel>
        <div className={styles.radioStack}>
          {LOCATION_OPTIONS.map(opt => (
            <RadioButton
              key={opt.value}
              checked={data.location === opt.value}
              onChange={() => onUpdate({ location: opt.value })}
              label={opt.label}
              disabled={readOnly}
            />
          ))}
        </div>
        {err('location') && <FieldError>Location is required</FieldError>}
      </FieldStack>

      {data.location === 'telehealth' && !consentSatisfied && submitted && (
        <Banner
          variant="outline"
          tone="warning"
        >
          Verbal telehealth consent required. Tick Audio-only or Audio-video visit in the Date of Service card above.
        </Banner>
      )}

      <FieldStack>
        <FieldLabel required>Performed by</FieldLabel>
        <Select
          options={performedByOptions}
          value={data.performedBy}
          onValueChange={(v2) => onUpdate({ performedBy: v2 })}
          placeholder="Select Provider"
          searchable
          searchPlaceholder="Search users…"
          invalid={err('performedBy')}
          disabled={readOnly}
        />
        {err('performedBy') && <FieldError>Provider is required</FieldError>}
      </FieldStack>

      <div className={styles.phq2Card}>
        <div className={styles.phq2CardHeader}>
          <div className={styles.fieldLabel}>Depression Screening : PHQ-2<span className={styles.required}>•</span></div>
        </div>
        <LikertMatrix
          scoreKey="phq2"
          values={phq2Values}
          onChange={(next) => onUpdate({
            phq2: { ...(data.phq2 || {}), item1: next[0], item2: next[1] },
          })}
          locked={phq2Saved || readOnly}
        />
        {/* Footer row surfaces once both PHQ-2 items are answered:
              • Positive + !saved → Save Score button + live badge.
              • Positive + saved  → badge only (Save is replaced by the
                success info bar below).
              • Negative          → badge only (no explicit save step,
                Negative auto-completes without a gap).
            The scoring-bands info tooltip sits inside the badge itself
            so band context anchors to where the score is read. */}
        {(bothPhq2Answered || phq2Saved) && (
          <div className={styles.phq2CardFooter}>
            {positive && !phq2Saved && !readOnly && (
              <Button
                leadingIcon="solar:check-circle-linear"
                onClick={handleSavePhq2Score}
              >
                Save score
              </Button>
            )}
            <Badge
              tone={positive ? 'warning' : 'success'}
              size="md"
              label={`Score : ${phq2Total} Point${phq2Total === 1 ? '' : 's'} (${positive ? 'Positive for Depression' : 'Negative for Depression'})`}
              trailingIconElement={
                <Tooltip
                  variant="light"
                  maxWidth={240}
                  label={
                    <div className={styles.scoreLegend}>
                      <div className={styles.scoreLegendTitle}>PHQ-2 scoring bands</div>
                      <ul className={styles.scoreLegendList}>
                        <li><strong>0–2</strong> Negative for Depression</li>
                        <li><strong>3–6</strong> Positive for Depression</li>
                      </ul>
                    </div>
                  }
                >
                  <span className={styles.scoreBadgeInfo} aria-label="PHQ-2 scoring bands">
                    <Icon name="solar:info-circle-linear" size={14} color="currentColor" />
                  </span>
                </Tooltip>
              }
            />
          </div>
        )}
        {bothPhq2Answered && positive && !phq2Saved && !readOnly && (
          <Banner className={styles.phq2InfoBarAttached}>
            Saving this score opens the DSF-B gap for this patient. Once saved, DSF-A cannot be edited.
          </Banner>
        )}
        {/* Saving a Positive score promotes straight to the consolidated
            note with DSF-B stacked below, so there is no jump button. */}
        {phq2Saved && !readOnly && (
          <Banner
            className={styles.phq2InfoBarAttached}
            tone="success"
            icon="solar:check-circle-linear"
          >
            Score saved, DSF-A locked and DSF-B is created.
          </Banner>
        )}
      </div>

      {bothPhq2Answered && !positive && (
        <CarePlanOutcomePanel
          title={DSF_CARE_PLANS.phq2Negative.title}
          bullets={DSF_CARE_PLANS.phq2Negative.bullets}
          outreachNotes={data.carePlan?.outreachNotes}
          onOutreachNotesChange={(next) => onUpdate({
            carePlan: { ...(data.carePlan || {}), outreachNotes: next },
          })}
        />
      )}
    </div>
  );
}

// ── DSF-B (PHQ-9) ───────────────────────────────────────────────────

export function DsfbEvidenceForm({ v, data, submitted }) {
  // Reviewer flow (opened from a sign-off task) is strictly read-only.
  // updateGap becomes a no-op, radios/select/matrix lock, Save Score
  // and its info bars hide. Author flows are unchanged.
  const readOnly = !!v.isReviewFlow;
  const onUpdate = readOnly ? () => {} : (patch) => v.updateGap('DSF-B', patch);
  const err = (field) => submitted && !data[field];
  const performedByOptions = usePerformedByOptions(data.performedBy);
  // When the note has no paired DSF-A, DSF-B is standalone, the
  // reviewer completed the PHQ-2 virtually and skipped creating the
  // Depression Screening care program. DSF-B has to collect its own
  // Location + Performed by; the paired flow keeps inheriting them
  // from the DSF-A carrier.
  const hasPairedDsfA = !!v.activeGaps?.some(g => g.code === 'DSF-A');
  const phq9Values = data.phq9?.items || [null, null, null, null, null, null, null, null, null];
  const allAnswered = phq9Values.every(v2 => v2 !== null && v2 !== undefined);
  // Always recompute from the current items, falling back to a stored
  // Save Score gate: mirrors the PHQ-2 pattern. Users answer all 9
  // items, then commit the score via an explicit Save Score button.
  // Save stamps `savedAt` (feeds the 30-day due-date math), locks the
  // Likert matrix, and reveals the band's care plan below.
  const phq9Saved = !!data.phq9?.savedAt;
  // Score + band are authoritative from the persisted payload once
  // the note has been saved: the frozen totalScore / band survive
  // re-opens even if items happen to hydrate late, and match the row
  // the review sign-off will commit. While the user is still editing
  // (pre-save) recompute live from the items array so the badge
  // reflects each radio click.
  const liveTotal = totalScore(phq9Values);
  const liveBranch = phq9Branch(liveTotal);
  const phq9Total = phq9Saved && typeof data.phq9?.totalScore === 'number'
    ? data.phq9.totalScore
    : liveTotal;
  const branch = phq9Saved && data.phq9?.band
    ? data.phq9.band
    : liveBranch;
  // Reference vocabulary: see dsfScoring.phq9BandLabel. Renders as
  // "Minimal / None", "Mild", "Moderate", "Severe" so the DSF-B Badge
  // reads the same as the clinical scoring reference sheet.
  const bandLabel = phq9BandLabel(branch);
  const bandTone = branch === 'minimal' ? 'success'
    : branch === 'mild' ? 'warning'
    : branch === 'moderate' ? 'secondary'
    : branch === 'severe' ? 'danger'
    : 'neutral';
  // Save requires: all 9 items answered, not already saved, not
  // declined. Mild bands' sub-question stays available before AND after
  // save; the care plan panel below only surfaces once both the score
  // is saved AND the sub-question is answered.
  const canSavePhq9 = allAnswered && !phq9Saved && !data.decline;
  const handleSavePhq9Score = () => {
    if (!canSavePhq9) return;
    onUpdate({
      phq9: {
        ...(data.phq9 || {}),
        totalScore: phq9Total,
        band: branch,
        savedAt: new Date().toISOString(),
      },
      manuallyOff: false,
    });
  };

  // Which care plan block is visible right now. Decline always wins;
  // band-driven plans surface as soon as the questionnaire is complete
  // so the reviewer can preview the recommendation before committing.
  // Save Score is still a separate commit that locks the score, but it
  // is no longer a gate for the care-plan preview.
  let planKey = null;
  if (data.decline) planKey = 'decline';
  else if (allAnswered && branch === 'minimal') planKey = 'phq9Minimal';
  else if (allAnswered && branch === 'mild' && data.phq9?.subMildAnswer === 'yes') planKey = 'phq9MildYes';
  else if (allAnswered && branch === 'mild' && data.phq9?.subMildAnswer === 'no') planKey = 'phq9MildNo';
  else if (allAnswered && branch === 'moderate') planKey = 'phq9Moderate';
  else if (allAnswered && branch === 'severe') planKey = 'phq9Severe';

  return (
    <div className={styles.form}>
      {/* Standalone DSF-B (no paired DSF-A on the note) needs its own
          visit-context fields. The DSF-A carrier normally provides
          these, but a virtually-run PHQ-2 skips creating that gap. */}
      {!hasPairedDsfA && (
        <>
          <FieldStack>
            <FieldLabel required>Location</FieldLabel>
            <div className={styles.radioStack}>
              {LOCATION_OPTIONS.map(opt => (
                <RadioButton
                  key={opt.value}
                  checked={data.location === opt.value}
                  onChange={() => onUpdate({ location: opt.value })}
                  label={opt.label}
                  disabled={readOnly}
                />
              ))}
            </div>
            {err('location') && <FieldError>Location is required</FieldError>}
          </FieldStack>
          <FieldStack>
            <FieldLabel required>Performed by</FieldLabel>
            <Select
              options={performedByOptions}
              value={data.performedBy}
              onValueChange={(v2) => onUpdate({ performedBy: v2 })}
              placeholder="Select Provider"
          searchable
          searchPlaceholder="Search users…"
              invalid={err('performedBy')}
              disabled={readOnly}
            />
            {err('performedBy') && <FieldError>Provider is required</FieldError>}
          </FieldStack>
        </>
      )}

      <div className={styles.phq2Card}>
        <div className={styles.phq2CardHeader}>
          <div className={styles.fieldLabel}>
            Depression Follow-Up : PHQ-9
            <span className={styles.required}>•</span>
          </div>
        </div>
        <LikertMatrix
          scoreKey="phq9"
          values={phq9Values}
          onChange={(next) => onUpdate({ phq9: { ...(data.phq9 || {}), items: next } })}
          locked={data.decline || phq9Saved || readOnly}
        />
        {/* Footer row surfaces once PHQ-9 is fully answered OR the
            score was committed via Save Score (which stamps the band
            on the payload: that survives a re-open even if items
            hydrate late):
              • !phq9Saved && !decline → Save Score button + live badge.
              • phq9Saved              → badge only.
              • decline                → badge only (score is still
                clinically relevant even when the patient declines
                follow-up; Save Score hides because the decline
                shortcut supersedes the sign-off queue).
            Scoring-bands info tooltip sits inside the badge so band
            context stays anchored to where the score is read. */}
        {(allAnswered || phq9Saved) && bandLabel && (
          <div className={styles.phq2CardFooter}>
            {canSavePhq9 && !readOnly && (
              <Button
                leadingIcon="solar:check-circle-linear"
                onClick={handleSavePhq9Score}
              >
                Save score
              </Button>
            )}
            <Badge
              tone={bandTone}
              size="md"
              label={`Score : ${phq9Total} Point${phq9Total === 1 ? '' : 's'} (${bandLabel})`}
              trailingIconElement={
                <Tooltip
                  variant="light"
                  maxWidth={240}
                  label={
                    <div className={styles.scoreLegend}>
                      <div className={styles.scoreLegendTitle}>PHQ-9 scoring bands</div>
                      <ul className={styles.scoreLegendList}>
                        <li><strong>0–4</strong> Minimal / None</li>
                        <li><strong>5–9</strong> Mild</li>
                        <li><strong>10–19</strong> Moderate</li>
                        <li><strong>20–27</strong> Severe</li>
                      </ul>
                    </div>
                  }
                >
                  <span className={styles.scoreBadgeInfo} aria-label="PHQ-9 scoring bands">
                    <Icon name="solar:info-circle-linear" size={14} color="currentColor" />
                  </span>
                </Tooltip>
              }
            />
          </div>
        )}
        {canSavePhq9 && !readOnly && (
          <Banner className={styles.phq2InfoBarAttached}>
            Saving this score commits the PHQ-9 result. Once saved, the assessment cannot be edited.
          </Banner>
        )}
        {phq9Saved && !readOnly && (
          <Banner
            className={styles.phq2InfoBarAttached}
            tone="success"
            icon="solar:check-circle-linear"
          >
            <span className={styles.phq2InfoBarSaved}>
              <span>Score saved, PHQ-9 locked{bandLabel ? ` (${bandLabel})` : ''}.</span>
            </span>
          </Banner>
        )}
      </div>

      {allAnswered && !data.decline && branch === 'mild' && (
        <div className={styles.subQuestion}>
          <div className={styles.subQuestionText}>
            Are any of the following present?
            <span className={styles.required}>•</span>
          </div>
          <ul className={styles.subQuestionBullets}>
            <li>History of prior depressive episodes, and/or</li>
            <li>Symptoms lasting more than 3 months</li>
          </ul>
          <div className={styles.subQuestionRadios}>
            <RadioButton
              checked={data.phq9?.subMildAnswer === 'yes'}
              onChange={() => onUpdate({ phq9: { ...(data.phq9 || {}), subMildAnswer: 'yes' } })}
              label="Yes"
              disabled={readOnly}
            />
            <RadioButton
              checked={data.phq9?.subMildAnswer === 'no'}
              onChange={() => onUpdate({ phq9: { ...(data.phq9 || {}), subMildAnswer: 'no' } })}
              label="No"
              disabled={readOnly}
            />
          </div>
        </div>
      )}

      {planKey && (
        <CarePlanOutcomePanel
          title={DSF_CARE_PLANS[planKey].title}
          bullets={DSF_CARE_PLANS[planKey].bullets}
          outreachNotes={data.carePlan?.outreachNotes}
          onOutreachNotesChange={(next) => onUpdate({
            carePlan: { ...(data.carePlan || {}), outreachNotes: next },
          })}
        />
      )}

      <button
        type="button"
        role="checkbox"
        aria-checked={!!data.decline}
        className={styles.declineRow}
        onClick={() => onUpdate({ decline: !data.decline })}
        disabled={readOnly}
        style={readOnly ? { cursor: 'default', opacity: 0.7 } : undefined}
      >
        <CheckboxTick checked={!!data.decline} size={16} />
        <span className={styles.declineLabel}>
          Decline follow-up:
          <span style={{ color: 'var(--neutral-400)', fontWeight: 400, marginLeft: 4 }}>
            patient declines further evaluation and treatment related to this depression screening measure, independent of the result above.
          </span>
        </span>
      </button>
    </div>
  );
}
