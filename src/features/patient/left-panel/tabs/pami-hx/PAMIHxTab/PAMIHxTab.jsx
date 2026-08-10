import { useState } from 'react';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Icon } from '../../../../../../components/Icon/Icon';
import styles from './PAMIHxTab.module.css';

const NOOP = () => {};

// — Mock data —

const CLINICAL_EVENTS = [
  { id: 'ce1', title: 'New unsynced data found from Network', reportedOn: '09/11/2024', meta: '41 items', action: 'Reconcile' },
  { id: 'ce2', title: 'Patient reported data found', reportedOn: '09/11/2024', meta: '2 items', action: 'Reconcile' },
  { id: 'ce3', title: 'New Lab Report', reportedOn: '09/11/2024', meta: 'Elation Montrose', action: 'View' },
  { id: 'ce4', title: 'New Imaging Report', reportedOn: '09/11/2024', meta: null, action: 'View' },
];

const PROBLEMS = [
  { id: 'p1', title: 'Diabeties Mellitus Type 2 (E11.9)', date: '11/18/23 (1 Year)', type: 'Chronic', severity: 'Mild', status: 'Active' },
  { id: 'p2', title: 'Asthama (J45)', date: '11/18/23 (1 Year)', type: 'Acute', severity: 'Mild', status: 'Active' },
];

const ALLERGIES = [
  { id: 'al1', title: 'Hypersensitivity disposition', type: 'Allergy', date: '11/18/23', severity: 'Low', status: 'Active' },
  { id: 'al2', title: 'Saltwater Taffy', type: 'Allergy', date: '11/18/23', severity: 'Low', status: 'Active' },
];

const MEDICATIONS = [
  { id: 'm1', title: 'Symbicort', startDate: '11/18/23', stopDate: '11/24/23', dosage: '1 tab, Once daily at Bedtime', status: 'Active' },
  { id: 'm2', title: 'Ozomet VG 1', startDate: '11/18/23', stopDate: null, dosage: '1 pill, 4 times a day, After Meal', status: 'Active' },
  { id: 'm3', title: 'Tenihpo M 500', startDate: '11/18/23', stopDate: '11/24/23', dosage: '1 pill, 4 times a day, Without food', status: 'Active' },
];

const IMMUNIZATIONS = [
  { id: 'im1', title: 'SARS-COV-2 COVID-19 Inactivated Virus Non-US Vaccine Product (BIBP, Sinopharm) (Sinopharm-Biotech)', dateAdministered: '06/30/2023', dose: '1 Dose', status: 'Not Done' },
];

const MEDICAL_HISTORY = [
  { id: 'mh1', title: 'Hypertension', date: '6 Month Ago' },
];

const SURGICAL_HISTORY = [
  { id: 'sh1', title: 'Appendectomy', date: '20 Days Ago' },
];

const FAMILY_HISTORY = [
  { id: 'fh1', relation: 'Father', name: 'Will Blaine', description: 'History of coronary artery disease (diagnosed at age 55), hypertension, and Type 2 diabetes.' },
];

const SOCIAL_HISTORY = [
  { id: 'soh1', category: 'Smoking', description: 'Former smoker, 1 pack per day for 10 years, quit in 2015' },
  { id: 'soh2', category: 'Alcohol', description: 'Occasional social drinker (1-2 drinks per week)' },
];

const LAB_REPORTS = [
  { id: 'lr1', title: 'Complete Blood Count (CBC)', issuedOn: '09/11/2024' },
  { id: 'lr2', title: 'Comprehensive Metabolic Panel (CMP)', issuedOn: '09/05/2024' },
  { id: 'lr3', title: 'HbA1c Test', issuedOn: '08/20/2024' },
];

const IMAGING_REPORTS = [
  { id: 'ir1', title: 'Chest X-Ray', issuedOn: '09/11/2024' },
  { id: 'ir2', title: 'Abdominal Ultrasound', issuedOn: '08/15/2024' },
];

// — Shared primitives —

function Badge({ label }) {
  return <span className={styles.badge}>{label}</span>;
}

function ColHeader({ nameLabel = 'Name', statusLabel = 'Status' }) {
  return (
    <div className={styles.colHeader}>
      <span className={styles.colName}>{nameLabel}</span>
      <span className={styles.colStatus}>{statusLabel}</span>
      <span className={styles.colActions} />
    </div>
  );
}

function FooterLink({ label }) {
  return (
    <div className={styles.footerRow}>
      <button className={styles.footerLink}>
        {label}
        <Icon name="solar:alt-arrow-right-linear" size={10} color="var(--primary-300)" />
      </button>
    </div>
  );
}

function DataRow({ children, showMore = false }) {
  return (
    <div className={styles.row}>
      {children}
      {showMore && (
        <div className={styles.moreBtn}>
          <ActionButton icon="solar:menu-dots-linear" size="S" tooltip="More" />
        </div>
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
          <Icon name={collapsed ? 'solar:alt-arrow-right-linear' : 'solar:alt-arrow-down-linear'} size={12} color="var(--neutral-200)" />
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

function AddBtn({ onClick }) {
  return <ActionButton icon="solar:add-linear" size="S" tooltip="Add" className={styles.addBtn} onClick={onClick} />;
}

// — Row components —

function ClinicalEventRow({ event }) {
  return (
    <DataRow key={event.id}>
      <div className={styles.nameCell}>
        <span className={styles.name}>{event.title}</span>
        <div className={styles.metaRow}>
          <span className={styles.meta}>Reported on: {event.reportedOn}</span>
          {event.meta && <><span className={styles.metaDot}>•</span><span className={styles.meta}>{event.meta}</span></>}
        </div>
      </div>
      <div className={styles.eventAction}>
        <button className={styles.actionLink} onClick={NOOP}>
          <Icon
            name={event.action === 'Reconcile' ? 'solar:refresh-linear' : 'solar:eye-linear'}
            size={12}
            color="var(--primary-300)"
          />
          {event.action}
        </button>
      </div>
    </DataRow>
  );
}

function ProblemRow({ item }) {
  return (
    <DataRow key={item.id} showMore>
      <div className={styles.nameCell}>
        <span className={styles.name}>{item.title}</span>
        <div className={styles.metaRow}>
          <span className={styles.meta}>{item.date}</span>
          <span className={styles.metaDot}>•</span>
          <span className={styles.meta}>{item.type}</span>
          <span className={styles.metaDot}>•</span>
          <Badge label={item.severity} />
        </div>
      </div>
      <div className={styles.statusCell}>
        <span className={styles.statusActive}>{item.status}</span>
      </div>
    </DataRow>
  );
}

function AllergyRow({ item }) {
  return (
    <DataRow key={item.id} showMore>
      <div className={styles.nameCell}>
        <span className={styles.name}>{item.title}</span>
        <div className={styles.metaRow}>
          <span className={styles.meta}>{item.type}</span>
          <span className={styles.metaDot}>•</span>
          <span className={styles.meta}>{item.date}</span>
          <span className={styles.metaDot}>•</span>
          <Badge label={item.severity} />
        </div>
      </div>
      <div className={styles.statusCell}>
        <span className={styles.statusActive}>{item.status}</span>
      </div>
    </DataRow>
  );
}

function MedicationRow({ item }) {
  return (
    <DataRow key={item.id} showMore>
      <div className={styles.nameCell}>
        <span className={styles.name}>{item.title}</span>
        <span className={styles.meta}>
          Start: {item.startDate}{item.stopDate ? ` • Stop: ${item.stopDate}` : ''}
        </span>
        <span className={styles.meta}>{item.dosage}</span>
      </div>
      <div className={styles.statusCell}>
        <span className={styles.statusNeutral}>{item.status}</span>
      </div>
    </DataRow>
  );
}

function ImmunizationRow({ item }) {
  return (
    <DataRow key={item.id} showMore>
      <div className={styles.nameCell}>
        <span className={styles.name}>{item.title}</span>
        <div className={styles.metaRow}>
          <span className={styles.meta}>Date Administered: {item.dateAdministered}</span>
          <span className={styles.metaDot}>•</span>
          <span className={styles.meta}>{item.dose}</span>
        </div>
      </div>
      <div className={styles.statusCell}>
        <span className={styles.statusNeutral}>{item.status}</span>
      </div>
    </DataRow>
  );
}

function MedicalHistoryRow({ item }) {
  return (
    <div key={item.id} className={styles.historyRow}>
      <div className={styles.historyContent}>
        <span className={styles.name}>{item.title}</span>
        <span className={styles.meta}>{item.date}</span>
      </div>
    </div>
  );
}

function SurgicalHistoryRow({ item }) {
  return (
    <div key={item.id} className={styles.historyRow}>
      <div className={styles.historyContent}>
        <span className={styles.name}>{item.title}</span>
        <span className={styles.meta}>{item.date}</span>
      </div>
    </div>
  );
}

function FamilyHistoryRow({ item }) {
  return (
    <div key={item.id} className={styles.historyFamilyRow}>
      <span className={styles.familyRelation}>{item.relation}</span>
      <span className={styles.familyName}>{item.name}</span>
      <span className={styles.familyDesc}>{item.description}</span>
    </div>
  );
}

function SocialHistoryRow({ item }) {
  return (
    <div key={item.id} className={styles.historyRow}>
      <div className={styles.historyContent}>
        <span className={styles.name}>{item.category}</span>
        <span className={styles.meta}>{item.description}</span>
      </div>
    </div>
  );
}

function ReportRow({ item }) {
  return (
    <div className={styles.row}>
      <div className={styles.nameCell}>
        <span className={styles.name}>{item.title}</span>
        <span className={styles.meta}>Issue On: {item.issuedOn}</span>
      </div>
      <div className={styles.reportActionsCell}>
        <ActionButton icon="solar:eye-linear" size="S" tooltip="View" />
        <span className={styles.reportActionDivider} />
        <ActionButton icon="solar:download-minimalistic-linear" size="S" tooltip="Download" />
      </div>
    </div>
  );
}

function ReportColHeader({ nameLabel }) {
  return (
    <div className={styles.colHeader}>
      <span className={styles.colName}>{nameLabel}</span>
      <div className={styles.reportColActions}>
        <ActionButton icon="solar:sort-linear" size="S" tooltip="Sort" />
        <ActionButton icon="custom:filter" size="S" tooltip="Filter" />
      </div>
    </div>
  );
}

// — Section components —

function RecentClinicalEvents() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={styles.section}>
      <SectionHeader title="Recent Clinical Events" collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <CollapseWrapper collapsed={collapsed}>
        <div className={styles.card}>
          <div className={styles.colHeader}>
            <span className={styles.colName}>Event Name</span>
            <span className={styles.colActions} />
          </div>
          {CLINICAL_EVENTS.map(ev => <ClinicalEventRow key={ev.id} event={ev} />)}
        </div>
      </CollapseWrapper>
    </div>
  );
}

function ProblemsSection() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={styles.section}>
      <SectionHeader title="Problems" actions={<AddBtn />} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <CollapseWrapper collapsed={collapsed}>
        <div className={styles.card}>
          <ColHeader />
          {PROBLEMS.map(item => <ProblemRow key={item.id} item={item} />)}
          <FooterLink label="Resolved (1)" />
        </div>
      </CollapseWrapper>
    </div>
  );
}

function AllergiesSection() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={styles.section}>
      <SectionHeader title="Allergies" actions={<AddBtn />} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <CollapseWrapper collapsed={collapsed}>
        <div className={styles.card}>
          <ColHeader />
          {ALLERGIES.map(item => <AllergyRow key={item.id} item={item} />)}
          <FooterLink label="Resolved (1)" />
        </div>
      </CollapseWrapper>
    </div>
  );
}

function MedicationsSection() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={styles.section}>
      <SectionHeader title="Medications" actions={<AddBtn />} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <CollapseWrapper collapsed={collapsed}>
        <div className={styles.card}>
          <ColHeader />
          {MEDICATIONS.map(item => <MedicationRow key={item.id} item={item} />)}
          <FooterLink label="Discontinued (4)" />
        </div>
      </CollapseWrapper>
    </div>
  );
}

function ImmunizationsSection() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={styles.section}>
      <SectionHeader title="Immunizations" actions={<AddBtn />} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <CollapseWrapper collapsed={collapsed}>
        <div className={styles.card}>
          <ColHeader />
          {IMMUNIZATIONS.map(item => <ImmunizationRow key={item.id} item={item} />)}
        </div>
      </CollapseWrapper>
    </div>
  );
}

function HistorySubCard({ title, actions, children, footer }) {
  return (
    <div className={styles.historyCard}>
      <div className={styles.historySubHeader}>
        <span className={styles.historySubTitle}>{title}</span>
        {actions && <div className={styles.subHeaderActions}>{actions}</div>}
      </div>
      {children}
      {footer}
    </div>
  );
}

function LabReportsSection() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={styles.section}>
      <SectionHeader title="Lab Reports" actions={<AddBtn />} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <CollapseWrapper collapsed={collapsed}>
        <div className={styles.card}>
          <ReportColHeader nameLabel="Lab Name" />
          {LAB_REPORTS.map(item => <ReportRow key={item.id} item={item} />)}
        </div>
      </CollapseWrapper>
    </div>
  );
}

function ImagingReportsSection() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={styles.section}>
      <SectionHeader title="Imaging Reports" actions={<AddBtn />} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <CollapseWrapper collapsed={collapsed}>
        <div className={styles.card}>
          <ReportColHeader nameLabel="Report Name" />
          {IMAGING_REPORTS.map(item => <ReportRow key={item.id} item={item} />)}
        </div>
      </CollapseWrapper>
    </div>
  );
}

function HistorySection() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={styles.section}>
      <SectionHeader title="History" collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <CollapseWrapper collapsed={collapsed}>
      <div className={styles.historyWrapper}>
        <HistorySubCard title="Medical History" actions={<AddBtn onClick={NOOP} />}>
          {MEDICAL_HISTORY.map(item => <MedicalHistoryRow key={item.id} item={item} />)}
        </HistorySubCard>

        <HistorySubCard
          title="Surgical History"
          actions={
            <>
              <ActionButton icon="solar:sort-linear" size="S" tooltip="Sort" />
              <ActionButton icon="custom:filter" size="S" tooltip="Filter" />
            </>
          }
          footer={<FooterLink label="Not Synced (1)" />}
        >
          {SURGICAL_HISTORY.map(item => <SurgicalHistoryRow key={item.id} item={item} />)}
        </HistorySubCard>

        <HistorySubCard
          title="Family History"
          actions={
            <>
              <ActionButton icon="solar:sort-linear" size="S" tooltip="Sort" />
              <ActionButton icon="custom:filter" size="S" tooltip="Filter" />
            </>
          }
          footer={<FooterLink label="Not Synced (1)" />}
        >
          {FAMILY_HISTORY.map(item => <FamilyHistoryRow key={item.id} item={item} />)}
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
              <AddBtn onClick={NOOP} />
            </>
          }
          footer={<FooterLink label="Not Synced (2)" />}
        >
          {SOCIAL_HISTORY.map(item => <SocialHistoryRow key={item.id} item={item} />)}
        </HistorySubCard>
      </div>
      </CollapseWrapper>
    </div>
  );
}

export function PAMIHxTab() {
  return (
    <div className={styles.wrapper}>
      <RecentClinicalEvents />
      <ProblemsSection />
      <AllergiesSection />
      <MedicationsSection />
      <ImmunizationsSection />
      <HistorySection />
      <LabReportsSection />
      <ImagingReportsSection />
    </div>
  );
}
