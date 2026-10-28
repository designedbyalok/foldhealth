import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/Icon/Icon';
import { Input } from '@/components/Input/Input';
import { FilterChip } from '@/components/FilterChip/FilterChip';
import { ActionButton } from '@/components/ActionButton/ActionButton';
import { CardSkeleton } from '@/components/CardSkeleton/CardSkeleton';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { CATEGORIES, categoryLabel, fileIcon, updatedLabel } from './docFormat';
import { UploadDocumentDrawer } from './UploadDocumentDrawer';
import styles from './Documents.module.css';


// Signed for a few minutes at a time; the bucket is private.
async function openDocument(doc, download) {
  if (doc.file_url) { window.open(doc.file_url, '_blank', 'noopener'); return; }
  const { data, error } = await supabase.storage.from('program-documents')
    .createSignedUrl(doc.storage_path, 300, download ? { download: doc.name } : undefined);
  if (error || !data?.signedUrl) { toast.error('We could not open this document. Try again.'); return; }
  window.open(data.signedUrl, '_blank', 'noopener');
}

// Documents tab on Home (frame 701:5182): what the care team shared, and
// what this profile uploaded.
export function Documents({ memberId }) {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [folder, setFolder] = useState([]);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.rpc('patient_documents', { p_member_id: memberId }).then(({ data, error: e }) => {
      if (!alive) return;
      setError(e ? 'We could not load your documents.' : '');
      setDocs(data || []);
    });
    return () => { alive = false; };
  }, [memberId, version]);

  const folders = useMemo(() => {
    const present = new Set((docs || []).map((d) => d.category));
    return CATEGORIES.filter((c) => present.has(c.key)).map((c) => c.label);
  }, [docs]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (docs || []).filter((d) => (!folder.length || categoryLabel(d.category) === folder[0])
      && (!q || d.name.toLowerCase().includes(q)));
  }, [docs, folder, query]);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <Input
          leadingIcon="solar:magnifer-linear"
          placeholder="Search documents"
          aria-label="Search documents"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          wrapperClassName={styles.search}
        />
        <FilterChip label="All Documents" popoverLabel="Folder" options={folders} selected={folder} onChange={setFolder} singleSelect />
        <button type="button" className={styles.upload} onClick={() => setUploading(true)}>
          <Icon name="solar:upload-minimalistic-linear" size={16} color="currentColor" />
          Upload
        </button>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {!docs && <CardSkeleton count={3} />}
      {docs && rows.length === 0 && (
        <div className={styles.card}>
          <EmptyState
            icon="solar:document-text-linear"
            title={docs.length ? 'No documents match' : 'No documents yet'}
            description={docs.length
              ? 'Try another folder or search.'
              : 'Reports, handouts and forms your care team shares will show here. You can upload your own too.'}
          />
        </div>
      )}
      {rows.length > 0 && (
        <ul className={styles.card} aria-label="Documents">
          {rows.map((d) => (
            <li key={d.id} className={styles.row}>
              <button type="button" className={styles.open} onClick={() => openDocument(d, false)}>
                <span className={styles.thumb}><Icon name={fileIcon(d.ext)} size={22} color="currentColor" /></span>
                <span className={styles.text}>
                  <span className={styles.folder}>{categoryLabel(d.category)}</span>
                  <span className={styles.name}>{d.name}</span>
                  <span className={styles.source}>{d.source}</span>
                </span>
                <span className={styles.updated}>{updatedLabel(d.updated_at)}</span>
              </button>
              <ActionButton
                icon="solar:download-minimalistic-linear"
                size="S"
                tooltip="Download"
                tooltipLeft
                aria-label={`Download ${d.name}`}
                onClick={() => openDocument(d, true)}
              />
            </li>
          ))}
        </ul>
      )}

      {uploading && (
        <UploadDocumentDrawer
          memberId={memberId}
          onClose={() => setUploading(false)}
          onUploaded={() => setVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}
