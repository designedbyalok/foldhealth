import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Drawer } from '../../components/Drawer/Drawer';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { Select } from '../../components/Select/Select';
import { SearchBar } from '../../components/SearchBar/SearchBar';
import { Checkbox } from '../../components/Checkbox/Checkbox';
import { Badge } from '../../components/Badge/Badge';
import { Banner } from '../../components/Banner/Banner';
import { Icon } from '../../components/Icon/Icon';
import { SimpleTableSkeleton } from '../../components/SimpleTableSkeleton/SimpleTableSkeleton';
import { openMeasureYears } from './data/caregapWhitelistMock';
import { STATUS_BADGE_VARIANT } from './HedisWorklistRow';
import { notApplicableReason } from './gapEligibility';
import styles from './AddCareGapsDrawer.module.css';

const isClosed = (status) => status === 'Completed' || String(status || '').startsWith('Closed');
// Only a gap closed without being met can be added again. Completed means
// the patient met the measure, and a measure is met once per measure year.
const canReAdd = (status) => String(status || '').startsWith('Closed');

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
    <table className={styles.history} aria-label="Instances in this measure year">
      <thead>
        <tr><th>Instance</th><th>Status</th><th>Opened</th><th>Closed</th></tr>
      </thead>
      <tbody>
        {history.map((g, i) => (
          <tr key={`${g.startDate}-${i}`}>
            <td>{history.length - i}</td>
            <td><Badge size="sm" tone={isClosed(g.status) ? 'neutral' : 'warning'} label={g.status} /></td>
            <td>{g.startDate || '-'}</td>
            <td>{g.closedDate || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// The patient's current gap for this measure in the selected measure year
// decides the row: none → can be added; closed without being met → can be
// added again with a reason; open or completed → locked, with why.
function GapRow({ whitelist, parent, history, measureYear, checked, config, onToggle, onConfig }) {
  const needsReason = history.length > 0;
  const locked = !!parent && !canReAdd(parent.status);
  const lockNote = !locked ? null
    : parent.status === 'Completed' ? `Already met in ${measureYear}`
    : 'Already open';
  return (
    <div className={[styles.gapRow, checked ? styles.gapRowOn : '', locked ? styles.gapRowOpen : ''].join(' ')}>
      <label className={styles.gapMain}>
        <Checkbox checked={checked} disabled={locked} onCheckedChange={onToggle} aria-label={`Add ${whitelist.code}`} />
        <span className={styles.gapCode}>{whitelist.code}</span>
        <span className={styles.gapName}>{whitelist.name}</span>
        <span className={styles.gapMeta}>
          {lockNote && <span className={styles.lockNote}>{lockNote}</span>}
          {parent && <Badge size="sm" tone={STATUS_BADGE_VARIANT[parent.status] || 'neutral'} label={parent.status} />}
        </span>
      </label>
      {checked && (
        <div className={styles.gapConfig}>
          {needsReason ? (
            <>
              <span className={styles.subLabel}>Instances in this measure year</span>
              <GapHistory history={history} />
              <div className={styles.field}>
                <span className={styles.label}>Reason<span className={styles.req}>•</span></span>
                <Select options={toOptions(REASONS)} value={config.reason} placeholder="Why add it again?" onValueChange={(v) => onConfig({ ...config, reason: v })} />
              </div>
            </>
          ) : (
            <span className={styles.helper}>No instance of this gap in {measureYear} yet. A new care gap will be created.</span>
          )}
        </div>
      )}
    </div>
  );
}

// Member field, as in HCC's Add Manually: the field is the search input;
// focus shows the matches, a picked member shows avatar, name and details
// and clicking it searches again.
function MemberField({ members, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(!value);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const q = query.trim().toLowerCase();
  const matches = (q
    ? members.filter(m => m.name.toLowerCase().includes(q) || String(m.memberId || '').toLowerCase().includes(q))
    : members).slice(0, 20);
  const meta = (m) => [m.gender, m.age, m.memberId].filter(Boolean).join(' • ');
  return (
    <div className={styles.memberSection} ref={wrapRef}>
      <span className={styles.label}>Member<span className={styles.req}>•</span></span>
      <div className={styles.memberField}>
        {value && !open ? (
          <button type="button" className={styles.memberSelected} onClick={() => { setQuery(''); setOpen(true); }}>
            <Avatar variant="patient" initials={value.in} />
            <span className={styles.memberName}>{value.name}</span>
            <span className={styles.memberMeta}>({meta(value)})</span>
          </button>
        ) : (
          <input
            type="text"
            className={styles.memberInput}
            placeholder="Search and Select Member"
            value={query}
            autoFocus
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            aria-label="Search and select member"
          />
        )}
        <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-300)" />
      </div>
      {open && (
        <div className={styles.memberPop} role="listbox" aria-label="Members">
          {matches.length === 0 ? (
            <div className={styles.memberEmpty}>No matches</div>
          ) : matches.map(m => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={value?.id === m.id}
              className={styles.memberOption}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(m); setQuery(''); setOpen(false); }}
            >
              <Avatar variant="patient" initials={m.in} />
              <span>{m.name}</span>
              <span className={styles.memberOptionMeta}>{meta(m)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AddCareGapsDrawer() {
  const member = useAppStore(s => s.addCareGapsMember);
  // From the worklist header the user picks the member in the drawer.
  const picker = useAppStore(s => s.addCareGapsPicker);
  const pickMember = useAppStore(s => s.pickAddCareGapsMember);
  const close = useAppStore(s => s.closeAddCareGaps);
  const addCareGaps = useAppStore(s => s.addCareGaps);
  const showToast = useAppStore(s => s.showToast);
  const whitelist = useAppStore(s => s.caregapWhitelist);
  const loading = useAppStore(s => s.caregapWhitelistLoading);
  const fetchWhitelist = useAppStore(s => s.fetchCaregapWhitelist);
  const hedisMembers = useAppStore(s => s.hedisMembers);

  const [measureYears] = useState(() => openMeasureYears());
  // Default to the current year; the next year is there to pick when open.
  const defaultYear = new Date().getFullYear();
  const [measureYear, setMeasureYear] = useState(defaultYear);
  // Per selected gap: { [code]: { workflows, reason } }.
  const [config, setConfig] = useState({});
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!member) return;
    fetchWhitelist();
    setMeasureYear(defaultYear);
    setConfig({});
    setSelected([]);
    setQuery('');
  }, [member?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const yearOptions = measureYears.map(y => ({ value: String(y), label: String(y) }));

  // Read the live row so a gap added moments ago drops out of the list.
  const liveMember = hedisMembers.find(m => m.id === member?.id) || member;

  // IPA and HP Code follow the measure year: the patient's contract on that
  // year's gaps, else the patient's current IPA / HP Code. Not editable.
  const yearGap = (liveMember?.gaps || []).find(g => (g.measureYear
    ? Number(g.measureYear) === measureYear
    : String(g.startDate || '').endsWith(String(measureYear))) && (g.ipa || g.hpCode));
  const ipa = yearGap?.ipa || member?.ipa || '';
  const hpCode = yearGap?.hpCode || member?.hpCode || '';
  // The patient's current gap per measure in the selected measure year.
  const existingByCode = useMemo(
    () => Object.fromEntries((liveMember?.gaps || [])
      .filter(g => !g.supersededAt && yearOf(g) === measureYear)
      .map(g => [g.code, g])),
    [liveMember, measureYear],
  );

  const contractGaps = useMemo(
    () => whitelist.filter(w => appliesTo(w, { ipa, hpCode, measureYear })),
    [whitelist, ipa, hpCode, measureYear],
  );
  // Measures that don't apply to this patient (sex, age) aren't offered;
  // a note under the list says which and why.
  const notApplicable = contractGaps
    .map(w => ({ w, reason: notApplicableReason(w, liveMember, measureYear) }))
    .filter(x => x.reason);
  const whitelisted = contractGaps.filter(w => !notApplicable.some(x => x.w === w));
  // A gap that is open or already met this measure year can't be added
  // again: it stays in the list with its status, but can't be selected.
  const eligible = whitelisted.filter(w => {
    const existing = existingByCode[w.code];
    return !existing || canReAdd(existing.status);
  });
  const q = query.trim().toLowerCase();
  const visible = q
    ? whitelisted.filter(w => w.code.toLowerCase().includes(q) || w.name.toLowerCase().includes(q))
    : whitelisted;
  // Selection outlives a filter change only for gaps still whitelisted.
  const picked = eligible.filter(w => selected.includes(w.code));

  if (!member && !picker) return null;
  if (!member) {
    return (
      <Drawer title="Add Care Gaps" onClose={close} bodyClassName={styles.body}>
        <div className={styles.container}>
          <MemberField members={hedisMembers} value={null} onChange={pickMember} />
        </div>
      </Drawer>
    );
  }

  const historyFor = (code) => (liveMember?.gaps || [])
    .filter(g => g.code === code && yearOf(g) === measureYear)
    .toSorted((a, b) => (!!a.supersededAt - !!b.supersededAt));
  const configFor = (code) => config[code] || { reason: '' };
  const canSave = picked.length > 0 && ipa && hpCode
    && picked.every(w => historyFor(w.code).length === 0 || !!configFor(w.code).reason);

  const toggle = (code) => setSelected(sel => sel.includes(code) ? sel.filter(c => c !== code) : [...sel, code]);

  // Why Add Gap is off, shown on hover of the disabled button.
  const disabledReason = picked.length === 0 ? 'Select a care gap'
    : !ipa || !hpCode ? 'This patient has no IPA or HP Code for this measure year'
    : 'Pick a reason for each care gap added again';

  const doSave = () => {
    const items = picked.map(w => {
      const existing = existingByCode[w.code];
      return {
        whitelist: w,
        parent: existing && isClosed(existing.status) ? existing : null,
        reason: historyFor(w.code).length ? configFor(w.code).reason : null,
      };
    });
    addCareGaps(member.id, { items, ipa, hpCode, measureYear });
    showToast?.(`${items.length} care gap${items.length === 1 ? '' : 's'} added for ${member.name}`);
    close();
  };

  const headerRight = (
    <>
      <Button disabled={!canSave} disabledReason={disabledReason} onClick={doSave}>
        {picked.length > 1 ? `Add ${picked.length} Gaps` : 'Add Gap'}
      </Button>
      <span className={styles.headerDivider} />
    </>
  );

  return (
    <Drawer
      title={picker ? `Add Care Gaps for ${member.name}` : 'Add Care Gaps'}
      onClose={close}
      headerRight={headerRight}
      noCloseDivider
      bodyClassName={styles.body}
    >
      {/* From the worklist header the Member field already names the
          patient, so the banner shows only for the row-level flow. */}
      {!picker && (
        <PatientBanner
          initials={member.in}
          name={member.name}
          gender={member.gender === 'M' ? 'Male' : member.gender === 'F' ? 'Female' : member.gender}
          age={member.age || ''}
          dob={member.dob}
          memberId={member.memberId}
          patientId={member.id}
        />
      )}

      {/* Edge to edge under the patient banner (or the drawer header when
          the Member field names the patient). */}
      <Banner className={styles.billingBar}>
        A gap is added to SSD automatically once its clinical note is signed; otherwise close it manually.
      </Banner>

      <div className={styles.container}>
        {picker && <MemberField key={member.id} members={hedisMembers} value={member} onChange={pickMember} />}
        <section className={styles.section}>
          <div className={styles.grid}>
            <div className={styles.field}>
              <span className={styles.label}>Measure Year<span className={styles.req}>•</span></span>
              <Select options={yearOptions} value={String(measureYear)} onValueChange={(v) => setMeasureYear(Number(v))} />
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
            <span className={styles.label}>Care Gaps<span className={styles.req}>•</span></span>
            <span className={styles.count}>{picked.length} selected</span>
          </div>
          <SearchBar value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={false} fullWidth placeholder="Search by measure code or name" />
          {loading ? (
            <SimpleTableSkeleton rows={5} cols={2} />
          ) : visible.length === 0 ? (
            <div className={styles.empty}>
              {whitelisted.length === 0
                ? `No care gaps are whitelisted for ${ipa || 'this IPA'} · ${hpCode || 'this HP code'} · ${measureYear}.`
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
                  measureYear={measureYear}
                  checked={selected.includes(w.code)}
                  config={configFor(w.code)}
                  onConfig={(c) => setConfig(prev => ({ ...prev, [w.code]: c }))}
                  onToggle={() => toggle(w.code)}
                />
              ))}
            </div>
          )}
          {!loading && notApplicable.length > 0 && (
            <span className={styles.helper}>
              Not shown for this patient: {notApplicable.map(x => `${x.w.code} (${x.reason})`).join(', ')}.
            </span>
          )}
        </section>

      </div>
    </Drawer>
  );
}
