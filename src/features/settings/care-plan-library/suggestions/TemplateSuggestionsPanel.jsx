import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionTitleBar } from '../../../../components/SectionTitleBar/SectionTitleBar';
import { WorklistShell } from '../../../../components/WorklistShell/WorklistShell';
import { FilterChip } from '../../../../components/FilterChip/FilterChip';
import { Badge } from '../../../../components/Badge/Badge';
import { Button } from '../../../../components/Button/Button';
import { Alert } from '../../../../components/Alert/Alert';
import { Icon } from '../../../../components/Icon/Icon';
import { TableSkeleton } from '../../../../components/TableSkeleton/TableSkeleton';
import { RingEmptyState } from '../../../../components/RingEmptyState/RingEmptyState';
import { toast } from '../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../store/useAppStore';
import { useCanManageTemplates } from '../lib/useCanManageTemplates';
import styles from './TemplateSuggestionsPanel.module.css';

const KINDS = {
  retire: { label: 'Retire', tone: 'grey', icon: 'solar:archive-down-linear', accept: 'Retire' },
  abandon: { label: 'High abandon', tone: 'warning', icon: 'solar:undo-left-round-linear', accept: 'Revise' },
  goal_attainment: { label: 'Low goal attainment', tone: 'error', icon: 'solar:flag-linear', accept: 'Revise' },
  split: { label: 'Split', tone: 'info', icon: 'solar:scissors-linear', accept: 'Split' },
  merge: { label: 'Merge', tone: 'primary', icon: 'solar:merge-linear', accept: 'Merge' },
};
const KIND_BY_LABEL = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [v.label, k]));
const STATUS_LABEL = { open: 'Open', accepted: 'Accepted', dismissed: 'Dismissed', resolved: 'Resolved' };
const STATUS_TONE = { open: 'primary', accepted: 'success', dismissed: 'grey', resolved: 'grey' };
const STATUS_BY_LABEL = Object.fromEntries(Object.entries(STATUS_LABEL).map(([k, v]) => [v, k]));

const COLUMNS = [
  { key: 'template', label: 'Template', sortKey: 'templateName', sticky: 'left', left: 0, width: 280 },
  { key: 'kind', label: 'Suggestion', sortKey: 'kind', width: 170 },
  { key: 'why', label: 'Why', width: 460 },
  { key: 'detected', label: 'Detected', sortKey: 'detectedAt', width: 110 },
  { key: 'status', label: 'Status', sortKey: 'status', width: 110 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 190 },
];

const fmtDay = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};

/**
 * Care Plan Library > Suggestions: what the nightly template analysis flagged
 * (rarely used, often removed while authoring, goals rarely met, split or
 * merge candidates). Supervisors accept or dismiss each in one click. Accept
 * retires the template outright; the other kinds open it in the editor,
 * since splitting or rewriting a clinical template is a person's call.
 *
 * Rendered as one of the library's tabs, so it draws the library's tab strip.
 */
export function TemplateSuggestionsPanel({ tabs, activeTab, onTabChange }) {
  const suggestions = useAppStore(s => s.templateSuggestions);
  const loading = useAppStore(s => s.templateSuggestionsLoading);
  const didFetch = useAppStore(s => s.templateSuggestionsDidFetch);
  const missing = useAppStore(s => s.templateSuggestionsMissing);
  const wording = useAppStore(s => s.templateSuggestionsWording);
  const fetchTemplateSuggestions = useAppStore(s => s.fetchTemplateSuggestions);
  const runTemplateAnalysis = useAppStore(s => s.runTemplateAnalysis);
  const decideTemplateSuggestion = useAppStore(s => s.decideTemplateSuggestion);
  const reopenTemplateSuggestion = useAppStore(s => s.reopenTemplateSuggestion);
  const wordTemplateSuggestions = useAppStore(s => s.wordTemplateSuggestions);
  const templates = useAppStore(s => s.carePlanTemplates);
  const libraryDidFetch = useAppStore(s => s.carePlanLibraryDidFetch);
  const fetchCarePlanLibrary = useAppStore(s => s.fetchCarePlanLibrary);
  const setCarePlanTemplateScreen = useAppStore(s => s.setCarePlanTemplateScreen);
  const canManage = useCanManageTemplates();

  useEffect(() => { fetchCarePlanLibrary(); fetchTemplateSuggestions(); }, [fetchCarePlanLibrary, fetchTemplateSuggestions]);

  // Word new suggestions once both lists are in; once per visit is enough.
  const worded = useRef(false);
  useEffect(() => {
    if (!canManage || worded.current || !didFetch || !libraryDidFetch || !suggestions.length) return;
    worded.current = true;
    wordTemplateSuggestions();
  }, [canManage, didFetch, libraryDidFetch, suggestions.length, wordTemplateSuggestions]);

  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState(['Open']);
  const [sort, setSort] = useState({ key: 'detectedAt', dir: 'desc' });
  const [busyId, setBusyId] = useState(null);
  const [running, setRunning] = useState(false);

  const templateById = useMemo(() => new Map((templates || []).map(t => [t.id, t])), [templates]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const kinds = new Set(kindFilter.map(l => KIND_BY_LABEL[l]));
    const statuses = new Set(statusFilter.map(l => STATUS_BY_LABEL[l]));
    const list = suggestions
      .map(s => ({
        ...s,
        template: templateById.get(s.templateId) || null,
        related: s.relatedTemplateId ? templateById.get(s.relatedTemplateId) || null : null,
      }))
      .filter(s => s.template)
      .map(s => ({ ...s, templateName: s.template.name }))
      .filter(s => (!kinds.size || kinds.has(s.kind))
        && (!statuses.size || statuses.has(s.status))
        && (!q || `${s.templateName} ${s.related?.name || ''} ${s.rationale} ${s.aiRationale || ''}`.toLowerCase().includes(q)));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return list.sort((a, b) => String(a[sort.key] || '').localeCompare(String(b[sort.key] || '')) * dir);
  }, [suggestions, templateById, search, kindFilter, statusFilter, sort]);

  const onSort = key => setSort(cur => ({ key, dir: cur.key === key && cur.dir === 'asc' ? 'desc' : 'asc' }));

  const decide = async (row, decision) => {
    setBusyId(row.id);
    const ok = await decideTemplateSuggestion(row.id, decision);
    setBusyId(null);
    if (!ok) { toast.error('Could not save that decision. Try again.'); return; }
    const undo = { label: 'Undo', onClick: () => reopenTemplateSuggestion(row.id) };
    if (decision === 'dismissed') { toast('Suggestion dismissed', { action: undo }); return; }
    if (row.kind === 'retire') { toast(`"${row.templateName}" retired`, { action: undo }); return; }
    // The change itself is an edit; open the template for it.
    setCarePlanTemplateScreen({ mode: 'edit', template: row.template });
  };

  const runNow = async () => {
    setRunning(true);
    const ok = await runTemplateAnalysis();
    setRunning(false);
    if (!ok) { toast.error('Could not run the analysis. Try again.'); return; }
    worded.current = false;
    toast('Analysis updated');
  };

  const renderRow = (s) => {
    const kind = KINDS[s.kind];
    const isOpen = s.status === 'open';
    const busy = busyId === s.id;
    return (
      <tr key={s.id} className={styles.row}>
        <td className={`${styles.td} ${styles.tdName}`}>
          <span className={styles.nameCell}>
            <button type="button" className={styles.nameLink} onClick={() => setCarePlanTemplateScreen({ mode: 'edit', template: s.template })}>
              {s.templateName}
            </button>
            {s.related && <span className={styles.nameSub}>with {s.related.name}</span>}
          </span>
        </td>
        <td className={styles.td}>
          <Badge tone={kind.tone} size="S" label={kind.label} icon={kind.icon} />
        </td>
        <td className={styles.td}>
          <span className={styles.why}>
            {s.aiRationale ? (
              <>
                <span className={styles.aiText}>
                  <Icon name="solar:magic-stick-3-linear" size={14} color="var(--primary-300)" />
                  <span>{s.aiRationale}</span>
                </span>
                <span className={styles.whySub}>{s.rationale}</span>
              </>
            ) : (
              <span className={styles.whyText}>{s.rationale}</span>
            )}
          </span>
        </td>
        <td className={`${styles.td} ${styles.nowrap}`}>{fmtDay(s.detectedAt)}</td>
        <td className={styles.td}>
          <Badge tone={STATUS_TONE[s.status]} size="S" label={STATUS_LABEL[s.status]} />
        </td>
        <td className={`${styles.td} ${styles.tdActions}`}>
          {canManage && (
            <span className={styles.actionCell}>
              {isOpen ? (
                <>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => decide(s, 'dismissed')}>Dismiss</Button>
                  <Button variant="soft" size="sm" disabled={busy} onClick={() => decide(s, 'accepted')}>{kind.accept}</Button>
                </>
              ) : s.status !== 'resolved' && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => reopenTemplateSuggestion(s.id)}>
                  {s.status === 'accepted' && s.kind === 'retire' ? 'Restore' : 'Reopen'}
                </Button>
              )}
            </span>
          )}
        </td>
      </tr>
    );
  };

  const showSkeleton = (loading && !didFetch) || !libraryDidFetch;
  const openCount = suggestions.filter(s => s.status === 'open').length;
  return (
    <div className={styles.wrapper}>
      <SectionTitleBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        actions={['search']}
        searchPlaceholder="Search suggestions…"
        searchValue={search}
        onSearchChange={setSearch}
        primaryActionLabel={canManage && !missing ? (running ? 'Analyzing…' : 'Run Analysis') : undefined}
        primaryActionIcon="solar:refresh-linear"
        primaryActionDisabled={running}
        onPrimaryAction={runNow}
      />
      <div className={styles.filterBar}>
        <FilterChip label="Status" options={Object.values(STATUS_LABEL)} selected={statusFilter} onChange={setStatusFilter} />
        <FilterChip label="Suggestion" options={Object.values(KINDS).map(k => k.label)} selected={kindFilter} onChange={setKindFilter} />
        <span className={styles.filterNote}>
          {wording ? 'Writing explanations…' : 'Analyzed nightly from template runs and goal outcomes'}
        </span>
      </div>
      {missing && (
        <div className={styles.notice}>
          <Alert tone="info" message="Run supabase/care_plan_template_suggestions_migration.sql to start the nightly template analysis." />
        </div>
      )}
      <div className={styles.content}>
        {showSkeleton ? <TableSkeleton rows={6} /> : !missing && openCount === 0 && statusFilter.join() === 'Open' && !search ? (
          <RingEmptyState icon="solar:magic-stick-3-linear" label="No suggestions right now. Templates are being used and working well." />
        ) : (
          <WorklistShell
            header={null}
            columns={COLUMNS}
            rows={rows}
            renderRow={renderRow}
            sortKey={sort.key}
            sortDir={sort.dir}
            onSort={onSort}
            emptyState={(
              <div className={styles.emptyState}>
                <Icon name="solar:magic-stick-3-linear" size={32} color="var(--neutral-150)" />
                <p>No suggestions match these filters.</p>
              </div>
            )}
            minTableWidth={1320}
          />
        )}
      </div>
    </div>
  );
}
