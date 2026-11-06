import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { DesktopOnlyNote } from '../../../components/DesktopOnlyNote/DesktopOnlyNote';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { useAppStore } from '../../../store/useAppStore';
import { EmailIframe } from '../../email-builder/DevicePreview';
import { renderPreviewHtml } from '../../email-builder/renderEmail';
import { makeInitialDocument } from '../../email-builder/initialDocument';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { GroupedSection } from '../more/GroupedList';
import common from '../mobile.module.css';
import more from '../more/more.module.css';
import styles from './forms.module.css';
import content from './content.module.css';

const PAGE = 20;
// The desktop Content tabs that hold templates to read; SMS and Articles are
// "Coming soon" there too.
const TABS = [
  { key: 'emails', label: 'Emails' },
  { key: 'sms', label: 'SMS' },
  { key: 'articles', label: 'Articles' },
];
const STATUSES = [
  { value: 'running', label: 'Running' },
  { value: 'paused', label: 'Paused' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'draft', label: 'Draft' },
  { value: 'ended', label: 'Ended' },
];

/** Content library (desktop Settings > Content): search templates and preview them. */
export function ContentScreen() {
  const emails = useAppStore(s => s.contentEmails);
  const total = useAppStore(s => s.contentEmailsTotal);
  const loading = useAppStore(s => s.contentEmailsLoading);
  const fetchContentEmails = useAppStore(s => s.fetchContentEmails);
  const [tab, setTab] = useState('emails');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [perPage, setPerPage] = useState(PAGE);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setQuery(search); setPerPage(PAGE); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    if (tab === 'emails') fetchContentEmails?.({ page: 1, perPage, search: query, status });
  }, [tab, fetchContentEmails, perPage, query, status]);

  const statusDef = STATUSES.find(s => s.value === status);

  return (
    <div className={common.screen}>
      <MobileSubHeader title="Content library" />
      <div className={more.toolbar}>
        <SegmentedControl size="lg" fullWidth aria-label="Content type" items={TABS} value={tab} onValueChange={setTab} />
        {tab === 'emails' && (
          <>
            <Input type="search" size="lg" leadingIcon="solar:magnifer-linear" placeholder="Search emails" aria-label="Search emails" enterKeyHint="search" value={search} onChange={e => setSearch(e.target.value)} />
            <div className={more.chips}>
              <FilterChip
                label="Status"
                options={STATUSES.map(s => s.label)}
                selected={statusDef ? [statusDef.label] : []}
                onChange={(labels) => setStatus(STATUSES.find(s => s.label === labels[labels.length - 1])?.value || 'all')}
                singleSelect
              />
            </div>
          </>
        )}
      </div>
      <div className={common.body}>
        {tab !== 'emails' ? (
          <MobileEmpty icon="solar:document-text-linear" title={`${TABS.find(t => t.key === tab).label} templates`} description="Coming soon" />
        ) : loading && !emails.length ? <MobileListSkeleton height={72} /> : emails.length === 0 ? (
          <MobileEmpty icon={query ? 'solar:magnifer-linear' : 'solar:letter-linear'} title={query ? `No emails match “${query.trim()}”` : 'No email templates yet'} />
        ) : (
          <div className={more.stack}>
            <GroupedSection label={`Emails · ${total || emails.length}`}>
              {emails.map(c => (
                <button key={c.id} type="button" className={styles.row} onClick={() => setPreview(c)}>
                  <span className={styles.icon}><Icon name="solar:letter-linear" size={24} color="currentColor" /></span>
                  <span className={styles.text}>
                    <span className={styles.name}>{c.name}</span>
                    {c.subjectLine && <span className={styles.sub}>{c.subjectLine}</span>}
                    {c.category && <span className={styles.sub}>{c.category}</span>}
                  </span>
                  <Icon name="solar:alt-arrow-right-linear" size={16} color="var(--placeholder-text)" />
                </button>
              ))}
            </GroupedSection>
            {emails.length < total && <Button size="lg" variant="outline" loading={loading} onClick={() => setPerPage(n => n + PAGE)}>Show more</Button>}
            <DesktopOnlyNote description="Create or edit templates in Settings > Content on a computer." />
          </div>
        )}
      </div>
      {preview && <EmailPreviewSheet campaign={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/** Read-only email preview, the same render as the desktop EmailPreviewDrawer. */
function EmailPreviewSheet({ campaign, onClose }) {
  const fetchCampaignById = useAppStore(s => s.fetchCampaignById);
  // The list query leaves out the heavy email_template; fetch the full row.
  const [full, setFull] = useState(null);
  useEffect(() => {
    if (campaign.emailTemplate !== undefined) return undefined;
    let live = true;
    fetchCampaignById(campaign.id).then(c => { if (live) setFull(c || campaign); });
    return () => { live = false; };
  }, [campaign, fetchCampaignById]);
  const source = campaign.emailTemplate !== undefined ? campaign : full;
  const html = useMemo(() => {
    if (!source) return null;
    return renderPreviewHtml(source.emailTemplate || makeInitialDocument(source), { theme: 'light', wrapperPadding: '0' });
  }, [source]);

  return (
    <BottomSheet title={campaign.name} onClose={onClose}>
      <div className={content.preview}>
        {campaign.subjectLine && (
          <p className={content.subject}><span className={content.subjectLabel}>Subject</span>{campaign.subjectLine}</p>
        )}
        <div className={content.frame}>
          {html ? <EmailIframe html={html} renderWidth={600} /> : <MobileListSkeleton count={3} />}
        </div>
      </div>
    </BottomSheet>
  );
}
