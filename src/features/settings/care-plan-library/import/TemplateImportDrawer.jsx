import { useMemo, useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Dropzone } from '../../../../components/Dropzone/Dropzone';
import { Button } from '../../../../components/Button/Button';
import { Badge } from '../../../../components/Badge/Badge';
import { Banner } from '../../../../components/Banner/Banner';
import { Icon } from '../../../../components/Icon/Icon';
import { Toggle } from '../../../../components/Toggle/Toggle';
import { EmptyState } from '../../../../components/EmptyState/EmptyState';
import { useAppStore } from '../../../../store/useAppStore';
import { CSV_COLUMNS, MAX_IMPORT_TEMPLATES, SAMPLE_CSV, SAMPLE_JSON, parseImportFile, planTemplateImport } from '../lib/templateImport';
import styles from './TemplateImportDrawer.module.css';

const ACTION_META = {
  add: { label: 'Add', tone: 'success' },
  update: { label: 'Update', tone: 'info' },
  skip: { label: 'Skip', tone: 'grey' },
};
const PAGE = 50;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function download(name, body, type) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One template in the preview: what happens to it, why, and its issues. */
function PlanRow({ plan }) {
  const [open, setOpen] = useState(false);
  const errors = plan.issues.filter(i => i.level === 'error');
  const warnings = plan.issues.filter(i => i.level === 'warning');
  const issues = [...errors, ...warnings];
  const shown = open ? issues : issues.slice(0, 2);
  const { goals, interventions, barriers, libraryGoals } = plan.counts;
  const meta = ACTION_META[plan.action];
  return (
    <li className={styles.planRow}>
      <div className={styles.planHead}>
        <span className={styles.planName}>{plan.name}</span>
        <Badge tone={errors.length ? 'danger' : meta.tone} size="sm" label={errors.length ? 'Error' : meta.label} />
      </div>
      <p className={styles.planMeta}>
        {[
          plural(goals, 'goal'), plural(interventions, 'intervention'), plural(barriers, 'barrier'),
          libraryGoals ? `${libraryGoals} from the goals library` : null, plan.source,
        ].filter(Boolean).join(' • ')}
      </p>
      <p className={styles.planWhy}>{plan.why}</p>
      {shown.length > 0 && (
        <ul className={styles.issues}>
          {shown.map((i, k) => (
            <li key={k} className={i.level === 'error' ? styles.issueError : styles.issueWarning}>
              <Icon name={i.level === 'error' ? 'solar:danger-triangle-linear' : 'solar:info-circle-linear'} size={14} />
              <span>{i.message}</span>
            </li>
          ))}
        </ul>
      )}
      {issues.length > 2 && (
        <Button variant="ghost" size="sm" className={styles.more} onClick={() => setOpen(v => !v)}>
          {open ? 'Show fewer' : `Show all ${issues.length} issues`}
        </Button>
      )}
    </li>
  );
}

/**
 * Bulk import of care plan templates: upload a CSV or JSON file, review what
 * will be added, updated or skipped (with every structure, reference and
 * library conflict found), then import the valid ones as drafts for approval.
 */
export function TemplateImportDrawer({ onClose, onReviewDrafts }) {
  const templates = useAppStore(s => s.carePlanTemplates);
  const goals = useAppStore(s => s.carePlanGoals);
  const importCarePlanTemplates = useAppStore(s => s.importCarePlanTemplates);
  const [file, setFile] = useState(null); // { name, parsed }
  const [rejected, setRejected] = useState('');
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const plan = useMemo(
    () => (file && !file.parsed.fileErrors.length ? planTemplateImport(file.parsed, { templates, goals }) : null),
    [file, templates, goals],
  );
  const importable = plan ? plan.plans.filter(p => p.action !== 'skip') : [];
  const visible = plan ? plan.plans.filter(p => filter === 'all' || p.action === filter) : [];

  const pick = async (picked) => {
    const f = Array.isArray(picked) ? picked[0] : picked;
    if (!f) return;
    setRejected('');
    setResult(null);
    setFilter('all');
    setLimit(PAGE);
    setFile({ name: f.name, parsed: parseImportFile(f.name, await f.text()) });
  };

  const runImport = async () => {
    setImporting(true);
    const r = await importCarePlanTemplates(importable, { fileName: file.name, totals: plan.totals });
    setImporting(false);
    setResult(r);
  };

  const reset = () => { setFile(null); setResult(null); };

  let primaryAction = null;
  let secondaryAction = null;
  if (result) {
    primaryAction = result.created + result.updated > 0
      ? <Button onClick={onReviewDrafts}>Review drafts</Button>
      : <Button onClick={() => setResult(null)}>Back to preview</Button>;
  } else if (plan) {
    secondaryAction = <Button variant="outline" onClick={reset} disabled={importing}>Choose another file</Button>;
    primaryAction = (
      <Button onClick={runImport} disabled={!importable.length} loading={importing}>
        {`Import ${plural(importable.length, 'template')} as drafts`}
      </Button>
    );
  }

  return (
    <Drawer title="Import Templates" onClose={onClose} primaryAction={primaryAction} secondaryAction={secondaryAction}>
      {result ? (
        <div className={styles.done}>
          {result.created + result.updated > 0 ? (
            <>
              <EmptyState icon="solar:check-circle-linear" title="Imported to Draft Templates" />
              <p className={styles.doneText}>
                {[
                  result.created ? `${plural(result.created, 'template')} added` : null,
                  result.updated ? `${plural(result.updated, 'draft')} updated` : null,
                ].filter(Boolean).join(', ')}. Each one waits in Draft Templates until a supervisor approves it.
              </p>
            </>
          ) : (
            <EmptyState icon="solar:danger-triangle-linear" title="Nothing was imported" />
          )}
          {result.failed > 0 && <Banner variant="outline" tone="danger">{`${plural(result.failed, 'template')} could not be saved. Try importing the file again.`}</Banner>}
        </div>
      ) : !file ? (
        <div className={styles.upload}>
          <p className={styles.lead}>
            Upload a CSV or JSON file with templates, their goals, interventions and barriers, and which goal each intervention and barrier belongs to. Up to {MAX_IMPORT_TEMPLATES} templates per file.
          </p>
          <Dropzone
            accept=".csv,.json,text/csv,application/json"
            acceptMime={['text/csv', 'application/json', 'application/vnd.ms-excel', 'text/plain', '']}
            helperText="CSV or JSON"
            onPick={pick}
            onReject={() => setRejected('Choose a .csv or .json file.')}
          />
          {rejected && <Banner variant="outline" tone="danger">{rejected}</Banner>}
          <section className={styles.format}>
            <h4 className={styles.formatTitle}>CSV format</h4>
            <p className={styles.formatText}>One row per goal, intervention or barrier. Columns: <span className={styles.columns}>{CSV_COLUMNS.join(', ')}</span>.</p>
            <ul className={styles.formatList}>
              <li><b>type</b>: goal, intervention or barrier.</li>
              <li><b>kind</b> (interventions): internal-task, patient-task, patient-education, measure-vital or send-form.</li>
              <li><b>goals</b>: the goal title the item belongs to; separate several with |.</li>
              <li><b>conditions</b>: separate several with |. Goals already in the goals library are reused.</li>
            </ul>
            <div className={styles.samples}>
              <Button variant="soft" size="sm" leadingIcon="solar:download-minimalistic-linear" onClick={() => download('care-plan-templates-sample.csv', SAMPLE_CSV, 'text/csv')}>CSV sample</Button>
              <Button variant="soft" size="sm" leadingIcon="solar:download-minimalistic-linear" onClick={() => download('care-plan-templates-sample.json', SAMPLE_JSON, 'application/json')}>JSON sample</Button>
            </div>
          </section>
        </div>
      ) : file.parsed.fileErrors.length ? (
        <div className={styles.upload}>
          <p className={styles.fileName}><Icon name="solar:file-text-linear" size={16} /> {file.name}</p>
          {file.parsed.fileErrors.map(e => <Banner variant="outline" key={e} tone="danger">{e}</Banner>)}
          <div><Button variant="outline" size="sm" onClick={reset}>Choose another file</Button></div>
        </div>
      ) : (
        <div className={styles.preview}>
          <p className={styles.fileName}><Icon name="solar:file-text-linear" size={16} /> {file.name} · {plural(plan.plans.length, 'template')}</p>
          <div className={styles.totals}>
            {['add', 'update', 'skip'].map(k => (
              <div key={k} className={styles.total}>
                <span className={styles.totalNumber}>{plan.totals[k]}</span>
                <span className={styles.totalLabel}>{k === 'add' ? 'to add' : k === 'update' ? 'to update' : 'skipped'}</span>
              </div>
            ))}
            <div className={styles.total}>
              <span className={`${styles.totalNumber} ${plan.totals.errors ? styles.totalError : ''}`}>{plan.totals.errors}</span>
              <span className={styles.totalLabel}>with errors</span>
            </div>
          </div>
          {plan.truncated && <Banner variant="outline" tone="warning">{`Only the first ${MAX_IMPORT_TEMPLATES} templates are read. Split the file to import the rest.`}</Banner>}
          {plan.totals.update > 0 && (
            <Banner variant="outline" tone="info">Updates to published templates are saved as draft revisions. The published template stays in use until the revision is approved.</Banner>
          )}
          <Toggle
            size="sm"
            items={[
              { key: 'all', label: `All ${plan.plans.length}` },
              { key: 'add', label: `Add ${plan.totals.add}` },
              { key: 'update', label: `Update ${plan.totals.update}` },
              { key: 'skip', label: `Skip ${plan.totals.skip}` },
            ]}
            value={filter}
            onValueChange={(k) => { setFilter(k); setLimit(PAGE); }}
          />
          <ul className={styles.planList}>
            {visible.slice(0, limit).map(p => <PlanRow key={p.key} plan={p} />)}
          </ul>
          {visible.length > limit && (
            <Button variant="ghost" size="sm" onClick={() => setLimit(l => l + PAGE)}>
              Show {Math.min(PAGE, visible.length - limit)} more of {visible.length - limit}
            </Button>
          )}
        </div>
      )}
    </Drawer>
  );
}
