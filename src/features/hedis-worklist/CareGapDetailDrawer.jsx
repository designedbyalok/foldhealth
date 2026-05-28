import { useState, useEffect } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { ClinicalNotePanel } from './ClinicalNotePanel';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Icon } from '../../components/Icon/Icon';
import { PdfPreviewOverlay } from '../../components/PdfPreviewOverlay/PdfPreviewOverlay';
import { Timeline } from '../../components/Timeline/Timeline';
import { useAppStore } from '../../store/useAppStore';
import styles from './CareGapDetailDrawer.module.css';

const MEASURE_NAMES = {
  CBP:      'Controlling Blood Pressure',
  COL:      'Colorectal Cancer Screening',
  'COA-FS': 'Care for Older Adults: Functional Status',
  'COA-M':  'Care for Older Adults: Medication Review',
  BCS:      'Breast Cancer Screening',
  DM:       'Diabetes HbA1c Control',
  ABA:      'Adult BMI Assessment',
  FUH:      'Follow-Up After Hospitalization',
  AMR:      'Asthma Medication Ratio',
  OMW:      'Osteoporosis Management in Women',
  KED:      'Kidney Health Evaluation',
  EED:      'Eye Exam for Patients With Diabetes',
  GSD3:     'Glycemic Status Assessment',
};

const STATUSES = ['Open', 'Closed', 'Excluded', 'Completed', 'Submitted', 'Closed-Data'];

const STATUS_COLOR = {
  Open:         styles.statusOpen,
  Completed:    styles.statusCompleted,
  Submitted:    styles.statusCompleted,
  Closed:       styles.statusExcluded,
  Excluded:     styles.statusExcluded,
  'Closed-Data': styles.statusExcluded,
};

// Tab labels with the static counts shown in the design reference. Only
// Activity Log has live content; the rest are stubbed (coming soon).
const TABS = [
  { key: 'Activity Log', label: 'Activity Log' },
  { key: 'Outreaches', label: 'Outreaches', count: 1 },
  { key: 'Referrals', label: 'Referrals', count: 2 },
  { key: 'Tasks', label: 'Tasks', count: 8 },
  { key: 'Appt/Reminders', label: 'Appt/Reminders', count: 5 },
  { key: 'Clinical Notes', label: 'Clinical Notes' },
  { key: 'Orders', label: 'Orders' },
];

// Map a raw caregapActivity entry into the shape the shared Timeline
// component expects. The Timeline handles month grouping internally.
function toTimelineEntry(e, i) {
  const d = new Date(e.when ?? e.at);
  const valid = !Number.isNaN(d.getTime());
  const mm = valid ? String(d.getMonth() + 1).padStart(2, '0') : '';
  const dd = valid ? String(d.getDate()).padStart(2, '0') : '';
  const yyyy = valid ? d.getFullYear() : '';
  let hh = valid ? d.getHours() : 0;
  const min = valid ? String(d.getMinutes()).padStart(2, '0') : '';
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return {
    id: e.id ?? `${e.when ?? e.at}-${i}`,
    createdAt: e.when ?? e.at,
    date: valid ? `${mm}/${dd}/${yyyy}` : '',
    time: valid ? `${hh}:${min} ${ampm}` : '',
    user: e.actor || e.user || 'System',
    icon: e.icon || 'solar:shield-check-linear',
    iconBg: 'var(--neutral-50)',
    iconBorder: 'color-mix(in srgb, var(--neutral-300) 12%, transparent)',
    iconColor: 'var(--neutral-300)',
    details: e.title,
    category: e.detail,
    attachment: e.attachment,
  };
}

export function CareGapDetailDrawer({ member, gapCode, year, onClose }) {
  const showToast = useAppStore(s => s.showToast);
  const updateGapStatus = useAppStore(s => s.updateGapStatus);
  const logCareGapActivity = useAppStore(s => s.logCareGapActivity);
  const activityEntries = useAppStore(s => s.caregapActivity[member?.id]);

  // Internal gap selection so the header prev/next arrows can cycle through
  // the member's care gaps without re-opening the drawer.
  const gaps = member?.gaps ?? [];
  const [currentCode, setCurrentCode] = useState(gapCode);
  useEffect(() => { setCurrentCode(gapCode); }, [gapCode, member?.id]);

  const [statusOpen, setStatusOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Activity Log');
  const [showClinicalNote, setShowClinicalNote] = useState(false);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentExpanded, setCommentExpanded] = useState(false);

  if (!member || gaps.length === 0) return null;

  const idx = Math.max(0, gaps.findIndex(g => g.code === currentCode));
  const gap = gaps[idx] ?? gaps[0];
  const canPrev = idx > 0;
  const canNext = idx < gaps.length - 1;

  const status = gap?.status ?? 'Open';
  const measureName = MEASURE_NAMES[gap.code] ?? gap.code;
  const statusLocked = status === 'Completed';

  // Adapt raw caregapActivity entries to Timeline's entry shape.
  const timelineEntries = (activityEntries || []).map(toTimelineEntry);

  const goPrev = () => { if (canPrev) { setCurrentCode(gaps[idx - 1].code); setStatusOpen(false); } };
  const goNext = () => { if (canNext) { setCurrentCode(gaps[idx + 1].code); setStatusOpen(false); } };

  const handleAddComment = () => {
    const text = commentText.trim();
    if (!text) return;
    logCareGapActivity(member.id, {
      when: new Date().toISOString(),
      actor: 'Alok Kumar',
      icon: 'solar:chat-round-linear',
      iconBg: 'var(--primary-100)',
      iconBorder: 'color-mix(in srgb, var(--primary-300) 20%, transparent)',
      iconColor: 'var(--primary-300)',
      title: text,
      detail: 'Comment',
    });
    setCommentText('');
    setCommentExpanded(false);
  };

  return (
    <>
    {showClinicalNote && (
      <ClinicalNotePanel
        member={member}
        gapCode={gap.code}
        year={year}
        onClose={() => setShowClinicalNote(false)}
      />
    )}
    <Drawer
      title="Care Gap Details"
      onClose={onClose}
      noCloseDivider
      bodyClassName={styles.drawerBody}
      headerRight={
        <div className={styles.headerNav}>
          <ActionButton
            icon="solar:alt-arrow-left-linear"
            size="L"
            tooltip="Previous gap"
            state={canPrev ? 'active' : 'disabled'}
            onClick={goPrev}
          />
          <ActionButton
            icon="solar:alt-arrow-right-linear"
            size="L"
            tooltip="Next gap"
            state={canNext ? 'active' : 'disabled'}
            onClick={goNext}
          />
          <span className={styles.headerDivider} />
        </div>
      }
    >
      {/* ── Patient banner (shared component) ── */}
      <div className={styles.patientBannerWrap}>
        <PatientBanner
          initials={member.in}
          name={member.name}
          gender={member.gender}
          age={member.age}
          memberId={member.memberId}
          hidePatientLabel
          onCall={() => showToast('Call — coming soon')}
        />
      </div>

      <div className={styles.contentBody}>
      {/* ── Gap header ── */}
      <div className={styles.gapHeader}>
        <div className={styles.gapToolbar}>
          {/* Status dropdown — disabled when Completed (AC-4 lockout) */}
          <div className={styles.statusWrap}>
            <button
              className={`${styles.statusBtn} ${STATUS_COLOR[status] ?? ''}`}
              onClick={() => { if (!statusLocked) setStatusOpen(v => !v); }}
              disabled={statusLocked}
              title={statusLocked ? 'Completed gaps are locked' : ''}
              style={statusLocked ? { cursor: 'not-allowed', opacity: 0.75 } : undefined}
            >
              {status}
              <Icon name={statusLocked ? 'solar:lock-keyhole-minimalistic-linear' : 'solar:alt-arrow-down-linear'} size={12} />
            </button>
            {statusOpen && !statusLocked && (
              <div className={styles.statusMenu}>
                {STATUSES.map(s => (
                  <button
                    key={s}
                    className={`${styles.statusMenuItem} ${s === status ? styles.statusMenuItemActive : ''}`}
                    onClick={() => { updateGapStatus(member.id, gap.code, s); setStatusOpen(false); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.gapToolbarRight}>
            <button
              className={`${styles.assignBtn} ${gap.assignee ? styles.assigned : ''}`}
              onClick={() => showToast('Assign — coming soon')}
            >
              <Icon name="solar:user-linear" size={15} color="currentColor" />
              {gap.assignee || 'Assign'}
              <Icon name="solar:alt-arrow-down-linear" size={12} color="currentColor" />
            </button>
            <span className={styles.headerDivider} />
            <ActionButton icon="solar:clipboard-add-linear" size="L" tooltip="Add Task" onClick={() => showToast('Add Task — coming soon')} />
            <span className={styles.headerDivider} />
            <ActionButton icon="solar:notes-linear" size="L" tooltip="Notes" onClick={() => showToast('Notes — coming soon')} />
            <span className={styles.headerDivider} />
            <ActionButton icon="solar:menu-dots-bold" size="L" tooltip="More" onClick={() => showToast('More — coming soon')} />
          </div>
        </div>

        <div className={styles.gapTitle}>{measureName}</div>
        <div className={styles.gapSubRow}>
          <span>Measure Year {year}</span>
          <span className={styles.gapSubDot}>&bull;</span>
          <button className={styles.moreDetailsBtn} onClick={() => setMoreOpen(v => !v)}>
            More Details
            <Icon
              name="solar:alt-arrow-down-linear"
              size={13}
              color="currentColor"
              className={`${styles.moreChevron} ${moreOpen ? styles.moreChevronOpen : ''}`}
            />
          </button>
        </div>

        {/* More Details expansion — Measure Requirements + Instructions live here */}
        <div className={`${styles.moreDetails} ${moreOpen ? styles.moreDetailsOpen : ''}`}>
          <div className={styles.moreDetailsInner}>
            <div className={styles.moreDetailsBody}>
              <div className={styles.infoBanner}>
                <span className={styles.infoBannerIcon}>
                  <Icon name="solar:info-circle-linear" size={15} color="var(--status-info, #145ECC)" />
                </span>
                <span>
                  Evidence uploaded will be recorded for measurement year {year}. The measurement year filter is displayed above for your reference.
                </span>
              </div>

              <div className={styles.accordionSection}>
                <button className={styles.accordionBtn} onClick={() => showToast('Measure Requirements — coming soon')}>
                  <Icon name="solar:alt-arrow-down-linear" size={13} />
                  Measure Requirements
                </button>
              </div>
              <div className={styles.accordionSection}>
                <button className={styles.accordionBtn} onClick={() => showToast('Measure Instructions — coming soon')}>
                  <Icon name="solar:alt-arrow-down-linear" size={13} />
                  Measure Instructions
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Suggested actions ── */}
      <div className={styles.suggestSection}>
      <div className={styles.suggestRow}>
        <Icon name="solar:magic-stick-3-bold" size={14} color="var(--primary-300)" />
        Suggested Actions
      </div>
      <div className={styles.suggestActions}>
        <Button variant="primary" size="L" leadingIcon="solar:document-add-linear" onClick={() => setShowClinicalNote(true)}>
          Add Clinical Note
        </Button>
        <Button variant="tertiary" size="L" onClick={() => showToast('Add Referral — coming soon')}>
          Add Referral
        </Button>
        <span className={styles.suggestDivider} />
        <Button variant="secondary" size="L" onClick={() => showToast('Add Outreach — coming soon')}>
          Add Outreach
        </Button>
        <Button variant="secondary" size="L" onClick={() => showToast('Set Reminder — coming soon')}>
          Set Reminder
        </Button>
      </div>
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabBar}>
        <div className={styles.tabsScroll}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.count != null && <span className={styles.tabCount}>({tab.count})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'Activity Log' ? (
        <div className={styles.activityLog}>
          <div className={styles.commentInput}>
            {commentExpanded ? (
              <textarea
                autoFocus
                className={styles.commentTextarea}
                placeholder="Add a comment, use @ to mention someone"
                rows={3}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setCommentExpanded(false); setCommentText(''); } }}
              />
            ) : (
              <Input
                placeholder="Add a comment"
                onFocus={() => setCommentExpanded(true)}
                style={{ cursor: 'text', width: '100%' }}
              />
            )}
            {commentExpanded && (
              <div className={styles.commentActions}>
                <Button variant="primary" size="S" disabled={!commentText.trim()} onClick={handleAddComment}>Comment</Button>
                <Button variant="secondary" size="S" onClick={() => { setCommentExpanded(false); setCommentText(''); }}>Cancel</Button>
              </div>
            )}
          </div>
          <Timeline
            entries={timelineEntries}
            emptyLabel="No activity yet for this care gap."
            renderExtra={(entry) =>
              entry.attachment?.blob ? (
                <button
                  type="button"
                  className={styles.activityAttachment}
                  onClick={(e) => { e.stopPropagation(); setPdfPreview(entry.attachment); }}
                >
                  <Icon name="solar:paperclip-linear" size={13} color="var(--primary-300)" />
                  {entry.attachment.filename || 'Consolidated note.pdf'}
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className={styles.emptyTab}>
          <Icon name="solar:hourglass-line-linear" size={36} color="var(--neutral-200)" />
          <p className={styles.emptyTabTitle}>{activeTab} — coming soon</p>
        </div>
      )}
      </div>
    </Drawer>
    {pdfPreview && (
      <PdfPreviewOverlay
        blob={pdfPreview.blob}
        filename={pdfPreview.filename}
        onClose={() => setPdfPreview(null)}
      />
    )}
    </>
  );
}
