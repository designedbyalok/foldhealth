import { useState } from 'react';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../../../components/Avatar/Avatar';
import { Switch } from '../../../../../components/Switch/Switch';
import { PanelSection, PanelSectionItem } from '../../../../../components/PanelSection/PanelSection';
import styles from './ActiveAutomationsWidget.module.css';

const AUTOMATIONS = [
  {
    id: 1,
    title: 'Send email when task is delayed',
    description:
      'When a task is delayed beyond due date, send a reminder email to assigned person as well as everyone who is part of pool.',
    defaultOn: true,
  },
  {
    id: 2,
    title: 'Send Task Completion Email',
    description: 'When a task is complete, inform everyone in task pool via email.',
    defaultOn: false,
  },
];

export function ActiveAutomationsWidget() {
  const [states, setStates] = useState(() => Object.fromEntries(AUTOMATIONS.map(a => [a.id, a.defaultOn])));

  return (
    <PanelSection
      icon="solar:bolt-linear"
      title="Active Automations"
      actions={<ActionButton icon="solar:refresh-linear" size="sm" tooltip="Refresh" />}
    >
      {AUTOMATIONS.map(a => (
        <PanelSectionItem
          key={a.id}
          leading={<Avatar type="icon" variant="patient" iconName="solar:bolt-linear" size="M" />}
          title={a.title}
          trailing={(
            <>
              <ActionButton icon="solar:eye-linear" size="sm" tooltip="View Automation" />
              <Switch checked={states[a.id]} onChange={val => setStates(prev => ({ ...prev, [a.id]: val }))} />
            </>
          )}
        >
          <span className={styles.description} title={a.description}>{a.description}</span>
        </PanelSectionItem>
      ))}
    </PanelSection>
  );
}
