import { useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { SplitDrawerLayout } from '../../../../../../../../components/Drawer/SplitDrawerLayout';
import { Button } from '../../../../../../../../components/Button/Button';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { Checkbox } from '../../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { MenuPopover } from '../../../../../../../../components/MenuPopover/MenuPopover';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { buildCarePlanDownloadFilename, downloadCarePlanPdf } from '../../lib/carePlanExport';
import { CarePlanPdfPreview } from './CarePlanPdfPreview';
import { GbiStatusButton } from '../../tables/carePlanTableShared';
import styles from './CarePlanShareDrawer.module.css';

const TARGET_ID = { EHR: 'ehr', Patient: 'patient', POA: 'poa' };
const GBI_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Met', 'Not Met'];

function SectionSelectAll({ label, ids, off, setOff, collapsed, onToggle }) {
  const total = ids.length;
  const count = ids.filter(id => !off.has(id)).length;
  const allOn = count === total && total > 0;
  return (
    <div className={styles.sectionHead}>
      <span className={styles.sectionHeadLeft}>
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
        >
          <DownChevronIcon
            size={14}
            color="var(--neutral-300)"
            className={`${styles.collapseChevron} ${collapsed ? styles.collapseChevronCollapsed : ''}`}
          />
        </button>
        <span className={styles.sectionTitle}>{label} <span className={styles.count}>{count}/{total}</span></span>
      </span>
      <button type="button" className={styles.selectAll} onClick={() => setOff(allOn ? new Set(ids) : new Set())}>
        {allOn ? 'Clear all' : 'Select all'}
      </button>
    </div>
  );
}

function applyPatches(items, patches) {
  return items.map(item => {
    const patch = patches[item.id];
    return patch ? { ...item, ...patch } : item;
  });
}

// Preview the plan, choose which goals/interventions to include, then download
// a PDF or share it to the EHR / patient / POA (#8, #13, #40).
export function CarePlanShareDrawer({ patientId, program, data, patientName, canShare = true, onClose }) {
  const sharePatientCarePlan = useAppStore(s => s.sharePatientCarePlan);
  const signCarePlan = useAppStore(s => s.signCarePlan);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const showToast = useAppStore(s => s.showToast);

  const allGoalIds = data.goals.map(g => g.id);
  const allIntvIds = data.interventions.map(i => i.id);
  const allBarrierIds = (data.barriers || []).map(b => b.id);

  const [goalOff, setGoalOff] = useState(() => new Set());
  const [intvOff, setIntvOff] = useState(() => new Set());
  const [barrierOff, setBarrierOff] = useState(() => new Set());
  const [statusPatches, setStatusPatches] = useState({});
  const [statusMenu, setStatusMenu] = useState(null);
  const [note, setNote] = useState('');
  const [sharing, setSharing] = useState(false);
  // Per-section collapse (Goals / Interventions / Barriers).
  const [collapsed, setCollapsed] = useState({});
  const toggleCollapsed = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }));

  const toggleOff = (set, id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  const selectedGoalIds = allGoalIds.filter(id => !goalOff.has(id));
  const selectedIntvIds = allIntvIds.filter(id => !intvOff.has(id));

  const patchedGoals = useMemo(
    () => applyPatches(data.goals, statusPatches),
    [data.goals, statusPatches],
  );
  const patchedInterventions = useMemo(
    () => applyPatches(data.interventions, statusPatches),
    [data.interventions, statusPatches],
  );
  const patchedBarriers = useMemo(
    () => applyPatches(data.barriers || [], statusPatches),
    [data.barriers, statusPatches],
  );

  const selection = useMemo(() => ({
    conditions: data.conditions.map(c => c.label),
    goals: patchedGoals.filter(g => !goalOff.has(g.id)),
    interventions: patchedInterventions.filter(i => !intvOff.has(i.id)),
    barriers: patchedBarriers.filter(b => !barrierOff.has(b.id)),
  }), [data.conditions, patchedGoals, patchedInterventions, patchedBarriers, goalOff, intvOff, barrierOff]);

  const nothingSelected = selection.goals.length === 0
    && selection.interventions.length === 0
    && selection.barriers.length === 0;

  const docMeta = useMemo(() => ({
    patientName,
    programName: program.name,
    sharedBy: currentUserProfile?.name || '',
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    note: note.trim(),
  }), [patientName, program.name, currentUserProfile?.name, note]);

  const handleDownload = () => {
    downloadCarePlanPdf(
      docMeta,
      selection,
      buildCarePlanDownloadFilename({
        patientName,
        programCode: program.code,
        programName: program.name,
      }),
    );
    showToast('Care plan downloaded');
  };

  const handleShare = async (shareTarget = 'EHR') => {
    setSharing(true);
    const rec = await sharePatientCarePlan(patientId, program, {
      target: TARGET_ID[shareTarget],
      format: 'standard',
      note: note.trim(),
      goalIds: selectedGoalIds,
      interventionIds: selectedIntvIds,
    });
    if (!rec) { setSharing(false); return; }
    const version = await signCarePlan(patientId, program, note.trim());
    setSharing(false);
    showToast(version
      ? `Care plan signed and shared to ${shareTarget}`
      : `Care plan shared to ${shareTarget}`);
    onClose();
  };

  const changeStatus = (status) => {
    if (!statusMenu) return;
    const { id } = statusMenu;
    setStatusPatches(prev => ({ ...prev, [id]: { status } }));
    setStatusMenu(null);
  };

  const headerRight = (
    <>
      <Button variant="secondary" size="L" leadingIcon="solar:download-minimalistic-linear" onClick={handleDownload} disabled={nothingSelected}>
        Download PDF
      </Button>
      <Button
        variant="primary"
        size="L"
        leadingIcon="solar:share-linear"
        onClick={() => handleShare('EHR')}
        disabled={nothingSelected || sharing || !canShare}
        menuItems={[
          { key: 'EHR', label: 'Share to EHR' },
          { key: 'Patient', label: 'Share to Patient' },
          { key: 'POA', label: 'Share to POA' },
        ]}
        onMenuSelect={(key) => handleShare(key)}
        menuAriaLabel="Share to"
      >
        Share
      </Button>
      <span className={styles.headerDivider} />
    </>
  );

  const editorPane = (
    <div className={styles.editorScroll}>
      <div className={styles.body}>
        {data.conditions.length > 0 && (
          <div className={styles.field}>
            <span className={styles.label}>Conditions</span>
            <div className={styles.chips}>
              {data.conditions.map(c => <Badge key={c.label} tone="grey" size="S" label={c.label} />)}
            </div>
          </div>
        )}

        <div className={styles.field}>
          <SectionSelectAll label="Goals" ids={allGoalIds} off={goalOff} setOff={setGoalOff} collapsed={collapsed.goals} onToggle={() => toggleCollapsed('goals')} />
          {!collapsed.goals && (
          <div className={styles.list}>
            {data.goals.length === 0 && <div className={styles.empty}>No goals on this plan.</div>}
            {patchedGoals.map(g => (
              <div key={g.id} className={styles.row}>
                <Checkbox checked={!goalOff.has(g.id)} onCheckedChange={() => setGoalOff(s => toggleOff(s, g.id))} aria-label={`Include ${g.title}`} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{g.title}</span>
                  {g.subtitle && <span className={styles.rowSub}>{g.subtitle}</span>}
                </span>
                <span className={styles.rowStatus}>
                  <GbiStatusButton
                    value={g.status}
                    onOpen={rect => setStatusMenu({ kind: 'goal', id: g.id, rect })}
                  />
                </span>
              </div>
            ))}
          </div>
          )}
        </div>

        <div className={styles.field}>
          <SectionSelectAll label="Interventions" ids={allIntvIds} off={intvOff} setOff={setIntvOff} collapsed={collapsed.interventions} onToggle={() => toggleCollapsed('interventions')} />
          {!collapsed.interventions && (
          <div className={styles.list}>
            {data.interventions.length === 0 && <div className={styles.empty}>No interventions on this plan.</div>}
            {patchedInterventions.map(i => (
              <div key={i.id} className={styles.row}>
                <Checkbox checked={!intvOff.has(i.id)} onCheckedChange={() => setIntvOff(s => toggleOff(s, i.id))} aria-label={`Include ${i.title}`} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{i.title}</span>
                  <span className={styles.rowSub}>{i.assignee?.name}</span>
                </span>
                <span className={styles.rowStatus}>
                  <GbiStatusButton
                    value={i.status}
                    onOpen={rect => setStatusMenu({ kind: 'intv', id: i.id, rect })}
                  />
                </span>
              </div>
            ))}
          </div>
          )}
        </div>

        {allBarrierIds.length > 0 && (
          <div className={styles.field}>
            <SectionSelectAll label="Barriers" ids={allBarrierIds} off={barrierOff} setOff={setBarrierOff} collapsed={collapsed.barriers} onToggle={() => toggleCollapsed('barriers')} />
            {!collapsed.barriers && (
            <div className={styles.list}>
              {patchedBarriers.map(b => (
                <div key={b.id} className={styles.row}>
                  <Checkbox checked={!barrierOff.has(b.id)} onCheckedChange={() => setBarrierOff(s => toggleOff(s, b.id))} aria-label={`Include ${b.title}`} />
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{b.title}</span>
                  </span>
                  <span className={styles.rowStatus}>
                    <GbiStatusButton
                      value={b.status}
                      onOpen={rect => setStatusMenu({ kind: 'barrier', id: b.id, rect })}
                    />
                  </span>
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        <div className={styles.field}>
          <span className={styles.label}>Note <span className={styles.optional}>(optional)</span></span>
          <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note for the recipient" rows={2} />
        </div>

        {nothingSelected && (
          <div className={styles.warn}>
            <Icon name="solar:info-circle-linear" size={14} color="var(--status-warning)" />
            Select at least one goal, intervention, or barrier to preview or download.
          </div>
        )}
        {!canShare && (
          <div className={styles.warn}>
            <Icon name="solar:info-circle-linear" size={14} color="var(--status-warning)" />
            Add a goal to save this plan before sharing. You can still download a preview.
          </div>
        )}
      </div>
    </div>
  );

  const previewPane = (
    <div className={styles.previewPane}>
      <CarePlanPdfPreview
        docMeta={docMeta}
        selection={selection}
        nothingSelected={nothingSelected}
      />
    </div>
  );

  return (
    <>
      <Drawer
        title="Preview & Share Care Plan"
        onClose={onClose}
        headerRight={headerRight}
        noCloseDivider
        width={1300}
        bodyClassName={SplitDrawerLayout.bodyClassName}
      >
        <SplitDrawerLayout left={previewPane} right={editorPane} />
      </Drawer>

      {statusMenu && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          align="left"
          width={160}
          ariaLabel="Change status"
          items={GBI_STATUSES.map(s => ({ key: s, label: s }))}
          onSelect={changeStatus}
          onClose={() => setStatusMenu(null)}
        />
      )}
    </>
  );
}
