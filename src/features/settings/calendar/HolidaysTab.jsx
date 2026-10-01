import { SectionTitleBar } from '../../../components/SectionTitleBar/SectionTitleBar';
import { useHolidays } from '../../holidays/useHolidays';
import styles from './CalendarSettings.module.css';

/**
 * Settings → Calendar → Holiday configuration (Figma December-2025
 * 842:14951): every holiday for the chosen year, with search and New
 * Configuration on the tab row.
 *
 * @param {object}   props
 * @param {object[]} props.tabs
 * @param {string}   props.activeTab
 * @param {function} props.onTabChange
 */
export function HolidaysTab({ tabs, activeTab, onTabChange }) {
  const h = useHolidays();
  return (
    <div className={styles.wrapper}>
      <SectionTitleBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} actions={[]} rightExtras={h.tools} />
      {h.intro}
      <div className={styles.content}>{h.body}</div>
      {h.elements}
    </div>
  );
}
