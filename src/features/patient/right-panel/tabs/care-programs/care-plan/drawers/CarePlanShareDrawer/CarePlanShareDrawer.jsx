import { useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { SplitDrawerLayout } from '../../../../../../../../components/Drawer/SplitDrawerLayout';
import { Button } from '../../../../../../../../components/Button/Button';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { Checkbox } from '../../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { FilterChip } from '../../../../../../../../components/FilterChip/FilterChip';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { buildCarePlanDownloadFilename, downloadCarePlanPdf } from '../../lib/carePlanExport';
import {
  SHARE_DATE_OPTIONS,
  SHARE_FILTERS_DEFAULT,
  SHARE_GBI_STATUSES,
  SHARE_PRIORITY_LABELS,
  isShareFiltersActive,
  matchesShareFilters,
} from '../../lib/carePlanShareFilters';
import { CarePlanPdfPreview } from './CarePlanPdfPreview';
import styles from './CarePlanShareDrawer.module.css';

const TARGET_ID = { EHR: 'ehr', Patient: 'patient', POA: 'poa' };

function SectionSelectAll({ label, ids, off, setOff, collapsed, onToggle }) {
  const total = ids.length;
  const count = ids.filter(id => !off.has(id)).length;
  const allOn = count === total && total > 0;
  return (
    <div className={styles.sectionHead}>
      <button
        type="button"
        className={styles.sectionToggle}
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <DownChevronIcon
          size={12}
          color="var(--neutral-400)"
          className={`${styles.sectionChevron} ${collapsed ? '' : styles.sectionChevronOpen}`}
        />
        <span className={styles.sectionTitle}>
          {label}
          {' '}
          <span className={styles.count}>{count}/{total}</span>
        </span>
      </button>
      <button
        type="button"
        className={styles.selectAll}
        onClick={() => setOff(allOn ? new Set(ids) : new Set())}
      >
        {allOn ? 'Clear all' : 'Select all'}
      </button>
    </div>
  );
}

function SectionToggleHead({ title, collapsed, onToggle, trailing }) {
  return (
    <div className={styles.sectionHead}>
      <button
        type="button"
        className={styles.sectionToggle}
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <DownChevronIcon
          size={12}
          color="var(--neutral-400)"
          className={`${styles.sectionChevron} ${collapsed ? '' : styles.sectionChevronOpen}`}
        />
        <span className={styles.sectionTitle}>{title}</span>
      </button>
      {trailing}
    </div>
  );
}

// Preview the plan, choose which goals/interventions to include, then download
// a PDF or share it to the EHR / patient / POA (#8, #13, #40).
export function CarePlanShareDrawer({ patientId, program, data, patientName, canShare = true, onClose }) {
  const sharePatientCarePlan = useAppStore(s => s.sharePatientCarePlan);
  const signCarePlan = useAppStore(s => s.signCarePlan);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const showToast = useAppStore(s => s.showToast);
  const lastVisit = useAppStore((s) => {
    const p = (s.patients || []).find(x => x.id === patientId)
      || (s.allPatients || []).find(x => x.id === patientId);
    return p?.lastVisit || p?.last_visit || null;
  });

  const [shareFilters, setShareFilters] = useState(() => ({ ...SHARE_FILTERS_DEFAULT }));
  const setShareFilter = (key, value) => setShareFilters(f => ({ ...f, [key]: value }));
  const clearShareFilters = () => setShareFilters({ ...SHARE_FILTERS_DEFAULT });
  const filtersActive = isShareFiltersActive(shareFilters);

  const filterCtx = useMemo(
    () => ({ lastVisitIso: lastVisit }),
    [lastVisit],
  );

  const filteredGoals = useMemo(
    () => data.goals.filter(g => matchesShareFilters(g, shareFilters, filterCtx)),
    [data.goals, shareFilters, filterCtx],
  );
  const filteredInterventions = useMemo(
    () => data.interventions.filter(i => matchesShareFilters(i, shareFilters, { ...filterCtx, kind: 'intervention' })),
    [data.interventions, shareFilters, filterCtx],
  );
  const filteredBarriers = useMemo(
    () => (data.barriers || []).filter(b => matchesShareFilters(b, shareFilters, filterCtx)),
    [data.barriers, shareFilters, filterCtx],
  );

  const assigneeOptions = useMemo(
    () => [...new Set((data.interventions || []).map(i => i.assignee?.name).filter(Boolean))],
    [data.interventions],
  );

  const filteredGoalIds = useMemo(() => filteredGoals.map(g => g.id), [filteredGoals]);
  const filteredIntvIds = useMemo(() => filteredInterventions.map(i => i.id), [filteredInterventions]);
  const filteredBarrierIds = useMemo(() => filteredBarriers.map(b => b.id), [filteredBarriers]);

  const [goalOff, setGoalOff] = useState(() => new Set());
  const [intvOff, setIntvOff] = useState(() => new Set());
  const [barrierOff, setBarrierOff] = useState(() => new Set());
  const [note, setNote] = useState('');
  const [sharing, setSharing] = useState(false);
  // Per-section collapse (Goals / Interventions / Barriers).
  const [collapsed, setCollapsed] = useState({});
  const toggleCollapsed = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }));

  const toggleConditionFilter = (label) => {
    setShareFilters((f) => {
      const set = new Set(f.conditions || []);
      if (set.has(label)) set.delete(label);
      else set.add(label);
      return { ...f, conditions: [...set] };
    });
  };

  const conditionLabels = useMemo(
    () => (data.conditions || []).map(c => c.label).filter(Boolean),
    [data.conditions],
  );

  const toggleOff = (set, id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  const selectedGoalIds = filteredGoals.filter(g => !goalOff.has(g.id)).map(g => g.id);
  const selectedIntvIds = filteredInterventions.filter(i => !intvOff.has(i.id)).map(i => i.id);

  const selection = useMemo(() => ({
    conditions: data.conditions.map(c => c.label),
    goals: filteredGoals.filter(g => !goalOff.has(g.id)),
    interventions: filteredInterventions.filter(i => !intvOff.has(i.id)),
    barriers: filteredBarriers.filter(b => !barrierOff.has(b.id)),
  }), [data.conditions, filteredGoals, filteredInterventions, filteredBarriers, goalOff, intvOff, barrierOff]);

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

  const dateChipSelected = useMemo(() => {
    if (shareFilters.datePreset === 'all') return [];
    const opt = SHARE_DATE_OPTIONS.find(o => o.key === shareFilters.datePreset);
    return opt ? [opt.label] : [];
  }, [shareFilters.datePreset]);

  const editorPane = (
    <div className={styles.editorScroll}>
      <div className={styles.filterBar}>
          <FilterChip
            label="Date"
            options={SHARE_DATE_OPTIONS.map(o => o.label)}
            selected={dateChipSelected}
            singleSelect
            onChange={(next) => {
              const pick = next[0];
              const opt = SHARE_DATE_OPTIONS.find(o => o.label === pick);
              setShareFilter('datePreset', opt?.key || 'all');
            }}
          />
          <FilterChip
            label="Status"
            options={SHARE_GBI_STATUSES}
            selected={shareFilters.status}
            onChange={(v) => setShareFilter('status', v)}
          />
          <FilterChip
            label="Priority"
            options={SHARE_PRIORITY_LABELS}
            selected={shareFilters.priority}
            onChange={(v) => setShareFilter('priority', v)}
          />
          {assigneeOptions.length > 0 && (
            <FilterChip
              label="Assignee"
              options={assigneeOptions}
              selected={shareFilters.assignee}
              searchable
              onChange={(v) => setShareFilter('assignee', v)}
            />
          )}
          {filtersActive && (
            <button type="button" className={styles.clearFilters} onClick={clearShareFilters}>
              <Icon name="solar:backspace-linear" size={16} color="var(--primary-300)" />
              Clear all
            </button>
          )}
      </div>

      <div className={styles.body}>
        <div className={styles.field}>
          <SectionToggleHead
            title={<>Note <span className={styles.optional}>(optional)</span></>}
            collapsed={collapsed.note}
            onToggle={() => toggleCollapsed('note')}
          />
          {!collapsed.note && (
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note for the recipient"
              rows={2}
            />
          )}
        </div>

        {conditionLabels.length > 0 && (
          <div className={styles.field}>
            <SectionToggleHead
              title="Conditions"
              collapsed={collapsed.conditions}
              onToggle={() => toggleCollapsed('conditions')}
              trailing={shareFilters.conditions?.length > 0 ? (
                <button
                  type="button"
                  className={styles.selectAll}
                  onClick={() => setShareFilter('conditions', [])}
                >
                  Clear filter
                </button>
              ) : null}
            />
            {!collapsed.conditions && (
              <div className={styles.chips}>
                {conditionLabels.map((label) => {
                  const active = shareFilters.conditions?.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      className={styles.conditionChipBtn}
                      aria-pressed={active}
                      onClick={() => toggleConditionFilter(label)}
                    >
                      <Badge tone={active ? 'primary' : 'grey'} size="S" label={label} />
                    </button>
                  );
                })}
              </div>
            )}
            {shareFilters.conditions?.length > 0 && (
              <p className={styles.filterHint}>Showing goals, interventions, and barriers related to selected conditions.</p>
            )}
          </div>
        )}

        <div className={styles.field}>
          <SectionSelectAll label="Goals" ids={filteredGoalIds} off={goalOff} setOff={setGoalOff} collapsed={collapsed.goals} onToggle={() => toggleCollapsed('goals')} />
          {!collapsed.goals && (
          <div className={styles.list}>
            {data.goals.length === 0 && <div className={styles.empty}>No goals on this plan.</div>}
            {data.goals.length > 0 && filteredGoals.length === 0 && (
              <div className={styles.empty}>No goals match the filters.</div>
            )}
            {filteredGoals.map(g => (
              <div key={g.id} className={styles.row}>
                <Checkbox checked={!goalOff.has(g.id)} onCheckedChange={() => setGoalOff(s => toggleOff(s, g.id))} aria-label={`Include ${g.title}`} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{g.title}</span>
                  {g.subtitle && <span className={styles.rowSub}>{g.subtitle}</span>}
                </span>
              </div>
            ))}
          </div>
          )}
        </div>

        <div className={styles.field}>
          <SectionSelectAll label="Interventions" ids={filteredIntvIds} off={intvOff} setOff={setIntvOff} collapsed={collapsed.interventions} onToggle={() => toggleCollapsed('interventions')} />
          {!collapsed.interventions && (
          <div className={styles.list}>
            {data.interventions.length === 0 && <div className={styles.empty}>No interventions on this plan.</div>}
            {data.interventions.length > 0 && filteredInterventions.length === 0 && (
              <div className={styles.empty}>No interventions match the filters.</div>
            )}
            {filteredInterventions.map(i => (
              <div key={i.id} className={styles.row}>
                <Checkbox checked={!intvOff.has(i.id)} onCheckedChange={() => setIntvOff(s => toggleOff(s, i.id))} aria-label={`Include ${i.title}`} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{i.title}</span>
                  <span className={styles.rowSub}>{i.assignee?.name}</span>
                </span>
              </div>
            ))}
          </div>
          )}
        </div>

        {(data.barriers || []).length > 0 && (
          <div className={styles.field}>
            <SectionSelectAll label="Barriers" ids={filteredBarrierIds} off={barrierOff} setOff={setBarrierOff} collapsed={collapsed.barriers} onToggle={() => toggleCollapsed('barriers')} />
            {!collapsed.barriers && (
            <div className={styles.list}>
              {filteredBarriers.length === 0 && (
                <div className={styles.empty}>No barriers match the filters.</div>
              )}
              {filteredBarriers.map(b => (
                <div key={b.id} className={styles.row}>
                  <Checkbox checked={!barrierOff.has(b.id)} onCheckedChange={() => setBarrierOff(s => toggleOff(s, b.id))} aria-label={`Include ${b.title}`} />
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{b.title}</span>
                  </span>
                </div>
              ))}
            </div>
            )}
          </div>
        )}

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
    </>
  );
}
