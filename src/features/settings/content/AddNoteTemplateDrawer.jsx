import { useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { Textarea } from '../../../components/Textarea/Textarea';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { Select } from '../../../components/Select/Select';
import { CheckboxTick } from '../../../components/CheckboxTick/CheckboxTick';
import { useAppStore } from '../../../store/useAppStore';
import { MEASURE_NAMES } from '../../hedis-worklist/ClinicalNotePanel.utils';
import styles from './AddNoteTemplateDrawer.module.css';

/**
 * AddNoteTemplateDrawer: first step of the Note Template authoring
 * flow (Settings → Content → Notes → + New Note).
 *
 * Collects the template's metadata (title, type, and, for Care Gap
 * notes: the gap + Visit/Non-Visit context and default flag) then
 * hands off to the shared FormBuilder for schema authoring. That way we
 * don't duplicate the field editor.
 *
 * Contracts:
 *  - Normal Note: title only; gap_code, context, is_default_for_gap all
 *    stay null/false.
 *  - Care Gap Note: title + gap + context required. `Set as default`
 *    checkbox is per (gap, context); toggling it triggers the atomic
 *    swap in the store so the partial unique index never trips.
 */
export function AddNoteTemplateDrawer({ onClose }) {
  const createNoteTemplate = useAppStore(s => s.createNoteTemplate);
  const openFormBuilder = useAppStore(s => s.openFormBuilder);
  const showToast = useAppStore(s => s.showToast);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('normal');
  const [gapCode, setGapCode] = useState('');
  const [context, setContext] = useState('visit');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const gapOptions = useMemo(
    () => Object.entries(MEASURE_NAMES)
      .map(([code, label]) => ({ value: code, label: `${code} · ${label}` }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );

  const isCareGap = type === 'care_gap';
  const canSave = title.trim().length > 0
    && (!isCareGap || (gapCode && context));

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setErr(null);
    try {
      const row = await createNoteTemplate({
        name: title,
        description,
        gapCode: isCareGap ? gapCode : undefined,
        context: isCareGap ? context : undefined,
        isDefault: isCareGap ? setAsDefault : false,
        status: 'draft',
      });
      showToast?.('Note template created: configure its fields next');
      // Open the FormBuilder first, THEN close the drawer. openFormBuilder
      // sets `editingFormId`, which triggers the AppLayout's full-screen
      // takeover: closing the drawer before that fires can leave the
      // caller stuck in the Notes list with no way to author fields.
      if (row?.id) {
        await openFormBuilder?.(row.id);
      }
      onClose?.();
    } catch (e) {
      console.error('createNoteTemplate failed:', e);
      setErr(e?.message || 'Could not save the template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title="New Note Template"
      onClose={onClose}
      width={520}
      primaryAction={
        <Button
          onClick={handleSave}
          disabled={!canSave} loading={saving}
        >
          Continue
        </Button>
      }
      secondaryAction={
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
      }
    >
      <div className={styles.body}>
        <section className={styles.section}>
          <label className={styles.label} htmlFor="note-tpl-title">Title</label>
          <Input
            id="note-tpl-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Diabetes A1C Visit Note"
            autoFocus
          />
          <p className={styles.help}>The name shown in the template picker.</p>
        </section>

        <section className={styles.section}>
          <label className={styles.label} htmlFor="note-tpl-desc">Description</label>
          <Textarea
            id="note-tpl-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short summary of when to use this template (optional)"
            rows={2}
          />
        </section>

        <section className={styles.section}>
          <span className={styles.label}>Note Type</span>
          <div className={styles.radioStack}>
            <RadioButton
              name="note-type"
              value="normal"
              checked={type === 'normal'}
              onChange={() => { setType('normal'); setGapCode(''); setSetAsDefault(false); }}
              label="Normal Note"
            />
            <p className={styles.optionHelp}>
              A standalone clinical note. Not tied to a specific care gap.
            </p>
            <RadioButton
              name="note-type"
              value="care_gap"
              checked={type === 'care_gap'}
              onChange={() => setType('care_gap')}
              label="Care Gap Note"
            />
            <p className={styles.optionHelp}>
              Associated with a HEDIS care gap and used from the Care Gap
              workflow (Visit or Non-Visit).
            </p>
          </div>
        </section>

        {isCareGap && (
          <>
            <section className={styles.section}>
              <label className={styles.label} htmlFor="note-tpl-gap">Care Gap</label>
              <Select
                id="note-tpl-gap"
                options={gapOptions}
                value={gapCode}
                onValueChange={setGapCode}
                placeholder="Choose a care gap"
                searchable
              />
            </section>

            <section className={styles.section}>
              <span className={styles.label}>Context</span>
              <div className={styles.radioRow}>
                <RadioButton
                  name="note-context"
                  value="visit"
                  checked={context === 'visit'}
                  onChange={() => setContext('visit')}
                  label="Visit"
                />
                <RadioButton
                  name="note-context"
                  value="non_visit"
                  checked={context === 'non_visit'}
                  onChange={() => setContext('non_visit')}
                  label="Non-Visit"
                />
              </div>
              <p className={styles.help}>
                Visit templates are used when a note is authored during a
                clinical visit; Non-Visit templates cover outreach and
                asynchronous documentation for the same care gap.
              </p>
            </section>

            <section className={styles.section}>
              <button
                type="button"
                className={styles.checkboxRow}
                aria-checked={setAsDefault}
                role="checkbox"
                onClick={() => setSetAsDefault(v => !v)}
              >
                <CheckboxTick checked={setAsDefault} />
                <span>
                  <span className={styles.checkboxLabel}>
                    Set as {context === 'visit' ? 'Visit' : 'Non-Visit'} default for this gap
                  </span>
                  <span className={styles.checkboxHelp}>
                    Only one {context === 'visit' ? 'Visit' : 'Non-Visit'} default is
                    allowed per care gap; if another template already holds it, we&apos;ll
                    move the default here.
                  </span>
                </span>
              </button>
            </section>
          </>
        )}

        {err && <div className={styles.error}>{err}</div>}
      </div>
    </Drawer>
  );
}
