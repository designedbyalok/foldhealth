import { lazy, Suspense, useEffect, useState } from 'react';
import { DashboardCard, DashboardCardBody } from '../../../../../../components/DashboardCard/DashboardCard';
import { PanelSectionItem } from '../../../../../../components/PanelSection/PanelSection';
import { CappedRows } from './CappedRows';
import { Icon } from '../../../../../../components/Icon/Icon';
import { useAppStore } from '../../../../../../store/useAppStore';
import { gapForHighlight, openOverviewGap } from './overviewItemActions';
import styles from './overviewCards.module.css';
import { CardHeaderActions, CardInsights } from '../attention/CardInsights';

const AddMedicationsDrawer = lazy(() => import('../../../../left-panel/tabs/pami-hx/AddMedicationsDrawer/AddMedicationsDrawer').then(m => ({ default: m.AddMedicationsDrawer })));
const CareGapDetailDrawer = lazy(() => import('../../../../../hedis-worklist/CareGapDetailDrawer').then(m => ({ default: m.CareGapDetailDrawer })));

const KIND = {
  encounter: { icon: 'solar:heart-pulse-linear', tone: 'error' },
  lab: { icon: 'solar:test-tube-linear', tone: 'warning' },
  medication: { icon: 'solar:pill-linear', tone: 'info' },
  risk: { icon: 'solar:danger-triangle-linear', tone: 'warning' },
};

export function HighlightsCard({ overview, patient, patientId }) {
  const showToast = useAppStore(s => s.showToast);
  const hedisMembers = useAppStore(s => s.hedisMembers);
  const hedisLoading = useAppStore(s => s.hedisLoading);
  const fetchHedisMembers = useAppStore(s => s.fetchHedisMembers);
  const hccMembers = useAppStore(s => s.hccMembers);
  const hccLoading = useAppStore(s => s.hccMembersLoading);
  const fetchHccMembers = useAppStore(s => s.fetchHccMembers);
  const openDiagPanel = useAppStore(s => s.openDiagPanel);
  const [medsOpen, setMedsOpen] = useState(false);
  const [careGap, setCareGap] = useState(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const highlights = overview?.highlights || [];
  const who = patient || { id: patientId };
  const needsGaps = highlights.some(h => h.kind === 'lab' || h.kind === 'risk');

  useEffect(() => {
    if (!needsGaps) return;
    fetchHedisMembers?.();
    fetchHccMembers?.();
  }, [needsGaps, fetchHedisMembers, fetchHccMembers]);

  const openHighlight = (h) => {
    if (h.kind === 'medication') { setMedsOpen(true); return; }
    const gap = gapForHighlight(h, overview?.gaps);
    if (!gap) return;
    openOverviewGap(gap, {
      patient: who, hedisMembers, hedisLoading, hccMembers, hccLoading, openDiagPanel, showToast, setCareGap,
    });
  };

  return (
    <DashboardCard icon="solar:lightbulb-minimalistic-linear" title="Highlights" count={highlights.length || null} actions={<CardHeaderActions insightsOpen={insightsOpen} onToggleInsights={() => setInsightsOpen(v => !v)}></CardHeaderActions>}>
      <CardInsights open={insightsOpen} />
      <DashboardCardBody className={styles.listBody}>
        {highlights.length === 0 ? (
          <p className={styles.empty}>Nothing notable recently.</p>
        ) : (
          <CappedRows
            items={highlights}
            render={(h) => {
              const kind = KIND[h.kind] || { icon: 'solar:info-circle-linear', tone: '' };
              const opens = h.kind === 'medication' || !!gapForHighlight(h, overview?.gaps);
              return (
                <div key={h.id} className={opens ? `${styles.listRow} ${styles.clickRow}` : styles.listRow}>
                  <PanelSectionItem
                    inset
                    leading={<span className={`${styles.tile} ${styles[kind.tone] || ''}`}><Icon name={kind.icon} size={16} /></span>}
                    title={opens ? (
                      <button type="button" className={`${styles.titleButton} ${styles.stretch}`} onClick={() => openHighlight(h)}>
                        {h.title}
                      </button>
                    ) : h.title}
                    meta={[h.date, h.source]}
                  />
                </div>
              );
            }}
          />
        )}
      </DashboardCardBody>
      {medsOpen && (
        <Suspense fallback={null}>
          <AddMedicationsDrawer patientId={patientId || patient?.id} onClose={() => setMedsOpen(false)} />
        </Suspense>
      )}
      {careGap && (
        <Suspense fallback={null}>
          <CareGapDetailDrawer
            member={careGap.member}
            gapCode={careGap.gapCode}
            year={careGap.year}
            onClose={() => setCareGap(null)}
          />
        </Suspense>
      )}
    </DashboardCard>
  );
}
