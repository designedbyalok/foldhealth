import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Button } from '../../../../../../../../components/Button/Button';
import { Input } from '../../../../../../../../components/Input/Input';
import { Checkbox } from '../../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { searchMedications } from '../../../../../../../../lib/openfda';
import { MED_RECON_MOCK } from '../../../../../../data/medReconMock';
import styles from './MedicationReconciliation.module.css';

// Empty template for the inline form once a med is picked from OpenFDA.
// The two dates carry MM/DD/YYYY strings to match every other cell in the
// table (start/stop columns are unformatted text there too).
const blankDraft = () => ({ name: '', start: '', stop: '', sig: '', openfdaMeta: null });

export function MedicationReconciliation() {
  const patientId          = useAppStore(s => s.selectedPatientId);
  const storedMeds         = useAppStore(s => (patientId ? s.patientMedications[patientId] : null));
  const fetchPatientMedications = useAppStore(s => s.fetchPatientMedications);
  const addPatientMedication    = useAppStore(s => s.addPatientMedication);

  useEffect(() => {
    if (patientId) fetchPatientMedications(patientId);
  }, [patientId, fetchPatientMedications]);

  // Fall back to the mock when the store hasn't hydrated yet OR the patient
  // has no rows in the DB — keeps the demo view intact for patients other
  // than p1 (only p1 is seeded).
  const medications = storedMeds && storedMeds.length > 0 ? storedMeds : MED_RECON_MOCK.medications;

  // Checklist stays local — it's not persisted yet.
  const [checks, setChecks] = useState(() => {
    const seed = {};
    MED_RECON_MOCK.checklist.forEach(c => { seed[c.id] = c.checked; });
    return seed;
  });

  // Add-New container state. Three phases:
  //   closed  — the "Add New" button is idle, nothing rendered below the header.
  //   search  — the container shows a search input; the user is typing or picking.
  //   form    — a med was picked; the container shows the inline row with
  //             editable Name/Start/Stop/Sig + Save/Discard.
  const [phase, setPhase] = useState('closed');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [draft, setDraft] = useState(blankDraft);
  const [saving, setSaving] = useState(false);
  const searchInputRef = useRef(null);
  const abortRef = useRef(null);

  // Debounced OpenFDA search. Cancels the previous in-flight fetch before
  // firing a new one — typeahead should never race stale responses onto the
  // list. Minimum 2 chars because 1-letter wildcards are noise.
  useEffect(() => {
    if (phase !== 'search') return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError('');
      return;
    }
    setSearching(true);
    setSearchError('');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      try {
        const rows = await searchMedications(q, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setResults(rows);
          setSearching(false);
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setSearchError('Could not reach OpenFDA. Try again.');
          setSearching(false);
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [phase, query]);

  const openContainer = () => {
    setPhase('search');
    setQuery('');
    setResults([]);
    setDraft(blankDraft());
    // Autofocus the search field once the container renders.
    queueMicrotask(() => searchInputRef.current?.focus?.());
  };

  const discard = () => {
    setPhase('closed');
    setQuery('');
    setResults([]);
    setDraft(blankDraft());
    abortRef.current?.abort();
  };

  const pickMed = (med) => {
    setDraft({
      name: med.displayName,
      start: '',
      stop: '',
      sig: '',
      openfdaMeta: med.raw,
    });
    setPhase('form');
  };

  const saveDraft = async () => {
    if (!draft.name.trim() || !patientId) return;
    setSaving(true);
    let id;
    try {
      id = await addPatientMedication(patientId, {
        name: draft.name.trim(),
        start: draft.start.trim(),
        stop: draft.stop.trim(),
        sig: draft.sig.trim(),
        source: draft.openfdaMeta ? 'openfda' : 'manual',
        openfdaMeta: draft.openfdaMeta,
      });
    } finally {
      setSaving(false);
    }
    if (id) discard();
  };

  const canSave = draft.name.trim().length > 0 && !saving;

  return (
    <div className={styles.container}>
      {/* Active Medications */}
      <div className={styles.medHeader}>
        <div className={styles.medHeaderLeft}>
          <Checkbox aria-label="Select all medications" />
          <span className={styles.medHeaderTitle}>Active Medications</span>
        </div>
        <Button
          variant="tertiary"
          size="S"
          trailingIcon="solar:alt-arrow-down-linear"
          onClick={() => (phase === 'closed' ? openContainer() : discard())}
        >
          Add New
        </Button>
      </div>

      {/* Add New container — search → results → picked-med inline form */}
      {phase !== 'closed' && (
        <div className={styles.addPanel}>
          {phase === 'search' && (
            <>
              <div className={styles.searchRow}>
                <Icon name="solar:magnifer-linear" size={16} color="var(--neutral-300)" />
                <Input
                  ref={searchInputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search medications from OpenFDA (brand or generic)…"
                  className={styles.searchInput}
                />
                {searching && <span className={styles.searchHint}>Searching…</span>}
              </div>
              {searchError && <div className={styles.searchError}>{searchError}</div>}
              {!searching && query.trim().length >= 2 && results.length === 0 && !searchError && (
                <div className={styles.searchEmpty}>No matches. Try a different name.</div>
              )}
              {results.length > 0 && (
                <ul className={styles.resultList}>
                  {results.map(m => (
                    <li key={m.id}>
                      <button type="button" className={styles.resultItem} onClick={() => pickMed(m)}>
                        <span className={styles.resultName}>{m.displayName}</span>
                        {(m.dosageForm || m.route) && (
                          <span className={styles.resultMeta}>
                            {[m.dosageForm, m.route].filter(Boolean).join(' • ').toLowerCase()}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {phase === 'form' && (
            <>
              <div className={styles.formRow}>
                <span className={styles.checkCell} />
                <div className={`${styles.nameCell} ${styles.formCell}`}>
                  <Input
                    value={draft.name}
                    onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                    placeholder="Medication name"
                  />
                </div>
                <div className={`${styles.dateCell} ${styles.formCell}`}>
                  <Input
                    value={draft.start}
                    onChange={e => setDraft(d => ({ ...d, start: e.target.value }))}
                    placeholder="MM/DD/YYYY"
                  />
                </div>
                <div className={`${styles.dateCell} ${styles.formCell}`}>
                  <Input
                    value={draft.stop}
                    onChange={e => setDraft(d => ({ ...d, stop: e.target.value }))}
                    placeholder="MM/DD/YYYY"
                  />
                </div>
                <div className={`${styles.sigCell} ${styles.formCell}`}>
                  <Input
                    value={draft.sig}
                    onChange={e => setDraft(d => ({ ...d, sig: e.target.value }))}
                    placeholder="e.g. 1 tab • 1 time a day • Any Time"
                  />
                </div>
              </div>
              <div className={styles.formActions}>
                <Button variant="secondary" size="S" onClick={discard} disabled={saving}>Discard</Button>
                <Button variant="primary" size="S" onClick={saveDraft} disabled={!canSave}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Discharge updates callout */}
      <div className={styles.discharge}>
        <button type="button" className={styles.dischargeLink}>
          <Icon name="solar:magic-stick-3-linear" size={16} color="var(--primary-300)" />
          New Medication Updates from Discharge Report
          {MED_RECON_MOCK.dischargeUpdates > 0 && (
            <span className={styles.dischargeBadge}>{MED_RECON_MOCK.dischargeUpdates}</span>
          )}
        </button>
        <span className={styles.dischargeDivider} />
        <button type="button" className={styles.viewAll}>View All</button>
      </div>

      {/* Medications table */}
      <div className={styles.table}>
        <div className={styles.headRow}>
          <span className={styles.checkCell} />
          <span className={styles.nameCell}>Medication Name</span>
          <span className={styles.dateCell}>Start Date</span>
          <span className={styles.dateCell}>Stop Date</span>
          <span className={styles.sigCell}>Sig</span>
        </div>
        {medications.map(m => (
          <div key={m.id} className={styles.row}>
            <span className={styles.checkCell} onClick={e => e.stopPropagation()}>
              <Checkbox aria-label={`Select ${m.name}`} />
            </span>
            <span className={styles.nameCell}>{m.name}</span>
            <span className={styles.dateCell}>{m.start || '—'}</span>
            <span className={styles.dateCell}>{m.stop || '—'}</span>
            <span className={styles.sigCell}>{m.sig || '—'}</span>
          </div>
        ))}
      </div>

      {/* Medication Checklist */}
      <div className={styles.checklist}>
        <div className={styles.checklistTitle}>Medication Checklist</div>
        {MED_RECON_MOCK.checklist.map(c => (
          <label key={c.id} className={styles.checkItem}>
            <Checkbox
              checked={!!checks[c.id]}
              onCheckedChange={v => setChecks(prev => ({ ...prev, [c.id]: v === true }))}
            />
            <span className={`${styles.checkLabel} ${checks[c.id] ? styles.checkLabelDone : ''}`}>{c.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
