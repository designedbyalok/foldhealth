import { useEffect, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Badge } from '../../../components/Badge/Badge';
import { TabStrip } from '../../../components/TabStrip/TabStrip';
import { useAppStore } from '../../../store/useAppStore';
import { PROGRAM_STATUSES, stepCounts } from './careProgramConfigModel';
import { OverviewTab } from './tabs/OverviewTab';
import { StepsTab } from './tabs/StepsTab';
import { WorklistsTab } from './tabs/WorklistsTab';
import { CareTeamTab } from './tabs/CareTeamTab';
import { CompletionTab } from './tabs/CompletionTab';
import { CadenceTab } from './tabs/CadenceTab';
import { AccessTab } from './tabs/AccessTab';
import styles from './CareProgramConfig.module.css';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'steps', label: 'Steps' },
  { key: 'worklists', label: 'Worklists' },
  { key: 'care-team', label: 'Care Team' },
  { key: 'completion', label: 'Completion Criteria' },
  { key: 'cadence', label: 'Cadence' },
  { key: 'access', label: 'Access' },
];

/**
 * One program type's configuration. Edits collect in a working copy and
 * apply on Save, so a half-made change never reaches patients' programs.
 */
export function ProgramTypeDetail({ type, tab, onTab, onDirtyChange }) {
  const saveType = useAppStore(s => s.saveCareProgramType);
  const showToast = useAppStore(s => s.showToast);
  const [draft, setDraft] = useState(type);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(type);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  const patch = p => setDraft(d => ({ ...d, ...p }));
  const status = PROGRAM_STATUSES.find(s => s.value === draft.status) || PROGRAM_STATUSES[0];
  const counts = stepCounts(draft.steps);
  const activeTab = TABS.some(t => t.key === tab) ? tab : 'overview';

  const save = async () => {
    setSaving(true);
    const saved = await saveType(draft);
    setSaving(false);
    if (saved) {
      setDraft(saved);
      showToast?.(`${saved.name} saved`);
    }
  };

  const props = { draft, patch };
  return (
    <>
      <div className={styles.detailTop}>
        <div className={styles.detailHead}>
          <div className={styles.detailTitleRow}>
            <span className={styles.detailTitle}>{draft.name}</span>
            <span className={styles.detailCode}>({draft.code})</span>
            <span className={styles.detailBadges}>
              <Badge size="S" tone="white" icon="solar:checklist-minimalistic-linear" label={`${counts.on}/${counts.total}`} />
              <Badge size="S" tone={status.tone} label={status.label} />
            </span>
          </div>
          <div className={styles.headerActions}>
            {dirty && <span className={styles.dirtyHint}>Unsaved changes</span>}
            <Button variant="outline" disabled={!dirty || saving} onClick={() => setDraft(type)}>Discard</Button>
            <Button disabled={!dirty || !draft.name.trim()} onClick={save} loading={saving}>
              Save Changes
            </Button>
          </div>
        </div>
        <div className={styles.detailTabs}>
          <TabStrip items={TABS} activeKey={activeTab} onChange={onTab} fullWidth={false} />
        </div>
      </div>
      <div className={styles.detailBody}>
        {activeTab === 'overview' && <OverviewTab {...props} onTab={onTab} />}
        {activeTab === 'steps' && <StepsTab {...props} />}
        {activeTab === 'worklists' && <WorklistsTab {...props} />}
        {activeTab === 'care-team' && <CareTeamTab {...props} />}
        {activeTab === 'completion' && <CompletionTab {...props} />}
        {activeTab === 'cadence' && <CadenceTab {...props} />}
        {activeTab === 'access' && <AccessTab {...props} />}
      </div>
    </>
  );
}
