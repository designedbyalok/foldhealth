import { Icon } from '../Icon/Icon';
import { CloseButton } from '../CloseButton/CloseButton';
import styles from './IntroCard.module.css';

/**
 * IntroCard: a dismissible explainer at the top of a section: what it is
 * and how it helps, with a few points that each pair an icon with a short
 * title and line. The host decides where dismissal is remembered and offers
 * a way to bring the card back (a help button).
 *
 * @param {object}   props
 * @param {string}   props.title
 * @param {node}     [props.description]  – a sentence or two under the title
 * @param {string}   [props.icon]         – Solar icon for the header glyph
 * @param {Array<{ icon?: string, title: string, description?: node }>} [props.items]
 * @param {'grid'|'steps'} [props.layout='grid'] – 'steps' lists the items in order on a
 *   connected timeline, for points that happen one after another
 * @param {function} [props.onDismiss]    – adds a close (×); omitted, the card can't be dismissed
 * @param {string}   [props.dismissLabel='Dismiss']
 * @param {string}   [props.className]
 */
export function IntroCard({ title, description, icon, items = [], layout = 'grid', onDismiss, dismissLabel = 'Dismiss', className }) {
  const steps = layout === 'steps';
  return (
    <section className={[styles.root, className || ''].filter(Boolean).join(' ')} aria-label={title}>
      <div className={styles.head}>
        {icon && (
          <span className={styles.headIcon} aria-hidden="true">
            <Icon name={icon} size={20} color="currentColor" />
          </span>
        )}
        <div className={styles.headText}>
          <h3 className={styles.title}>{title}</h3>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {onDismiss && <CloseButton onClick={onDismiss} label={dismissLabel} className={styles.close} />}
      </div>
      {items.length > 0 && (
        <ul className={steps ? styles.steps : styles.items}>
          {items.map(item => (
            <li key={item.title} className={steps ? styles.step : styles.item}>
              {steps ? (
                <span className={styles.stepMarker} aria-hidden="true">
                  {item.icon && <Icon name={item.icon} size={14} color="currentColor" />}
                </span>
              ) : item.icon && <Icon name={item.icon} size={16} color="var(--primary-300)" />}
              <span className={styles.itemText}>
                <span className={styles.itemTitle}>{item.title}</span>
                {item.description && <span className={styles.itemDescription}>{item.description}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
