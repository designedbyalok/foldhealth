import { ChevronIcon } from './icons';

/**
 * What the box shows right after feedback is sent (or the host's finish
 * action ran): an animated check, what happened, and, when the host offers
 * one, the next thing to review.
 */
export function DoneCard({ title, detail, nextUp, labels: L, onDismiss }) {
  return (
    <div className="rk-done" role="status">
      <div className="rk-done-hero">
        <span className="rk-done-check" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path className="rk-done-tick" d="M6 12.5l4 4 8-9" pathLength="1" />
          </svg>
        </span>
        <div className="rk-done-title">{title}</div>
        {detail && <div className="rk-done-detail">{detail}</div>}
      </div>

      {nextUp && (
        <div className="rk-next">
          <div className="rk-next-label">{L.upNext}</div>
          <div className="rk-next-card">
            <div className="rk-next-title" title={nextUp.title}>{nextUp.title}</div>
            {nextUp.meta && <div className="rk-next-meta">{nextUp.meta}</div>}
          </div>
          <div className="rk-next-actions">
            <button type="button" className="rk-next-dismiss" onClick={onDismiss}>
              {nextUp.dismissLabel || L.notNow}
            </button>
            <button type="button" className="rk-next-go" onClick={nextUp.onAccept}>
              {nextUp.label || L.reviewNext}
              <span className="rk-next-arrow"><ChevronIcon direction="right" width={14} height={14} /></span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
