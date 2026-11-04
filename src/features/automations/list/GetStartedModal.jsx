import { useAppStore } from '../../../store/useAppStore';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../components/Dialog/Dialog';
import { Button } from '../../../components/Button/Button';
import styles from './GetStartedModal.module.css';

const STEPS = [
  { title: 'Pick a trigger', body: 'Choose the event that starts the automation, such as a contact being added or updated.' },
  { title: 'Add conditions', body: 'Narrow who it runs for: tags, demographics, membership, app activity and more.' },
  { title: 'Add actions and branches', body: 'Send emails, SMS, forms or education, create tasks, and split the flow on the outcome.' },
  { title: 'Test it', body: 'Run it against a sample member and follow each step on the canvas.' },
  { title: 'Save and publish', body: 'Choose the population group and schedule, then turn it on.' },
  { title: 'Monitor in analytics', body: 'See who completed, who is in progress and who failed, and retry failures.' },
];

/** "How to use Fold Automation": the guide behind the list's Get Started link. */
export function GetStartedModal({ onClose }) {
  const openNewAutomation = useAppStore(s => s.openNewAutomation);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={styles.modal}>
        <div className={styles.poster} aria-hidden="true">
          <span className={styles.posterKicker}>How to use</span>
          <span className={styles.posterTitle}>Fold Automation</span>
          <span className={styles.posterSub}>Create an automation in 6 simple steps</span>
        </div>
        <div className={styles.content}>
          <DialogTitle className={styles.title}>How to use Fold Automation</DialogTitle>
          <DialogDescription className={styles.description}>
            Automations run care workflows for you. Build one in six steps:
          </DialogDescription>
          <ol className={styles.steps}>
            {STEPS.map((s, i) => (
              <li key={s.title} className={styles.step}>
                <span className={styles.num}>{i + 1}</span>
                <span className={styles.stepText}>
                  <span className={styles.stepTitle}>{s.title}</span>
                  <span className={styles.stepBody}>{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className={styles.footer}>
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button leadingIcon="solar:add-circle-linear" onClick={() => { onClose(); openNewAutomation(null); }}>
              Create an automation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
