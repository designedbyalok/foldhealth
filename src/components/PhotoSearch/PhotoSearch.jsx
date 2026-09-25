import { useEffect, useState } from 'react';
import { SearchBar } from '../SearchBar/SearchBar';
import { Button } from '../Button/Button';
import { CheckboxTick } from '../CheckboxTick/CheckboxTick';
import { RingEmptyState } from '../RingEmptyState/RingEmptyState';
import styles from './PhotoSearch.module.css';

const DEBOUNCE_MS = 400;
const SKELETON_COUNT = 6;

/** Default search: the `/api/pexels-search` proxy (photos only, never videos). */
async function searchPexelsPhotos({ query, page = 1, orientation }) {
  const params = new URLSearchParams({ q: query, page: String(page) });
  if (orientation) params.set('orientation', orientation);
  const res = await fetch(`/api/pexels-search?${params}`);
  if (!res.ok) return { photos: [], nextPage: null, source: 'error' };
  return res.json();
}

/**
 * PhotoSearch — search free stock photos (Pexels) and pick one. A search
 * field, a grid of thumbnails, "Load more", and the Pexels credit their
 * licence asks for. Videos are never searched.
 *
 * @param {object}   props
 * @param {(photo: object) => void} props.onSelect – The picked photo:
 *   `{ id, alt, width, height, avgColor, photographer, photographerUrl, url, thumb, full }`
 * @param {number|string} [props.selectedId]      – Highlights the picked photo
 * @param {'portrait'|'landscape'|'square'} [props.orientation]
 * @param {string}   [props.placeholder]
 * @param {function} [props.search] – `({ query, page, orientation }) => Promise<{ photos, nextPage, source }>`;
 *   defaults to the Pexels proxy. Pass a stub in stories and tests.
 */
export function PhotoSearch({
  onSelect,
  selectedId,
  orientation,
  placeholder = 'Search free photos',
  search = searchPexelsPhotos,
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  // Tagged with the query it answers, so a stale response never shows.
  const [result, setResult] = useState(null); // { query, photos, nextPage, source }
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debounced) return undefined;
    let live = true;
    search({ query: debounced, page: 1, orientation })
      .catch(() => ({ photos: [], nextPage: null, source: 'error' }))
      .then((r) => { if (live) setResult({ query: debounced, ...r }); });
    return () => { live = false; };
  }, [debounced, orientation, search]);

  const current = debounced && result?.query === debounced ? result : null;
  const loading = !!debounced && !current;

  const loadMore = () => {
    setLoadingMore(true);
    search({ query: current.query, page: current.nextPage, orientation })
      .catch(() => ({ photos: [], nextPage: null }))
      .then((r) => {
        setResult(prev => (prev?.query === current.query
          ? { ...prev, photos: [...prev.photos, ...r.photos.filter(p => !prev.photos.some(q => q.id === p.id))], nextPage: r.nextPage }
          : prev));
        setLoadingMore(false);
      });
  };

  let body = null;
  if (loading) {
    body = (
      <div className={styles.grid} aria-busy="true">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => <div key={i} className={[styles.tile, styles.shimmer].join(' ')} />)}
      </div>
    );
  } else if (current?.source === 'error' || current?.source === 'unconfigured') {
    body = <RingEmptyState icon="solar:gallery-linear" label="Photo search isn't available right now" iconSize={31} />;
  } else if (current && !current.photos.length) {
    body = <RingEmptyState icon="solar:gallery-linear" label={`No photos found for "${current.query}"`} iconSize={31} />;
  } else if (current) {
    body = (
      <>
        <div className={styles.grid} role="listbox" aria-label="Photos">
          {current.photos.map(p => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={selectedId === p.id}
              aria-label={p.alt ? `${p.alt}, photo by ${p.photographer}` : `Photo by ${p.photographer}`}
              title={`Photo by ${p.photographer}`}
              className={[styles.tile, selectedId === p.id ? styles.tileOn : ''].filter(Boolean).join(' ')}
              style={{ '--tile-bg': p.avgColor }}
              onClick={() => onSelect(p)}
            >
              {p.thumb && <img src={p.thumb} alt="" loading="lazy" className={styles.img} />}
              {selectedId === p.id && <span className={styles.check}><CheckboxTick checked /></span>}
            </button>
          ))}
        </div>
        {current.nextPage && (
          <div className={styles.more}>
            <Button variant="secondary" size="S" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={styles.root}>
      <SearchBar
        fullWidth
        autoFocus={false}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onClose={query ? () => setQuery('') : undefined}
        placeholder={placeholder}
      />
      {body}
      <span className={styles.credit}>
        Photos provided by{' '}
        <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className={styles.creditLink}>Pexels</a>
      </span>
    </div>
  );
}
