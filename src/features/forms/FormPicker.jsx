/**
 * Modal to pick a form to share into a chat. Lists saved forms with search;
 * onSelect hands back the chosen form. Used by the message composer.
 */
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { Icon } from '../../components/Icon/Icon';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import styles from './FormPicker.module.css';

export function FormPicker({ onSelect, onClose }) {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const titleId = useId();

  // Escape closes, and focus goes back to whatever opened the picker — the
  // modal moves focus into its search box, so without this a keyboard user is
  // dropped at the top of the page when it closes.
  useEffect(() => {
    const opener = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    supabase
      .from('forms')
      .select('id, name, category, response_count, status')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(50)
      .then(({ data }) => { if (active) { setForms(data || []); setLoading(false); } });
    return () => { active = false; };
  }, []);

  const filtered = forms.filter((f) => f.name?.toLowerCase().includes(search.trim().toLowerCase()));

  return createPortal(
    <div className={styles.scrim}>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.header}>
          <span className={styles.title} id={titleId}>Share a form</span>
          <CloseButton onClick={onClose} />
        </div>
        <div className={styles.search}>
          <Icon name="solar:magnifer-linear" size={15} color="var(--neutral-300)" />
          <input aria-label="Search forms" autoFocus placeholder="Search forms…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className={styles.list}>
          {loading ? (
            <div className={styles.state}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div className={styles.state}>No forms found.</div>
          ) : (
            filtered.map((f) => (
              <button key={f.id} className={styles.item} onClick={() => onSelect(f)}>
                <span className={styles.itemIcon}>
                  <Icon name="solar:clipboard-text-linear" size={18} color="var(--primary-300)" />
                </span>
                <span className={styles.itemMain}>
                  <span className={styles.itemName}>{f.name}</span>
                  <span className={styles.itemMeta}>
                    {f.category ? `${f.category} · ` : ''}{f.response_count || 0} response{(f.response_count || 0) === 1 ? '' : 's'}
                  </span>
                </span>
                <Icon name="solar:plain-2-linear" size={15} color="var(--neutral-300)" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
