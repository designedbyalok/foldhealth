import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Icon } from '../../../components/Icon/Icon';

/**
 * HccUploadProcessingHost
 *
 * Floating progress chip mounted globally in AppLayout. Appears bottom-
 * right whenever an HCC upload session is minimized (user closed the
 * drawer mid-extraction). Visual modelled after Figma node 22:41409,
 * a 375px card with a soft purple gradient, a 4-step task list, and a
 * Discard link. On completion the card swaps to a green gradient with
 * a "Review and Confirm Extraction" primary CTA.
 *
 * Lifecycle: stays mounted as long as `hccUploadSession` is non-null and
 * `hccUploadMinimized` is true. Expanding or cancelling unmounts it.
 */
const STEPS = [
  'Reading the uploaded File',
  'Extracting text for processing',
  'Creating encounter',
  'Matching patient',
];

export function HccUploadProcessingHost() {
  const session = useAppStore(s => s.hccUploadSession);
  const minimized = useAppStore(s => s.hccUploadMinimized);
  const expand = useAppStore(s => s.expandHccUpload);
  const cancel = useAppStore(s => s.cancelHccUpload);

  // Step animation: purely visual. The OCR effect in the parent
  // UploadDocumentDrawer populates the real encounters; we just walk
  // through the labels at a natural pace so the chip feels alive.
  const [step, setStep] = useState(0);
  const startedAt = useRef(null);
  useEffect(() => {
    if (!session || session.phase !== 'processing') return;
    if (startedAt.current == null) startedAt.current = Date.now();
    // ~8s total: each step takes 2s. The fourth step ("Matching patient")
    // completes when the session phase flips to 'review', i.e. when the
    // mockOcr promise resolves (PROCESSING_DELAY_MS = 8000).
    const t = [];
    t.push(setTimeout(() => setStep(1), 2000));
    t.push(setTimeout(() => setStep(2), 4000));
    t.push(setTimeout(() => setStep(3), 6000));
    return () => t.forEach(clearTimeout);
  }, [session?.phase]);

  useEffect(() => {
    if (!session) {
      startedAt.current = null;
      setStep(0);
    }
  }, [session?.id]);

  if (!session || !minimized) return null;

  const isComplete = session.phase === 'review';
  const fileName = session.file?.name || 'Uploaded file';

  return (
    <div
      style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 3000,
        animation: 'pg-slide-up 0.3s cubic-bezier(0.32,0,0.15,1)',
      }}
    >
      {!isComplete ? (
        // ── Extracting ───────────────────────────────────────────
        <div style={{
          width: 375,
          borderRadius: 8,
          boxShadow: '4px 15px 60px 24px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          fontFamily: 'Inter, sans-serif',
          backgroundImage: 'linear-gradient(117deg, #f1e7ff 4%, #ffffff 32%)',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '12px 16px 8px',
          }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-500)' }}>
                  Processing Document
                </span>
                <SparkleIcon />
              </div>
              <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-200)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Running AI extraction on {fileName}
              </div>
            </div>
            <button
              onClick={expand}
              type="button"
              title="Maximize"
              style={chipBtn}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <Icon name="solar:maximize-square-2-linear" size={16} color="var(--neutral-300)" />
            </button>
            <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)' }} />
            <button
              onClick={() => cancel()}
              type="button"
              title="Close"
              style={chipBtn}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <Icon name="solar:close-circle-linear" size={16} color="var(--neutral-300)" />
            </button>
          </div>

          {/* Step list */}
          <div style={{ padding: '4px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {STEPS.map((label, i) => {
              const done = step > i;
              const active = step === i;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {done ? (
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--status-success)', border: '0.67px solid var(--status-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.3 5.7L8 1" stroke="var(--neutral-0)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  ) : active ? (
                    <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 0.9s linear infinite' }}>
                        <circle cx="7" cy="7" r="5.5" stroke="var(--neutral-150)" strokeWidth="1.5" />
                        <path d="M7 1.5 A 5.5 5.5 0 0 1 12.5 7" stroke="var(--primary-300)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                      </svg>
                    </div>
                  ) : (
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '0.67px solid var(--neutral-200)', background: 'var(--neutral-0)', flexShrink: 0 }} />
                  )}
                  <span style={{
                    fontSize: 'var(--font-base)',
                    color: 'var(--neutral-400)',
                    fontWeight: 400,
                  }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Discard link */}
          <div style={{ padding: '4px 16px 12px' }}>
            <button
              onClick={() => cancel()}
              type="button"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0,
                fontFamily: 'Inter, sans-serif',
                fontSize: 'var(--font-base)', color: 'var(--neutral-300)',
              }}
            >
              <Icon name="solar:trash-bin-2-linear" size={16} color="#6F7A90" />
              Discard
            </button>
          </div>
        </div>
      ) : (
        // ── Complete ─────────────────────────────────────────────
        <div style={{
          width: 375,
          borderRadius: 8,
          boxShadow: '4px 15px 60px 24px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          fontFamily: 'Inter, sans-serif',
          backgroundImage: 'linear-gradient(105deg, var(--status-success-light) 0%, var(--neutral-0) 44%)',
          animation: 'pg-fade-up 0.3s ease',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px',
          }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--status-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: 'pg-badge-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <svg width="14" height="11" viewBox="0 0 16 13" fill="none"><path d="M1.5 6.5L5.5 10.5L14.5 1.5" stroke="var(--neutral-0)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-500)' }}>
                Document Extracted &amp; Processed
              </div>
              <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-200)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fileName}
              </div>
            </div>
            <button
              onClick={() => cancel()}
              type="button"
              title="Dismiss"
              style={chipBtn}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <Icon name="solar:close-circle-linear" size={16} color="var(--neutral-300)" />
            </button>
          </div>
          <div style={{ padding: '0 16px 12px' }}>
            <button
              onClick={expand}
              type="button"
              style={{
                width: '100%', height: 32,
                background: 'var(--primary-300)', color: 'var(--neutral-0)',
                border: 'none', borderRadius: 4,
                fontSize: 'var(--font-base)', fontWeight: 500, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-400)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--primary-300)'}
            >
              Review and Confirm Extraction
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const chipBtn = {
  width: 24, height: 24,
  border: 'none', background: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 4, flexShrink: 0, padding: 4,
};

// Small inline sparkle so we don't depend on a specific iconify variant.
function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5l1.4 3.6 3.6 1.4-3.6 1.4L8 11.5 6.6 7.9 3 6.5l3.6-1.4L8 1.5zM12.5 10.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z"
        fill="#8C5AE2"
      />
    </svg>
  );
}
