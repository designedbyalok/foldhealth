/**
 * Modal to pick a form to share into a chat. Lists saved forms with search;
 * onSelect hands back the chosen form. Used by the message composer.
 */
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNativeDialog } from '../../hooks/useNativeDialog';
import { supabase } from '../../lib/supabase';
import { Icon } from '../../components/Icon/Icon';
import { Input } from '../../components/Input/Input';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import styles from './FormPicker.module.css';

export function FormPicker({ onSelect, onClose }) {
  const dialogRef = useNativeDialog();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const titleId = useId();

  useEffect(() => {
    let active = true;
    supabase
      .from('forms')
      .select('id, name, category, response_count, status')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(50)
      .then(({ data, error: err }) => {
        if (!active) return;
        // Distinguish "no forms" from "couldn't load", an empty list and a
        // failed query rendered identically before.
        setError(err ? 'Could not load forms' : null);
        setForms(data || []);
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = forms.filter((f) => f.name?.toLowerCase().includes(search.trim().toLowerCase()));

  return createPortal(
    <dialog
      ref={dialogRef}
      className={styles.modal}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
    >
        <div className={styles.header}>
          <span className={styles.title} id={titleId}>Share a form</span>
          <CloseButton onClick={onClose} />
        </div>
        <div className={styles.search}>
          <Input
            type="search"
            aria-label="Search forms"
            autoFocus
            placeholder="Search forms…"
            leadingIcon="solar:magnifer-linear"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.list}>
          {loading ? (
            <div className={styles.state}>Loading…</div>
          ) : error ? (
            <div className={styles.state} role="alert">{error}</div>
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
    </dialog>,
    document.body,
  );
}
