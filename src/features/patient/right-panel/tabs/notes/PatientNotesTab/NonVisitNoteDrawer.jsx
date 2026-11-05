import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../../../../store/useAppStore';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../components/Button/Button';
import { Input } from '../../../../../../components/Input/Input';
import { Select } from '../../../../../../components/Select/Select';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Icon } from '../../../../../../components/Icon/Icon';
import { MEASURE_NAMES } from '../../../../../hedis-worklist/ClinicalNotePanel.utils';
import { TemplateAnswersForm } from './TemplateAnswersForm';
import styles from './NonVisitNoteDrawer.module.css';

/**
 * NonVisitNoteDrawer: Clinical Note authoring surface used from P360 →
 * Notes → New Note.
 *
 * A single drawer with two possible bodies:
 *
 *   1. Free-form (default): title + body + optional gap chips. Payload:
 *      { title, body, dateOfService }. This is the shape shipped in
 *      Phase-1 and is what earlier notes carry.
 *
 *   2. Template-driven: user picks a Note Template (either a Normal
 *      template or a Care Gap × Non-Visit template). The template's
 *      schema fields render via TemplateAnswersForm and the payload
 *      becomes { formId, answers, dateOfService }. Care Gap templates
 *      also auto-attach their gap_code so the note lines up under the
 *      right care gap without an extra picker.
 */
export function NonVisitNoteDrawer({ patient, initialTitle = '', onClose }) {
  const upsertClinicalNote = useAppStore(s => s.upsertClinicalNote);
  const showToast = useAppStore(s => s.showToast);
  const hedisMembers = useAppStore(s => s.hedisMembers);
  const templatesById = useAppStore(s => s.noteTemplatesById);
  const fetchNoteTemplates = useAppStore(s => s.fetchNoteTemplates);

  const [templateId, setTemplateId] = useState(''); // '' = free-form
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState('');
  const [answers, setAnswers] = useState({});
  const [selectedGaps, setSelectedGaps] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchNoteTemplates?.(); }, [fetchNoteTemplates]);

  const memberIdStr = patient?.memberId != null ? String(patient.memberId) : null;
  const hedisMember = hedisMembers?.find(m => (
    m.id === patient?.id
    || (memberIdStr && String(m.memberId) === memberIdStr)
  ));
  const hedisMemberId = hedisMember?.id || patient?.id;

  // Available templates for this surface: Normal templates + Care Gap ×
  // Non-Visit templates. Care Gap × Visit templates are authored from
  // the Care Gap drawer, not here, so they're deliberately excluded.
  const templateOptions = useMemo(() => {
    const rows = Object.values(templatesById || {})
      .filter(t => t.status !== 'archived')
      .filter(t => !t.gap_code || t.context === 'non_visit');
    const normal = rows.filter(t => !t.gap_code).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const care = rows.filter(t => !!t.gap_code).sort((a, b) => (a.gap_code || '').localeCompare(b.gap_code || ''));
    const opts = [{ value: '', label: 'Free-form (title + body)' }];
    normal.forEach(t => opts.push({ value: String(t.id), label: `${t.name}, Normal` }));
    care.forEach(t => opts.push({ value: String(t.id), label: `${t.name}, ${t.gap_code} · Non-Visit` }));
    return opts;
  }, [templatesById]);

  const template = templateId ? templatesById?.[templateId] : null;
  const templateFields = Array.isArray(template?.schema?.items) ? template.schema.items : [];
  const templateGapCode = template?.gap_code || null;

  // When a template is picked, hard-lock its gap to the chip row so it
  // survives save even if the user never toggled a chip manually.
  useEffect(() => {
    if (templateGapCode) setSelectedGaps([templateGapCode]);
    else if (!templateId) setSelectedGaps([]);
  }, [templateGapCode, templateId]);

  const availableGaps = (hedisMember?.gaps || [])
    .filter(g => g.code && g.status !== 'Completed')
    .map(g => g.code);
  const toggleGap = (code) => {
    if (templateGapCode) return; // locked to template's gap
    setSelectedGaps(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const buildPayload = () => {
    const base = { dateOfService: new Date().toISOString().slice(0, 10) };
    if (template) return { ...base, formId: template.id, answers };
    return { ...base, title: title.trim(), body: body.trim() };
  };

  const validate = () => {
    if (template) {
      // Every required field on the template must have a value.
      return templateFields.every(f => {
        if (!f.required) return true;
        const v = answers?.[f.key];
        if (f.type === 'checkbox') return v === true;
        return v !== undefined && v !== null && v !== '';
      });
    }
    return !!title.trim() && !!body.trim();
  };

  const save = async (status) => {
    setSubmitted(true);
    if (!validate()) {
      showToast?.(template ? 'Please fill in all required fields' : 'Title and note body are required');
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertClinicalNote({
        hedisMemberId,
        patientId: patient?.id,
        gapCodes: selectedGaps,
        formType: template ? (templateGapCode ? 'non_visit_note' : 'normal_note') : 'non_visit_note',
        formId: template?.id || null,
        status,
        payload: buildPayload(),
        originKind: 'patient',
        originRef: patient?.id ? String(patient.id) : null,
      });
      if (saved) {
        showToast?.(status === 'signed' ? 'Note signed' : 'Draft saved');
        onClose?.();
      } else {
        showToast?.('Save failed: check console');
      }
    } finally {
      setSaving(false);
    }
  };

  const canSave = validate() && !saving;
  const drawerTitle = template
    ? `New ${template.name}`
    : 'New Clinical Note';

  return (
    <Drawer
      title={drawerTitle}
      onClose={onClose}
      width={640}
      primaryAction={
        <Button onClick={() => save('signed')} disabled={!canSave}>
          Sign &amp; Save
        </Button>
      }
      secondaryAction={
        <Button variant="outline" onClick={() => save('draft')} disabled={saving}>
          Save as Draft
        </Button>
      }
    >
      <div className={styles.body}>
        <div className={styles.infoBanner}>
          <Icon name="solar:info-circle-linear" size={14} color="var(--status-info)" />
          <span>Non-Visit and Normal notes skip the Reviewer flow. Sign to lock, or save a Draft to keep editing.</span>
        </div>

        <div className={styles.field}>
          <label className={styles.groupLabel}>Template</label>
          <Select
            options={templateOptions}
            value={templateId}
            onValueChange={(v) => { setTemplateId(v || ''); setSubmitted(false); }}
            placeholder="Choose a template"
          />
          {template?.description && (
            <p className={styles.templateHelp}>{template.description}</p>
          )}
        </div>

        {template ? (
          templateFields.length === 0 ? (
            <div className={styles.templateEmpty}>
              This template has no fields yet. Open <strong>Settings → Content → Notes</strong>
              &nbsp;and click <strong>Edit fields</strong> to add them.
            </div>
          ) : (
            <TemplateAnswersForm
              items={templateFields}
              answers={answers}
              onChange={setAnswers}
              submitted={submitted}
            />
          )
        ) : (
          <>
            <div className={styles.field}>
              <Input
                label="Title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary of the note"
                autoFocus
              />
            </div>
            <div className={styles.field}>
              <label className={styles.textareaLabel}>
                Note<span className={styles.required}> •</span>
              </label>
              <textarea
                className={styles.textarea}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write the clinical note…"
                rows={10}
              />
            </div>
          </>
        )}

        {templateGapCode && (
          <div className={styles.field}>
            <label className={styles.groupLabel}>Related Care Gap</label>
            <div className={styles.chipRow}>
              <span className={styles.chipActive}>
                <Icon name="solar:link-linear" size={12} color="var(--primary-300)" />
                <Badge tone="primary" size="sm" label={`${templateGapCode}: ${MEASURE_NAMES[templateGapCode] || templateGapCode}`} />
              </span>
            </div>
            <p className={styles.templateHelp}>Locked by the selected template.</p>
          </div>
        )}

        {!templateGapCode && availableGaps.length > 0 && (
          <div className={styles.field}>
            <label className={styles.groupLabel}>Related Care Gaps (optional)</label>
            <div className={styles.chipRow}>
              {availableGaps.map(code => {
                const active = selectedGaps.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    className={active ? styles.chipActive : styles.chip}
                    onClick={() => toggleGap(code)}
                  >
                    {active && <Icon name="solar:check-circle-linear" size={12} color="var(--primary-300)" />}
                    <Badge tone={active ? 'primary' : 'neutral'} size="sm" label={code} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
