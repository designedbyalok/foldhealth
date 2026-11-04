import { useState } from 'react';
import { useNativeDialog } from '../../hooks/useNativeDialog';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/Button/Button';
import { Select } from '../../components/Select/Select';
import { Icon } from '../../components/Icon/Icon';
import { GOOGLE_FONTS } from './googleFonts';
import { applyFontMappings } from './htmlToDocument';

// Surfaces unknown font families found in an imported HTML doc and asks
// the user to map each to a font the builder can load. On confirm we
// rewrite the pending doc with the chosen substitutions and commit it via
// setEmailDocument. Skipping leaves the original (unrenderable) font name
// in place: the renderer falls back to Inter, which is safe.
export function FontSubstitutionDialog() {
  const pendingFontDoc = useAppStore(s => s.pendingFontDoc);
  const pendingUnknownFonts = useAppStore(s => s.pendingUnknownFonts);
  const dialogRef = useNativeDialog(!!pendingFontDoc && pendingUnknownFonts.length > 0);
  const closeFontSubstitutionDialog = useAppStore(s => s.closeFontSubstitutionDialog);
  const setEmailDocument = useAppStore(s => s.setEmailDocument);

  // Default every unknown font to Inter, the existing builder default,
  // so a single Confirm click works.
  const [mappings, setMappings] = useState(() =>
    Object.fromEntries(pendingUnknownFonts.map(f => [f, 'Inter']))
  );

  if (!pendingFontDoc || !pendingUnknownFonts.length) return null;

  const fontOptions = GOOGLE_FONTS.map(f => ({ value: f.value, label: f.label }));

  const commit = () => {
    const next = applyFontMappings(pendingFontDoc, mappings);
    setEmailDocument(next);
    closeFontSubstitutionDialog();
  };

  const skip = () => {
    setEmailDocument(pendingFontDoc);
    closeFontSubstitutionDialog();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="Font substitution"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        width: '100%', height: '100%', maxWidth: 'none', maxHeight: 'none',
        margin: 0, border: 0,
        background: 'rgba(15, 23, 42, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onCancel={(e) => { e.preventDefault(); closeFontSubstitutionDialog(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 12, width: 480, maxWidth: '100%',
        maxHeight: '85vh', overflow: 'auto',
        boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px', borderBottom: '0.5px solid var(--neutral-100)',
        }}>
          <Icon name="solar:text-italic-circle-linear" size={20} color="var(--primary-300)" />
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--neutral-500)' }}>
              {pendingUnknownFonts.length === 1 ? 'Unknown font detected' : `${pendingUnknownFonts.length} unknown fonts detected`}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--font-sm)', color: 'var(--neutral-300)' }}>
              Map each to a Google Font the builder can load. Email clients render the substitution.
            </p>
          </div>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          {pendingUnknownFonts.map(font => (
            <div key={font} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                flex: '0 0 160px', fontSize: 'var(--font-md)', color: 'var(--neutral-400)',
                fontWeight: 500,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }} title={font}>
                {font}
              </div>
              <Icon name="solar:arrow-right-linear" size={14} color="var(--neutral-200)" />
              <div style={{ flex: 1 }}>
                <Select
                  options={fontOptions}
                  value={mappings[font] || 'Inter'}
                  onValueChange={v => setMappings(m => ({ ...m, [font]: v }))}
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: '0.5px solid var(--neutral-100)',
        }}>
          <Button variant="outline" onClick={skip}>Skip</Button>
          <Button onClick={commit}>Apply substitutions</Button>
        </div>
      </div>
    </dialog>
  );
}
