import { Icon } from '../../components/Icon/Icon';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { describeRange } from './oooUtils';
import styles from './CoveringNote.module.css';

/**
 * "Covering for <name> ⓘ" under a member in a worklist: this row is here
 * because I'm covering that person while they're out; the icon's hover gives
 * their dates. Shared by Home's My Worklist and the program worklists.
 *
 * @param {Array<{ name, startAt, endAt }>} props.people – whom I'm covering on this row
 */
export function CoveringNote({ people }) {
  if (!people?.length) return null;
  return (
    <span className={styles.note}>
      Covering for
      {people.map((c, i) => (
        <span key={c.name} className={styles.who}>
          {i > 0 && ', '}{c.name}
          <Tooltip
            label={(
              <span className={styles.tip}>
                <span className={styles.tipTitle}>{c.name} is out of office</span>
                {c.startAt && <span>{describeRange(c.startAt, c.endAt).span}</span>}
              </span>
            )}
            maxWidth={260}
            align="left"
          >
            <span className={styles.info} aria-label={`${c.name} out of office details`}>
              <Icon name="solar:info-circle-linear" size={14} />
            </span>
          </Tooltip>
        </span>
      ))}
    </span>
  );
}
