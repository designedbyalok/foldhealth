import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../components/Dialog/Dialog';
import { Input } from '../../../components/Input/Input';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { useAppStore } from '../../../store/useAppStore';
import { TEMPLATE_CATEGORIES } from '../lib/catalog';
import { FlowIcons } from '../shared/FlowIcons';
import styles from './AutomationBuilder.module.css';

/**
 * Pick a template to drop in as a micro automation: a grouped set of steps
 * that runs as one branch. Its steps are copied, so later edits to the
 * template don't change this automation.
 */
export function MicroAutomationPicker({ onPick, onClose }) {
  const templates = useAppStore(s => s.automationTemplates);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const sections = useMemo(() => {
    const match = templates.filter(t => !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    return [
      { key: 'recommended', label: 'Recommended for you', items: match.filter(t => t.recommended) },
      ...TEMPLATE_CATEGORIES.map(c => ({ key: c.key, label: c.label, items: match.filter(t => t.category === c.key && !t.recommended) })),
    ].filter(s => s.items.length);
  }, [templates, q]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={styles.pickerDialog}>
        <DialogTitle>Micro Automation</DialogTitle>
        <DialogDescription>Add a ready-made set of steps as one branch. You can edit the steps after adding them.</DialogDescription>
        <Input leadingIcon="solar:magnifer-linear" placeholder="Search templates" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search templates" />
        <div className={styles.pickerBody}>
          {sections.length === 0 ? (
            <EmptyState icon="solar:magnifer-linear" title={`No templates match “${query}”`} />
          ) : sections.map(s => (
            <div key={s.key} className={styles.pickerSection}>
              <span className={styles.paletteSection}>{s.label}</span>
              <div className={styles.pickerGrid}>
                {s.items.map(t => (
                  <button key={t.id} type="button" className={styles.pickerCard} onClick={() => onPick(t)}>
                    <FlowIcons graph={t.graph} />
                    <span className={styles.pickerTitle}>{t.name}</span>
                    <span className={styles.pickerDesc}>{t.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
