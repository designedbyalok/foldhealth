import { Drawer } from '@/components/Drawer/Drawer';
import styles from './Claims.module.css';

const TERMS = [
  { term: 'In network', text: 'Doctors, hospitals and labs that have an agreement with your plan. Care from them usually costs you less.' },
  { term: 'Out of network', text: 'Providers without an agreement with your plan. Your plan pays less, or nothing, and you pay more.' },
  { term: 'Deductible', text: 'What you pay for covered care each year before your plan starts to share the cost.' },
  { term: 'Out-of-pocket maximum', text: 'The most you pay for covered care in a year. After you reach it, your plan pays its full share.' },
  { term: 'Copay', text: 'A fixed amount you pay for a visit or service, such as $20 for a primary care visit.' },
  { term: 'Coinsurance', text: 'Your share of a cost as a percentage, such as 20%, usually after you reach your deductible.' },
  { term: 'Individual and family', text: 'Individual amounts count your own care. Family amounts add up care for everyone on the plan.' },
];

// "Understanding Your Coverage" (frame 1114:7063).
export function CoverageGuideDrawer({ onClose }) {
  return (
    <Drawer title="Understanding Your Coverage" onClose={onClose} width={560}>
      <dl className={styles.terms}>
        {TERMS.map((t) => (
          <div key={t.term} className={styles.termRow}>
            <dt className={styles.termName}>{t.term}</dt>
            <dd className={styles.termText}>{t.text}</dd>
          </div>
        ))}
      </dl>
    </Drawer>
  );
}
