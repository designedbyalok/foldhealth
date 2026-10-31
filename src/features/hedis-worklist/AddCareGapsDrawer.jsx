import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Drawer } from '../../components/Drawer/Drawer';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { Button } from '../../components/Button/Button';
import { Select } from '../../components/Select/Select';
import { ChipSelect } from '../../components/ChipSelect/ChipSelect';
import { SearchBar } from '../../components/SearchBar/SearchBar';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Badge } from '../../components/Badge/Badge';
import { InfoBar } from '../../components/InfoBar/InfoBar';
import { SimpleTableSkeleton } from '../../components/SimpleTableSkeleton/SimpleTableSkeleton';
import { MEASURE_YEARS } from './data/caregapWhitelistMock';
import styles from './AddCareGapsDrawer.module.css';

const WORKFLOWS = ['Outreach', 'Clinical Note', 'Referral', 'Task'];

const isClosed = (status) => status === 'Completed' || String(status || '').startsWith('Closed');

const appliesTo = (w, { ipa, hpCode, measureYear }) =>
  w.measureYear === measureYear
  && (!w.ipas.length || w.ipas.includes(ipa))
  && (!w.hpCodes.length || w.hpCodes.includes(hpCode));

const toOptions = (values) => values.map(v => ({ value: v, label: v, searchText: v }));

const REASONS = ['Closed incorrectly', 'Missing outreach', 'Missing evidence'];

// A gap's measure year: stamped on gaps added in Fold, else its start year.
const yearOf = (g) => (g.measureYear ? Number(g.measureYear) : Number(String(g.startDate || '').slice(-4)) || null);

// Every instance of `code` the patient has in the selected measure year,
// newest first. Read-only context for re-adding the gap.
function GapHistory({ history }) {
  return (
    <table className={styles.history} aria-label="Previous instances">
      <thead>
        <tr><th>Instance</th><th>Status</th><th>Opened</th><th>Closed</th></tr>
      </thead>
      <tbody>
        {history.map((g, i) => (
          <tr key={`${g.startDate}-${i}`}>
            <td>{history.length - i}{g.supersededAt ? ' (Previous)' : ' (Latest)'}</td>
            <td><Badge size="S" variant={isClosed(g.status) ? 'ai-neutral' : 'status-queued'} label={g.status} /></td>
            <td>{g.startDate || '-'}</td>
            <td>{g.closedDate || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GapRow({ whitelist, parent, history, checked, config, onToggle, onConfig }) {
  const needsReason = history.length > 0;
  return (
    <div className={[styles.gapRow, checked ? styles.gapRowOn : ''].join(' ')}>
      <label className={styles.gapMain}>
        <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`Add ${whitelist.code}`} />
        <span className={styles.gapCode}>{whitelist.code}</span>
        <span className={styles.gapName}>{whitelist.name}</span>
        <span className={styles.gapMeta}>
          {parent && <Badge size="S" variant="status-queued" icon="solar:history-linear" label={`Previous: ${parent.status}`} />}
        </span>
      </label>
      {checked && (
        <div className={styles.gapConfig}>
          {needsReason ? (
            <>
              <span className={styles.subLabel}>Previous instances in this measure year</span>
              <GapHistory history={history} />
            </>
          ) : (
            <span className={styles.helper}>No previous instance in this measure year. A new care gap will be created.</span>
          )}
          <div className={styles.configRow}>
            <div className={styles.field}>
              <span className={styles.label}>Workflow<span className={styles.req}>•</span></span>
              <ChipSelect options={WORKFLOWS} value={config.workflows} onChange={(v) => onConfig({ ...config, workflows: v })} ariaLabel={`${whitelist.code} workflow`} />
            </div>
            {needsReason && (
              <div className={styles.field}>
                <span className={styles.label}>Reason<span className={styles.req}>•</span></span>
                <Select options={toOptions(REASONS)} value={config.reason} placeholder="Why add it again?" onChange={(v) => onConfig({ ...config, reason: v })} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AddCareGapsDrawer() {
  const member = useAppStore(s => s.addCareGapsMember);
  const close = useAppStore(s => s.closeAddCareGaps);
  const addCareGaps = useAppStore(s => s.addCareGaps);
  const showToast = useAppStore(s => s.showToast);
  const whitelist = useAppStore(s => s.caregapWhitelist);
  const loading = useAppStore(s => s.caregapWhitelistLoading);
  const fetchWhitelist = useAppStore(s => s.fetchCaregapWhitelist);
  const hedisMembers = useAppStore(s => s.hedisMembers);

  const [measureYear, setMeasureYear] = useState(MEASURE_YEARS[0]);
  // Per selected gap: { [code]: { workflows, reason } }.
  const [config, setConfig] = useState({});
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!member) return;
    fetchWhitelist();
    setMeasureYear(MEASURE_YEARS[0]);
    setConfig({});
    setSelected([]);
    setQuery('');
  }, [member?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const yearOptions = MEASURE_YEARS.map(y => ({ value: String(y), label: `MY${y}` }));

  // Read the live row so a gap added moments ago drops out of the list.
  const liveMember = hedisMembers.find(m => m.id === member?.id) || member;

  // IPA and HP Code follow the measure year: the patient's contract on that
  // year's gaps, else the patient's current IPA / HP Code. Not editable.
  const yearGap = (liveMember?.gaps || []).find(g => (g.measureYear
    ? Number(g.measureYear) === measureYear
    : String(g.startDate || '').endsWith(String(measureYear))) && (g.ipa || g.hpCode));
  const ipa = yearGap?.ipa || member?.ipa || '';
  const hpCode = yearGap?.hpCode || member?.hpCode || '';
  const existingByCode = useMemo(
    () => Object.fromEntries((liveMember?.gaps || []).filter(g => !g.supersededAt).map(g => [g.code, g])),
    [liveMember],
  );

  const whitelisted = useMemo(
    () => whitelist.filter(w => appliesTo(w, { ipa, hpCode, measureYear })),
    [whitelist, ipa, hpCode, measureYear],
  );
  // A gap the patient already has open can't be added again, so it isn't listed.
  const eligible = whitelisted.filter(w => {
    const existing = existingByCode[w.code];
    return !existing || isClosed(existing.status);
  });
  const q = query.trim().toLowerCase();
  const visible = q
    ? eligible.filter(w => w.code.toLowerCase().includes(q) || w.name.toLowerCase().includes(q))
    : eligible;
  // Selection outlives a filter change only for gaps still whitelisted.
  const picked = eligible.filter(w => selected.includes(w.code));

  if (!member) return null;

  const historyFor = (code) => (liveMember?.gaps || [])
    .filter(g => g.code === code && yearOf(g) === measureYear)
    .toSorted((a, b) => (!!a.supersededAt - !!b.supersededAt));
  const configFor = (code) => config[code] || { workflows: [], reason: '' };
  const canSave = picked.length > 0 && ipa && hpCode && picked.every(w => {
    const c = configFor(w.code);
    return c.workflows.length > 0 && (historyFor(w.code).length === 0 || !!c.reason);
  });

  const toggle = (code) => setSelected(sel => sel.includes(code) ? sel.filter(c => c !== code) : [...sel, code]);

  const doSave = () => {
    const items = picked.map(w => {
      const existing = existingByCode[w.code];
      const c = configFor(w.code);
      return {
        whitelist: w,
        parent: existing && isClosed(existing.status) ? existing : null,
        workflows: c.workflows,
        reason: historyFor(w.code).length ? c.reason : null,
      };
    });
    addCareGaps(member.id, { items, ipa, hpCode, measureYear });
    showToast?.(`${items.length} care gap${items.length === 1 ? '' : 's'} added for ${member.name}`);
    close();
  };

  const headerRight = (
    <>
      <Button size="sm" disabled={!canSave} onClick={doSave}>
        {picked.length > 1 ? `Add ${picked.length} Gaps` : 'Add Gap'}
      </Button>
      <span className={styles.headerDivider} />
    </>
  );

  return (
    <Drawer
      title="Add Care Gaps"
      onClose={close}
      headerRight={headerRight}
      noCloseDivider
      bodyClassName={styles.body}
    >
      <PatientBanner
        initials={member.in}
        name={member.name}
        gender={member.gender === 'M' ? 'Male' : member.gender === 'F' ? 'Female' : member.gender}
        age={member.age || ''}
        dob={member.dob}
        memberId={member.memberId}
        patientId={member.id}
      />

      <div className={styles.container}>
        <section className={styles.section}>
          <div className={styles.grid}>
            <div className={styles.field}>
              <span className={styles.label}>Measure Year<span className={styles.req}>•</span></span>
              <Select options={yearOptions} value={String(measureYear)} onChange={(v) => setMeasureYear(Number(v))} />
            </div>
            <div className={styles.field}>
              <span className={styles.label}>IPA</span>
              <Select options={toOptions([ipa].filter(Boolean))} value={ipa} placeholder="No IPA on file" disabled />
            </div>
            <div className={styles.field}>
              <span className={styles.label}>HP Code</span>
              <Select options={toOptions([hpCode].filter(Boolean))} value={hpCode} placeholder="No HP Code on file" disabled />
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.listHead}>
            <span className={styles.label}>Whitelisted Care Gaps<span className={styles.req}>•</span></span>
            <span className={styles.count}>{picked.length} selected</span>
          </div>
          <SearchBar value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={false} fullWidth placeholder="Search by measure code or name" />
          {loading ? (
            <SimpleTableSkeleton rows={5} cols={2} />
          ) : visible.length === 0 ? (
            <div className={styles.empty}>
              {whitelisted.length > 0 && eligible.length === 0
                ? 'Every whitelisted care gap is already open for this patient.'
                : eligible.length === 0
                ? `No care gaps are whitelisted for ${ipa || 'this IPA'} · ${hpCode || 'this HP code'} · MY${measureYear}.`
                : 'No whitelisted care gaps match your search.'}
            </div>
          ) : (
            <div className={styles.list}>
              {visible.map(w => (
                <GapRow
                  key={w.id}
                  whitelist={w}
                  parent={existingByCode[w.code] || null}
                  history={historyFor(w.code)}
                  checked={selected.includes(w.code)}
                  config={configFor(w.code)}
                  onConfig={(c) => setConfig(prev => ({ ...prev, [w.code]: c }))}
                  onToggle={() => toggle(w.code)}
                />
              ))}
            </div>
          )}
        </section>

        <InfoBar>
          Only whitelisted gaps are billed. A gap is added to SSD automatically once its clinical note is signed; otherwise close it manually.
        </InfoBar>
      </div>
    </Drawer>
  );
}
