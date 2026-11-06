import { useEffect, useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { DesktopOnlyNote } from '../../../components/DesktopOnlyNote/DesktopOnlyNote';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { useAppStore } from '../../../store/useAppStore';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { GroupedSection } from '../more/GroupedList';
import common from '../mobile.module.css';
import more from '../more/more.module.css';
import styles from './forms.module.css';

const PAGE = 20;
// Same tones as the desktop Forms table.
const FORM_TYPE_TONE = { Assessment: 'primary', Intake: 'success', Survey: 'warning', Consent: 'danger' };

/**
 * Forms (desktop Settings > Content > Forms): search the library, fill a
 * form on the phone, or read its responses. Building a form stays on a
 * computer.
 */
export function FormsScreen() {
  const { push } = useMobileNav();
  const forms = useAppStore(s => s.contentForms);
  const total = useAppStore(s => s.contentFormsTotal);
  const loading = useAppStore(s => s.contentFormsLoading);
  const fetchContentForms = useAppStore(s => s.fetchContentForms);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [perPage, setPerPage] = useState(PAGE);
  const [picked, setPicked] = useState(null);

  // Debounced like the desktop search box, so each keystroke isn't a query.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search); setPerPage(PAGE); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { fetchContentForms?.({ page: 1, perPage, search: query }); }, [fetchContentForms, perPage, query]);

  const open = (key) => {
    const f = picked;
    setPicked(null);
    push(key, { id: f.id, name: f.name });
  };

  return (
    <div className={common.screen}>
      <MobileSubHeader title="Forms" />
      <div className={more.toolbar}>
        <Input type="search" size="lg" leadingIcon="solar:magnifer-linear" placeholder="Search forms" aria-label="Search forms" enterKeyHint="search" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className={common.body}>
        {loading && !forms.length ? <MobileListSkeleton height={72} /> : forms.length === 0 ? (
          <MobileEmpty icon={query ? 'solar:magnifer-linear' : 'solar:clipboard-text-linear'} title={query ? `No forms match “${query.trim()}”` : 'No forms yet'} description={query ? undefined : 'Build forms in Settings > Content on a computer.'} />
        ) : (
          <div className={more.stack}>
            <GroupedSection label={`Forms · ${total || forms.length}`}>
              {forms.map(f => (
                <button key={f.id} type="button" className={styles.row} onClick={() => setPicked(f)}>
                  <span className={styles.icon}><Icon name="solar:document-text-linear" size={24} color="currentColor" /></span>
                  <span className={styles.text}>
                    <span className={styles.name}>{f.name}</span>
                    {f.description && <span className={styles.sub}>{f.description}</span>}
                    <span className={styles.badges}>
                      <Badge tone={FORM_TYPE_TONE[f.formType] || 'neutral'} size="sm" label={f.formType || 'Other'} />
                      {f.category && <Badge size="sm" label={f.category} />}
                      <span className={styles.sub}>{f.responseCount ?? 0} responses</span>
                    </span>
                  </span>
                  <Icon name="solar:alt-arrow-right-linear" size={16} color="var(--placeholder-text)" />
                </button>
              ))}
            </GroupedSection>
            {forms.length < total && (
              <Button size="lg" variant="outline" loading={loading} onClick={() => setPerPage(n => n + PAGE)}>Show more</Button>
            )}
            <DesktopOnlyNote description="Create a form or change its questions, logic and scoring in Settings > Content > Forms on a computer." />
          </div>
        )}
      </div>
      {picked && (
        <BottomSheet title={picked.name} onClose={() => setPicked(null)}>
          <BottomSheetItem icon="solar:pen-new-square-linear" label="Fill out form" onClick={() => open('formFill')} />
          <BottomSheetItem icon="solar:chart-square-linear" label="Responses" detail={String(picked.responseCount ?? 0)} onClick={() => open('formResponses')} />
        </BottomSheet>
      )}
    </div>
  );
}
