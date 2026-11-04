import { useEffect, useMemo, useState } from 'react';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { Icon } from '../../../components/Icon/Icon';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { useAppStore } from '../../../store/useAppStore';
import { renderPreviewHtml } from '../../email-builder/renderEmail';
import { unknownMergeTags } from '../lib/mergeTagCheck';
import { PanelRow, PanelSection } from './EditPanel';
import styles from './AutomationBuilder.module.css';

/**
 * Which shared email (Settings > Content > Emails) a step sends, its subject,
 * a rendered preview with sample merge values, and warnings for merge tags
 * the engine can't fill. "Edit Template" opens the email in the email
 * builder, so every automation using it gets the change.
 */
export function EmailTemplateField({ config, onChange, errors = {}, onEditTemplate, usingLabel = 'Using' }) {
  const options = useAppStore(s => s.automationEmailOptions);
  const fetchOptions = useAppStore(s => s.fetchAutomationEmailOptions);
  const fetchEmail = useAppStore(s => s.fetchAutomationEmail);
  // The loaded email, tagged with the id it belongs to.
  const [loaded, setLoaded] = useState({ id: null, email: null });

  useEffect(() => { fetchOptions(); }, [fetchOptions]);

  const id = config.templateId;
  useEffect(() => {
    if (!id) return undefined;
    let live = true;
    fetchEmail(id).then(e => { if (live) setLoaded({ id, email: e }); });
    return () => { live = false; };
  }, [id, fetchEmail]);
  const email = id && loaded.id === id ? loaded.email : null;
  const loading = !!id && loaded.id !== id;

  const subject = config.subject ?? email?.subject ?? '';
  const html = useMemo(() => {
    if (!email?.doc) return '';
    try { return renderPreviewHtml(email.doc); } catch { return ''; }
  }, [email]);
  // Check the raw template (before sample values fill it in).
  const rawHtml = useMemo(() => {
    if (!email?.doc) return '';
    try { return JSON.stringify(email.doc); } catch { return ''; }
  }, [email]);
  const unknown = useMemo(() => unknownMergeTags(subject, rawHtml), [subject, rawHtml]);
  const optionList = useMemo(() => options.map(o => ({ value: o.id, label: o.name, description: o.category })), [options]);
  const missing = id && options.length && !options.some(o => o.id === String(id));

  return (
    <>
      <PanelSection>
        <PanelRow label={usingLabel} required error={errors.templateId}>
          <div className={styles.ruleControls}>
            <Select
              options={optionList}
              value={id ? String(id) : ''}
              onValueChange={v => {
                const o = options.find(x => x.id === v);
                onChange({ templateId: v, templateName: o?.name || '', templateKey: undefined, subject: undefined });
              }}
              searchable
              placeholder="Select an email"
              invalid={errors.templateId}
            />
            <span className={styles.opText}>template</span>
          </div>
        </PanelRow>
        {missing && <p className={styles.fieldWarning}><Icon name="solar:danger-triangle-linear" size={14} /> This email was deleted from Content. Pick another one.</p>}
      </PanelSection>

      {id && (
        <PanelSection
          title="Template info"
          action={onEditTemplate && (
            <Tooltip label={email?.campaign ? 'Opens this email in the email builder' : 'Available once the email exists in Content > Emails'}>
              <button type="button" className={styles.linkButton} disabled={!email?.campaign} onClick={() => onEditTemplate(email.campaign)}>
                Edit Template
              </button>
            </Tooltip>
          )}
        >
          {unknown.length > 0 && (
            <p className={styles.fieldWarning}>
              <Icon name="solar:danger-triangle-linear" size={14} />
              {unknown.length === 1
                ? `The ${unknown[0]} merge tag isn’t recognized. It will be sent as written.`
                : `These merge tags aren’t recognized and will be sent as written: ${unknown.join(', ')}.`}
            </p>
          )}
          <PanelRow label="Subject" required error={errors.subject}>
            <Input value={subject} onChange={e => onChange({ subject: e.target.value })} aria-label="Subject" />
          </PanelRow>
          <div className={styles.emailPreview}>
            {loading ? (
              <span className={styles.panelHint}>Loading preview…</span>
            ) : html ? (
              <iframe title="Email preview" srcDoc={html} sandbox="" className={styles.emailFrame} />
            ) : (
              <span className={styles.panelHint}>No preview for this email.</span>
            )}
          </div>
          <p className={styles.panelHint}>Preview uses sample values (Sarah Johnson, Dr. Patel).</p>
        </PanelSection>
      )}
    </>
  );
}
