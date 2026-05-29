/**
 * Renders the email-builder header/footer presets inside a form (Preview tab
 * and the public fill view). Reuses PresetLivePreview so the exact same
 * header/footer designs from the email builder render here.
 */
import { PresetLivePreview } from '../../email-builder/PresetLivePreview';
import { HEADER_PRESETS, FOOTER_PRESETS } from '../../email-builder/headerFooterLibrary';

const headerPresetById = (id) => HEADER_PRESETS.find((p) => p.id === id) || HEADER_PRESETS[0];
const footerPresetById = (id) => FOOTER_PRESETS.find((p) => p.id === id) || FOOTER_PRESETS[0];

export function FormHeader({ settings, className }) {
  if (!settings?.header?.enabled) return null;
  // No width → PresetLivePreview measures its container and scales to fit.
  // Pass the form's font so the header reads cohesively with the body.
  return (
    <div className={className}>
      <PresetLivePreview preset={headerPresetById(settings.header.presetId)} fontFamily={settings.fontFamily} />
    </div>
  );
}

export function FormFooter({ settings, className }) {
  if (!settings?.footer?.enabled) return null;
  return (
    <div className={className}>
      <PresetLivePreview preset={footerPresetById(settings.footer.presetId)} fontFamily={settings.fontFamily} />
    </div>
  );
}
