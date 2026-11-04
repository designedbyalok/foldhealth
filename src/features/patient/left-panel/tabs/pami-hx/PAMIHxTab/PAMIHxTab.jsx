import { Fragment, useState, useEffect, useMemo } from 'react';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Icon } from '../../../../../../components/Icon/Icon';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { AddProblemsDrawer } from '../AddProblemsDrawer';
import { AddMedicationsDrawer } from '../AddMedicationsDrawer';
import { AddAllergiesDrawer } from '../AddAllergiesDrawer';
import { AddImmunizationsDrawer } from '../AddImmunizationsDrawer';
import { AddSurgicalHistoryDrawer } from '../AddSurgicalHistoryDrawer';
import { AddMedicalHistoryDrawer } from '../AddMedicalHistoryDrawer';
import { AddFamilyHistoryDrawer } from '../AddFamilyHistoryDrawer';
import { groupByRelation } from '../../../../../../reference-data/familyRelations';
import { AddSocialHistoryDrawer } from '../AddSocialHistoryDrawer';
import { answeredSocialHistory } from '../../../../../../reference-data/socialHistoryQuestionnaire';
import { EmptyState } from '../../../../../../components/EmptyState/EmptyState';
import { MenuPopover } from '../../../../../../components/MenuPopover/MenuPopover';
import { ConfirmDialog } from '../../../../../../components/ConfirmDialog/ConfirmDialog';
import { DownChevronIcon } from '../../../../../../components/Icon/DownChevronIcon';
import { ProfileTable } from '../../../../../../components/ProfileTable/ProfileTable';
import { profileRowClass, profileCellClass } from '../../../../../../components/ProfileTable/profileTableClasses';
import { useAppStore } from '../../../../../../store/useAppStore';
import { formatClinicalDate, formatDaysAgo } from '../../../../../../lib/clinicalDates';
import styles from './PAMIHxTab.module.css';

const NOOP = () => {};

// Static data,
//
// Recent Clinical Events and Lab / Imaging Reports have no source to read from
// yet, so they show fixed sample rows for every patient. Their sections keep
// the empty-state branch, ready for when real data replaces these constants.

const CLINICAL_EVENTS = [
  { id: 'ce1', title: 'New unsynced data found from Network', reportedOn: '2024-09-11', meta: '41 items', action: 'Reconcile' },
  { id: 'ce2', title: 'Patient reported data found', reportedOn: '2024-09-11', meta: '2 items', action: 'Reconcile' },
  { id: 'ce3', title: 'New Lab Report', reportedOn: '2024-09-11', meta: 'Elation Montrose', action: 'View' },
  { id: 'ce4', title: 'New Imaging Report', reportedOn: '2024-09-11', meta: null, action: 'View' },
];

const LAB_REPORTS = [
  { id: 'lr1', title: 'Complete Blood Count (CBC)', issuedOn: '2024-09-11' },
  { id: 'lr2', title: 'Comprehensive Metabolic Panel (CMP)', issuedOn: '2024-09-05' },
  { id: 'lr3', title: 'HbA1c Test', issuedOn: '2024-08-20' },
];

const IMAGING_REPORTS = [
  { id: 'ir1', title: 'Chest X-Ray', issuedOn: '2024-09-11' },
  { id: 'ir2', title: 'Abdominal Ultrasound', issuedOn: '2024-08-15' },
];

// Shared primitives,

function Badge({ label }) {
  return <span className={styles.badge}>{label}</span>;
}

// Problems, Allergies, Medications and Immunizations share these columns so
// their Status columns line up from section to section.
const STATUS_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status', width: 100 },
  { key: 'actions', label: '', width: 40 },
];

const EVENT_COLUMNS = [
  { key: 'name', label: 'Event Name' },
  // Fits "Reconcile", so the name takes the rest of the row.
  { key: 'actions', label: '', width: 120, align: 'right' },
];

const rowClass = `${profileRowClass} ${styles.row}`;

function FooterLink({ label, onClick }) {
  return (
    <div className={styles.footerRow}>
      <button type="button" className={styles.footerLink} onClick={onClick}>
        {label}
        <Icon name="solar:alt-arrow-right-linear" size={10} color="var(--primary-300)" />
      </button>
    </div>
  );
}

/**
 * The row's "⋯" menu. Every PAMI list offers the same one action, so they
 * share it rather than each growing its own popover.
 *
 * Remove asks first. A status change can be undone from its toast, but a
 * removed record is gone, so this is the one place a confirm earns its click.
 */
function RowMenu({ label, onRemove }) {
  const [menuRect, setMenuRect] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  if (!onRemove) return null;

  const remove = async () => {
    setRemoving(true);
    await onRemove();
    setRemoving(false);
    setConfirming(false);
  };

  return (
    <div className={styles.moreBtn}>
      <ActionButton
        icon="solar:menu-dots-linear"
        size="sm"
        tooltip="More"
        aria-label={`Actions for ${label}`}
        onClick={(e) => setMenuRect(e.currentTarget.getBoundingClientRect())}
      />
      {menuRect && (
        <MenuPopover
          anchorRect={menuRect}
          align="right"
          width={140}
          ariaLabel={`${label} actions`}
          items={[{ key: 'remove', label: 'Remove', icon: 'solar:trash-bin-trash-linear', danger: true }]}
          onSelect={() => { setMenuRect(null); setConfirming(true); }}
          onClose={() => setMenuRect(null)}
        />
      )}
      {confirming && (
        <ConfirmDialog
          variant="destructive"
          title={`Remove ${label}?`}
          description="This removes it from the patient's record and can't be undone."
          confirmLabel="Remove"
          loading={removing}
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

function SectionHeader({ title, actions, collapsed, onToggle }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionTitle}>{title}</span>
      {onToggle && (
        <button className={styles.collapseToggle} onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}>
          <DownChevronIcon size={12} color="var(--neutral-200)" style={collapsed ? { transform: 'rotate(-90deg)' } : undefined} />
        </button>
      )}
      {actions && <div className={styles.sectionActions}>{actions}</div>}
    </div>
  );
}

function CollapseWrapper({ collapsed, children }) {
  return (
    <div className={`${styles.collapseOuter} ${collapsed ? styles.collapsedSection : ''}`}>
      <div className={styles.collapseInner}>{children}</div>
    </div>
  );
}

function AddBtn({ onClick, disabled }) {
  return (
    <ActionButton
      icon="solar:add-linear"
      size="sm"
      tooltip="Add"
      className={styles.addBtn}
      onClick={onClick}
      disabled={disabled}
    />
  );
}

// Row components,

function ClinicalEventRow({ event }) {
  return (
    <tr className={rowClass}>
      <td className={profileCellClass}>
        <div className={styles.nameCell}>
          <span className={styles.name}>{event.title}</span>
          <div className={styles.metaRow}>
            <span className={styles.meta}>Reported on: {formatClinicalDate(event.reportedOn)}</span>
            {event.meta && <><span className={styles.metaDot}>•</span><span className={styles.meta}>{event.meta}</span></>}
          </div>
        </div>
      </td>
      <td className={`${profileCellClass} ${styles.actionsTd}`}>
        <button className={styles.actionLink} onClick={NOOP}>
          <Icon
            name={event.action === 'Reconcile' ? 'solar:refresh-linear' : 'solar:eye-linear'}
            size={12}
            color="var(--primary-300)"
          />
          {event.action}
        </button>
      </td>
    </tr>
  );
}

function ProblemRow({ item, onRemove }) {
  // Same meta line as the Add Problems drawer: plain text throughout, joined
  // by bullets, with no trailing separator.
  const meta = [item.onsetLabel || item.date, item.type, item.severity].filter(Boolean);
  return (
    <tr className={rowClass}>
      <td className={profileCellClass}>
        <div className={styles.nameCell}>
          <span className={styles.name}>{item.title}</span>
          <div className={styles.metaRow}>
            {meta.map((part, i) => (
              <span key={part} className={styles.meta}>
                {i > 0 && <span className={styles.metaDot}>•</span>}
                {part}
              </span>
            ))}
          </div>
        </div>
      </td>
      <td className={profileCellClass}>
        <span className={styles.statusActive}>{item.status}</span>
      </td>
      <td className={profileCellClass}>
        <RowMenu label={item.title} onRemove={onRemove && (() => onRemove(item))} />
      </td>
    </tr>
  );
}

function AllergyRow({ item, onRemove }) {
  const meta = [
    item.reactionType,
    item.criticality ? `${item.criticality} Criticality` : '',
    item.sinceDate ? `Since ${formatClinicalDate(item.sinceDate)}` : '',
  ].filter(Boolean);
  return (
    <tr className={rowClass}>
      <td className={profileCellClass}>
        <div className={styles.nameCell}>
          <span className={styles.name}>{item.title}</span>
          <div className={styles.metaRow}>
            {meta.map((part, i) => (
              <span key={part} className={styles.meta}>
                {i > 0 && <span className={styles.metaDot}>•</span>}
                {part}
              </span>
            ))}
          </div>
        </div>
      </td>
      <td className={profileCellClass}>
        <span className={styles.statusNeutral}>{item.status || 'Active'}</span>
      </td>
      <td className={profileCellClass}>
        <RowMenu label={item.title} onRemove={onRemove && (() => onRemove(item))} />
      </td>
    </tr>
  );
}

function MedicationRow({ item, onRemove }) {
  return (
    <tr className={rowClass}>
      <td className={profileCellClass}>
        <div className={styles.nameCell}>
          <span className={styles.name}>{item.name}</span>
          <span className={styles.meta}>
            {item.start ? `Start: ${formatClinicalDate(item.start)}` : ''}{item.stop ? ` • Stop: ${formatClinicalDate(item.stop)}` : ''}
          </span>
          {item.sig && <span className={styles.meta}>{item.sig}</span>}
        </div>
      </td>
      <td className={profileCellClass}>
        <span className={styles.statusNeutral}>{item.status}</span>
      </td>
      <td className={profileCellClass}>
        <RowMenu label={item.name} onRemove={onRemove && (() => onRemove(item))} />
      </td>
    </tr>
  );
}

function ImmunizationRow({ item, onRemove }) {
  const dose = [item.doseQuantity, item.doseUnits].filter(Boolean).join(' ');
  const meta = [
    item.dateAdministered ? `Date Administered: ${formatClinicalDate(item.dateAdministered)}` : '',
    dose,
  ].filter(Boolean);
  return (
    <tr className={rowClass}>
      <td className={profileCellClass}>
        <div className={styles.nameCell}>
          <span className={styles.name}>{item.title}</span>
          <div className={styles.metaRow}>
            {meta.map((part, i) => (
              <span key={part} className={styles.meta}>
                {i > 0 && <span className={styles.metaDot}>•</span>}
                {part}
              </span>
            ))}
          </div>
        </div>
      </td>
      <td className={profileCellClass}>
        <span className={styles.statusNeutral}>{item.status}</span>
      </td>
      <td className={profileCellClass}>
        <RowMenu label={item.title} onRemove={onRemove && (() => onRemove(item))} />
      </td>
    </tr>
  );
}

// Medical and surgical entries are a name plus how long ago (Figma P360
// 484:329560 for Surgical History).
function DatedHistoryRow({ item }) {
  return (
    <div className={styles.historyRow}>
      <div className={styles.historyContent}>
        <span className={styles.name}>{item.title}</span>
        {item.recordedOn && <span className={styles.meta}>{formatDaysAgo(item.recordedOn)}</span>}
      </div>
    </div>
  );
}

function FamilyHistoryRow({ item }) {
  return (
    <div className={styles.historyFamilyRow}>
      <span className={styles.familyRelation}>{item.relation}</span>
      <span className={styles.familyName}>{item.title}</span>
      {item.detail && <span className={styles.familyDesc}>{item.detail}</span>}
    </div>
  );
}

function SocialHistoryRow({ item }) {
  return (
    <div className={styles.historyRow}>
      <div className={styles.historyContent}>
        <span className={styles.name}>{item.title}</span>
        <span className={styles.meta}>{item.detail}</span>
      </div>
    </div>
  );
}

function ReportRow({ item }) {
  return (
    <tr className={rowClass}>
      <td className={profileCellClass}>
        <div className={styles.nameCell}>
          <span className={styles.name}>{item.title}</span>
          <span className={styles.meta}>Issued On: {formatClinicalDate(item.issuedOn)}</span>
        </div>
      </td>
      <td className={profileCellClass}>
        <div className={styles.reportActionsCell}>
          <ActionButton icon="solar:eye-linear" size="sm" tooltip="View" />
          <span className={styles.reportActionDivider} />
          <ActionButton icon="solar:download-minimalistic-linear" size="sm" tooltip="Download" />
        </div>
      </td>
    </tr>
  );
}

// The Sort / Filter buttons head the actions column, above each row's
// View / Download.
function reportColumns(nameLabel) {
  return [
    { key: 'name', label: nameLabel },
    {
      key: 'actions',
      label: '',
      width: 88,
      align: 'right',
      thLabel: (
        <div className={styles.reportColActions}>
          <ActionButton icon="solar:sort-linear" size="sm" tooltip="Sort" />
          <ActionButton icon="custom:filter" size="sm" tooltip="Filter" />
        </div>
      ),
    },
  ];
}

// Section components,

function RecentClinicalEvents({ updates, loading }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={styles.section}>
      <SectionHeader title="Recent Clinical Events" collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <CollapseWrapper collapsed={collapsed}>
        {!loading && updates.length === 0 ? (
          <div className={styles.emptyCard}>
            <EmptyState icon="solar:bell-linear" title="No Recent Clinical Events" iconSize={31} />
          </div>
        ) : (
          <div className={styles.card}>
            {loading
              ? <CardSkeleton rows={3} />
              : <ProfileTable columns={EVENT_COLUMNS} rows={updates} renderRow={ev => <ClinicalEventRow key={ev.id} event={ev} />} />}
          </div>
        )}
      </CollapseWrapper>
    </div>
  );
}

function ProblemsSection({ patientId }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const storeProblems = useAppStore(s => (patientId ? s.patientProblems[patientId] : null));
  const loadedFor = useAppStore(s => (patientId ? s.patientProblemsLoadedFor[patientId] : false));
  const fetchPatientProblems = useAppStore(s => s.fetchPatientProblems);
  const removePatientProblem = useAppStore(s => s.removePatientProblem);

  useEffect(() => { if (patientId) fetchPatientProblems(patientId); }, [patientId, fetchPatientProblems]);

  const problems = useMemo(() => storeProblems || [], [storeProblems]);
  // Controlled stays on the active list, see the Add Problems drawer.
  const active = problems.filter(p => p.status !== 'Resolved');
  const resolvedCount = problems.filter(p => p.status === 'Resolved').length;
  const loading = !!patientId && !loadedFor;

  return (
    <div className={styles.section}>
      <SectionHeader
        title="Problems"
        actions={<AddBtn onClick={() => setDrawerOpen(true)} disabled={!patientId} />}
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
      />
      <CollapseWrapper collapsed={collapsed}>
        {!loading && active.length === 0 ? (
          <div className={styles.emptyCard}>
            <EmptyState icon="solar:health-linear" title="No Active Problems" iconSize={31} />
          </div>
        ) : (
        <div className={styles.card}>
          {loading ? (
            <CardSkeleton rows={3} />
          ) : (
            <ProfileTable
              columns={STATUS_COLUMNS}
              rows={active}
              renderRow={item => (
                <ProblemRow
                  key={item.id}
                  item={item}
                  onRemove={p => removePatientProblem(patientId, p.id)}
                />
              )}
            />
          )}
          {resolvedCount > 0 && (
            <FooterLink
              label={`Resolved (${resolvedCount})`}
              onClick={() => setDrawerOpen('resolved')}
            />
          )}
        </div>
        )}
      </CollapseWrapper>
      {drawerOpen && (
        <AddProblemsDrawer
          patientId={patientId}
          focus={drawerOpen === 'resolved' ? 'resolved' : undefined}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}

function AllergiesSection({ patientId }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const stored = useAppStore(s => (patientId ? s.patientAllergies[patientId] : null));
  const loadedFor = useAppStore(s => (patientId ? s.patientAllergiesLoadedFor[patientId] : false));
  const fetchPatientAllergies = useAppStore(s => s.fetchPatientAllergies);
  const removePatientAllergy = useAppStore(s => s.removePatientAllergy);

  useEffect(() => { if (patientId) fetchPatientAllergies(patientId); }, [patientId, fetchPatientAllergies]);

  const allergies = useMemo(() => stored || [], [stored]);
  const active = allergies.filter(a => (a.status || 'Active') !== 'Past');
  const pastCount = allergies.filter(a => a.status === 'Past').length;
  const loading = !!patientId && !loadedFor;

  return (
    <div className={styles.section}>
      <SectionHeader
        title="Allergies"
        actions={<AddBtn onClick={() => setDrawerOpen(true)} disabled={!patientId} />}
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
      />
      <CollapseWrapper collapsed={collapsed}>
        {!loading && active.length === 0 ? (
          <div className={styles.emptyCard}>
            <EmptyState icon="custom:allergy" title="No Active Allergies" iconSize={31} />
          </div>
        ) : (
        <div className={styles.card}>
          {loading
            ? <CardSkeleton rows={3} />
            : (
              <ProfileTable
                columns={STATUS_COLUMNS}
                rows={active}
                renderRow={item => (
                  <AllergyRow
                    key={item.id}
                    item={item}
                    onRemove={a => removePatientAllergy(patientId, a.id)}
                  />
                )}
              />
            )}
          {pastCount > 0 && (
            <FooterLink
              label={`Past (${pastCount})`}
              onClick={() => setDrawerOpen('past')}
            />
          )}
        </div>
        )}
      </CollapseWrapper>
      {drawerOpen && (
        <AddAllergiesDrawer
          patientId={patientId}
          focus={drawerOpen === 'past' ? 'past' : undefined}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}

function MedicationsSection({ patientId }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const storeMeds = useAppStore(s => (patientId ? s.patientMedications[patientId] : null));
  const loadedFor = useAppStore(s => (patientId ? s.patientMedicationsLoadedFor[patientId] : false));
  const fetchPatientMedications = useAppStore(s => s.fetchPatientMedications);
  const removePatientMedication = useAppStore(s => s.removePatientMedication);

  useEffect(() => { if (patientId) fetchPatientMedications(patientId); }, [patientId, fetchPatientMedications]);

  const meds = useMemo(() => storeMeds || [], [storeMeds]);
  const active = meds.filter(m => (m.status || 'Active') !== 'Stopped');
  const stoppedCount = meds.filter(m => m.status === 'Stopped').length;
  const loading = !!patientId && !loadedFor;

  return (
    <div className={styles.section}>
      <SectionHeader
        title="Medications"
        actions={<AddBtn onClick={() => setDrawerOpen(true)} disabled={!patientId} />}
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
      />
      <CollapseWrapper collapsed={collapsed}>
        {!loading && active.length === 0 ? (
          <div className={styles.emptyCard}>
            <EmptyState icon="solar:pill-linear" title="No Active Medications" iconSize={31} />
          </div>
        ) : (
        <div className={styles.card}>
          {loading
            ? <CardSkeleton rows={3} />
            : (
              <ProfileTable
                columns={STATUS_COLUMNS}
                rows={active}
                renderRow={item => (
                  <MedicationRow
                    key={item.id}
                    item={item}
                    onRemove={m => removePatientMedication(patientId, m.id)}
                  />
                )}
              />
            )}
          {stoppedCount > 0 && (
            <FooterLink
              label={`Stopped (${stoppedCount})`}
              onClick={() => setDrawerOpen('stopped')}
            />
          )}
        </div>
        )}
      </CollapseWrapper>
      {drawerOpen && (
        <AddMedicationsDrawer
          patientId={patientId}
          focus={drawerOpen === 'stopped' ? 'stopped' : undefined}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}

function ImmunizationsSection({ patientId }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const stored = useAppStore(s => (patientId ? s.patientImmunizations[patientId] : null));
  const loadedFor = useAppStore(s => (patientId ? s.patientImmunizationsLoadedFor[patientId] : false));
  const fetchPatientImmunizations = useAppStore(s => s.fetchPatientImmunizations);
  const removePatientImmunization = useAppStore(s => s.removePatientImmunization);

  useEffect(() => { if (patientId) fetchPatientImmunizations(patientId); }, [patientId, fetchPatientImmunizations]);

  const immunizations = useMemo(() => stored || [], [stored]);
  const active = immunizations.filter(i => (i.status || 'Active') !== 'Completed');
  const completedCount = immunizations.filter(i => i.status === 'Completed').length;
  const loading = !!patientId && !loadedFor;

  return (
    <div className={styles.section}>
      <SectionHeader
        title="Immunizations"
        actions={<AddBtn onClick={() => setDrawerOpen(true)} disabled={!patientId} />}
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
      />
      <CollapseWrapper collapsed={collapsed}>
        {!loading && active.length === 0 ? (
          <div className={styles.emptyCard}>
            <EmptyState icon="solar:syringe-linear" title="No Active Immunizations" iconSize={31} />
          </div>
        ) : (
        <div className={styles.card}>
          {loading
            ? <CardSkeleton rows={3} />
            : (
              <ProfileTable
                columns={STATUS_COLUMNS}
                rows={active}
                renderRow={item => (
                  <ImmunizationRow
                    key={item.id}
                    item={item}
                    onRemove={i => removePatientImmunization(patientId, i.id)}
                  />
                )}
              />
            )}
          {completedCount > 0 && (
            <FooterLink
              label={`Completed (${completedCount})`}
              onClick={() => setDrawerOpen('completed')}
            />
          )}
        </div>
        )}
      </CollapseWrapper>
      {drawerOpen && (
        <AddImmunizationsDrawer
          patientId={patientId}
          focus={drawerOpen === 'completed' ? 'completed' : undefined}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}

function HistorySubCard({ title, actions, children, footer, divided = false }) {
  return (
    <div className={styles.historyCard}>
      <div className={[styles.historySubHeader, divided ? styles.historySubHeaderDivided : ''].filter(Boolean).join(' ')}>
        <span className={styles.historySubTitle}>{title}</span>
        {actions && <div className={styles.subHeaderActions}>{actions}</div>}
      </div>
      {children}
      {footer}
    </div>
  );
}

function ReportsSection({ title, nameLabel, emptyLabel, emptyIcon, reports, loading }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={styles.section}>
      <SectionHeader title={title} actions={<AddBtn />} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <CollapseWrapper collapsed={collapsed}>
        {!loading && reports.length === 0 ? (
          <div className={styles.emptyCard}>
            <EmptyState icon={emptyIcon} title={emptyLabel} iconSize={31} />
          </div>
        ) : (
          <div className={styles.card}>
            {loading
              ? <CardSkeleton rows={2} />
              : <ProfileTable columns={reportColumns(nameLabel)} rows={reports} renderRow={item => <ReportRow key={item.id} item={item} />} />}
          </div>
        )}
      </CollapseWrapper>
    </div>
  );
}

// "Not Synced (N)" counts real rows now; with nothing unsynced there is
// nothing to say, so the footer drops away.
function unsyncedFooter(entries) {
  const n = entries.filter(e => !e.synced).length;
  return n > 0 ? <FooterLink label={`Not Synced (${n})`} /> : null;
}

// Every history card shares one loading / empty / list treatment, so the four
// cards can't drift apart.
function HistoryEntries({ entries, loading, emptyIcon, emptyLabel, render }) {
  if (loading) return <CardSkeleton rows={1} />;
  if (entries.length === 0) {
    return (
      <div className={styles.emptyCard}>
        <EmptyState icon={emptyIcon} title={emptyLabel} iconSize={31} />
      </div>
    );
  }
  return entries.map(render);
}

function HistorySection({ patientId, history, loading }) {
  const [collapsed, setCollapsed] = useState(false);
  const [medicalOpen, setMedicalOpen] = useState(false);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [surgicalOpen, setSurgicalOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);

  // Social History is a questionnaire with its own table; the card lists
  // whichever questions have been answered.
  const socialRecord = useAppStore(s => (patientId ? s.patientSocialHistory[patientId] : null));
  const socialLoadedFor = useAppStore(s => (patientId ? s.patientSocialHistoryLoadedFor[patientId] : false));
  const fetchPatientSocialHistory = useAppStore(s => s.fetchPatientSocialHistory);
  useEffect(() => { if (patientId) fetchPatientSocialHistory(patientId); }, [patientId, fetchPatientSocialHistory]);
  const socialLoading = !!patientId && !socialLoadedFor;
  const social = useMemo(
    () => answeredSocialHistory(socialRecord?.answers).map(a => ({ id: a.id, title: a.label, detail: a.value })),
    [socialRecord],
  );
  const byKind = (kind) => history.filter(h => h.kind === kind);
  const medical = byKind('medical');
  // Newest first, matching the drawer.
  const surgical = byKind('surgical').sort((a, b) => (b.recordedOn || '').localeCompare(a.recordedOn || ''));
  const family = byKind('family');
  // One row per relation, its conditions listed together.
  const familyGroups = groupByRelation(family).map(g => ({
    id: g.relation,
    relation: g.relation,
    title: g.entries.map(e => e.title).join(', '),
    detail: g.entries.map(e => e.detail).filter(Boolean).join(' '),
  }));

  return (
    <div className={styles.section}>
      <SectionHeader title="History" collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <CollapseWrapper collapsed={collapsed}>
      <div className={styles.historyWrapper}>
        <HistorySubCard title="Medical History" actions={<AddBtn onClick={() => setMedicalOpen(true)} disabled={!patientId} />} footer={unsyncedFooter(medical)}>
          <HistoryEntries
            entries={medical}
            loading={loading}
            emptyIcon="custom:medical-history"
            emptyLabel="No Medical History"
            render={item => <DatedHistoryRow key={item.id} item={item} />}
          />
        </HistorySubCard>

        {/* The header divider only shows with entries under it: in the empty
            state it would sit right on top of the dashed ring card. */}
        <HistorySubCard
          title="Surgical History"
          actions={<AddBtn onClick={() => setSurgicalOpen(true)} disabled={!patientId} />}
          footer={unsyncedFooter(surgical)}
          divided={!loading && surgical.length > 0}
        >
          <HistoryEntries
            entries={surgical}
            loading={loading}
            emptyIcon="custom:scalpel"
            emptyLabel="No Surgical History"
            render={item => <DatedHistoryRow key={item.id} item={item} />}
          />
        </HistorySubCard>

        <HistorySubCard
          title="Family History"
          actions={
            <>
              <ActionButton icon="solar:sort-linear" size="sm" tooltip="Sort" />
              <ActionButton icon="custom:filter" size="sm" tooltip="Filter" />
              <AddBtn onClick={() => setFamilyOpen(true)} disabled={!patientId} />
            </>
          }
          footer={unsyncedFooter(family)}
        >
          <HistoryEntries
            entries={familyGroups}
            loading={loading}
            emptyIcon="custom:family-history"
            emptyLabel="No Family History"
            render={item => <FamilyHistoryRow key={item.id} item={item} />}
          />
        </HistorySubCard>

        <HistorySubCard
          title="Social History"
          actions={
            <>
              <button className={styles.profileLink} onClick={NOOP}>
                Central Profile
                <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" />
              </button>
              <span className={styles.subHeaderDivider} />
              <AddBtn onClick={() => setSocialOpen(true)} disabled={!patientId} />
            </>
          }
        >
          <HistoryEntries
            entries={social}
            loading={socialLoading}
            emptyIcon="custom:social-history"
            emptyLabel="No Social History"
            render={item => <SocialHistoryRow key={item.id} item={item} />}
          />
        </HistorySubCard>
      </div>
      </CollapseWrapper>
      {familyOpen && (
        <AddFamilyHistoryDrawer patientId={patientId} onClose={() => setFamilyOpen(false)} />
      )}
      {medicalOpen && (
        <AddMedicalHistoryDrawer patientId={patientId} onClose={() => setMedicalOpen(false)} />
      )}
      {surgicalOpen && (
        <AddSurgicalHistoryDrawer patientId={patientId} onClose={() => setSurgicalOpen(false)} />
      )}
      {socialOpen && (
        <AddSocialHistoryDrawer patientId={patientId} onClose={() => setSocialOpen(false)} />
      )}
    </div>
  );
}

const EMPTY_RECORDS = { history: [] };
const PAMI_WIDGETS = ['clinical-events', 'problems', 'allergies', 'medications', 'immunizations', 'history', 'lab-reports', 'imaging-reports'];

/** `widgets`: the keys to show, in order (More > Customize); all by default. */
export function PAMIHxTab({ patientId, widgets = PAMI_WIDGETS }) {
  const records = useAppStore(s => (patientId ? s.patientPamiRecords[patientId] : null)) || EMPTY_RECORDS;
  const loadedFor = useAppStore(s => (patientId ? s.patientPamiRecordsLoadedFor[patientId] : false));
  const fetchPatientPamiRecords = useAppStore(s => s.fetchPatientPamiRecords);

  useEffect(() => { if (patientId) fetchPatientPamiRecords(patientId); }, [patientId, fetchPatientPamiRecords]);
  const loading = !!patientId && !loadedFor;

  const render = {
    'clinical-events': () => <RecentClinicalEvents updates={CLINICAL_EVENTS} loading={false} />,
    problems: () => <ProblemsSection patientId={patientId} />,
    allergies: () => <AllergiesSection patientId={patientId} />,
    medications: () => <MedicationsSection patientId={patientId} />,
    immunizations: () => <ImmunizationsSection patientId={patientId} />,
    history: () => <HistorySection patientId={patientId} history={records.history} loading={loading} />,
    'lab-reports': () => (
      <ReportsSection
        title="Lab Reports"
        nameLabel="Lab Name"
        emptyLabel="No Lab Reports"
        emptyIcon="solar:test-tube-linear"
        reports={LAB_REPORTS}
        loading={false}
      />
    ),
    'imaging-reports': () => (
      <ReportsSection
        title="Imaging Reports"
        nameLabel="Report Name"
        emptyLabel="No Imaging Reports"
        emptyIcon="custom:imaging"
        reports={IMAGING_REPORTS}
        loading={false}
      />
    ),
  };

  return (
    <div className={styles.wrapper}>
      {widgets.map(key => <Fragment key={key}>{render[key]?.()}</Fragment>)}
    </div>
  );
}
