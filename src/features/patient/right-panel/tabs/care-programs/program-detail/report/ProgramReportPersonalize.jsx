import { useState } from 'react';
import { Input } from '../../../../../../../components/Input/Input';
import { Textarea } from '../../../../../../../components/Textarea/Textarea';
import { Switch } from '../../../../../../../components/Switch/Switch';
import { Select } from '../../../../../../../components/Select/Select';
import { Toggle } from '../../../../../../../components/Toggle/Toggle';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { ImageTileGallery } from '../../../../../../../components/ImageTileGallery/ImageTileGallery';
import { TypographyPopover } from '../../../../../../../components/TypographyPopover/TypographyPopover';
import {
  ReportLogoField, LogoScale, LogoPlacement, CoverSwatches, CoverSwatch, AddSwatch,
} from '../../../../../../../components/ReportCover/ReportCover';
import { readReportImage } from '../../../../../../../components/ReportCover/readReportImage';
import { COVER_GRADIENTS, gradientCss } from '../../../../../../analytics/views/employer/generateEmployerReportPdf';
import { PRESET_COVERS } from '../../../../../../analytics/views/employer/reportCovers';
import { REPORT_FONTS, loadFontPreviews } from '../../../../../../analytics/views/employer/reportFonts';
import {
  BACKGROUND_TYPES, COVER_DESCRIPTION_MAX, DEFAULT_COLOR_SWATCHES, FONT_WEIGHTS, INTRO_SIZE, TITLE_MAX, TITLE_SIZE,
  presetPickerCss,
} from './programReportSettings';
import styles from './ProgramReportDrawer.module.css';

const COVER_ACCEPT = '.png,.jpg,.jpeg,.svg';
const COVER_MIME = ['image/png', 'image/jpeg', 'image/svg+xml'];
const COVER_MAX_MB = 5;

/**
 * Program report > Personalize: the report title and logo, the cover page
 * (as the Employer Impact Report's Personalize tab), and the page header and
 * footer.
 */
export function ProgramReportPersonalize({
  settings, onChange, defaultTitle, clinicLogo, addedCovers, onAddCover, onRemoveCover,
  headerComponents, footerComponents, headerId, footerId, onFocusCover,
}) {
  const [typographyAt, setTypographyAt] = useState(null);
  const set = patch => onChange({ ...settings, ...patch });
  const s = settings;

  const colorList = [...DEFAULT_COLOR_SWATCHES, ...s.customColors];
  const gradientList = [
    ...COVER_GRADIENTS.map(g => ({ id: g.key, label: g.label, css: gradientCss(g), custom: false })),
    ...s.customGradients.map((g, i) => ({ id: g.id, label: `Custom gradient ${i + 1}`, css: g.css, custom: true })),
  ];
  const customGradient = s.customGradients.find(g => g.id === s.bgGradient);

  const pickColor = (color, draft) => {
    const c = color.toUpperCase();
    const base = draft ? s.customColors.filter(x => x !== draft) : s.customColors;
    set({ customColors: DEFAULT_COLOR_SWATCHES.includes(c) || base.includes(c) ? base : [...base, c], bgColor: c });
    return c;
  };
  const pickGradient = (css, draft) => {
    const id = draft || `custom-${Date.now().toString(36)}`;
    set({
      customGradients: draft ? s.customGradients.map(g => (g.id === id ? { ...g, css } : g)) : [...s.customGradients, { id, css }],
      bgGradient: id,
    });
    return id;
  };

  return (
    <div className={styles.personalize} onPointerDownCapture={onFocusCover} onKeyDownCapture={onFocusCover}>
      <LogoPlacement label="Logo" align={s.logoAlign} onAlign={logoAlign => set({ logoAlign })} alignRows={3}>
        <ReportLogoField
          src={clinicLogo?.dataUrl}
          name="Clinic logo"
          custom={s.customLogo}
          onPick={customLogo => set({ customLogo })}
          onReset={() => set({ customLogo: null })}
        />
        <LogoScale label="Logo" value={s.logoScale} onChange={logoScale => set({ logoScale })} />
      </LogoPlacement>

      <Input
        label="Report Title"
        value={s.title}
        maxLength={TITLE_MAX}
        placeholder={defaultTitle}
        onChange={e => set({ title: e.target.value })}
      />

      <section className={styles.coverGroup}>
        <div className={styles.groupHead}>
          <h3 className={styles.groupTitle}>Cover Page</h3>
          <span className={styles.groupActions}>
            {s.includeCover && (
              <>
                <ActionButton
                  icon="solar:text-linear"
                  size="sm"
                  tooltip="Typography"
                  tooltipLeft
                  active={!!typographyAt}
                  onClick={(e) => { const el = e.currentTarget; loadFontPreviews(); setTypographyAt(at => (at ? null : { rect: el.getBoundingClientRect(), el })); }}
                />
                <span className={styles.headerDivider} aria-hidden="true" />
              </>
            )}
            <Switch checked={s.includeCover} onChange={includeCover => set({ includeCover })} ariaLabel="Include cover page" />
          </span>
          {s.includeCover && typographyAt && (
            <TypographyPopover
              anchorRect={typographyAt.rect}
              anchorEl={typographyAt.el}
              families={REPORT_FONTS}
              weights={FONT_WEIGHTS}
              rows={[
                { key: 'title', label: 'Report Title', value: s.titleStyle, ...TITLE_SIZE },
                { key: 'intro', label: 'Report Introduction', value: s.introStyle, ...INTRO_SIZE },
              ]}
              onChange={(key, next) => set(key === 'title' ? { titleStyle: next } : { introStyle: next })}
              onClose={() => setTypographyAt(null)}
            />
          )}
        </div>
        {s.includeCover && (
          <>
            <Textarea
              title="Report Introduction"
              value={s.coverDescription}
              onValueChange={coverDescription => set({ coverDescription })}
              placeholder="A short introduction for the cover (optional)"
              maxLength={COVER_DESCRIPTION_MAX}
              rows={3}
            />
            <div className={styles.fieldGroup}>
              <div className={styles.groupHead}>
                <span className={styles.groupTitle}>Cover Background</span>
                <Toggle size="sm" items={BACKGROUND_TYPES} value={s.bgType} onValueChange={bgType => set({ bgType })} />
              </div>
              {s.bgType === 'color' && (
                <CoverSwatches ariaLabel="Cover colour">
                  {colorList.map(c => (
                    <CoverSwatch
                      key={c}
                      label={c}
                      fill={{ background: c }}
                      selected={s.bgColor.toUpperCase() === c}
                      onSelect={() => set({ bgColor: c })}
                      onRemove={s.customColors.includes(c) ? () => set({
                        customColors: s.customColors.filter(x => x !== c),
                        bgColor: s.bgColor.toUpperCase() === c ? DEFAULT_COLOR_SWATCHES[0] : s.bgColor,
                      }) : undefined}
                    />
                  ))}
                  <AddSwatch value={s.bgColor} onPick={pickColor} />
                </CoverSwatches>
              )}
              {s.bgType === 'gradient' && (
                <CoverSwatches ariaLabel="Cover gradient">
                  {gradientList.map(g => (
                    <CoverSwatch
                      key={g.id}
                      label={g.label}
                      fill={{ backgroundImage: g.css }}
                      selected={s.bgGradient === g.id}
                      onSelect={() => set({ bgGradient: g.id })}
                      onRemove={g.custom ? () => set({
                        customGradients: s.customGradients.filter(x => x.id !== g.id),
                        bgGradient: s.bgGradient === g.id ? COVER_GRADIENTS[0].key : s.bgGradient,
                      }) : undefined}
                    />
                  ))}
                  <AddSwatch gradient value={customGradient?.css || presetPickerCss(s.bgGradient)} onPick={pickGradient} />
                </CoverSwatches>
              )}
              {s.bgType === 'image' && (
                <>
                  <ImageTileGallery
                    ariaLabel="Cover image"
                    columns={5}
                    items={[
                      ...addedCovers.map(c => ({ id: c.id, src: c.dataUrl, label: c.name, removable: true })),
                      ...PRESET_COVERS.map(c => ({ id: c.id, src: c.src, label: c.label })),
                    ]}
                    selectedId={s.bgCover}
                    onSelect={bgCover => set({ bgCover })}
                    accept={COVER_ACCEPT}
                    acceptMime={COVER_MIME}
                    maxMb={COVER_MAX_MB}
                    onAdd={async (file) => {
                      const img = await readReportImage(file);
                      if (!img) throw new Error('That image couldn’t be read. Try another file.');
                      const cover = { ...img, id: `upload-${Date.now().toString(36)}`, name: file.name };
                      onAddCover(cover);
                      set({ bgCover: cover.id });
                    }}
                    onRemove={(id) => {
                      onRemoveCover(id);
                      if (s.bgCover === id) set({ bgCover: PRESET_COVERS[0].id });
                    }}
                  />
                  <span className={styles.coverHint}>PNG, JPG or SVG, up to {COVER_MAX_MB} MB. Added images are kept for this report only.</span>
                </>
              )}
            </div>
          </>
        )}
      </section>

      <div className={styles.chromeRow}>
        <section className={styles.chromeGroup}>
          <div className={styles.groupHead}>
            <h3 className={styles.groupTitle}>Show Header</h3>
            <Switch checked={s.showHeader} onChange={showHeader => set({ showHeader })} ariaLabel="Show header" />
          </div>
          {s.showHeader && (
            <Select
              portal
              options={headerComponents.map(h => ({ value: String(h.id), label: h.label }))}
              value={String(headerId ?? '')}
              onValueChange={id => set({ headerId: id })}
            />
          )}
        </section>
        <section className={styles.chromeGroup}>
          <div className={styles.groupHead}>
            <h3 className={styles.groupTitle}>Show Footer</h3>
            <Switch checked={s.showFooter} onChange={showFooter => set({ showFooter })} ariaLabel="Show footer" />
          </div>
          {s.showFooter && (
            <Select
              portal
              options={footerComponents.map(f => ({ value: String(f.id), label: f.label }))}
              value={String(footerId ?? '')}
              onValueChange={id => set({ footerId: id })}
            />
          )}
        </section>
      </div>
    </div>
  );
}
