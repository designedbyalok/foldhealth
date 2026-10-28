import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/Input/Input';
import { AvatarBase } from '@/components/Avatar/AvatarBase';
import { initialsOf, sexAndAge } from '../lib/profileFormat';
import { IntroCarousel } from '../auth/IntroCarousel';
import loginStyles from '../auth/LoginPage.module.css';
import pickerStyles from './ProfilePicker.module.css';
import styles from './ViewAsPicker.module.css';

const SEARCH_DELAY_MS = 250;

export function ViewAsPicker({ onSelect }) {
  const [query, setQuery] = useState('');
  const [featured, setFeatured] = useState({ loading: true, rows: [] });
  // Tagged with the query they answer, so a result is "loading" until the
  // latest query's answer arrives.
  const [answer, setAnswer] = useState({ q: '', rows: [], error: '' });
  const q = query.trim();
  const searching = q.length >= 2;
  const results = { loading: answer.q !== q, rows: answer.q === q ? answer.rows : [], error: answer.q === q ? answer.error : '' };

  useEffect(() => {
    let alive = true;
    supabase.rpc('staff_view_as_featured').then(({ data }) => {
      if (alive) setFeatured({ loading: false, rows: data || [] });
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!searching) return undefined;
    let alive = true;
    const t = setTimeout(() => {
      supabase.rpc('staff_view_as_search', { p_query: q }).then(({ data, error }) => {
        if (alive) setAnswer({ q, rows: data || [], error: error ? 'Search failed. Please try again.' : '' });
      });
    }, SEARCH_DELAY_MS);
    return () => { alive = false; clearTimeout(t); };
  }, [q, searching]);

  const list = searching ? results : featured;
  let empty = '';
  if (searching && results.error) empty = results.error;
  else if (searching && !results.loading && results.rows.length === 0) empty = `No patients match "${q}".`;
  else if (!searching && !featured.loading && featured.rows.length === 0) empty = 'Search for a patient by name or member ID.';

  return (
    <main className={loginStyles.page}>
      <IntroCarousel />
      <div className={loginStyles.side}>
        <div className={`${loginStyles.card} ${styles.card}`}>
          <h1 className={pickerStyles.title}>View the portal as a patient</h1>
          <p className={styles.subtitle}>
            You are signed in with your care team account. Messages you send and visits you book are recorded as yours, not the patient&apos;s.
          </p>
          <Input
            aria-label="Search patients by name or member ID"
            leadingIcon="solar:magnifer-linear"
            placeholder="Search name or member ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <p className={styles.listLabel}>{searching ? 'Results' : 'Patients using the portal'}</p>
          {empty ? (
            <p className={styles.empty}>{empty}</p>
          ) : (
            <ul className={styles.list} aria-busy={list.loading}>
              {list.rows.map((p) => (
                <li key={p.member_id}>
                  <button type="button" className={styles.row} onClick={() => onSelect(p)}>
                    <AvatarBase variant="patient" size="M" initials={initialsOf(p)} />
                    <span className={styles.rowText}>
                      <span className={styles.rowName}>{p.name || p.member_id}</span>
                      <span className={styles.rowMeta}>{[p.member_id, sexAndAge(p)].filter(Boolean).join(' • ')}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className={pickerStyles.signOut} onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
