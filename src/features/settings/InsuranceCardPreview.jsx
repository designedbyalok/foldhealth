import { useState, useEffect, useRef } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { AVERGENT_THEME, PROMINENCE_THEME, NO_THEME } from './CardThemePicker';
import { sanitizeRichText } from '../../lib/sanitizeHtml';
import styles from './InsuranceCardPreview.module.css';

/* Theme selector — bordered field + dropdown (Figma 2005:76958 / 8:64414) */
const Swatch = ({ size, theme }) => (
  <span
    className={styles.themeSwatch}
    style={{ width: size, height: size, background: theme.bg, border: theme.border }}
  />
);
const Forbidden = ({ size }) => (
  <Icon name="solar:forbidden-circle-linear" size={size} color="var(--neutral-300)" />
);

function ThemeDropdown({ logoChoice, cardTheme, onThemeChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!onThemeChange || !logoChoice || logoChoice === 'custom') return null;

  const brandTheme = logoChoice === 'avergent' ? AVERGENT_THEME : PROMINENCE_THEME;
  const brandOptionLabel = logoChoice === 'avergent' ? 'Avergent Theme' : 'Prominence Theme';
  const brandTriggerLabel = logoChoice === 'avergent' ? 'Avergent Health Theme' : 'Prominence Health Theme';
  const isBrand = cardTheme?.name === brandTheme.name;

  return (
    <div className={styles.themeSelectWrap} ref={ref}>
      <button className={styles.themeSelectBtn} onClick={() => setOpen(v => !v)}>
        <span className={styles.themeSelectLeft}>
          {isBrand ? <Swatch size={32} theme={brandTheme} /> : <Forbidden size={24} />}
          <span className={styles.themeSelectLabel}>{isBrand ? brandTriggerLabel : 'No Theme'}</span>
        </span>
        <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" />
      </button>

      {open && (
        <div className={styles.themeSelectMenu}>
          <button
            className={`${styles.themeOption} ${isBrand ? styles.themeOptionActive : ''}`}
            onClick={() => { onThemeChange(brandTheme); setOpen(false); }}
          >
            <Swatch size={24} theme={brandTheme} />
            <span className={`${styles.themeOptionLabel} ${isBrand ? styles.themeOptionLabelActive : ''}`}>{brandOptionLabel}</span>
          </button>
          <button
            className={`${styles.themeOption} ${!isBrand ? styles.themeOptionActive : ''}`}
            onClick={() => { onThemeChange(NO_THEME); setOpen(false); }}
          >
            <Forbidden size={24} />
            <span className={`${styles.themeOptionLabel} ${!isBrand ? styles.themeOptionLabelActive : ''}`}>No Theme</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function InsuranceCardPreview({
  data,
  logoPreviewUrl,
  tpaLogoPreviewUrl,
  cardTheme,
  onThemeChange,
  logoChoice,
  coverageFamily,
}) {
  const isFamily = coverageFamily ?? data?.coverageFamily ?? false;

  const coverageLabel = data?.coverageType || (isFamily ? 'Family' : 'Individual');
  const noteText = data?.additionalNote?.replace(/<[^>]*>/g, '').trim();
  const frontLogoUrl = logoPreviewUrl || data?.logoPreviewUrl || data?.planLogoUrl;
  const backLogoUrl  = tpaLogoPreviewUrl || data?.tpaLogoPreviewUrl || data?.tpaLogoUrl;

  /* The Avergent logo (not the theme) drives the motto line + 341px height */
  const isAvergentLogo = logoChoice === 'avergent';
  const cardStyle = {
    background: cardTheme?.bg,
    border: cardTheme?.border,
    height: isAvergentLogo ? 341 : 327,
  };

  const badgeStyle = {
    background: cardTheme?.badgeBg,
    borderColor: cardTheme?.badgeBorderColor,
    color: cardTheme?.badgeText,
  };

  return (
    <>
      <div className={styles.previewScroll}>

        {/* ── Front View ── */}
        <div className={styles.cardViewSection}>
          <span className={`${styles.cardViewLabel} ${styles.cardViewLabelFront}`}>Front View</span>
          <div className={styles.insuranceCard} style={cardStyle}>

            {/* Header: logo + group badge */}
            <div className={styles.cardHeader}>
              <div className={styles.cardLogoBox}>
                {frontLogoUrl ? (
                  <img src={frontLogoUrl} alt="Plan Logo" className={styles.cardLogoImg} />
                ) : (
                  <span className={styles.cardLogoPlaceholder}>{'{Plan Logo}'}</span>
                )}
              </div>
              <span className={styles.cardBadge} style={badgeStyle}>
                GROUP ID : {data?.groupNumber || 'AV032'}
              </span>
            </div>

            {/* Content */}
            <div className={styles.cardContent}>
              {/* Member Name + Member ID */}
              <div className={styles.cardMemberGroup}>
                <div className={styles.cardField}>
                  <span className={styles.cardFieldLabel}>Member Name</span>
                  <span className={styles.cardFieldValue} style={{ textTransform: 'uppercase' }}>{'{Member Name}'}</span>
                </div>
                <div className={styles.cardField}>
                  <span className={styles.cardFieldLabel}>Member ID</span>
                  <span className={styles.cardFieldValue}>{'{Member ID}'}</span>
                </div>
              </div>

              <div className={styles.cardDivider} />

              {/* Dependents + Coverage */}
              <div className={styles.cardMetaGroup}>
                <div className={styles.cardMetaItem}>
                  <span className={styles.cardMetaLabel}>Dependents</span>
                  <span className={styles.cardMetaValue}>{'{Dependents}'}</span>
                </div>
                <div className={styles.cardMetaItem}>
                  <span className={styles.cardMetaLabel}>Coverage</span>
                  <span className={styles.cardMetaValue}>{coverageLabel}</span>
                </div>
              </div>

              <div className={styles.cardDivider} />

              {/* Deductibles + OOP */}
              <div className={styles.cardCostGroup}>
                <div className={styles.cardCostRow}>
                  <div className={styles.cardCostCell}>
                    <span className={styles.cardMetaLabel}>In - network Deductible</span>
                    <span className={styles.cardMetaValue}>{data?.inNetDeductible ? `$${data.inNetDeductible}` : '{$}'}</span>
                  </div>
                  <div className={styles.cardCostCell}>
                    <span className={styles.cardMetaLabel}>Out of - network Deductible</span>
                    <span className={styles.cardMetaValue}>{data?.outNetDeductible ? `$${data.outNetDeductible}` : '{$}'}</span>
                  </div>
                </div>
                <div className={styles.cardCostRow}>
                  <div className={styles.cardCostCell}>
                    <span className={styles.cardMetaLabel}>In - network OOP MAX</span>
                    <span className={styles.cardMetaValue}>{data?.inNetOopMax ? `$${data.inNetOopMax}` : '{$}'}</span>
                  </div>
                  <div className={styles.cardCostCell}>
                    <span className={styles.cardMetaLabel}>Out of - network OOP MAX</span>
                    <span className={styles.cardMetaValue}>{data?.outNetOopMax ? `$${data.outNetOopMax}` : '{$}'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer motto bar — shown whenever the Avergent logo is selected (any theme) */}
            {isAvergentLogo && data?.planMotto && (
              <div
                className={styles.cardFooterBar}
                style={{ background: cardTheme?.footerBg || '#FFA449', color: cardTheme?.footerText || '#FFFFFF' }}
              >
                {data.planMotto}
              </div>
            )}
          </div>
        </div>

        {/* ── Back View ── */}
        <div className={`${styles.cardViewSection} ${styles.cardViewSectionLast}`}>
          <span className={`${styles.cardViewLabel} ${styles.cardViewLabelBack}`}>Back View</span>
          <div className={styles.backCard} style={cardStyle}>

            <div className={styles.backContent}>
              {/* TPA logo — only when a TPA logo is provided */}
              {backLogoUrl && (
                <>
                  <div className={styles.backTpaRow}>
                    <div className={styles.backTpaText}>
                      <span className={styles.cardMetaLabel}>Third Party Administrator</span>
                      <img src={backLogoUrl} alt="TPA Logo" className={styles.backTpaLogoImg} />
                    </div>
                  </div>
                  <div className={styles.cardDivider} />
                </>
              )}

              {/* RxBIN / RxPCN / RxGroup — only the ones provided */}
              {(data?.rxBin || data?.rxPcn || data?.rxGroup) && (
                <>
                  <div className={styles.backRxGroup}>
                    {(data?.rxBin || data?.rxPcn) && (
                      <div className={styles.backRow}>
                        {data?.rxBin && (
                          <div className={styles.backCell}>
                            <span className={styles.cardMetaLabel}>RxBIN</span>
                            <span className={styles.cardMetaValue}>{data.rxBin}</span>
                          </div>
                        )}
                        {data?.rxPcn && (
                          <div className={styles.backCell}>
                            <span className={styles.cardMetaLabel}>RxPCN</span>
                            <span className={styles.cardMetaValue}>{data.rxPcn}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {data?.rxGroup && (
                      <div className={styles.backCell}>
                        <span className={styles.cardMetaLabel}>RxGroup</span>
                        <span className={styles.cardMetaValue}>{data.rxGroup}</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.cardDivider} />
                </>
              )}

              {/* Member Support / Provider Support */}
              <div className={styles.backRow}>
                <div className={styles.backCell}>
                  <span className={styles.cardMetaLabel}>Member Support</span>
                  <span className={styles.cardMetaValue}>{data?.memberSupportPhone || '{Member Support}'}</span>
                </div>
                <div className={styles.backCell}>
                  <span className={styles.cardMetaLabel}>Provider Support</span>
                  <span className={styles.cardMetaValue}>{data?.providerSupportPhone || '{Provider Support}'}</span>
                </div>
              </div>

              <div className={styles.cardDivider} />

              {/* EDI Payer ID / Claims Mailing Address */}
              <div className={`${styles.backRow} ${styles.backRowAlignStart}`}>
                <div className={styles.backCell}>
                  <span className={styles.cardMetaLabel}>EDI Payer ID</span>
                  <span className={styles.cardMetaValue}>{data?.ediPayerId || '{EDI Payer ID}'}</span>
                </div>
                <div className={styles.backCell}>
                  <span className={styles.cardMetaLabel}>Claims Mailing Address</span>
                  <div className={styles.backAddressBlock}>
                    <span className={styles.cardMetaValue}>{data?.addressLine1 || '{Address Line 1}'}</span>
                    {data?.addressLine2 && <span className={styles.cardMetaValue}>{data.addressLine2}</span>}
                    <span className={styles.cardMetaValue}>
                      {(data?.zipcode || data?.city || data?.state)
                        ? [data.city, data.state, data.zipcode].filter(Boolean).join(', ')
                        : '{City, State, Zipcode}'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Note bar — theme-tinted */}
            {noteText && (
              <div className={styles.backNoteBar} style={{ background: cardTheme?.noteBg || '#FFEDDB' }}>
                {/* Rich-text field authored in CreateInsurancePlanDrawer and
                    read back for every viewer of the plan — sanitize. */}
                <p className={styles.backNote} dangerouslySetInnerHTML={{ __html: sanitizeRichText(data.additionalNote) }} />
              </div>
            )}
          </div>
        </div>

      </div>

      <div className={styles.previewFooter}>
        <ThemeDropdown logoChoice={logoChoice} cardTheme={cardTheme} onThemeChange={onThemeChange} />
        {!onThemeChange && cardTheme?.name && (
          <span className={styles.themeStaticLabel}>{cardTheme.name} Theme</span>
        )}
      </div>
    </>
  );
}
