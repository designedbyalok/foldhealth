import { useEffect, useMemo, useState } from 'react';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Toggle } from '../../../components/Toggle/Toggle';
import { Alert } from '../../../components/Alert/Alert';
import { useAppStore } from '../../../store/useAppStore';
import { RUN_SCHEDULES, nodeDef, triggerDef } from '../lib/catalog';
import { getNode } from '../lib/graph';
import { EditPanel } from './EditPanel';
import styles from './AutomationBuilder.module.css';

const DESC_MAX = 150;
const TIMES = Array.from({ length: 24 }, (_, h) => {
  const v = `${String(h).padStart(2, '0')}:00`;
  const label = new Date(2026, 0, 1, h).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return { value: v, label };
});

/**
 * Save Automation (Figma 134583 / 134597): name, description, population
 * group, when it runs, and whether it goes live. Publishing needs every step
 * set up; saving as a draft doesn't.
 */
export function SavePanel({ state, graph, problems, onSave, onClose, onShowProblem, saving }) {
  const popGroups = useAppStore(s => s.popGroups);
  const fetchPopGroups = useAppStore(s => s.fetchPopGroups);
  useEffect(() => { if (!popGroups?.length) fetchPopGroups?.(); }, [popGroups?.length, fetchPopGroups]);

  const [name, setName] = useState(state.name === 'New Automation' ? '' : state.name);
  const [description, setDescription] = useState(state.description || '');
  const [groupId, setGroupId] = useState(state.populationGroupId || '');
  const [schedule, setSchedule] = useState(state.schedule || 'onTrigger');
  const [runTime, setRunTime] = useState(state.runTime || '09:00');
  const [goLive, setGoLive] = useState(state.status === 'active' ? 'active' : state.status === 'inactive' ? 'inactive' : 'draft');
  const [tried, setTried] = useState(false);

  const groupOptions = useMemo(() => [
    { value: '', label: 'None' },
    ...(popGroups || []).map(g => ({ value: String(g.id), label: `${g.name} (${g.count ?? 0})` })),
    // A saved name with no matching group in this account (seeded sample).
    ...(state.populationGroupName && !state.populationGroupId ? [{ value: '__saved', label: state.populationGroupName }] : []),
  ], [popGroups, state.populationGroupName, state.populationGroupId]);

  const trig = triggerDef(getNode(graph, 'trigger')?.type);
  const scheduled = ['daily', 'weekly', 'monthly'].includes(schedule);
  const errors = {
    name: !name.trim() ? 'This field can’t be empty' : null,
    description: !description.trim() ? 'This field can’t be empty' : description.length > DESC_MAX ? `Keep it under ${DESC_MAX} characters` : null,
  };
  const blocked = goLive === 'active' && problems.length > 0;

  const submit = () => {
    setTried(true);
    if (errors.name || errors.description || blocked) return;
    const group = (popGroups || []).find(g => String(g.id) === groupId);
    onSave({
      name: name.trim(),
      description: description.trim(),
      populationGroupId: group ? String(group.id) : null,
      populationGroupName: group ? group.name : groupId === '__saved' ? state.populationGroupName : null,
      schedule,
      runTime: scheduled ? runTime : null,
      status: goLive,
    });
  };

  return (
    <EditPanel title="Save Automation" onSave={submit} saveLabel={saving ? 'Saving…' : goLive === 'active' ? 'Publish' : 'Save'} saveDisabled={saving} onClose={onClose} width={464}>
      <div className={styles.saveFields}>
        <Input label="Automation name" required value={name} onChange={e => setName(e.target.value)} maxLength={120} errorText={tried ? errors.name : undefined} />
        <Textarea
          title="Description"
          mandatory
          value={description}
          onValueChange={text => setDescription(text)}
          rows={3}
          placeholder="Tell your team what this automation does"
          maxLength={DESC_MAX}
          invalid={tried && errors.description}
        />
        <Select label="Associated population group" options={groupOptions} value={groupId || (state.populationGroupName && !state.populationGroupId ? '__saved' : '')} onValueChange={setGroupId} searchable />
        <Select
          label="Run automation"
          required
          options={RUN_SCHEDULES.map(s => ({ value: s.value, label: s.value === 'onTrigger' && trig ? `When “${trig.label.toLowerCase()}”` : s.label }))}
          value={schedule}
          onValueChange={setSchedule}
          leadingIcon="solar:clock-circle-linear"
        />
        {scheduled && <Select label="At" options={TIMES} value={runTime} onValueChange={setRunTime} />}
        <div className={styles.saveStatus}>
          <span className={styles.panelSectionTitle}>After saving</span>
          <Toggle
            size="sm"
            items={[{ key: 'draft', label: 'Keep as draft' }, { key: 'active', label: 'Publish (Active)' }, { key: 'inactive', label: 'Inactive' }]}
            value={goLive}
            onValueChange={setGoLive}
          />
        </div>
        {goLive === 'active' && problems.length > 0 && (
          <Alert tone={tried ? 'error' : 'warning'}>
            <span>Finish these steps before publishing:</span>
            <ul className={styles.problemList}>
              {problems.map(p => {
                const node = getNode(graph, p.nodeId);
                const label = p.nodeId === 'trigger' ? 'Trigger' : nodeDef(node?.type)?.nodeLabel || 'Step';
                return (
                  <li key={p.nodeId}>
                    <button type="button" className={styles.linkButton} onClick={() => onShowProblem(p.nodeId)}>{label}</button>
                    {`: ${p.problems.map(x => x.label).join(', ')}`}
                  </li>
                );
              })}
            </ul>
          </Alert>
        )}
      </div>
    </EditPanel>
  );
}
