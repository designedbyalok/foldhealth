import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../Dialog/Dialog';
import { ActionButton } from '../ActionButton/ActionButton';
import { Icon } from '../Icon/Icon';
import styles from './SlideshowDialog.module.css';

const prefersReducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * SlideshowDialog: a two-pane walkthrough. The white left pane lists the
 * steps (icon, title, one-line summary, an optional count) with the current
 * one tinted and marked by an accent bar. The tinted right pane shows that
 * step's slide: a small eyebrow, the headline (the one thing to read
 * first), an optional description, then a preview and a detail body. The
 * slide scrolls on its own while both footers stay put.
 *
 * Steps advance on their own every `autoplayMs` (the accent bar fills as the
 * timer runs, and pauses while the pointer is over the dialog) until the
 * reader picks a step or uses Previous / Next. No autoplay under
 * prefers-reduced-motion.
 *
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.subtitle]
 * @param {React.ReactNode} [props.leading] – above the title (a logo, an avatar)
 * @param {React.ReactNode} [props.headerExtra] – under the subtitle (a period switch)
 * @param {Array<{ key: string, icon: string, iconColor?: string, title: string, summary?: React.ReactNode,
 *   count?: React.ReactNode, eyebrow?: React.ReactNode, heading?: React.ReactNode,
 *   description?: React.ReactNode, preview?: React.ReactNode,
 *   body?: React.ReactNode | ((api: { goTo: (key: string) => void }) => React.ReactNode),
 *   primary?: React.ReactNode }>} props.steps – a function `body` gets `goTo` to jump to another step
 * @param {React.ReactNode} [props.footerStart] – left pane footer (secondary links)
 * @param {number} [props.autoplayMs=7000] – 0 turns autoplay off
 * @param {{ x: number, y: number }} [props.origin] – viewport point the dialog grows from and
 *   shrinks back to (the centre of the control that opened it)
 */
export function SlideshowDialog({
  open, onOpenChange, title, subtitle, leading, headerExtra, steps, footerStart, autoplayMs = 7000, origin,
}) {
  const [index, setIndex] = useState(0);
  // +1 moving down the steps, -1 moving back up: the slide enters from that side.
  const [dir, setDir] = useState(1);
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(false);
  const count = steps.length;
  const current = Math.min(index, Math.max(0, count - 1));
  const step = steps[current];
  const playing = open && auto && autoplayMs > 0 && current < count - 1 && !prefersReducedMotion();

  // Each opening starts from the first step with autoplay on.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setIndex(0);
      setDir(1);
      setAuto(true);
    }
  }

  const go = (i) => {
    const next = Math.max(0, Math.min(count - 1, i));
    setAuto(false);
    setDir(next >= current ? 1 : -1);
    setIndex(next);
  };
  const goTo = (key) => {
    const i = steps.findIndex(s => s.key === key);
    if (i >= 0) go(i);
  };

  const onKeyDown = (e) => {
    if (e.target.closest?.('input, textarea, [contenteditable]')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={styles.dialog}
        // The dialog is centred in the viewport, so the trigger's offset from
        // the viewport centre is its offset from the dialog's centre.
        style={origin ? {
          transformOrigin: `calc(50% + ${Math.round(origin.x - window.innerWidth / 2)}px) calc(50% + ${Math.round(origin.y - window.innerHeight / 2)}px)`,
        } : undefined}
        onKeyDown={onKeyDown}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
      >
        <div className={styles.panes}>
          <div className={styles.left}>
            <div className={styles.head}>
              {leading && <div className={styles.leading}>{leading}</div>}
              <DialogTitle className={styles.title}>{title}</DialogTitle>
              {subtitle && <DialogDescription className={styles.subtitle}>{subtitle}</DialogDescription>}
              {headerExtra && <div className={styles.headerExtra}>{headerExtra}</div>}
            </div>
            <ol className={styles.steps}>
              {steps.map((s, i) => {
                const active = i === current;
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      className={`${styles.step} ${active ? styles.stepActive : ''}`}
                      aria-current={active ? 'step' : undefined}
                      onClick={() => go(i)}
                    >
                      <span className={styles.bar} aria-hidden="true">
                        {active && (
                          <span
                            // Remount per step so the fill restarts.
                            key={`${s.key}-${playing}`}
                            className={`${styles.barFill} ${playing ? styles.barPlaying : ''}`}
                            style={{
                              animationDuration: `${autoplayMs}ms`,
                              animationPlayState: paused ? 'paused' : 'running',
                            }}
                            onAnimationEnd={() => { setDir(1); setIndex(v => Math.min(count - 1, v + 1)); }}
                          />
                        )}
                      </span>
                      <span className={styles.stepIcon}>
                        <Icon name={s.icon} size={16} color={s.iconColor || (active ? 'var(--primary-300)' : 'var(--neutral-300)')} />
                      </span>
                      <span className={styles.stepText}>
                        <span className={styles.stepTitleRow}>
                          <span className={styles.stepTitle}>{s.title}</span>
                          {s.count != null && <span className={styles.stepCount}>{s.count}</span>}
                        </span>
                        {s.summary && <span className={styles.stepSummary}>{s.summary}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {footerStart && <div className={`${styles.footer} ${styles.footerStart}`}>{footerStart}</div>}
          </div>

          <div className={styles.right}>
            {step && (
              <div key={step.key} className={`${styles.slide} ${dir < 0 ? styles.slideBack : ''}`}>
                <header className={styles.slideHead}>
                  <span className={styles.eyebrow}>
                    <Icon name={step.icon} size={14} />
                    {step.eyebrow ?? step.title}
                  </span>
                  <h3 className={styles.heading}>{step.heading ?? step.title}</h3>
                  {step.description && <div className={styles.description}>{step.description}</div>}
                </header>
                {step.preview && <div className={styles.preview}>{step.preview}</div>}
                {step.body && <div className={styles.body}>{typeof step.body === 'function' ? step.body({ goTo }) : step.body}</div>}
              </div>
            )}
            <div className={`${styles.footer} ${styles.footerEnd}`}>
              <span className={styles.position}>{count ? `${current + 1} of ${count}` : ''}</span>
              <ActionButton icon="solar:alt-arrow-left-linear" size="sm" tooltip="Previous" disabled={current === 0} onClick={() => go(current - 1)} />
              <ActionButton icon="solar:alt-arrow-right-linear" size="sm" tooltip="Next" disabled={current >= count - 1} onClick={() => go(current + 1)} />
              {step?.primary && <span className={styles.primary}>{step.primary}</span>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
