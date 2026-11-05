import { useState } from 'react';
import { Dialog, DialogContent } from '../../../../../../../components/Dialog/Dialog';
import { Input } from '../../../../../../../components/Input/Input';
import { Select } from '../../../../../../../components/Select/Select';
import { Textarea } from '../../../../../../../components/Textarea/Textarea';
import { Button } from '../../../../../../../components/Button/Button';
import { referralPartner, referralUrl } from '../lib/sdohTaxonomy';
import styles from './SdohReferralDialog.module.css';

const STATUS_OPTIONS = [
  { value: 'Sent', label: 'Sent' },
  { value: 'Draft', label: 'Draft (not sent yet)' },
];

/**
 * Record a community referral for an SDOH barrier. There's no partner API:
 * the care manager finds or sends the referral on the partner's site (opened
 * in a new tab) and records it here, where its status is tracked. Submits
 * { partner, program, note, status }.
 */
export function SdohReferralDialog({ partner, barrier, zip, onCancel, onSubmit }) {
  const p = referralPartner(partner);
  const [program, setProgram] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('Sent');
  const url = referralUrl(partner, { domain: barrier?.sdohDomain, zip });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel?.(); }}>
      <DialogContent className={styles.content}>
        <div className={styles.body}>
          <h3 className={styles.title}>{p?.label} Referral</h3>
          <p className={styles.description}>
            For <strong>{barrier?.title}</strong>. Find or send the referral on {p?.label}, then record it here to track it on the plan.
          </p>
          {url && (
            <Button
              variant="outline"
              leadingIcon="solar:square-top-down-linear"
              onClick={() => window.open(url, '_blank', 'noopener')}
            >
              Open {p?.label}
            </Button>
          )}
          <Input
            label="Program or organization"
            value={program}
            onChange={e => setProgram(e.target.value.slice(0, 120))}
            placeholder="e.g. Eastside Community Food Bank"
          />
          <Select label="Referral status" options={STATUS_OPTIONS} value={status} onValueChange={setStatus} />
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Contact, eligibility, or what the patient agreed to…"
            rows={3}
            aria-label="Referral notes"
          />
          <div className={styles.footer}>
            <Button variant="outline" fullWidth onClick={onCancel}>Cancel</Button>
            <Button
              fullWidth
              disabled={!program.trim()}
              onClick={() => onSubmit?.({ partner, program, note, status })}
            >
              Save Referral
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
