import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../../components/Button/Button';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Input } from '../../../../components/Input/Input';
import { Select } from '../../../../components/Select/Select';
import { Switch } from '../../../../components/Switch/Switch';
import { RadioOptionGroup } from '../../../../components/RadioOptionGroup/RadioOptionGroup';
import { useAppStore } from '../../../../store/useAppStore';
import { STEP_SCREENS, stepOpens, stepScreen } from '../careProgramConfigModel';
import styles from '../CareProgramConfig.module.css';

const TOP_LEVEL = '__top';
const EMPTY = [];
const OPENS_OPTIONS = [
  { value: 'form', label: 'A form', hint: 'Opens a form built in Settings > Content > Forms, ready to fill in.' },
  { value: 'screen', label: 'A built-in screen', hint: 'Opens one of the app’s step screens, e.g. Outreach or Care Plan.' },
  { value: 'none', label: 'Nothing yet', hint: 'The step is listed and can be marked reviewed, with no screen.' },
];

function SwitchRow({ label, hint, checked, onChange, disabled }) {
  return (
    <div className={styles.switchRow}>
      <span className={styles.switchText}>
        <span className={styles.switchLabel}>{label}</span>
        <span className={styles.switchHint}>{hint}</span>
      </span>
      <Switch checked={checked} disabled={disabled} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

/**
 * Configure one program step (or add a new one): its name, what it opens in
 * the patient's program (a form from the Forms library, a built-in screen or
 * nothing yet), which section it sits in, and whether it's shown, mandatory
 * and flagged with an alert. Sections only take a name and Show.
 *
 * @param {object}   props
 * @param {object}   props.step       – the step being edited (a new one has no name yet)
 * @param {boolean}  props.isNew
 * @param {string|null} props.sectionId – the section it's in (null: top level)
 * @param {Array<{id: string, name: string}>} props.sections – sections it can move to
 * @param {(step: object, sectionId: string|null) => void} props.onSave
 * @param {function} props.onClose
 */
export function StepConfigDrawer({ step, isNew = false, sectionId = null, sections = EMPTY, onSave, onClose }) {
  const isSection = step.type === 'section';
  const [name, setName] = useState(step.name || '');
  const [opens, setOpens] = useState(() => (isNew ? 'form' : stepOpens(step)));
  const [screen, setScreen] = useState(() => stepScreen(step) || '');
  const [form, setForm] = useState(() => (step.formId ? { id: String(step.formId), name: step.formName || step.name } : null));
  const [placement, setPlacement] = useState(sectionId || TOP_LEVEL);
  const [enabled, setEnabled] = useState(step.enabled !== false);
  const [mandatory, setMandatory] = useState(!!step.mandatory);
  const [hasAlert, setHasAlert] = useState(!!step.hasAlert);

  const forms = useAppStore(s => s.contentForms) || EMPTY;
  const fetchContentForms = useAppStore(s => s.fetchContentForms);
  useEffect(() => {
    if (!isSection) fetchContentForms?.({ page: 1, perPage: 100, search: '' });
  }, [isSection, fetchContentForms]);

  const formOptions = useMemo(() => {
    const opts = forms.map(f => ({ value: String(f.id), label: f.name }));
    // The linked form may be outside the first page of the library.
    if (form && !opts.some(o => o.value === form.id)) opts.unshift({ value: form.id, label: form.name });
    return opts;
  }, [forms, form]);

  const missing = !name.trim()
    || (!isSection && opens === 'form' && !form)
    || (!isSection && opens === 'screen' && !screen);

  const save = () => {
    const next = { ...step, name: name.trim(), enabled };
    if (!isSection) {
      next.mandatory = mandatory;
      if (hasAlert) next.hasAlert = true; else delete next.hasAlert;
      delete next.formId;
      delete next.formName;
      delete next.screen;
      delete next.kind;
      if (opens === 'form') {
        next.formId = form.id;
        next.formName = form.name;
      } else if (opens === 'screen') {
        next.screen = screen;
        if (screen === 'Billing Review') next.kind = 'billing';
      }
    }
    onSave(next, isSection || placement === TOP_LEVEL ? null : placement);
  };

  const title = isNew ? 'Add Step' : `Configure ${isSection ? 'Section' : 'Step'}`;

  return (
    <Drawer
      title={title}
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <>
          <Button disabled={missing} onClick={save}>{isNew ? 'Add Step' : 'Save'}</Button>
          <span className={styles.headerDivider} />
        </>
      )}
    >
      <div className={styles.drawerBody}>
        <Input
          label={isSection ? 'Section Name' : 'Step Name'}
          required
          value={name}
          maxLength={60}
          placeholder={isSection ? 'e.g. Program Directives' : 'e.g. Snapshot'}
          onChange={e => setName(e.target.value)}
        />
        {!isSection && (
          <>
            <RadioOptionGroup
              label="When opened in the program"
              name="step-opens"
              value={opens}
              onChange={setOpens}
              options={OPENS_OPTIONS}
            />
            {opens === 'form' && (
              <Select
                label="Form"
                portal
                searchable
                searchPlaceholder="Search forms"
                placeholder="Pick a form"
                options={formOptions}
                value={form?.id || ''}
                onValueChange={(id) => {
                  const picked = formOptions.find(o => o.value === id);
                  setForm(picked ? { id, name: picked.label } : null);
                  if (!name.trim() && picked) setName(picked.label);
                }}
                emptyText="No forms match"
                helperText="Clicking the step in a patient’s program opens this form."
              />
            )}
            {opens === 'screen' && (
              <Select
                label="Screen"
                portal
                searchable
                placeholder="Pick a screen"
                options={STEP_SCREENS.map(sc => ({ value: sc, label: sc }))}
                value={screen}
                onValueChange={setScreen}
              />
            )}
            {sections.length > 0 && (
              <Select
                label="Section"
                portal
                options={[{ value: TOP_LEVEL, label: 'None (top level)' }, ...sections.map(sec => ({ value: sec.id, label: sec.name }))]}
                value={placement}
                onValueChange={setPlacement}
                helperText="Steps in a section are listed under it in the program."
              />
            )}
          </>
        )}
        <SwitchRow
          label="Show"
          hint={isSection ? 'Lists this section and its steps in the program.' : 'Lists this step in the program.'}
          checked={enabled}
          onChange={setEnabled}
        />
        {!isSection && (
          <>
            <SwitchRow
              label="Mandatory"
              hint="The program can’t be completed until this step is reviewed."
              checked={mandatory}
              disabled={!enabled}
              onChange={setMandatory}
            />
            <SwitchRow
              label="Show alert"
              hint="Flags the step with an alert in the program’s step list."
              checked={hasAlert}
              disabled={!enabled}
              onChange={setHasAlert}
            />
          </>
        )}
      </div>
    </Drawer>
  );
}
