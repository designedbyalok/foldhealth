import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Badge } from '../../components/Badge/Badge';
import { Icon } from '../../components/Icon/Icon';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { CardSkeleton } from '../../components/CardSkeleton/CardSkeleton';
import { RingEmptyState } from '../../components/RingEmptyState/RingEmptyState';
import { useAppStore } from '../../store/useAppStore';
import styles from './FormsLibraryDrawer.module.css';

const PAGE_SIZE = 100;
const EMPTY = [];
// Same tones as the Type badge in Settings > Content > Forms.
const TYPE_TONE = { Note: 'primary', Assessment: 'info', Intake: 'success', Consent: 'warning', Other: 'neutral' };

/**
 * Pick forms from the Forms library (Settings > Content > Forms), e.g. to
 * link assessments to a program step. Forms already linked show as added
 * and can't be picked twice.
 *
 * @param {object}   props
 * @param {string}   [props.title]
 * @param {Array<string|number>} [props.linkedIds] – forms already linked
 * @param {(forms: object[]) => void} props.onAdd – the picked forms ({ id, name, formType, category, status })
 * @param {function} props.onClose
 */
export function FormsLibraryDrawer({ title = 'Forms Library', linkedIds = EMPTY, onAdd, onClose }) {
  const forms = useAppStore(s => s.contentForms) || EMPTY;
  const loading = useAppStore(s => s.contentFormsLoading);
  const fetchContentForms = useAppStore(s => s.fetchContentForms);
  const [search, setSearch] = useState('');
  const [types, setTypes] = useState([]);
  const [picked, setPicked] = useState(() => new Set());

  useEffect(() => {
    const t = window.setTimeout(() => fetchContentForms?.({ page: 1, perPage: PAGE_SIZE, search }), search ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [fetchContentForms, search]);

  const linked = useMemo(() => new Set(linkedIds.map(String)), [linkedIds]);
  const typeOptions = useMemo(() => [...new Set(forms.map(f => f.form_type || f.formType).filter(Boolean))].sort(), [forms]);
  const shown = useMemo(
    () => forms.filter(f => !types.length || types.includes(f.form_type || f.formType)),
    [forms, types],
  );
  const toggle = id => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <Drawer
      title={title}
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <>
          <Button
            disabled={!picked.size}
            onClick={() => onAdd(forms.filter(f => picked.has(String(f.id))))}
          >
            {picked.size ? `Add ${picked.size}` : 'Add'}
          </Button>
          <span className={styles.headerDivider} />
        </>
      )}
    >
      <div className={styles.body}>
        <div className={styles.toolbar}>
          <Input
            leadingIcon="solar:magnifer-linear"
            placeholder="Search forms"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search forms"
          />
          {typeOptions.length > 0 && <FilterChip label="Type" options={typeOptions} selected={types} onChange={setTypes} />}
        </div>
        <div className={styles.list}>
          {loading && forms.length === 0 ? <CardSkeleton count={6} /> : shown.length === 0 ? (
            <RingEmptyState icon="solar:clipboard-text-linear" label={search.trim() || types.length ? 'No forms match' : 'No forms in the library yet'} />
          ) : shown.map((f) => {
            const id = String(f.id);
            const isLinked = linked.has(id);
            const on = isLinked || picked.has(id);
            const type = f.form_type || f.formType;
            return (
              <label key={id} className={[styles.item, on ? styles.itemOn : '', isLinked ? styles.itemLinked : ''].join(' ')}>
                <Checkbox checked={on} disabled={isLinked} onCheckedChange={() => toggle(id)} aria-label={`Pick ${f.name}`} />
                <span className={styles.itemIcon}><Icon name="solar:clipboard-text-linear" size={16} color="var(--primary-300)" /></span>
                <span className={styles.itemText}>
                  <span className={styles.itemName}>{f.name}</span>
                  {(f.category || f.description) && <span className={styles.itemMeta}>{f.category || f.description}</span>}
                </span>
                {isLinked && <Badge size="sm" tone="success" label="Added" />}
                {type && <Badge size="sm" tone={TYPE_TONE[type] || 'neutral'} label={type} />}
              </label>
            );
          })}
        </div>
      </div>
    </Drawer>
  );
}
