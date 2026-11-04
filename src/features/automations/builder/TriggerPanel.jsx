import { useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Select } from '../../../components/Select/Select';
import { Alert } from '../../../components/Alert/Alert';
import { CARE_PROGRAM_CATALOG } from '../../patient/data/careProgramCatalog';
import { TRIGGER_GROUPS, TRIGGERS, nodeDef, triggerDef } from '../lib/catalog';
import { PROGRAM_STATUS_TRIGGERS } from '../lib/programStatusRules';
import { EditPanel } from './EditPanel';
import styles from './AutomationBuilder.module.css';

const PROGRAM_OPTIONS = CARE_PROGRAM_CATALOG.map(p => ({ value: p.code, label: `${p.name} (${p.code})` }));
const STATUS_OPTIONS = PROGRAM_STATUS_TRIGGERS.map(t => ({ value: t.key, label: t.label }));
const PROGRAM_TRIGGERS = new Set(['careProgramEnrolled', 'careProgramStatusChanged']);

/** "Run automation, when": pick the event that starts the automation. */
export function TriggerPanel({ graph, current, onSave, onClose }) {
  const [type, setType] = useState(current?.type || null);
  const [programCodes, setProgramCodes] = useState(current?.config?.programCodes || []);
  const [programStatuses, setProgramStatuses] = useState(current?.config?.programStatuses || ['utr']);
  const statusTrigger = type === 'careProgramStatusChanged';
  // Steps that only work after a specific trigger (care plan actions).
  const stranded = (graph?.nodes || []).filter(n => {
    const t = nodeDef(n.type)?.triggers;
    return t && type && !t.includes(type);
  });
  const needs = stranded.length ? triggerDef(nodeDef(stranded[0].type).triggers[0])?.label : null;
  const config = !PROGRAM_TRIGGERS.has(type) ? {} : statusTrigger ? { programCodes, programStatuses } : { programCodes };

  return (
    <EditPanel
      title="Run automation, when"
      onSave={() => onSave(type, config)}
      saveDisabled={!type || (statusTrigger && !programStatuses.length)}
      onClose={onClose}
    >
      {stranded.length > 0 && (
        <Alert tone="warning">
          {stranded.length} care plan step{stranded.length === 1 ? '' : 's'} only run{stranded.length === 1 ? 's' : ''} with the trigger “{needs}”.
        </Alert>
      )}
      {TRIGGER_GROUPS.map(group => (
        <div key={group} className={styles.panelSection}>
          <span className={styles.panelSectionTitle}>{group}</span>
          <div className={styles.triggerList}>
            {TRIGGERS.filter(t => t.group === group).map(t => (
              <button
                key={t.type}
                type="button"
                className={`${styles.triggerOption} ${type === t.type ? styles.triggerOptionActive : ''}`}
                onClick={() => setType(t.type)}
                aria-pressed={type === t.type}
              >
                <Icon name={t.icon} size={18} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          {group === 'Care program' && statusTrigger && (
            <Select
              label="Moves to"
              options={STATUS_OPTIONS}
              value={programStatuses}
              onValueChange={v => setProgramStatuses(v || [])}
              multiple
              checkboxes
              badges
              placeholder="Pick a program status"
            />
          )}
          {group === 'Care program' && PROGRAM_TRIGGERS.has(type) && (
            <Select
              label="Programs"
              options={PROGRAM_OPTIONS}
              value={programCodes}
              onValueChange={v => setProgramCodes(v || [])}
              multiple
              checkboxes
              badges
              placeholder={statusTrigger ? 'All programs (account default)' : 'Any care program'}
            />
          )}
          {group === 'Care program' && statusTrigger && (
            <p className={styles.panelHint}>
              Leave programs empty for the account default. An automation for specific program types overrides the default for those programs.
            </p>
          )}
        </div>
      ))}
    </EditPanel>
  );
}
