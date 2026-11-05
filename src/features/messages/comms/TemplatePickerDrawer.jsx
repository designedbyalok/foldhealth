import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { Icon } from '../../../components/Icon/Icon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { supabase } from '../../../lib/supabase';
import { renderPreviewHtml } from '../../email-builder/renderEmail';
import { DEFAULT_TEMPLATE_ID, DEFAULT_SUBJECT, defaultEmailHtml } from './defaultEmailTemplate';
import styles from './ComposeEmail.module.css';

const SCRATCH_HTML = '<!doctype html><html><body style="margin:0;padding:24px;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:#3A485F"><p>Type your email here.</p></body></html>';

/**
 * Select Template (Figma 1:24005 list, 1:24057 grid): Content → Emails
 * templates, plus the Fold default and Start from Scratch. Picking one hands
 * back { id, name, subject, html } rendered for this recipient.
 */
export function TemplatePickerDrawer({ recipient, sender, currentId, onPick, onClose }) {
  const [templates, setTemplates] = useState(null);
  const [view, setView] = useState('list');
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(currentId || DEFAULT_TEMPLATE_ID);

  useEffect(() => {
    let alive = true;
    supabase.from('campaigns')
      .select('id, name, category, subject_line, email_template')
      .eq('channel', 'email')
      .not('email_template', 'is', null)
      .order('name', { ascending: true })
      .limit(100)
      .then(({ data }) => { if (alive) setTemplates(data || []); });
    return () => { alive = false; };
  }, []);

  const all = useMemo(() => {
    const builtIn = {
      id: DEFAULT_TEMPLATE_ID,
      name: 'Fold Care',
      category: 'Default',
      subject: DEFAULT_SUBJECT,
      render: () => defaultEmailHtml({ sender }),
    };
    const fromContent = (templates || []).map(t => ({
      id: t.id,
      name: t.name,
      category: t.category || 'Uncategorized',
      subject: t.subject_line || t.name,
      render: () => renderPreviewHtml(t.email_template, { recipient, wrapperPadding: '0' }),
    }));
    return [builtIn, ...fromContent];
  }, [templates, recipient, sender]);

  const categoryOptions = [...new Set(all.map(t => t.category))];
  const q = query.trim().toLowerCase();
  const shown = all.filter(t => (!categories.length || categories.includes(t.category))
    && (!q || `${t.name} ${t.category}`.toLowerCase().includes(q)));
  const active = all.find(t => t.id === activeId) || shown[0];
  const activeHtml = active?.render();

  const pick = (t) => onPick({ id: t.id, name: t.name, subject: t.subject, html: t.render() });
  const scratch = () => onPick({ id: 'scratch', name: 'Blank', subject: '', html: SCRATCH_HTML });

  return (
    <Drawer title="Select Template" onClose={onClose} width={1180} bodyClassName={styles.pickerBody}>
      <div className={styles.pickerBar}>
        <FilterChip label="Category" options={categoryOptions} selected={categories} onChange={setCategories} />
        <span className={styles.pickerDivider} />
        <ActionButton icon="solar:widget-4-linear" size="sm" tooltip="Grid" onClick={() => setView('grid')} />
        <ActionButton icon="solar:list-linear" size="sm" tooltip="List" onClick={() => setView('list')} />
        <div className={styles.pickerSearch}>
          <SearchBar placeholder="Search Template" value={query} onChange={e => setQuery(e.target.value)} onClose={() => setQuery('')} />
        </div>
      </div>

      {templates === null ? (
        <div className={styles.pickerEmpty}>Loading templates…</div>
      ) : view === 'grid' ? (
        <div className={styles.grid}>
          <button type="button" className={[styles.gridCard, styles.scratchCard].join(' ')} onClick={scratch}>
            <Icon name="solar:magic-stick-3-linear" size={24} color="var(--neutral-300)" />
            <span>Start from Scratch</span>
          </button>
          {shown.map(t => (
            <button type="button" key={t.id} className={styles.gridCard} onClick={() => pick(t)}>
              <span className={styles.thumb}>
                <iframe title={t.name} srcDoc={t.render()} sandbox="" loading="lazy" tabIndex={-1} className={styles.thumbFrame} />
              </span>
              <span className={styles.cardName}>{t.name}</span>
              <span className={styles.cardCategory}>{t.category}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.split}>
          <div className={styles.listCol}>
            <Button variant="outline" leadingIcon="solar:magic-stick-3-linear" fullWidth onClick={scratch}>Start from Scratch</Button>
            <div className={styles.list}>
              {shown.length === 0 && <div className={styles.pickerEmpty}>No templates match</div>}
              {shown.map(t => (
                <button
                  type="button"
                  key={t.id}
                  className={[styles.listItem, active?.id === t.id ? styles.listItemActive : ''].join(' ')}
                  onClick={() => setActiveId(t.id)}
                >
                  <span className={styles.cardName}>{t.name}</span>
                  <span className={styles.cardCategory}>{t.category}</span>
                </button>
              ))}
            </div>
          </div>
          {active && (
            <div className={styles.previewCol}>
              <div className={styles.previewHead}>
                <span className={styles.previewName}>{active.name}</span>
                <Button onClick={() => pick(active)}>Use Template</Button>
              </div>
              <div className={styles.previewBody}>
                <Input label="Subject Line" required value={active.subject} readOnly />
                <iframe title={`${active.name} preview`} srcDoc={activeHtml} sandbox="" className={styles.previewFrame} />
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
