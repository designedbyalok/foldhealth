import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { useHolidays } from './useHolidays';
import styles from './holidays.module.css';

/**
 * The calendar's Holidays touchpoint: the same holidays list as Settings →
 * Calendar → Holiday configuration, in a drawer, with New Configuration in
 * the header.
 *
 * @param {object}   props
 * @param {function} props.onClose
 */
export function HolidaysDrawer({ onClose }) {
  const h = useHolidays({ embedded: true });
  return (
    <>
      <Drawer
        title="Holidays"
        width={980}
        onClose={onClose}
        noCloseDivider
        bodyClassName={styles.flushBody}
        headerRight={(
          <>
            <Button variant="secondary" size="L" leadingIcon="solar:add-circle-linear" onClick={h.openNew}>New Configuration</Button>
            <span className={styles.headerDivider} aria-hidden="true" />
          </>
        )}
      >
        {h.intro}
        {h.body}
      </Drawer>
      {h.elements}
    </>
  );
}
