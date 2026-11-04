import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Select } from '../../../../../../components/Select/Select';
import { Input } from '../../../../../../components/Input/Input';
import { Textarea } from '../../../../../../components/Textarea/Textarea';
import { Button } from '../../../../../../components/Button/Button';
import { Link } from '../../../../../../components/Link/Link';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { DownChevronIcon } from '../../../../../../components/Icon/DownChevronIcon';
import { Icon } from '../../../../../../components/Icon/Icon';
import { CloseIcon } from '../../../../../../components/Icon/CloseIcon';
import { AddIconMinimalist } from '../../../../../../components/Icon/AddIconMinimalist';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { RingEmptyState } from '../../../../../../components/RingEmptyState/RingEmptyState';
import { useAppStore } from '../../../../../../store/useAppStore';
import { AllergySelect } from './AllergySelect';
import { ALLERGY_REACTIONS, REACTION_SYSTEM } from '../../../../../../reference-data/allergyReactions';
import { toast } from '../../../../../../components/Toast/sonnerToast';
import { todayIso, toIsoDate, formatClinicalDate } from '../../../../../../lib/clinicalDates';
import { CollapsibleContent } from '../../../../../../components/Collapsible/Collapsible';
import styles from '../AddProblemsDrawer/AddProblemsDrawer.module.css';

const STATUS_OPTIONS = ['Active', 'Past'].map(v => ({ value: v, label: v }));
const REACTION_TYPE_OPTIONS = ['Adverse Reaction', 'Allergy', 'Intolerance']
  .map(v => ({ value: v, label: v }));
// Criticality drives the badge tone: High is the one that changes care.
const CRITICALITY_OPTIONS = ['High', 'Low', 'Unable to Assess']
  .map(v => ({ value: v, label: v }));
const CRITICALITY_TONE = { High: 'danger', Low: 'neutral', 'Unable to Assess': 'neutral' };
// Coded reactions, so a recorded reaction carries its SNOMED concept rather
// than a string someone typed.
const REACTION_OPTIONS = ALLERGY_REACTIONS.map(r => ({ value: r.code, label: r.display }));
const REACTION_SEVERITY_OPTIONS = ['Severe', 'Moderate', 'Mild']
  .map(v => ({ value: v, label: v }));



function AllergyRow({ allergy, onStatusChange, onEdit, dimmed }) {
  const [open, setOpen] = useState(false);
  const meta = [
    allergy.reactionType,
    allergy.sinceDate ? `Since ${formatClinicalDate(allergy.sinceDate)}` : '',
  ].filter(Boolean);
  const hasDetails = allergy.reactions?.length > 0 || !!allergy.note;

  return (
    <div className={[styles.row, dimmed ? styles.dimmed : ''].filter(Boolean).join(' ')}>
      <div className={styles.rowTop}>
        <div className={styles.rowMain}>
          <span className={styles.rowTitleRow}>
            <span className={styles.rowTitle}>{allergy.title}</span>
            {allergy.criticality && (
              <Badge
                tone={CRITICALITY_TONE[allergy.criticality] || 'neutral'}
                size="sm"
                label={allergy.criticality}
              />
            )}
          </span>
          <span className={styles.rowMeta}>
            {meta.map((part, i) => (
              <span key={part}>
                {i > 0 && <span className={styles.dot} aria-hidden="true">•</span>}
                {part}
              </span>
            ))}
            {hasDetails && (
              <>
                {meta.length > 0 && <span className={styles.dot} aria-hidden="true">•</span>}
                <Link className={styles.viewNote} onClick={() => setOpen(v => !v)}>
                  View Details
                  <DownChevronIcon size={12} color="currentColor" className={open ? styles.chevronOpen : undefined} />
                </Link>
              </>
            )}
          </span>
        </div>
        <Select
          portal
          options={STATUS_OPTIONS}
          value={allergy.status || 'Active'}
          onValueChange={v => onStatusChange(allergy, v)}
          className={styles.statusSelect}
        />
        <span className={styles.rowDivider} aria-hidden="true" />
        <ActionButton
          icon="solar:pen-linear"
          size="sm"
          tooltip="Edit"
          aria-label={`Edit ${allergy.title}`}
          onClick={() => onEdit(allergy)}
        />
      </div>
      {hasDetails && (
        <CollapsibleContent open={open}>
          <div className={styles.rowDetails}>
            {allergy.reactions?.length > 0 && (
              <p className={`${styles.rowNote} ${styles.rowReactions}`}>
                <span className={styles.rowNoteLabel}>Reactions:</span>
                {allergy.reactions.map(r => (
                  <span key={r.code || r.display || r} className={styles.reaction}>
                    <Icon name="solar:flag-linear" size={14} color="var(--status-error)" />
                    {r.display || r}{r.severity ? ` (${r.severity})` : ''}
                  </span>
                ))}
              </p>
            )}
            {allergy.note && (
              <p className={styles.rowNote}>
                <span className={styles.rowNoteLabel}>Note:</span> {allergy.note}
              </p>
            )}
          </div>
        </CollapsibleContent>
      )}
    </div>
  );
}

/**
 * The allergen being described before it joins the list: when it started, what
 * kind of reaction it is, how critical, plus the reactions it causes and an
 * optional note. Figma P360 1840:301635.
 */
function AllergyDraft({ title, eyebrow, initial, onSave, onCancel }) {
  const [since, setSince] = useState(initial?.since || todayIso());
  const [reactionType, setReactionType] = useState(initial?.reactionType || 'Allergy');
  const [criticality, setCriticality] = useState(initial?.criticality || 'Low');
  const [reactions, setReactions] = useState(initial?.reactions || []);
  const [note, setNote] = useState(initial?.note || '');
  const [noteOpen, setNoteOpen] = useState(!!initial?.note);
  const [saving, setSaving] = useState(false);

  const canSave = !!since && !!reactionType && !!criticality;

  // Codes already chosen, so no two rows can name the same reaction.
  const takenCodes = new Set(reactions.map(r => r.code).filter(Boolean));
  const canAddReaction = takenCodes.size < ALLERGY_REACTIONS.length
    && reactions.every(r => r.code);
  const addReaction = () => setReactions(list => [...list, { key: `r-${Date.now()}-${list.length}`, code: '', display: '', severity: 'Moderate' }]);
  const patchReaction = (i, patch) => setReactions(list =>
    list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeReaction = (i) => setReactions(list => list.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
      title,
      sinceDate: since,
      reactionType,
      criticality,
      // A row left blank was added and never filled in.
      // Drop the row key and any row added but never filled in.
      reactions: reactions
        .filter(r => r.code)
        .map(({ code, display, severity }) => ({ system: REACTION_SYSTEM, code, display, severity })),
      note: note.trim(),
    });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.draft}>
      <div className={styles.draftHead}>
        {eyebrow && <span className={styles.draftEyebrow}>{eyebrow}</span>}
        <span className={styles.draftTitle}>{title}</span>
      </div>
      <div className={[styles.draftFields, styles.draftFieldsTriple].join(' ')}>
        <Input label="Since Date" required type="date" value={since} onChange={e => setSince(e.target.value)} />
        <Select portal label="Reaction Type" required options={REACTION_TYPE_OPTIONS} value={reactionType} onValueChange={setReactionType} />
        <Select portal label="Criticality" required options={CRITICALITY_OPTIONS} value={criticality} onValueChange={setCriticality} />
      </div>

      <div className={styles.draftDividerRow} aria-hidden="true" />

      <div className={styles.reactionBlock}>
        <span className={styles.draftNoteLabel}>Reaction</span>
        {reactions.map((r, i) => (
          <div className={styles.reactionRow} key={r.key || r.code || i}>
            <Select
              portal
              searchable
              options={REACTION_OPTIONS.filter(o => o.value === r.code || !takenCodes.has(o.value))}
              value={r.code}
              onValueChange={(code) => patchReaction(i, {
                code,
                display: ALLERGY_REACTIONS.find(x => x.code === code)?.display || '',
              })}
              placeholder="Select a reaction"
              searchPlaceholder="Search reactions…"
              className={styles.reactionName}
            />
            <Select
              portal
              options={REACTION_SEVERITY_OPTIONS}
              value={r.severity}
              onValueChange={v => patchReaction(i, { severity: v })}
              className={styles.reactionSeverity}
            />
            <ActionButton size="sm" tooltip="Remove" aria-label={`Remove reaction ${i + 1}`} onClick={() => removeReaction(i)}>
              <CloseIcon size={14} color="var(--neutral-300)" />
            </ActionButton>
          </div>
        ))}
        {canAddReaction && (
          <Link className={styles.draftAddNote} onClick={addReaction}>
            <AddIconMinimalist size={14} color="var(--primary-300)" />
            Add Reaction
          </Link>
        )}
      </div>

      {noteOpen ? (
        <div className={styles.draftNote}>
          <div className={styles.draftNoteHead}>
            <span className={styles.draftNoteLabel}>Note</span>
            <ActionButton size="sm" tooltip="Discard note" aria-label="Discard note" onClick={() => { setNote(''); setNoteOpen(false); }}>
              <CloseIcon size={14} color="var(--neutral-300)" />
            </ActionButton>
          </div>
          <Textarea rows={3} placeholder="Add note" value={note} onChange={e => setNote(e.target.value)} />
        </div>
      ) : (
        <Link className={styles.draftAddNote} onClick={() => setNoteOpen(true)}>
          <AddIconMinimalist size={14} color="var(--primary-300)" />
          Add Note
        </Link>
      )}

      <div className={styles.draftActions}>
        <Button disabled={saving || !canSave} onClick={save}>Save</Button>
        <span className={styles.draftDivider} aria-hidden="true" />
        <Link variant="secondary" onClick={onCancel}>Discard</Link>
      </div>
    </div>
  );
}

const Section = forwardRef(function Section({ title, count, open, onToggle, children, dimmed }, ref) {
  return (
    <div className={styles.section} ref={ref}>
      <button
        type="button"
        className={[styles.sectionHead, dimmed ? styles.dimmed : ''].filter(Boolean).join(' ')} onClick={onToggle} aria-expanded={open}>
        <span className={styles.sectionTitle}>{title}</span>
        {count > 0 && <Badge size="sm" label={String(count)} className={styles.countBadge} />}
        <DownChevronIcon size={14} className={open ? styles.chevron : styles.chevronClosed} />
      </button>
      <div className={[styles.sectionBody, open ? styles.sectionBodyOpen : ''].filter(Boolean).join(' ')}>
        <div className={styles.sectionBodyInner}>{children}</div>
      </div>
    </div>
  );
});

/**
 * Add Allergies: the PAMI/Hx Allergies section's `+` opens this. Mirrors Add
 * Problems and Add Medications: type an allergen, describe it, and the list
 * below splits by status.
 */
export function AddAllergiesDrawer({ patientId, focus, onClose }) {
  const stored = useAppStore(s => (patientId ? s.patientAllergies[patientId] : null));
  const allergies = useMemo(() => stored || [], [stored]);
  const loadedFor = useAppStore(s => (patientId ? s.patientAllergiesLoadedFor[patientId] : false));
  const fetchPatientAllergies = useAppStore(s => s.fetchPatientAllergies);
  const addPatientAllergy = useAppStore(s => s.addPatientAllergy);
  const updatePatientAllergy = useAppStore(s => s.updatePatientAllergy);
  const showToast = useAppStore(s => s.showToast);
  const [activeOpen, setActiveOpen] = useState(true);
  const [pastOpen, setPastOpen] = useState(focus === 'past');
  const pastRef = useRef(null);
  const [draft, setDraft] = useState(null);

  useEffect(() => { if (patientId) fetchPatientAllergies(patientId); }, [patientId, fetchPatientAllergies]);

  const active = useMemo(() => allergies.filter(a => (a.status || 'Active') !== 'Past'), [allergies]);
  const past = useMemo(() => allergies.filter(a => a.status === 'Past'), [allergies]);
  const loading = !!patientId && !loadedFor;

  useEffect(() => {
    if (focus !== 'past' || loading) return undefined;
    const id = requestAnimationFrame(() => {
      pastRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [focus, loading]);

  // A picked concept carries its terminology, so the allergy is stored coded
  // rather than as loose text.
  const startDraft = (concept) => {
    if (!concept?.display) return;
    const title = concept.display.trim();
    if (allergies.some(a => (a.title || '').trim().toLowerCase() === title.toLowerCase())) {
      showToast?.('This allergy is already on the list');
      return;
    }
    setDraft({
      title,
      conceptKey: `${concept.system}|${concept.code}`,
      concept: { code: concept.code, codeSystem: concept.system },
    });
  };

  const startEdit = (allergy) => setDraft({
    title: allergy.title,
    editing: allergy,
    concept: { code: allergy.code || '', codeSystem: allergy.codeSystem || '' },
    initial: {
      since: toIsoDate(allergy.sinceDate) || todayIso(),
      reactionType: allergy.reactionType || 'Allergy',
      criticality: allergy.criticality || 'Low',
      reactions: allergy.reactions || [],
      note: allergy.note || '',
    },
  });

  const saveDraft = async (values) => {
    const payload = { ...values, ...(draft?.concept || {}) };
    const ok = draft?.editing
      ? await updatePatientAllergy(patientId, draft.editing.id, payload)
      : await addPatientAllergy(patientId, payload);
    if (ok) setDraft(null);
  };

  const handleStatusChange = async (allergy, status) => {
    const prev = allergy.status || 'Active';
    if (status === prev) return;
    const ok = await updatePatientAllergy(patientId, allergy.id, { status });
    if (ok && status === 'Past') {
      toast.success('Allergy moved to past allergies', {
        action: { label: 'Undo', onClick: () => updatePatientAllergy(patientId, allergy.id, { status: prev }) },
      });
    }
  };

  const renderRow = (a) => (draft?.editing?.id === a.id ? (
    <AllergyDraft
      key={a.id}
      eyebrow="Edit Allergy"
      title={draft.title}
      initial={draft.initial}
      onSave={saveDraft}
      onCancel={() => setDraft(null)}
    />
  ) : (
    <AllergyRow key={a.id} allergy={a} onStatusChange={handleStatusChange} onEdit={startEdit} dimmed={!!draft?.editing} />
  ));

  return (
    <Drawer title="Add Allergies" onClose={onClose}>
      <div className={styles.body}>
        <div className={[styles.addBlock, draft?.editing ? styles.dimmed : ''].filter(Boolean).join(' ')}>
          <span className={styles.addLabel}>Add New Allergies</span>
          <AllergySelect
            leadingIcon="solar:magnifer-linear"
            value={draft?.editing ? '' : (draft?.conceptKey || '')}
            onChange={startDraft}
          />
        </div>

        {draft && !draft.editing && (
          <AllergyDraft
            key={draft.title}
            title={draft.title}
            onSave={saveDraft}
            onCancel={() => setDraft(null)}
          />
        )}

        {loading ? (
          <CardSkeleton rows={3} />
        ) : (
          <div className={[styles.list, draft && !draft.editing ? styles.listDimmed : ''].filter(Boolean).join(' ')}>
            <Section
              dimmed={!!draft?.editing}
              title="Active Allergies"
              count={active.length}
              open={activeOpen}
              onToggle={() => setActiveOpen(v => !v)}
            >
              {active.length === 0 ? (
                <div className={styles.emptyCard}>
                  <RingEmptyState icon="custom:allergy" label="No Active Allergies" iconSize={31} />
                </div>
              ) : active.map(a => renderRow(a))}
            </Section>

            {past.length > 0 && (
              <Section
                dimmed={!!draft?.editing}
                ref={pastRef}
                title="Past Allergies"
                count={past.length}
                open={pastOpen}
                onToggle={() => setPastOpen(v => !v)}
              >
                {past.map(a => renderRow(a))}
              </Section>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
