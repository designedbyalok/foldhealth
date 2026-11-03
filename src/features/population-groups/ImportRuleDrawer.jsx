import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { Badge } from '../../components/Badge/Badge';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import styles from './ImportRuleDrawer.module.css';

const CATEGORY_ICONS = {
  'Chronic Care': 'solar:heart-pulse-linear',
  'Preventive Care': 'solar:shield-check-linear',
  'Risk Management': 'solar:danger-triangle-linear',
  'Care Coordination': 'solar:users-group-rounded-linear',
  General: 'solar:clipboard-list-linear',
};

/**
 * Import Rule drawer: shows pre-built rule templates the customer can pick
 * to bootstrap a new Dynamic population group. The chosen template's rule
 * tree is handed back to the caller via `onImport(template)`.
 */
export function ImportRuleDrawer({ onClose, onImport }) {
  const [templates, setTemplates] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('pop_group_rule_templates')
        .select('*')
        .order('category')
        .order('name');
      if (cancelled) return;
      if (err) { setError(err.message); setTemplates([]); return; }
      setTemplates(data || []);
    })();
    return () => { cancelled = true; };
  }, []);

  const grouped = (templates || []).reduce((acc, t) => {
    (acc[t.category] ||= []).push(t);
    return acc;
  }, {});

  return (
    <Drawer
      title="Import Rule"
      onClose={onClose}
      primaryAction={
        <Button
          disabled={!selected}
          onClick={() => { if (selected) onImport(selected); }}
        >
          Import
        </Button>
      }
    >
      {error && (
        <div className={styles.error}>
          <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-error)" />
          Failed to load templates: {error}
        </div>
      )}

      {templates && templates.length === 0 && !error && (
        <EmptyState
          icon="solar:clipboard-list-linear"
          title="No templates yet"
          description="Pre-built rule templates will appear here once they're configured."
        />
      )}

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className={styles.group}>
          <div className={styles.groupTitle}>
            <Icon name={CATEGORY_ICONS[cat] || CATEGORY_ICONS.General} size={14} color="var(--neutral-300)" />
            {cat}
          </div>
          {items.map(t => {
            const active = selected?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={`${styles.card} ${active ? styles.cardActive : ''}`}
                onClick={() => setSelected(active ? null : t)}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardName}>{t.name}</span>
                  <Badge size="sm" label={`${(t.rule?.rules || []).length} conditions`} />
                </div>
                {t.description && <div className={styles.cardDesc}>{t.description}</div>}
              </button>
            );
          })}
        </div>
      ))}
    </Drawer>
  );
}
