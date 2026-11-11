import { useState } from 'react';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Banner } from '../../../../../../../../components/Banner/Banner';
import { Button } from '../../../../../../../../components/Button/Button';
import { Checkbox } from '../../../../../../../../components/Checkbox/Checkbox';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { SegmentedControl } from '../../../../../../../../components/SegmentedControl/SegmentedControl';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { DatePickerPopover } from '../../../../../../../../components/DatePicker/DatePickerPopover';
import { GBI_STATUS_TONE } from '../../tables/carePlanTableShared';
import { gbiStatusMeta } from '../../lib/gbiStatus';
import { fmtCarePlanDate, toPickerValue } from '../../tables/carePlanTableModel';
import { CHOICES, NOTE_TAGS } from './guidedReviewModel';
import styles from './GuidedReviewDrawer.module.css';

const KIND_ICON = {
  goal: 'solar:target-linear',
  intervention: 'solar:checklist-minimalistic-linear',
  barrier: 'solar:danger-triangle-linear',
};

/** One barrier or intervention: its decision, the record's suggestion, and Reschedule's new date. */
function ItemDecision({ row, entry, onPick, onDueDate, onOpen }) {
  const [dateRect, setDateRect] = useState(null);
  const pick = entry?.decision || CHOICES[row.kind][0];
  const { item } = row;
  const meta = row.kind === 'intervention'
    ? [row.due?.formatted ? `Due ${row.due.formatted}` : 'No due date', item.assignee?.name && item.assignee.name !== 'Unassigned' ? item.assignee.name : null]
    : [item.description || null];
  return (
    <li className={styles.itemRow}>
      <div className={styles.itemMain}>
        <span className={styles.itemText}>
          <button type="button" className={styles.itemTitle} onClick={onOpen}>{item.title}</button>
          <span className={styles.itemMeta}>
            <Badge size="sm" tone={GBI_STATUS_TONE[item.status || 'Not Started'] || 'neutral'} icon={gbiStatusMeta(item.status).icon} label={item.status || 'Not Started'} />
            {meta.filter(Boolean).map(m => <span key={m}>{m}</span>)}
            {row.late > 0 && <Badge size="sm" tone="danger" label={`${row.late} ${row.late === 1 ? 'Day' : 'Days'} Overdue`} />}
          </span>
        </span>
        <SegmentedControl
          size="sm"
          items={CHOICES[row.kind]}
          value={pick}
          onValueChange={onPick}
          aria-label={`Decision for ${item.title}`}
        />
      </div>
      {pick === 'Reschedule' && (
        <span className={styles.subRow}>
          <span className={styles.muted}>New due date</span>
          <Button variant="outline" size="sm" leadingIcon="solar:calendar-linear" onClick={e => setDateRect(e.currentTarget.getBoundingClientRect())}>
            {entry?.dueDate ? fmtCarePlanDate(entry.dueDate) : 'Pick a Date'}
          </Button>
        </span>
      )}
      {row.suggestion && (
        <span className={styles.subRow}>
          <Icon name="custom:ai" size={14} />
          <span className={styles.suggestion}>Suggested: {row.suggestion.choice} · {row.suggestion.why}</span>
          {pick === row.suggestion.choice
            ? <Badge size="sm" tone="primary" label="Suggestion Used" />
            : <Button variant="soft" size="sm" onClick={() => onPick(row.suggestion.choice)}>Use Suggestion</Button>}
        </span>
      )}
      {row.orphan && (
        <Banner size="sm" tone="warning" action={<Button variant="ghost" size="sm" onClick={onOpen}>Open Barrier</Button>}>
          No intervention addresses this barrier.
        </Banner>
      )}
      {dateRect && (
        <DatePickerPopover
          open
          value={toPickerValue(entry?.dueDate) || ''}
          anchorRect={dateRect}
          onChange={(iso) => { setDateRect(null); if (iso) onDueDate(iso); }}
          onClose={() => setDateRect(null)}
        />
      )}
    </li>
  );
}

function ItemSection({ title, rows, empty, entries, onPick, onDueDate, onOpen }) {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <span className={styles.cardTitle}>{title}</span>
        {rows.length > 0 && <span className={styles.muted}>{rows.length} open</span>}
      </header>
      {rows.length === 0 ? (
        <p className={styles.cardEmpty}>{empty}</p>
      ) : (
        <ul className={styles.itemList}>
          {rows.map(row => (
            <ItemDecision
              key={row.key}
              row={row}
              entry={entries[row.key]}
              onPick={choice => onPick(row, choice)}
              onDueDate={iso => onDueDate(row, iso)}
              onOpen={() => onOpen(row.kind, row.item)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function StepFooter({ hint, onSkip, onConfirm, confirmLabel = 'Confirm and Continue' }) {
  return (
    <div className={styles.footer}>
      {onSkip && <Button variant="ghost" tone="neutral" onClick={onSkip}>Skip for Now</Button>}
      <span className={styles.spacer} />
      {hint && <span className={styles.muted}>{hint}</span>}
      <Button trailingIcon="solar:arrow-right-linear" onClick={onConfirm}>{confirmLabel}</Button>
    </div>
  );
}

export function StepHead({ eyebrow, title, badges, children }) {
  return (
    <div className={styles.stepHead}>
      {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      <div className={styles.titleRow}>
        <h2 className={styles.stepTitle}>{title}</h2>
        {badges}
      </div>
      {children}
    </div>
  );
}

/** A goal with its barriers and interventions: what to look at, then a decision on each. */
export function GoalStep({ step, eyebrow, entries, onPick, onDueDate, onToggleTag, onOpen, footer }) {
  const { goal } = step;
  const goalPick = entries[step.key]?.decision || CHOICES.goal[0];
  const tags = entries[step.key]?.tags || [];
  return (
    <>
      <StepHead
        eyebrow={eyebrow}
        title={goal.title}
        badges={(
          <>
            <Badge size="sm" tone={step.attention.tone} label={step.attention.label} />
            {goal.category && <Badge size="sm" label={goal.category} />}
          </>
        )}
      >
        {goal.patientTitle && <span className={styles.patientWords}>“{goal.patientTitle}”</span>}
      </StepHead>

      <section className={`${styles.card} ${styles.lookCard}`}>
        <span className={styles.lookHead}><Icon name="custom:ai" size={14} />What to Review</span>
        <ul className={styles.facts}>
          {step.facts.map(f => (
            <li key={f}><Icon name="solar:alt-arrow-right-linear" size={14} color="var(--primary-300)" />{f}</li>
          ))}
        </ul>
      </section>

      <section className={`${styles.card} ${styles.readingCard}`}>
        <span className={styles.reading}>
          <span className={styles.muted}>Target</span>
          <span className={styles.readingValue}>{step.target || 'No target set'}</span>
        </span>
        {step.readings.map((r, i) => (
          <span key={r.id} className={styles.reading}>
            <span className={styles.muted}>{r.date}</span>
            <span className={`${styles.readingValue} ${i === step.readings.length - 1 ? (r.met === false ? styles.off : r.met ? styles.on : '') : styles.past}`}>{r.value}</span>
          </span>
        ))}
        <span className={styles.spacer} />
        {step.met != null && <Badge size="md" tone={step.met ? 'success' : 'danger'} label={step.met ? 'On Target' : 'Off Target'} />}
      </section>

      <ItemSection title="Barriers" rows={step.barriers} empty="No open barriers on this goal." entries={entries} onPick={onPick} onDueDate={onDueDate} onOpen={onOpen} />
      <ItemSection title="Interventions" rows={step.interventions} empty="No open interventions on this goal." entries={entries} onPick={onPick} onDueDate={onDueDate} onOpen={onOpen} />

      <section className={`${styles.card} ${styles.decisionCard}`}>
        <span className={styles.cardTitle}>Decision for This Goal</span>
        <span className={styles.decisionRow}>
          <SegmentedControl
            items={CHOICES.goal}
            value={goalPick}
            onValueChange={choice => onPick({ kind: 'goal', key: step.key, item: goal }, choice)}
            aria-label="Goal decision"
          />
          <Button variant="ghost" size="sm" leadingIcon="solar:pen-linear" onClick={() => onOpen('goal', goal)}>Edit Target</Button>
        </span>
        <span className={styles.tagRow}>
          <span className={styles.muted}>Note Tags</span>
          {NOTE_TAGS.map(t => (
            <button
              key={t}
              type="button"
              className={`${styles.tag} ${tags.includes(t) ? styles.tagOn : ''}`}
              aria-pressed={tags.includes(t)}
              onClick={() => onToggleTag(step.key, t)}
            >
              {tags.includes(t) && <Icon name="solar:check-read-linear" size={12} color="currentColor" />}
              {t}
            </button>
          ))}
        </span>
      </section>
      {footer}
    </>
  );
}

/** Interventions and barriers no open goal covers. */
export function OtherStep({ step, eyebrow, entries, onPick, onDueDate, onOpen, footer }) {
  return (
    <>
      <StepHead eyebrow={eyebrow} title={step.title} badges={<Badge size="sm" tone={step.attention.tone} label={step.attention.label} />}>
        <span className={styles.muted}>These are on the plan without a goal. Decide on each, or link them to a goal from their details.</span>
      </StepHead>
      {step.barriers.length > 0 && <ItemSection title="Barriers" rows={step.barriers} entries={entries} onPick={onPick} onDueDate={onDueDate} onOpen={onOpen} />}
      {step.interventions.length > 0 && <ItemSection title="Interventions" rows={step.interventions} entries={entries} onPick={onPick} onDueDate={onDueDate} onOpen={onOpen} />}
      {footer}
    </>
  );
}

/** Last step: the changes, the drafted note, and Complete. */
export function WrapUpStep({ changes, skipped, note, onNote, sendToSign, onSendToSign, canSign, nextReview, onReviewSkipped, onBack, onComplete, busy }) {
  return (
    <>
      <StepHead eyebrow="Last step" title="Wrap Up Review">
        <span className={styles.muted}>Check the changes, edit the note if needed, then complete the review. Nothing changes on the plan until you do.</span>
      </StepHead>
      {skipped.length > 0 && (
        <Banner tone="warning" action={<Button variant="soft" size="sm" onClick={onReviewSkipped}>Review Now</Button>}>
          {skipped.length === 1 ? '1 step was' : `${skipped.length} steps were`} not reviewed: {skipped.map(s => s.title).join(', ')}. {skipped.length === 1 ? 'It stays' : 'They stay'} as {skipped.length === 1 ? 'it is' : 'they are'}.
        </Banner>
      )}
      <section className={styles.card}>
        <header className={styles.cardHead}>
          <span className={styles.cardTitle}>Changes to the Plan</span>
          <Badge size="sm" label={String(changes.length)} />
        </header>
        {changes.length === 0 ? (
          <p className={styles.cardEmpty}>No changes. The plan is confirmed as it is.</p>
        ) : (
          <ul className={styles.itemList}>
            {changes.map(c => (
              <li key={c.key} className={styles.changeRow}>
                <Icon name={KIND_ICON[c.kind]} size={16} color="var(--neutral-300)" />
                <span className={styles.changeText}>{c.item.title}</span>
                <Badge size="sm" tone={c.tone} label={c.label} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={`${styles.card} ${styles.decisionCard}`}>
        <Textarea title="Review Note" value={note} onValueChange={v => onNote(typeof v === 'string' ? v : (v?.target?.value ?? ''))} rows={4} />
        <span className={styles.muted}>Drafted from your decisions and tags. It is saved to the Activity Log with the review time.</span>
      </section>
      <section className={`${styles.card} ${styles.decisionCard}`}>
        <label className={styles.option}>
          <Checkbox checked={sendToSign} disabled={!canSign} onCheckedChange={v => onSendToSign(v === true)} />
          <span className={styles.optionText}>
            <span>Complete the plan and send it to sign</span>
            <span className={styles.muted}>
              {canSign ? 'Next, pick the provider and record the patient’s agreement.' : 'The plan can be completed once it has unsigned changes.'}
            </span>
          </span>
        </label>
        {nextReview && (
          <span className={styles.option}>
            <Icon name="solar:calendar-linear" size={16} color="var(--neutral-300)" />
            <span className={styles.optionText}>
              <span>Next review due {nextReview}</span>
              <span className={styles.muted}>From this program’s review cadence, counted from today.</span>
            </span>
          </span>
        )}
      </section>
      <div className={styles.footer}>
        <Button variant="ghost" tone="neutral" onClick={onBack}>Back</Button>
        <span className={styles.spacer} />
        <Button leadingIcon="solar:check-circle-linear" disabled={busy} onClick={onComplete}>
          {sendToSign && canSign ? 'Complete Review and Send to Sign' : 'Complete Review'}
        </Button>
      </div>
    </>
  );
}
