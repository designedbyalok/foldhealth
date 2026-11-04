import { useEffect, useMemo, useState } from 'react';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { useAppStore } from '../../../store/useAppStore';
import { MERGE_TOKENS } from '../../email-builder/mergeTags';
import { LAB_CATALOG } from '../lib/clinicalCriteria';
import { DELAY_UNITS } from '../lib/catalog';
import { GBI_KINDS } from '../lib/programStatusRules';
import { BARRIER_STATUSES, gbiStatusMeta } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/gbiStatus';
import { EmailTemplateField } from './EmailTemplateField';
import { PanelRow, PanelSection } from './EditPanel';
import styles from './AutomationBuilder.module.css';

const PRIORITIES = ['High', 'Medium', 'Low'].map(p => ({ value: p, label: p }));
const DUE = [
  { value: '', label: 'No due date' },
  { value: '0', label: 'Same day' },
  { value: '1', label: '1 day after' },
  { value: '2', label: '2 days after' },
  { value: '7', label: '1 week after' },
];
const APPOINTMENT_TYPES = ['a first virtual visit', 'a virtual visit', 'an in-person visit', 'a preventive screening', 'a preventive visit'].map(v => ({ value: v, label: v.replace(/^an? /, '').replace(/^./, c => c.toUpperCase()) }));
const LAB_TESTS = [...new Set([...LAB_CATALOG.map(l => l.label), 'Lipid panel', 'Comprehensive metabolic panel', 'Urine albumin-to-creatinine ratio'])].map(v => ({ value: v, label: v }));
const TOKEN_OPTIONS = MERGE_TOKENS.filter(t => t.group === 'Patient' || t.group === 'Care team').map(t => ({ value: t.key, label: t.label }));

/** A message body with an "insert merge tag" picker (SMS, push, IVR, preferred channel). */
function MessageField({ label, value, onChange, error, max }) {
  return (
    <PanelRow label={label} required error={error}>
      <div className={styles.ruleColumn}>
        <Textarea value={value || ''} onValueChange={text => onChange(text)} rows={4} maxLength={max} invalid={error} />
        <Select
          options={TOKEN_OPTIONS}
          value=""
          onValueChange={k => onChange(`${value || ''}{{${k}}}`)}
          placeholder="Insert merge tag"
          className={styles.tokenPicker}
        />
      </div>
    </PanelRow>
  );
}

/**
 * The setup form of one action step. `config` is the panel's draft; `errors`
 * maps a field to its message once the author tried to save or test.
 */
export function ActionEditor({ type, config, onChange, errors = {}, onEditTemplate }) {
  const set = (p) => onChange(p);
  switch (type) {
    case 'email':
    case 'reminder':
    case 'appInvitation':
      return <EmailTemplateField config={config} onChange={set} errors={errors} onEditTemplate={onEditTemplate} usingLabel="Send" />;
    case 'education':
      return (
        <>
          <PanelSection title="Education info">
            <PanelRow label="Content" required error={errors.contentTitle}>
              <Input value={config.contentTitle || ''} onChange={e => set({ contentTitle: e.target.value })} placeholder="e.g. How to connect your wearable" invalid={errors.contentTitle} />
            </PanelRow>
          </PanelSection>
          <EmailTemplateField config={config} onChange={set} errors={errors} onEditTemplate={onEditTemplate} />
        </>
      );
    case 'appointmentLink':
      return (
        <>
          <PanelSection title="Booking info">
            <PanelRow label="Book">
              <Select options={APPOINTMENT_TYPES} value={config.appointmentType || ''} onValueChange={v => set({ appointmentType: v })} placeholder="Select a visit type" />
            </PanelRow>
          </PanelSection>
          <EmailTemplateField config={config} onChange={set} errors={errors} onEditTemplate={onEditTemplate} />
        </>
      );
    case 'form':
      return <FormFields config={config} onChange={set} errors={errors} onEditTemplate={onEditTemplate} />;
    case 'sms':
      return <PanelSection title="Message"><MessageField label="Text" value={config.message} onChange={v => set({ message: v })} error={errors.message} max={320} /></PanelSection>;
    case 'push':
      return <PanelSection title="Notification"><MessageField label="Message" value={config.message} onChange={v => set({ message: v })} error={errors.message} max={180} /></PanelSection>;
    case 'preferredChannelMessage':
      return (
        <PanelSection title="Message">
          <MessageField label="Message" value={config.message} onChange={v => set({ message: v })} error={errors.message} max={320} />
          <p className={styles.panelHint}>Sent by email, text, chat or a call, whichever the member prefers. Members with no preference on file are skipped.</p>
        </PanelSection>
      );
    case 'ivr':
      return <PanelSection title="Call"><MessageField label="Call script" value={config.script} onChange={v => set({ script: v })} error={errors.script} max={600} /></PanelSection>;
    case 'lab':
      return (
        <PanelSection title="Order">
          <PanelRow label="Lab test" required error={errors.labTest}>
            <Select options={LAB_TESTS} value={config.labTest || ''} onValueChange={v => set({ labTest: v })} searchable placeholder="Select a lab test" invalid={errors.labTest} />
          </PanelRow>
        </PanelSection>
      );
    case 'generalTask':
      return <TaskFields config={config} onChange={set} errors={errors} />;
    case 'attachCarePlan':
      return <CarePlanFields config={config} onChange={set} errors={errors} />;
    case 'setGbiStatus':
      return <GbiStatusFields config={config} onChange={set} errors={errors} />;
    case 'microAutomation':
      return (
        <PanelSection title="Micro automation">
          <PanelRow label="Name">
            <Input value={config.title || ''} onChange={e => set({ title: e.target.value })} />
          </PanelRow>
          <p className={styles.panelHint}>Edit the steps inside it on the canvas.</p>
        </PanelSection>
      );
    default:
      return null;
  }
}

function FormFields({ config, onChange, errors, onEditTemplate }) {
  const [forms, setForms] = useState([]);
  const fetchAssessmentFormOptions = useAppStore(s => s.fetchAssessmentFormOptions);
  useEffect(() => {
    let live = true;
    fetchAssessmentFormOptions().then(list => { if (live) setForms(list); });
    return () => { live = false; };
  }, [fetchAssessmentFormOptions]);
  // Forms named on the step but not in this account (seeded samples) stay pickable.
  const options = useMemo(() => {
    const list = forms.map(f => ({ value: f.id, label: f.name }));
    (config.formIds || []).forEach((id, i) => {
      if (!list.some(o => o.value === id)) list.push({ value: id, label: config.formNames?.[i] || id });
    });
    return list;
  }, [forms, config.formIds, config.formNames]);
  return (
    <>
      <PanelSection title="Form info">
        <PanelRow label="Send" required error={errors.formIds}>
          <Select
            options={options}
            value={config.formIds || []}
            onValueChange={v => onChange({ formIds: v || [], formNames: (v || []).map(id => options.find(o => o.value === id)?.label || id) })}
            multiple
            checkboxes
            badges
            searchable
            placeholder="Select forms"
            invalid={errors.formIds}
          />
        </PanelRow>
        <PanelRow label="Via"><span className={styles.opText}>Email</span></PanelRow>
        <PanelRow label="Ask again">
          <div className={styles.ruleControls}>
            <Input type="number" min={0} value={config.repeatEvery ?? ''} onChange={e => onChange({ repeatEvery: e.target.value === '' ? null : Number(e.target.value) })} placeholder="0" wrapperClassName={styles.numberInput} aria-label="Ask again every" />
            <Select options={DELAY_UNITS.filter(u => u.value !== 'minutes')} value={config.repeatUnit || 'days'} onValueChange={v => onChange({ repeatUnit: v })} className={styles.unitSelect} />
          </div>
        </PanelRow>
        <label className={styles.checkRow}>
          <Checkbox checked={!!config.skipIfSubmitted} onCheckedChange={v => onChange({ skipIfSubmitted: !!v })} />
          Skip the email when every form is already submitted
        </label>
      </PanelSection>
      <EmailTemplateField config={config} onChange={onChange} errors={errors} onEditTemplate={onEditTemplate} />
    </>
  );
}

function TaskFields({ config, onChange, errors }) {
  const users = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const pools = useAppStore(s => s.taskPools);
  const fetchTaskPools = useAppStore(s => s.fetchTaskPools);
  useEffect(() => { fetchPlatformUsers?.(); fetchTaskPools?.(); }, [fetchPlatformUsers, fetchTaskPools]);
  const userOptions = useMemo(() => {
    const list = (users || []).map(u => ({ value: u.name, label: u.name }));
    if (config.assignee?.name && !list.some(o => o.value === config.assignee.name)) list.unshift({ value: config.assignee.name, label: config.assignee.name });
    return list;
  }, [users, config.assignee]);
  const poolOptions = useMemo(() => {
    const names = [...new Set(['Automation Tasks', ...(pools || []).map(p => p.name || p).filter(Boolean)])];
    return names.map(n => ({ value: n, label: n }));
  }, [pools]);
  return (
    <PanelSection title="Task info">
      <PanelRow label="Title" required error={errors.title}>
        <Input value={config.title || ''} onChange={e => onChange({ title: e.target.value })} invalid={errors.title} />
      </PanelRow>
      <PanelRow label="Description" required error={errors.description}>
        <Textarea value={config.description || ''} onChange={e => onChange({ description: e.target.value })} rows={3} invalid={errors.description} />
      </PanelRow>
      <PanelRow label="Assigned to" required error={errors.assignee}>
        <Select
          options={userOptions}
          value={config.assignee?.name || ''}
          onValueChange={v => {
            const u = (users || []).find(x => x.name === v);
            onChange({ assignee: { id: u?.id || null, name: v } });
          }}
          searchable
          placeholder="Select"
          invalid={errors.assignee}
        />
      </PanelRow>
      <PanelRow label="Task pool">
        <Select options={poolOptions} value={config.pool || 'Automation Tasks'} onValueChange={v => onChange({ pool: v })} />
      </PanelRow>
      <PanelRow label="Due">
        <Select options={DUE} value={config.dueInDays == null ? '' : String(config.dueInDays)} onValueChange={v => onChange({ dueInDays: v === '' ? null : Number(v) })} />
      </PanelRow>
      <PanelRow label="Priority" required error={errors.priority}>
        <Select options={PRIORITIES} value={config.priority || ''} onValueChange={v => onChange({ priority: v })} invalid={errors.priority} />
      </PanelRow>
    </PanelSection>
  );
}

function CarePlanFields({ config, onChange, errors }) {
  const templates = useAppStore(s => s.carePlanTemplates);
  const fetchCarePlanLibrary = useAppStore(s => s.fetchCarePlanLibrary);
  const users = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { if (!templates.length) fetchCarePlanLibrary(); fetchPlatformUsers?.(); }, [templates.length, fetchCarePlanLibrary, fetchPlatformUsers]);
  const options = useMemo(() => (templates || [])
    .filter(t => (t.status || 'published') === 'published' && (t.scope || 'org') === 'org')
    .map(t => ({ value: t.id, label: t.name })), [templates]);
  return (
    <PanelSection title="Care plan">
      <PanelRow label="Attach in draft" required error={errors.templateIds}>
        <Select
          options={options}
          value={config.templateIds || []}
          onValueChange={v => onChange({ templateIds: v || [], templateNames: (v || []).map(id => options.find(o => o.value === id)?.label).filter(Boolean) })}
          multiple
          checkboxes
          badges
          searchable
          placeholder="Pick care plan templates"
          invalid={errors.templateIds}
        />
      </PanelRow>
      <PanelRow label="Review task goes to">
        <Select
          options={[{ value: '', label: 'Program assignee, else the Care Management pool' }, ...(users || []).map(u => ({ value: u.name, label: u.name }))]}
          value={config.reviewer?.name || ''}
          onValueChange={v => {
            const u = (users || []).find(x => x.name === v);
            onChange({ reviewer: u ? { id: u.id || null, name: u.name } : null });
          }}
          searchable
        />
      </PanelRow>
    </PanelSection>
  );
}

// Every open goal / intervention / barrier in the program moves to one status.
// Items already closed (Met, Not Met, Resolved, Discontinued, Not Applicable) keep theirs.
const GBI_STATUS_OPTIONS = BARRIER_STATUSES.map(v => ({ value: v, label: v, icon: gbiStatusMeta(v).icon }));
const KIND_OPTIONS = GBI_KINDS.map(k => ({ value: k.key, label: k.label }));

function GbiStatusFields({ config, onChange, errors }) {
  return (
    <PanelSection title="Care plan items">
      <PanelRow label="Apply to">
        <Select
          options={KIND_OPTIONS}
          value={config.kinds?.length ? config.kinds : GBI_KINDS.map(k => k.key)}
          onValueChange={v => onChange({ kinds: v?.length ? v : GBI_KINDS.map(k => k.key) })}
          multiple
          checkboxes
          badges
        />
      </PanelRow>
      <PanelRow label="Set open items to" required error={errors.toStatus}>
        <Select
          options={GBI_STATUS_OPTIONS}
          value={config.toStatus || ''}
          onValueChange={v => onChange({ toStatus: v })}
          placeholder="Pick a status"
          invalid={errors.toStatus}
        />
      </PanelRow>
      <PanelRow label="Reason">
        <Input value={config.reason || ''} onChange={e => onChange({ reason: e.target.value })} placeholder="e.g. Program UTR" aria-label="Reason" />
      </PanelRow>
      <p className={styles.panelHint}>Items already Met, Not Met, Resolved, Discontinued or Not Applicable keep their status.</p>
    </PanelSection>
  );
}
