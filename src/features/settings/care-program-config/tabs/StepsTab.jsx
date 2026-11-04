import { useState } from 'react';
import { Switch } from '../../../../components/Switch/Switch';
import { Checkbox } from '../../../../components/Checkbox/Checkbox';
import { Icon } from '../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../components/Icon/DownChevronIcon';
import { Link } from '../../../../components/Link/Link';
import { Button } from '../../../../components/Button/Button';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { SortableItem, SortableList } from '../../../../components/SortableList/SortableList';
import { FormsLibraryDrawer } from '../../../forms/FormsLibraryDrawer';
import { holdsAssessments, newId, stepCounts, stepScreen } from '../careProgramConfigModel';
import { StepConfigDrawer } from './StepConfigDrawer';
import styles from '../CareProgramConfig.module.css';

const setAll = (steps, enabled) => steps.map(s => ({ ...s, enabled, ...(s.children ? { children: s.children.map(c => ({ ...c, enabled })) } : {}) }));
const allOn = steps => steps.every(s => s.enabled !== false && (s.children || []).every(c => c.enabled !== false));
const byIds = (list, ids) => ids.map(id => list.find(x => x.id === id)).filter(Boolean);
// What a step opens, shown under its name: "Form: PHQ-9", "Screen: Care Plan" (when renamed).
const opensNote = (step) => {
  if (step.formId) return `Form: ${step.formName || step.name}`;
  const screen = stepScreen(step);
  return screen && screen !== step.name ? `Screen: ${screen}` : null;
};

/**
 * Steps: every step a program can have, in the order patients see them
 * (Figma Simplifying-Implementation 55:42451, the access card). Drag the
 * grip to reorder: a section moves with its steps, and a section's steps
 * reorder within it. Switch a step on to show it and tick Mandatory to make
 * it required. Sections that hold assessments (Program Directives) link
 * more from the Forms library; those can be removed any time. Configure
 * (the gear) sets a step's name, what it opens (a form, a built-in screen or
 * nothing yet), its section, Show, Mandatory and Alert; Add Step adds a new
 * one the same way. Added steps can be removed.
 */
export function StepsTab({ draft, patch }) {
  const steps = draft.steps;
  const setSteps = next => patch({ steps: next });
  const counts = stepCounts(steps);
  const [addingTo, setAddingTo] = useState(null); // section id the Forms library is open for
  const [collapsed, setCollapsed] = useState(() => new Set());
  // The step being configured: { step, sectionId, isNew }.
  const [editing, setEditing] = useState(null);
  const sections = steps.filter(s => s.type === 'section').map(s => ({ id: s.id, name: s.name }));
  const linkedFormIds = steps.flatMap(s => (s.type === 'section' ? (s.children || []) : [s])).map(s => s.formId).filter(Boolean);

  const updateTop = (id, p) => setSteps(steps.map(s => (s.id === id ? { ...s, ...p } : s)));
  const updateChildren = (sectionId, fn) => setSteps(steps.map(s => (s.id === sectionId ? { ...s, children: fn(s.children || []) } : s)));
  const toggleCollapsed = id => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const addForms = (forms) => {
    const added = forms.map(f => ({ id: newId('form'), name: f.name, formId: f.id, formName: f.name, enabled: true, mandatory: false, custom: true }));
    updateChildren(addingTo, children => [...children, ...added]);
    setCollapsed((prev) => { const next = new Set(prev); next.delete(addingTo); return next; });
    setAddingTo(null);
  };

  // Save a configured step: in place when it stays in its section, else
  // moved to the end of its new section (or of the top level).
  const saveStep = (next, toSection) => {
    const { sectionId: fromSection, isNew } = editing;
    setEditing(null);
    if (!isNew && fromSection === toSection) {
      if (fromSection) updateChildren(fromSection, list => list.map(x => (x.id === next.id ? next : x)));
      else updateTop(next.id, next);
      return;
    }
    const without = steps
      .filter(s => s.id !== next.id)
      .map(s => (s.type === 'section' ? { ...s, children: (s.children || []).filter(c => c.id !== next.id) } : s));
    setSteps(toSection
      ? without.map(s => (s.id === toSection ? { ...s, children: [...(s.children || []), next] } : s))
      : [...without, next]);
    if (toSection) setCollapsed((prev) => { const n = new Set(prev); n.delete(toSection); return n; });
  };
  const addStep = () => setEditing({
    step: { id: newId('step'), name: '', enabled: true, mandatory: false, custom: true },
    sectionId: null,
    isNew: true,
  });

  const controls = ({ step, sectionOff = false, onPatch, onRemove, onConfigure, isSection = false }) => {
    const off = step.enabled === false || sectionOff;
    return (
      <span className={styles.accessControls}>
        <span className={styles.colCheck}>
          {!isSection && (
            <Checkbox
              checked={!!step.mandatory}
              disabled={off}
              onCheckedChange={v => onPatch({ mandatory: v === true })}
              aria-label={`${step.name} is mandatory`}
            />
          )}
        </span>
        <span className={styles.colSwitch}>
          <Switch checked={step.enabled !== false} disabled={sectionOff} onChange={enabled => onPatch({ enabled })} ariaLabel={`Show ${step.name}`} />
        </span>
        <span className={styles.colConfigure}>
          {onConfigure && <ActionButton icon="solar:settings-linear" size="sm" tooltip={isSection ? 'Configure section' : 'Configure step'} onClick={onConfigure} />}
        </span>
        <span className={styles.colDelete}>
          {onRemove && <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Remove" onClick={onRemove} />}
        </span>
      </span>
    );
  };

  const renderSection = (section, handle) => {
    const sectionOff = section.enabled === false;
    const children = section.children || [];
    const isCollapsed = collapsed.has(section.id);
    const canAdd = holdsAssessments(section);
    return (
      <>
        <div className={[styles.sectionRow, sectionOff ? styles.accessRowOff : ''].join(' ')}>
          {handle}
          <button
            type="button"
            className={styles.treeToggle}
            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${section.name}`}
            aria-expanded={!isCollapsed}
            onClick={() => toggleCollapsed(section.id)}
          >
            <DownChevronIcon size={14} color="var(--neutral-300)" className={isCollapsed ? styles.treeToggleClosed : undefined} />
          </button>
          <Icon name="solar:folder-linear" size={16} color="var(--neutral-400)" />
          <span className={styles.sectionLabel}>{section.name}</span>
          <span className={styles.sectionCount}>{children.length} {children.length === 1 ? 'step' : 'steps'}</span>
          {canAdd && <Link onClick={() => setAddingTo(section.id)}>+ Add Assessment</Link>}
          {controls({ step: section, isSection: true, onPatch: p => updateTop(section.id, p), onConfigure: () => setEditing({ step: section, sectionId: null }) })}
        </div>
        {!isCollapsed && children.length > 0 && (
          <SortableList ids={children.map(c => c.id)} onReorder={ids => updateChildren(section.id, list => byIds(list, ids))}>
            {children.map((c, i) => (
              <SortableItem key={c.id} id={c.id} label={c.name}>
                {childHandle => (
                  <div className={[styles.accessRow, styles.childRow, i === children.length - 1 ? styles.childLast : '', c.enabled === false || sectionOff ? styles.accessRowOff : ''].join(' ')}>
                    <span className={styles.treeGuide} aria-hidden="true" />
                    {childHandle}
                    <Icon name={canAdd || c.formId ? 'solar:clipboard-text-linear' : 'solar:checklist-minimalistic-linear'} size={16} color="var(--neutral-300)" />
                    <StepLabel step={c} />
                    {controls({
                      step: c,
                      sectionOff,
                      onPatch: p => updateChildren(section.id, list => list.map(x => (x.id === c.id ? { ...x, ...p } : x))),
                      onRemove: canAdd || c.custom ? () => updateChildren(section.id, list => list.filter(x => x.id !== c.id)) : undefined,
                      onConfigure: () => setEditing({ step: c, sectionId: section.id }),
                    })}
                  </div>
                )}
              </SortableItem>
            ))}
          </SortableList>
        )}
        {!isCollapsed && children.length === 0 && (
          <div className={[styles.accessRow, styles.childRow, styles.childLast].join(' ')}>
            <span className={styles.treeGuide} aria-hidden="true" />
            <span className={styles.emptyChild}>{canAdd ? 'No assessments yet. Use + Add Assessment to link forms.' : 'No steps in this section.'}</span>
          </div>
        )}
      </>
    );
  };

  return (
    <section className={styles.accessCard}>
      <div className={styles.accessHead}>
        <span className={styles.accessTitle}>
          <Icon name="solar:checklist-minimalistic-linear" size={16} color="var(--neutral-400)" />
          Program Steps
          <span className={styles.accessCount}>{counts.on} of {counts.total} on, {counts.mandatory} mandatory</span>
        </span>
        <span className={styles.accessHeadRight}>
          <Button variant="outline" leadingIcon="solar:add-circle-linear" onClick={addStep}>Add Step</Button>
          <span className={styles.headerDivider} />
          <span className={styles.allowAll}>Show All</span>
          <Switch checked={steps.length > 0 && allOn(steps)} onChange={on => setSteps(setAll(steps, on))} ariaLabel="Show all steps" />
        </span>
      </div>
      <div className={styles.accessCols}>
        <span className={styles.accessColName}>Steps</span>
        <span className={styles.accessControls}>
          <span className={styles.colCheck}>Mandatory</span>
          <span className={styles.colSwitch}>Show</span>
          <span className={styles.colConfigure} />
          <span className={styles.colDelete} />
        </span>
      </div>
      <SortableList ids={steps.map(s => s.id)} onReorder={ids => setSteps(byIds(steps, ids))}>
        {steps.map(st => (
          <SortableItem key={st.id} id={st.id} label={st.name}>
            {handle => (st.type === 'section' ? renderSection(st, handle) : (
              <div className={[styles.accessRow, st.enabled === false ? styles.accessRowOff : ''].join(' ')}>
                {handle}
                <span className={styles.treeSpacer} aria-hidden="true" />
                <Icon name={st.formId ? 'solar:clipboard-text-linear' : 'solar:checklist-minimalistic-linear'} size={16} color="var(--neutral-400)" />
                <StepLabel step={st} />
                {controls({
                  step: st,
                  onPatch: p => updateTop(st.id, p),
                  onRemove: st.custom ? () => setSteps(steps.filter(x => x.id !== st.id)) : undefined,
                  onConfigure: () => setEditing({ step: st, sectionId: null }),
                })}
              </div>
            ))}
          </SortableItem>
        ))}
      </SortableList>
      {addingTo && (
        <FormsLibraryDrawer
          title={`Add Assessments to ${steps.find(s => s.id === addingTo)?.name || 'Section'}`}
          linkedIds={linkedFormIds}
          onAdd={addForms}
          onClose={() => setAddingTo(null)}
        />
      )}
      {editing && (
        <StepConfigDrawer
          step={editing.step}
          isNew={!!editing.isNew}
          sectionId={editing.sectionId}
          sections={sections}
          onSave={saveStep}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function StepLabel({ step }) {
  const note = opensNote(step);
  return (
    <span className={styles.accessLabel}>
      {step.name}
      {note && <span className={styles.stepNote}>{note}</span>}
    </span>
  );
}
