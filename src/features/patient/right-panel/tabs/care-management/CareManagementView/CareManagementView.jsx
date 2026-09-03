import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../../../../components/Icon/Icon';
import { Button } from '../../../../../../components/Button/Button';
import { FilterChip } from '../../../../../../components/FilterChip/FilterChip';
import { AddIconMinimalist } from '../../../../../../components/Icon/AddIconMinimalist';
import { SubTabs } from '../../../../../../components/SubTabs/SubTabs';
import { useAppStore } from '../../../../../../store/useAppStore';
import { CareProgramsTab } from '../../care-programs/CareProgramsTab/CareProgramsTab';
import { CarePlanSummaryView } from '../../care-programs/care-plan/summary/CarePlanSummaryView/CarePlanSummaryView.jsx';
import { buildCarePlanSnapshot, filterCarePlanSnapshot, downloadCarePlanCsv } from '../../care-programs/care-plan/summary/carePlanSnapshot';
import { programUrlKey } from '../../care-programs/CareProgramsTab/CareProgramsTab.utils';
import { stepsFor, flatSteps } from '../../care-programs/program-detail/ProgramDetailView/ProgramDetailView.utils';
import { CareManagementToolbar } from '../CareManagementToolbar/CareManagementToolbar';
import { ProgramActivityCard } from '../ProgramActivityCard/ProgramActivityCard.jsx';
import { groupProgramActivity } from '../programActivity';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { RingEmptyState } from '../../../../../../components/RingEmptyState/RingEmptyState';
import { CM_FILTERS } from '../../../../data/programActivityMock';
import styles from './CareManagementView.module.css';

const CM_TABS = ['Care Programs', 'Comprehensive Care Plan', 'Program Activity Log'];

/** Comprehensive Care Plan pane — read-only cross-program snapshot with its own
 *  search + (program) filter and a Download CTA. */
function ComprehensiveCarePlanPane({ header, patientId, programs, onClose, onOpenProgramStep }) {
  const showToast = useAppStore(s => s.showToast);
  const patientCarePlans = useAppStore(s => s.patientCarePlans);
  const [searchMode, setSearchMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [programFilter, setProgramFilter] = useState([]);
  const programCodes = useMemo(() => [...new Set(programs.map(p => p.code))], [programs]);

  const handleDownload = () => {
    const snapshot = filterCarePlanSnapshot(
      buildCarePlanSnapshot(programs, patientCarePlans, patientId),
      { searchText, programFilter },
    );
    if (snapshot.goals.length === 0 && snapshot.interventions.length === 0) {
      showToast?.('No care plan data to download');
      return;
    }
    downloadCarePlanCsv(snapshot, `care-plan-${patientId || 'patient'}`);
    showToast?.('Care plan downloaded');
  };

  return (
    <div className={styles.pane}>
      <CareManagementToolbar
        header={header}
        searchMode={searchMode} setSearchMode={setSearchMode}
        searchText={searchText} setSearchText={setSearchText}
        searchPlaceholder="Search goals & interventions"
        showFilters={showFilters} setShowFilters={setShowFilters}
        cta={(
          <Button
            variant="tertiary"
            size="L"
            leadingIcon="solar:download-minimalistic-linear"
            onClick={handleDownload}
          >
            Download
          </Button>
        )}
        filterBar={(
          <div className={styles.filterBar}>
            <FilterChip label="Program" options={programCodes} selected={programFilter} onChange={setProgramFilter} />
            {programFilter.length > 0 && (
              <button type="button" className={styles.clearAll} onClick={() => setProgramFilter([])}>
                <Icon name="solar:backspace-linear" size={16} color="var(--primary-300)" />
                Clear All
              </button>
            )}
          </div>
        )}
      />
      <div className={styles.paneBody}>
        <CarePlanSummaryView
          embedded
          patientId={patientId}
          programs={programs}
          searchText={searchText}
          programFilter={programFilter}
          onClose={onClose}
          onOpenProgramStep={onOpenProgramStep}
        />
      </div>
    </div>
  );
}

/** Program Activity Log — the monthly activity timeline with its own search +
 *  filter and an Add Care Note CTA. */
function ProgramActivityLog({ header }) {
  const showToast = useAppStore(s => s.showToast);
  const patientId = useAppStore(s => s.selectedPatientId);
  const fetchPatientProgramActivity = useAppStore(s => s.fetchPatientProgramActivity);
  const activityByPatient = useAppStore(s => s.patientProgramActivity);
  const loadingMap = useAppStore(s => s.patientProgramActivityLoading);
  const loadedFor = useAppStore(s => s.patientProgramActivityLoadedFor);
  const [searchMode, setSearchMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (patientId) fetchPatientProgramActivity(patientId);
  }, [patientId, fetchPatientProgramActivity]);

  const entries = activityByPatient[patientId] || [];
  const loading = !!loadingMap[patientId] && !loadedFor[patientId];

  const months = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const filtered = q
      ? entries.filter(e => `${e.programName} ${e.programCode} ${e.title} ${e.actorName}`.toLowerCase().includes(q))
      : entries;
    return groupProgramActivity(filtered);
  }, [entries, searchText]);

  return (
    <div className={styles.pane}>
      <CareManagementToolbar
        header={header}
        searchMode={searchMode} setSearchMode={setSearchMode}
        searchText={searchText} setSearchText={setSearchText}
        searchPlaceholder="Search activity"
        showFilters={showFilters} setShowFilters={setShowFilters}
        cta={(
          <Button
            variant="tertiary"
            size="L"
            leadingIconElement={<AddIconMinimalist size={16} />}
            onClick={() => showToast?.('Add a care note')}
          >
            Add Care Note
          </Button>
        )}
        filterBar={(
          <div className={styles.filterBar}>
            {CM_FILTERS.map(f => (
              <FilterChip key={f.label} label={f.label} options={[]} selected={[]} onChange={() => {}} />
            ))}
          </div>
        )}
      />
      <div className={styles.timeline}>
        {loading ? (
          <CardSkeleton count={4} />
        ) : months.length === 0 ? (
          <RingEmptyState icon="solar:clipboard-list-linear" label={searchText ? 'No matching activity' : 'No program activity yet'} />
        ) : (
          months.map(month => (
            <div key={month.key} className={styles.monthSection}>
              <div className={styles.monthHeader}>
                <span className={styles.monthLine} />
                <span className={styles.monthTitle}>{month.label}</span>
                <span className={styles.monthLine} />
              </div>
              {month.cards.map(card => (
                <ProgramActivityCard key={card.key} card={card} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Care Management — a secondary switch (SubTabs) over the three program views.
 * Every tab shares the same toolbar layout (search · sub-tabs · CTA · filter);
 * only the CTA changes per tab. Each pane reuses its existing, data-backed view.
 */
export function CareManagementView() {
  // Sub-tab lives in the store so it rides the URL and survives a refresh.
  const subTab = useAppStore(s => s.careManagementTab);
  const setSubTab = useAppStore(s => s.setCareManagementTab);
  const patientId = useAppStore(s => s.selectedPatientId);
  const careProgramsByPatient = useAppStore(s => s.careProgramsByPatient);
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  const openCareProgram = useAppStore(s => s.openCareProgram);
  const setCareProgramStep = useAppStore(s => s.setCareProgramStep);

  useEffect(() => {
    if (patientId) fetchCareProgramsForPatient(patientId);
  }, [patientId, fetchCareProgramsForPatient]);

  const programs = useMemo(
    () => careProgramsByPatient[patientId] || [],
    [careProgramsByPatient, patientId],
  );

  // From the comprehensive view, hand off to the owning program's Care Plan
  // step: open the program (store) and switch to the Care Programs sub-tab so
  // CareProgramsTab renders it.
  const openProgramAtCarePlan = (program) => {
    const carePlanStep = flatSteps(stepsFor(program.code)).find(s => s.name.toLowerCase().includes('care plan'));
    openCareProgram(programUrlKey(program));
    if (carePlanStep) setCareProgramStep(carePlanStep.id);
    setSubTab('Care Programs');
  };

  // The sub-tab switch is a controlled element owned here, handed to each pane
  // so it renders inline in that pane's shared toolbar row.
  const subTabBar = <SubTabs tabs={CM_TABS} activeKey={subTab} onChange={setSubTab} />;

  // Keep all three panes mounted and toggle visibility, so switching only
  // shows/hides a pane instead of unmounting + remounting it — no re-fetch,
  // no re-animation, no reflow. The result is a flicker-free switch.
  return (
    <div className={styles.container}>
      <div className={styles.paneSlot} hidden={subTab !== 'Care Programs'}>
        <CareProgramsTab header={subTabBar} />
      </div>
      <div className={styles.paneSlot} hidden={subTab !== 'Comprehensive Care Plan'}>
        <ComprehensiveCarePlanPane
          header={subTabBar}
          patientId={patientId}
          programs={programs}
          onClose={() => setSubTab('Care Programs')}
          onOpenProgramStep={openProgramAtCarePlan}
        />
      </div>
      <div className={styles.paneSlot} hidden={subTab !== 'Program Activity Log'}>
        <ProgramActivityLog header={subTabBar} />
      </div>
    </div>
  );
}
