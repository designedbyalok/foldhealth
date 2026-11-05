import { Icon } from '../../components/Icon/Icon';
import { useAppStore } from '../../store/useAppStore';
import { parseHtmlToDocument, collectUnknownFonts } from './htmlToDocument';
import { stripCustomHtml } from './PropertiesPanel.utils.jsx';
import styles from './EmailBuilder.module.css';

export function CodeTabHtmlOverrideBanner({ doc, htmlPreviewOverride, setEmailDocument }) {
  return (
    <div className={styles.codeBanner}>
      <Icon name="solar:info-circle-linear" size={12} color="currentColor" />
      <span style={{ flex: 1 }}>Previewing edited HTML: choose how to import.</span>
      <button
        type="button"
        className={styles.codeBannerBtn}
        style={{ background: 'transparent', color: 'var(--primary-300)', border: '0.5px solid var(--primary-200)' }}
        onClick={() => {
          const html = htmlPreviewOverride;
          setEmailDocument({
            ...doc,
            root: {
              ...doc.root,
              data: {
                ...(doc.root?.data || {}),
                customHtml: html,
                childrenIds: [],
              },
            },
          });
        }}
        title="Render the HTML verbatim in an editable iframe, no block conversion"
      >
        <Icon name="solar:code-linear" size={13} color="currentColor" />
        Keep as raw HTML
      </button>
      <button
        type="button"
        className={styles.codeBannerBtn}
        onClick={async () => {
          const html = htmlPreviewOverride;
          const parsed = await parseHtmlToDocument(html);
          if (parsed?.doc) {
            const next = stripCustomHtml(parsed.doc);
            const unknownFonts = collectUnknownFonts(next);
            if (unknownFonts.length > 0) {
              useAppStore.getState().openFontSubstitutionDialog(next, unknownFonts);
            } else {
              setEmailDocument(next);
            }
          } else {
            setEmailDocument({
              ...doc,
              root: {
                ...doc.root,
                data: { ...(doc.root?.data || {}), customHtml: html },
              },
            });
          }
        }}
        title="Import HTML as editable blocks"
      >
        <Icon name="solar:layers-linear" size={13} color="currentColor" />
        Import as blocks
      </button>
    </div>
  );
}

export function CodeTabCustomHtmlBanner({ doc, setEmailDocument, setError }) {
  return (
    <div className={styles.codeBanner}>
      <Icon name="solar:check-circle-linear" size={12} color="currentColor" />
      <span style={{ flex: 1 }}>Custom HTML body is active.</span>
      <button
        type="button"
        className={styles.codeBannerBtn}
        onClick={async () => {
          const html = doc.root.data.customHtml;
          const parsed = await parseHtmlToDocument(html);
          if (parsed?.doc) {
            const next = stripCustomHtml(parsed.doc);
            const unknownFonts = collectUnknownFonts(next);
            if (unknownFonts.length > 0) {
              useAppStore.getState().openFontSubstitutionDialog(next, unknownFonts);
            } else {
              setEmailDocument(next);
            }
          } else {
            setError('Could not parse the HTML into editable blocks. Try simplifying the markup or remove the custom HTML to start over.');
          }
        }}
        title="Convert the HTML into editable blocks"
        style={{ marginRight: 4 }}
      >
        <Icon name="solar:layers-linear" size={13} color="currentColor" />
        Convert to blocks
      </button>
      <button
        type="button"
        className={styles.codeBannerBtn}
        onClick={() => setEmailDocument(stripCustomHtml(doc))}
        title="Remove custom HTML and revert to block-based body"
      >
        <Icon name="solar:trash-bin-minimalistic-linear" size={13} color="currentColor" />
        Remove
      </button>
    </div>
  );
}
