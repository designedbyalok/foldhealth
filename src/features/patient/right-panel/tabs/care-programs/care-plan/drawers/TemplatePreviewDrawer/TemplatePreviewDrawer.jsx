import { useMemo } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { CarePlanSections } from '../../../../../../../settings/care-plan-library/shared';
import { goalCategoryIcon } from '../../../../../../../settings/care-plan-library/lib';
import {
  goalPayloadFromTemplateEntry,
  interventionPayloadFromTemplateEntry,
} from '../../lib/carePlanTemplateApply';
import { CARE_PLAN_INTERVENTION_ICONS } from '../../lib/carePlanInterventionMenu';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import styles from './TemplatePreviewDrawer.module.css';

/**
 * Read-only look at a Care Plan Library template before it is applied to a
 * patient plan. Renders the template's Goals / Interventions / Barriers with
 * the same shared CarePlanSections stack the template editor and New Care Plan
 * use, so a template reads identically wherever it is reviewed. Nothing here
 * writes: no "+" add affordances, no row menus, no clickable rows.
 */
export function TemplatePreviewDrawer({ template, onClose }) {
  const libraryGoals = useAppStore(s => s.carePlanGoals);

  const goals = useMemo(() => template?.goals || [], [template]);
  const interventions = useMemo(() => template?.interventions || [], [template]);
  const barriers = useMemo(() => template?.barriers || [], [template]);
  const conditions = (template?.conditions || []).filter(Boolean);

  const goalRows = useMemo(() => goals.map((entry, i) => {
    const payload = goalPayloadFromTemplateEntry(entry, libraryGoals);
    return {
      ...payload,
      id: entry.id || `goal-${i}`,
      icon: goalCategoryIcon(payload.category),
      currentValue: 'No Data',
      trend: '—',
      progress: '0%',
    };
  }), [goals, libraryGoals]);

  const interventionRows = useMemo(() => interventions.map((entry, i) => ({
    ...interventionPayloadFromTemplateEntry(entry),
    id: entry.id || `intv-${i}`,
    icon: CARE_PLAN_INTERVENTION_ICONS[entry.kind] || 'solar:clipboard-list-linear',
  })), [interventions]);

  const barrierRows = useMemo(() => barriers.map((entry, i) => ({
    id: entry.id || `barrier-${i}`,
    title: entry.title,
    subtitle: entry.description || '',
    status: 'Not Started',
  })), [barriers]);

  // Which goals own each intervention / barrier, keyed by the link id and by
  // title (templates saved before barriers were sourced from goal links carry
  // barrier-library ids that never match a link id). Mirrors CarePlanTemplateView.
  const goalsByLinkId = useMemo(() => {
    const map = new Map();
    const norm = (v) => (v || '').trim().toLowerCase();
    for (const entry of goals) {
      const goal = libraryGoals.find(g => g.id === entry.id);
      for (const link of goal?.interventions || []) {
        const owner = {
          id: entry.id,
          title: entry.title || goal?.title || '',
          icon: goalCategoryIcon(goal?.category),
        };
        const list = map.get(link.id) || [];
        list.push(owner);
        map.set(link.id, list);
        const titleKey = norm(link.title);
        if (titleKey) {
          const byTitle = map.get(titleKey) || [];
          if (!byTitle.some(o => o.id === owner.id)) byTitle.push(owner);
          map.set(titleKey, byTitle);
        }
      }
    }
    return map;
  }, [goals, libraryGoals]);

  if (!template) return null;

  return (
    <Drawer title="Template Preview" onClose={onClose}>
      <div className={styles.body}>
        <div className={styles.hero}>
          <span className={styles.name}>{template.name}</span>
          {conditions.length > 0 && (
            <div className={styles.conditions}>
              {conditions.map(c => <Badge key={c} tone="grey" size="S" label={c} />)}
            </div>
          )}
        </div>

        <CarePlanSections
          goalRows={goalRows}
          interventionRows={interventionRows}
          barrierRows={barrierRows}
          linkedForChild={(row) => {
            const owners = goalsByLinkId.get(row.id)
              || goalsByLinkId.get((row.title || '').trim().toLowerCase());
            return owners?.length ? { goals: owners } : null;
          }}
          linkedForGoal={(row) => {
            const goal = libraryGoals.find(g => g.id === row.id);
            const links = goal?.interventions || [];
            if (!links.length) return null;
            return {
              interventions: links
                .filter(l => l.kind !== 'barrier')
                .map(l => ({
                  id: l.id,
                  title: l.title,
                  icon: CARE_PLAN_INTERVENTION_ICONS[l.kind] || 'solar:clipboard-list-linear',
                })),
              barriers: links
                .filter(l => l.kind === 'barrier')
                .map(l => ({ id: l.id, title: l.title })),
            };
          }}
        />
      </div>
    </Drawer>
  );
}
