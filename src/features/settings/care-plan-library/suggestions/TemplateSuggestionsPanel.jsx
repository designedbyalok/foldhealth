import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionTitleBar } from '../../../../components/SectionTitleBar/SectionTitleBar';
import { WorklistShell } from '../../../../components/WorklistShell/WorklistShell';
import { FilterChip } from '../../../../components/FilterChip/FilterChip';
import { Badge } from '../../../../components/Badge/Badge';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Alert } from '../../../../components/Alert/Alert';
import { Icon } from '../../../../components/Icon/Icon';
import { TableSkeleton } from '../../../../components/TableSkeleton/TableSkeleton';
import { RingEmptyState } from '../../../../components/RingEmptyState/RingEmptyState';
import { toast } from '../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../store/useAppStore';
import { useCanManageTemplates } from '../lib/useCanManageTemplates';
import styles from './TemplateSuggestionsPanel.module.css';

const KINDS = {
  retire: { label: 'Retire', tone: 'grey', accept: 'Retire' },
  abandon: { label: 'High Abandon', tone: 'warning', accept: 'Revise' },
  goal_attainment: { label: 'Low Goal Attainment', tone: 'error', accept: 'Revise' },
  split: { label: 'Split', tone: 'info', accept: 'Split' },
  merge: { label: 'Merge', tone: 'primary', accept: 'Merge' },
};
const KIND_BY_LABEL = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [v.label, k]));
const STATUS_LABEL = { open: 'Open', accepted: 'Accepted', dismissed: 'Dismissed', resolved: 'Resolved' };
const STATUS_TONE = { open: 'primary', accepted: 'success', dismissed: 'neutral', resolved: 'neutral' };
const STATUS_BY_LABEL = Object.fromEntries(Object.entries(STATUS_LABEL).map(([k, v]) => [v, k]));

const COLUMNS = [
  { key: 'template', label: 'Template', sortKey: 'templateName', sticky: 'left', left: 0, width: 280 },
  { key: 'kind', label: 'Suggestion', sortKey: 'kind', width: 170 },
  { key: 'why', label: 'Why', width: 480 },
  { key: 'detected', label: 'Detected', sortKey: 'detectedAt', width: 120 },
  { key: 'status', label: 'Status', sortKey: 'status', width: 110 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 96 },
];

const fmtDay = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};

// "Today, 1:20 PM", "Yesterday, 7:15 AM" or "10/28/2026, 7:15 AM".
const fmtRun = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${fmtDay(iso)}, ${time}`;
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
  const lastRun = useAppStore(s => s.templateAnalysisLastRun);
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
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

  // Narrowing the list can leave the page past its end; a new search or filter starts from the first page.
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / perPage)));
  const paged = rows.slice((currentPage - 1) * perPage, currentPage * perPage);
  const fromFirstPage = setter => (value) => { setter(value); setPage(1); };

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
          <Badge tone={kind.tone} size="sm" label={kind.label} />
        </td>
        <td className={styles.td}>
          <span className={styles.why} title={s.aiRationale ? `${s.aiRationale}\n\n${s.rationale}` : s.rationale}>
            <span className={styles.whyText}>{s.aiRationale || s.rationale}</span>
            {s.aiRationale && <span className={styles.whySub}>{s.rationale}</span>}
          </span>
        </td>
        <td className={`${styles.td} ${styles.nowrap}`}>{fmtDay(s.detectedAt)}</td>
        <td className={styles.td}>
          <Badge tone={STATUS_TONE[s.status]} size="sm" label={STATUS_LABEL[s.status]} />
        </td>
        <td className={`${styles.td} ${styles.tdActions}`}>
          {canManage && (
            <span className={styles.actionCell}>
              {isOpen ? (
                <>
                  <ActionButton icon="solar:check-circle-linear" size="sm" tooltip={kind.accept} tooltipLeft disabled={busy} onClick={() => decide(s, 'accepted')} />
                  <ActionButton icon="solar:close-circle-linear" size="sm" tooltip="Dismiss" tooltipLeft disabled={busy} onClick={() => decide(s, 'dismissed')} />
                </>
              ) : s.status !== 'resolved' && (
                <ActionButton
                  icon="solar:restart-linear"
                  size="sm"
                  tooltip={s.status === 'accepted' && s.kind === 'retire' ? 'Restore' : 'Reopen'}
                  tooltipLeft
                  disabled={busy}
                  onClick={() => reopenTemplateSuggestion(s.id)}
                />
              )}
            </span>
          )}
        </td>
      </tr>
    );
  };

  const showSkeleton = (loading && !didFetch) || !libraryDidFetch;
  const openCount = suggestions.filter(s => s.status === 'open').length;
  const activeFilters = statusFilter.length + kindFilter.length;
  return (
    <div className={styles.wrapper}>
      <SectionTitleBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        actions={['search', 'filter']}
        onFilter={() => setFiltersOpen(v => !v)}
        filterActive={filtersOpen}
        filterBadgeCount={activeFilters || undefined}
        searchPlaceholder="Search suggestions…"
        searchValue={search}
        onSearchChange={fromFirstPage(setSearch)}
        primaryActionLabel={canManage && !missing ? (running ? 'Analyzing…' : 'Run Analysis') : undefined}
        primaryActionIcon="solar:refresh-linear"
        primaryActionDisabled={running}
        onPrimaryAction={runNow}
        rightExtras={(wording || lastRun) && (
          <span
            className={styles.lastRun}
            title={lastRun ? `${lastRun.source === 'manual' ? `Run by ${lastRun.runBy || 'a user'}` : 'Nightly run'}, ${lastRun.openCount} open. Analyzed nightly from template runs and goal outcomes.` : undefined}
          >
            {wording ? 'Writing explanations…' : `Last run: ${fmtRun(lastRun.ranAt)}`}
          </span>
        )}
      />
      {filtersOpen && (
        <div className={styles.filterBar}>
          <FilterChip label="Status" options={Object.values(STATUS_LABEL)} selected={statusFilter} onChange={fromFirstPage(setStatusFilter)} />
          <FilterChip label="Suggestion" options={Object.values(KINDS).map(k => k.label)} selected={kindFilter} onChange={fromFirstPage(setKindFilter)} />
        </div>
      )}
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
            rows={paged}
            renderRow={renderRow}
            sortKey={sort.key}
            sortDir={sort.dir}
            onSort={onSort}
            page={currentPage}
            perPage={perPage}
            totalItems={rows.length}
            onPageChange={setPage}
            onPageSizeChange={(n) => { setPerPage(n); setPage(1); }}
            emptyState={(
              <div className={styles.emptyState}>
                <Icon name="solar:magic-stick-3-linear" size={32} color="var(--neutral-150)" />
                <p>No suggestions match these filters.</p>
              </div>
            )}
            minTableWidth={1256}
          />
        )}
      </div>
    </div>
  );
}
