import { useMemo, useState, useRef, useEffect } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Toggle } from '../../../components/Toggle/Toggle';
import { Button } from '../../../components/Button/Button';
import { EmailIframe, MacBookPro, IPhone17Pro } from '../../email-builder/DevicePreview';
import { renderPreviewHtml } from '../../email-builder/renderEmail';
import { makeInitialDocument } from '../../email-builder/initialDocument';
import { useAppStore } from '../../../store/useAppStore';
import styles from './EmailPreviewDrawer.module.css';

const VIEW_ITEMS = [
  { key: 'email',  label: 'Email' },
  { key: 'web',    label: 'Web' },
  { key: 'mobile', label: 'Mobile' },
];

/**
 * EmailPreviewDrawer — read-only preview of a campaign's email template.
 *
 * Three views, switched via the shared Toggle:
 *   • Email  — bare iframe, full-bleed of the drawer body
 *   • Web    — same MacBookPro mockup used in the email builder
 *   • Mobile — same iPhone 17 Pro mockup used in the email builder
 *
 * The email's emailTemplate document (or a generated initial doc) is rendered
 * once into HTML via renderEmailHtml and fed into EmailIframe — same render
 * pipeline as the builder's DevicePreview.
 */
export function EmailPreviewDrawer({ campaign, onClose, onEdit }) {
  const [view, setView] = useState('email');
  const fetchCampaignById = useAppStore(s => s.fetchCampaignById);

  // The Content → Emails list query excludes the heavy `email_template`
  // JSONB to keep the table fast. When that row is passed in, fetch the
  // full record now so we render the actual saved email instead of the
  // generic initial document.
  // Only the async fetch result lives in state; when the prop already carries
  // the template we derive directly so a changed prop never renders stale.
  const [fetchedCampaign, setFetchedCampaign] = useState(null);
  useEffect(() => {
    if (!campaign?.id || campaign.emailTemplate !== undefined) return undefined;
    let cancelled = false;
    (async () => {
      const full = await fetchCampaignById(campaign.id);
      if (!cancelled) setFetchedCampaign(full || campaign);
    })();
    return () => { cancelled = true; };
  }, [campaign, fetchCampaignById]);
  const fullCampaign = campaign?.emailTemplate !== undefined ? campaign : fetchedCampaign;

  const html = useMemo(() => {
    const source = fullCampaign || campaign;
    const doc = source?.emailTemplate || makeInitialDocument(source || {});
    // wrapperPadding: '0' strips the renderEmailHtml outer <td padding:24px 0>
    // so the preview iframe sits flush against the email's own design.
    return renderPreviewHtml(doc, { theme: 'light', wrapperPadding: '0' });
  }, [fullCampaign, campaign]);

  // Track stage width so the device mockups can sit inside the 700px drawer
  // without overflowing — mirrors how DevicePreview sizes itself against its
  // parent column.
  const stageRef = useRef(null);
  const [stageW, setStageW] = useState(0);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setStageW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const avail = Math.max(280, stageW - 32);
  const macWidth = Math.min(640, avail);
  const phoneWidth = Math.min(320, Math.max(240, avail * 0.7));

  const title = (
    <div className={styles.titleStack}>
      <span className={styles.titleMain}>Email Preview</span>
      <span className={styles.titleSub}>{campaign?.name || 'Untitled email'}</span>
    </div>
  );

  const headerRight = onEdit ? (
    <>
      <Button
        variant="primary"
        size="S"
        leadingIcon="solar:pen-linear"
        onClick={onEdit}
      >
        Edit
      </Button>
      <span className={styles.headerDivider} />
    </>
  ) : null;

  return (
    <Drawer title={title} onClose={onClose} headerRight={headerRight} bodyClassName={styles.body} noCloseDivider>
      <div className={styles.toggleBar}>
        <Toggle
          size="S"
          items={VIEW_ITEMS}
          active={view}
          onChange={setView}
        />
      </div>

      {view === 'email' ? (
        <div className={styles.emailPad}>
          <EmailIframe html={html} theme="light" />
        </div>
      ) : (
        <div className={styles.deviceCenter} ref={stageRef}>
          {view === 'web' ? (
            <MacBookPro
              width={macWidth}
              screen={<EmailIframe html={html} renderWidth={1280} theme="light" />}
            />
          ) : (
            <IPhone17Pro
              width={phoneWidth}
              screen={<EmailIframe html={html} renderWidth={420} theme="light" />}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}
