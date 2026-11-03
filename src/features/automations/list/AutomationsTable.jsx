import { useMemo, useState } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Switch } from '../../../components/Switch/Switch';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { Checkbox } from '../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { WorklistShell } from '../../../components/WorklistShell/WorklistShell';
import { FlowIcons } from '../shared/FlowIcons';
import { categoryLabel, executionTypeOf } from '../lib/catalog';
import { formatDurationMinutes, graphCounts } from '../lib/analytics';
import { AutomationMenu, TemplateMenu } from './AutomationMenu';
import { executionsIn90Days, fmtDateTime, latestFailures, plural } from './listUtils';
import styles from './AutomationsTable.module.css';

const AUTOMATION_COLUMNS = [
  { key: 'select', label: '', showCheckbox: true, width: 44, sticky: 'left', left: 0 },
  { key: 'trigger', label: 'Trigger', width: 140 },
  { key: 'name', label: 'Name & Author', sortKey: 'name', sortType: 'alpha', width: 320 },
  { key: 'population', label: 'Population Group', sortKey: 'population', sortType: 'alpha', width: 190 },
  { key: 'executions', label: 'Executions', sortKey: 'executions', sortType: 'number', width: 110, align: 'right' },
  { key: 'type', label: 'Execution Type', width: 130 },
  { key: 'last', label: 'Last Execution', sortKey: 'last', sortType: 'date', width: 190 },
  { key: 'status', label: 'Status', width: 65 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 150 },
];

const SORTERS = {
  name: a => (a.name || '').toLowerCase(),
  population: a => (a.populationGroupName || '').toLowerCase(),
  executions: (a, runs) => executionsIn90Days(runs),
  last: a => (a.lastExecutedAt ? new Date(a.lastExecutedAt).getTime() : 0),
};

function useSort(initial) {
  const [sort, setSort] = useState(initial);
  const onSort = (key) => setSort(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  return [sort, onSort];
}

/** My Automations, list view. */
export function AutomationsTable({ automations, runsOf, actions, emptyState }) {
  const [sort, onSort] = useSort({ key: 'last', dir: 'desc' });
  const [selected, setSelected] = useState([]);
  const rows = useMemo(() => {
    const get = SORTERS[sort.key];
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...automations].sort((x, y) => {
      const a = get(x, runsOf(x.id));
      const b = get(y, runsOf(y.id));
      return a < b ? -dir : a > b ? dir : 0;
    });
  }, [automations, runsOf, sort]);
  const selectedIds = selected.filter(id => automations.some(a => a.id === id));
  const toggleRow = (id) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  const bulk = (fn) => () => { fn(automations.filter(a => selectedIds.includes(a.id))); setSelected([]); };

  const renderRow = (a) => {
    const runs = runsOf(a.id);
    const failures = latestFailures(a, runs);
    const isSelected = selectedIds.includes(a.id);
    return (
      <tr key={a.id} className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`} onClick={() => actions.open(a)}>
        <td className={`${styles.checkTd} ${styles.stickyLeft}`} onClick={e => e.stopPropagation()}>
          <Checkbox checked={isSelected} onCheckedChange={() => toggleRow(a.id)} aria-label={`Select ${a.name}`} />
        </td>
        <td className={styles.td}><FlowIcons graph={a.draftGraph || a.graph} max={2} /></td>
        <td className={styles.td}>
          <div className={styles.nameCell}>
            <span className={styles.name} title={a.name}>{a.name}</span>
            <span className={styles.sub}>by {a.createdBy || 'Unknown'}</span>
          </div>
        </td>
        <td className={`${styles.td} ${styles.muted} ${styles.clip}`} title={a.populationGroupName || undefined}>{a.populationGroupName || '-'}</td>
        <td className={`${styles.td} ${styles.num}`}>{executionsIn90Days(runs).toLocaleString('en-US')}</td>
        <td className={`${styles.td} ${styles.muted}`}>{executionTypeOf(a.schedule)}</td>
        <td className={`${styles.td} ${styles.muted}`}>
          <span className={styles.lastCell}>
            {a.lastExecutedAt ? fmtDateTime(a.lastExecutedAt) : 'Not run yet'}
            {failures > 0 && (
              <Tooltip label={`${plural(failures, 'member')} failed in the latest run`}>
                <button type="button" className={styles.errorLink} onClick={(e) => { e.stopPropagation(); actions.errors(a); }}>
                  <Icon name="solar:danger-triangle-linear" size={14} />
                  {failures}
                </button>
              </Tooltip>
            )}
          </span>
        </td>
        <td className={styles.td} onClick={e => e.stopPropagation()}>
          {a.status === 'draft'
            ? <Badge size="sm" label="Draft" />
            : <Switch checked={a.status === 'active'} onChange={on => actions.toggle(a, on)} ariaLabel={a.status === 'active' ? 'Turn off automation' : 'Turn on automation'} />}
        </td>
        <td className={`${styles.td} ${styles.stickyRight}`} onClick={e => e.stopPropagation()}>
          <div className={styles.actionCell}>
            {a.status === 'active' && (
              <>
                <Button variant="outline" size="sm" leadingIcon="solar:play-linear" onClick={() => actions.run(a)}>Run</Button>
                <span className={styles.vDivider} />
              </>
            )}
            {a.status === 'draft' && (
              <>
                <Button variant="outline" size="sm" leadingIcon="solar:pen-linear" onClick={() => actions.edit(a)}>Edit</Button>
                <span className={styles.vDivider} />
              </>
            )}
            <ActionButton
              icon="solar:chart-2-linear"
              size="sm"
              tooltip={runs.length ? 'Analytics' : 'Analytics appear after the first run'}
              disabled={!runs.length}
              onClick={() => actions.menu('analytics', a)}
            />
            <span className={styles.vDivider} />
            <AutomationMenu hasRuns={runs.length > 0} onSelect={key => actions.menu(key, a)} />
          </div>
        </td>
      </tr>
    );
  };

  return (
    <WorklistShell
      header={null}
      columns={AUTOMATION_COLUMNS}
      rows={rows}
      renderRow={renderRow}
      sortKey={sort.key}
      sortDir={sort.dir}
      onSort={onSort}
      selectedIds={selectedIds}
      onSelectAll={(checked) => setSelected(checked ? automations.map(a => a.id) : [])}
      onClearSelection={() => setSelected([])}
      bulkActions={[
        { label: 'Turn on', icon: 'solar:play-linear', variant: 'outline', onClick: bulk(list => list.filter(a => a.status === 'inactive').forEach(a => actions.toggle(a, true))) },
        { label: 'Turn off', icon: 'solar:pause-linear', variant: 'outline', onClick: bulk(list => list.filter(a => a.status === 'active').forEach(a => actions.toggle(a, false))) },
      ]}
      emptyState={emptyState}
      minTableWidth={1190}
      fixedLayout
    />
  );
}

const TEMPLATE_COLUMNS = [
  { key: 'name', label: 'Name', sortKey: 'name', sortType: 'alpha', width: 300, thStyle: { paddingLeft: 'var(--space-4)' } },
  { key: 'category', label: 'Category', sortKey: 'category', sortType: 'alpha', width: 140 },
  { key: 'conditions', label: '# Conditions', sortKey: 'conditions', sortType: 'number', width: 120, align: 'right' },
  { key: 'actions', label: '# Actions', sortKey: 'actionCount', sortType: 'number', width: 100, align: 'right' },
  { key: 'avg', label: 'Avg. Exe. Time', width: 130 },
  { key: 'used', label: '# of times used', sortKey: 'used', sortType: 'number', width: 140, align: 'right' },
  { key: 'rowActions', label: 'Actions', sticky: 'right', width: 170 },
];

const TEMPLATE_SORTERS = {
  name: t => (t.name || '').toLowerCase(),
  category: t => categoryLabel(t.category).toLowerCase(),
  conditions: t => graphCounts(t.graph).conditions,
  actionCount: t => graphCounts(t.graph).actions,
  used: t => t.usedCount || 0,
};

/** Templates, list view. */
export function TemplatesTable({ templates, avgOf, onPreview, onUse, emptyState }) {
  const [sort, onSort] = useSort({ key: 'used', dir: 'desc' });
  const rows = useMemo(() => {
    const get = TEMPLATE_SORTERS[sort.key];
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...templates].sort((x, y) => (get(x) < get(y) ? -dir : get(x) > get(y) ? dir : 0));
  }, [templates, sort]);

  const renderRow = (t) => {
    const counts = graphCounts(t.graph);
    return (
      <tr key={t.id} className={styles.row} onClick={() => onPreview(t)}>
        <td className={`${styles.td} ${styles.firstTd}`}><span className={styles.name} title={t.name}>{t.name}</span></td>
        <td className={`${styles.td} ${styles.muted}`}>{categoryLabel(t.category)}</td>
        <td className={`${styles.td} ${styles.num}`}>{counts.conditions}</td>
        <td className={`${styles.td} ${styles.num}`}>{counts.actions}</td>
        <td className={`${styles.td} ${styles.muted}`}>{formatDurationMinutes(avgOf(t.id))}</td>
        <td className={`${styles.td} ${styles.num}`}>{(t.usedCount || 0).toLocaleString('en-US')}</td>
        <td className={`${styles.td} ${styles.stickyRight}`} onClick={e => e.stopPropagation()}>
          <div className={styles.actionCell}>
            <Button variant="outline" size="sm" leadingIcon="solar:copy-linear" onClick={() => onUse(t)}>Use Template</Button>
            <span className={styles.vDivider} />
            <TemplateMenu onPreview={() => onPreview(t)} />
          </div>
        </td>
      </tr>
    );
  };

  return (
    <WorklistShell
      header={null}
      columns={TEMPLATE_COLUMNS}
      rows={rows}
      renderRow={renderRow}
      sortKey={sort.key}
      sortDir={sort.dir}
      onSort={onSort}
      emptyState={emptyState}
      minTableWidth={1100}
    />
  );
}
