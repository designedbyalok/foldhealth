import { useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../../../components/Button/Button';
import { Toggle } from '../../../../../../../../components/Toggle/Toggle';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { Checkbox } from '../../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { buildCarePlanHtml, downloadCarePlanDocument } from './carePlanExport';
import styles from './CarePlanShareDrawer.module.css';

const TARGETS = ['EHR', 'Patient', 'POA'];
const TARGET_ID = { EHR: 'ehr', Patient: 'patient', POA: 'poa' };

function SectionSelectAll({ label, ids, off, setOff }) {
  const total = ids.length;
  const count = ids.filter(id => !off.has(id)).length;
  const allOn = count === total && total > 0;
  return (
    <div className={styles.sectionHead}>
      <span className={styles.sectionTitle}>{label} <span className={styles.count}>{count}/{total}</span></span>
      <button type="button" className={styles.selectAll} onClick={() => setOff(allOn ? new Set(ids) : new Set())}>
        {allOn ? 'Clear all' : 'Select all'}
      </button>
    </div>
  );
}

// Preview the plan, choose which goals/interventions to include, then download
// a template-based document or share it to the EHR / patient / POA (#8, #13, #40).
export function CarePlanShareDrawer({ patientId, program, data, patientName, canShare = true, onClose }) {
  const sharePatientCarePlan = useAppStore(s => s.sharePatientCarePlan);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const showToast = useAppStore(s => s.showToast);

  const allGoalIds = data.goals.map(g => g.id);
  const allIntvIds = data.interventions.map(i => i.id);
  // Track what's been *deselected* rather than selected, so the default is
  // "everything included" no matter what the plan currently holds — new rows
  // are included by default and a stale set can't leave real rows unchecked.
  const [goalOff, setGoalOff] = useState(() => new Set());
  const [intvOff, setIntvOff] = useState(() => new Set());
  const [target, setTarget] = useState('EHR');
  const [note, setNote] = useState('');
  const [sharing, setSharing] = useState(false);

  const toggleOff = (set, id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  const selectedGoalIds = allGoalIds.filter(id => !goalOff.has(id));
  const selectedIntvIds = allIntvIds.filter(id => !intvOff.has(id));

  const selection = useMemo(() => ({
    conditions: data.conditions.map(c => c.label),
    goals: data.goals.filter(g => !goalOff.has(g.id)),
    interventions: data.interventions.filter(i => !intvOff.has(i.id)),
  }), [data, goalOff, intvOff]);

  const nothingSelected = selection.goals.length === 0 && selection.interventions.length === 0;

  const buildDoc = () => buildCarePlanHtml(
    {
      patientName,
      programName: program.name,
      sharedBy: currentUserProfile?.name || '',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    },
    selection,
  );

  const handleDownload = () => {
    const safe = (patientName || 'patient').replace(/[^a-z0-9]+/gi, '-');
    downloadCarePlanDocument(buildDoc(), `CarePlan-${safe}.html`);
    showToast('Care plan downloaded');
  };

  const handleShare = async () => {
    setSharing(true);
    const rec = await sharePatientCarePlan(patientId, program, {
      target: TARGET_ID[target],
      format: 'standard',
      note: note.trim(),
      goalIds: selectedGoalIds,
      interventionIds: selectedIntvIds,
    });
    setSharing(false);
    if (rec) {
      showToast(`Care plan shared to ${target}`);
      onClose();
    }
  };

  const headerRight = (
    <>
      <Button variant="secondary" size="L" leadingIcon="solar:download-minimalistic-linear" onClick={handleDownload} disabled={nothingSelected}>
        Download
      </Button>
      <Button variant="primary" size="L" leadingIcon="solar:share-linear" onClick={handleShare} disabled={nothingSelected || sharing || !canShare}>
        Share
      </Button>
      <span className={styles.headerDivider} />
    </>
  );

  return (
    <Drawer title="Preview & Share Care Plan" onClose={onClose} headerRight={headerRight} noCloseDivider>
      <div className={styles.body}>
        <div className={styles.field}>
          <span className={styles.label}>Share with</span>
          <Toggle size="S" items={TARGETS} active={target} onChange={setTarget} />
        </div>

        {data.conditions.length > 0 && (
          <div className={styles.field}>
            <span className={styles.label}>Conditions</span>
            <div className={styles.chips}>
              {data.conditions.map(c => <Badge key={c.label} tone="grey" size="S" label={c.label} />)}
            </div>
          </div>
        )}

        <div className={styles.field}>
          <SectionSelectAll label="Goals" ids={allGoalIds} off={goalOff} setOff={setGoalOff} />
          <div className={styles.list}>
            {data.goals.length === 0 && <div className={styles.empty}>No goals on this plan.</div>}
            {data.goals.map(g => (
              <label key={g.id} className={styles.row}>
                <Checkbox checked={!goalOff.has(g.id)} onCheckedChange={() => setGoalOff(s => toggleOff(s, g.id))} aria-label={`Include ${g.title}`} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{g.title}</span>
                  {g.subtitle && <span className={styles.rowSub}>{g.subtitle}</span>}
                </span>
                <span className={styles.rowStatus}>{g.status}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <SectionSelectAll label="Interventions" ids={allIntvIds} off={intvOff} setOff={setIntvOff} />
          <div className={styles.list}>
            {data.interventions.length === 0 && <div className={styles.empty}>No interventions on this plan.</div>}
            {data.interventions.map(i => (
              <label key={i.id} className={styles.row}>
                <Checkbox checked={!intvOff.has(i.id)} onCheckedChange={() => setIntvOff(s => toggleOff(s, i.id))} aria-label={`Include ${i.title}`} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{i.title}</span>
                  <span className={styles.rowSub}>{i.assignee?.name}</span>
                </span>
                <span className={styles.rowStatus}>{i.status}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Note <span className={styles.optional}>(optional)</span></span>
          <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note for the recipient" rows={2} />
        </div>

        {nothingSelected && (
          <div className={styles.warn}>
            <Icon name="solar:info-circle-linear" size={14} color="var(--status-warning)" />
            Select at least one goal or intervention to download or share.
          </div>
        )}
        {!canShare && (
          <div className={styles.warn}>
            <Icon name="solar:info-circle-linear" size={14} color="var(--status-warning)" />
            Add a goal to save this plan before sharing. You can still download a preview.
          </div>
        )}
      </div>
    </Drawer>
  );
}
