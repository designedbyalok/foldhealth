import { useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { SplitDrawerLayout } from '../../../components/Drawer/SplitDrawerLayout';
import { FilePreview } from '../../../components/FilePreview/FilePreview';
import { Button } from '../../../components/Button/Button';
import { Select } from '../../../components/Select/Select';
import { Icon } from '../../../components/Icon/Icon';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { AiTooltipLabel } from '../../../components/Tooltip/AiTooltipLabel';
import { ConfidenceBadge, SuggestedPatients } from '../../../components/SuggestedPatients/SuggestedPatients';
import { sexAgeOf } from '../../../components/SuggestedPatients/patientMatch';
import { PatientMeta } from '../../../components/SuggestedPatients/PatientMeta';
import styles from './Efax.module.css';

// "Aaron Carter (F•33y 2m)"
const nameWithMeta = (p) => {
  const meta = sexAgeOf(p);
  return meta ? `${p.name} (${meta})` : p.name;
};

/**
 * Patient Context for eFax (Figma 2916:41416 → 2930:59418), laid out as the
 * review drawers are (Figma Oct-Nov 2025, 523:20659): the fax on the left, so
 * it can be read while choosing, and on the right who it's about. The fax's name and details sit over the fax. Pick from Select
 * Patient. The dropdown leads with the Suggested
 * Members (confidence badge, hover for why), then All Patients. With no
 * patient picked, the Suggested Members also sit under the field as a
 * collapsible box (+ picks); when changing an added patient the dropdown
 * opens instead. A suggested pick shows the AI mark. Then optionally Link
 * Referral, and Save.
 * `onSave(patientId, viaOcr, { linkReferral })`.
 *
 * @param {object} props.fax        – the fax: documentName, senderName, senderFax, pages, receivedAt
 * @param {string} props.pdf        – its file, shown on the left
 * @param {Array} props.suggestions – from suggestionsFor(), best first
 * @param {Array} props.patients    – all patients
 * @param {{ patientId, name, linkReferral?, viaOcr?, by?, when? }} [props.current] – the
 *   patient the fax is already added to (Change Patient): starts selected, and
 *   Save waits for a change
 */
const NONE = [];

export function PatientContextDrawer({ fax, pdf, suggestions = NONE, patients = NONE, current, onSave, onClose }) {
  const startId = current?.patientId ? String(current.patientId) : '';
  const [pickedId, setPickedId] = useState(startId);
  const [linkReferral, setLinkReferral] = useState(!!current?.linkReferral);
  const unchanged = !!current && pickedId === startId && linkReferral === !!current.linkReferral;

  const suggestedIds = useMemo(() => new Set(suggestions.map(s => String(s.patient.id))), [suggestions]);
  const viaOcr = suggestedIds.has(pickedId);

  const options = useMemo(() => {
    const suggested = suggestions.map(s => ({
      value: String(s.patient.id),
      searchText: s.patient.name,
      label: (
        <span className={styles.option}>
          <span className={styles.optionTop}>
            <span>{s.patient.name}</span>
            {s.confidence != null && <ConfidenceBadge confidence={s.confidence} matched={s.matched} />}
          </span>
          <PatientMeta className={styles.optionMeta} patient={s.patient} />
        </span>
      ),
      triggerLabel: (
        <span className={styles.pickedOcr}>
          {nameWithMeta(s.patient)}
          {/* Saved: who added it and when, as on the fax. Not saved yet: just where it came from. */}
          <Tooltip
            variant="card"
            label={(
              <AiTooltipLabel title="Suggested by Unity">
                Unity matched this patient from the eFax.
                {current?.viaOcr && String(s.patient.id) === startId && <span className={styles.addedLine}>Added by {current.by}, {current.when}.</span>}
              </AiTooltipLabel>
            )}
          >
            <span className={styles.ocrTag} aria-label="Patient suggested by Unity"><Icon name="custom:ai" size={16} /></span>
          </Tooltip>
        </span>
      ),
    }));
    // The current patient may be one the list hasn't loaded.
    const all = current && startId && !suggestedIds.has(startId) && !patients.some(p => String(p.id) === startId)
      ? [{ id: startId, name: current.name }, ...patients]
      : patients;
    const rest = all.filter(p => !suggestedIds.has(String(p.id))).map(p => ({
      value: String(p.id), label: p.name, searchText: p.name, triggerLabel: nameWithMeta(p),
    }));
    return [
      ...(suggested.length ? [{
        type: 'header',
        value: 'h-suggested',
        label: <span className={`${styles.groupLabel} ${styles.groupAi}`}><Icon name="custom:ai" size={12} /><span className={styles.aiText}>Suggested Members</span></span>,
      }, ...suggested] : []),
      ...(suggested.length && rest.length ? [{ type: 'header', value: 'h-all', label: <span className={styles.groupLabel}>All Patients</span> }] : []),
      ...rest,
    ];
  }, [patients, suggestions, suggestedIds, current, startId]);

  const received = fax?.receivedAt && new Date(fax.receivedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const docMeta = [
    fax?.senderName && `From ${fax.senderName}${fax.senderFax ? ` (${fax.senderFax})` : ''}`,
    fax?.pages && `${fax.pages} ${fax.pages === 1 ? 'page' : 'pages'}`,
    received && `Received ${received}`,
  ].filter(Boolean);

  // Which fax this is, over the fax itself.
  const docInfo = fax && (
    <div className={styles.contextDoc}>
      <span className={styles.contextDocName}>{fax.documentName}</span>
      {docMeta.length > 0 && (
        <span className={styles.contextDocMeta}>
          {docMeta.map((m, i) => (
            <span key={m}>{i > 0 && <span className={styles.contextDocDot} aria-hidden="true">•</span>}{m}</span>
          ))}
        </span>
      )}
    </div>
  );

  const form = (
    <div className={styles.contextPane}>
      {/* The pane's own header, level with the fax's details on the left. */}
      <div className={styles.contextHead}>
        <h3 className={styles.contextHeading}>Add Patient Context from Document</h3>
      </div>
      <div className={`${styles.contextBody} ${styles.contextForm}`}>
        <Select
          label="Select Patient"
          portal
          searchable
          defaultOpen={!!startId}
          placeholder="Search Patient"
          searchPlaceholder="Search patients"
          options={options}
          value={pickedId}
          onValueChange={setPickedId}
        />
        {/* Nothing picked: the suggestions sit under the field. Picked:
            Link Referral (the suggestions stay in the dropdown). */}
        {pickedId ? (
          <label className={styles.checkRow}>
            <Checkbox checked={linkReferral} onCheckedChange={v => setLinkReferral(v === true)} />
            Link Referral
          </label>
        ) : suggestions.length > 0 && (
          <SuggestedPatients boxed items={suggestions} onAdd={it => setPickedId(String(it.patient.id))} />
        )}
      </div>
    </div>
  );

  return (
    <Drawer
      title="Preview Document"
      onClose={onClose}
      noCloseDivider
      width="min(1280px, calc(100vw - 16px))"
      bodyClassName={SplitDrawerLayout.bodyClassName}
      headerRight={(
        <>
          <Button disabled={!pickedId || unchanged} onClick={() => onSave(pickedId, viaOcr, { linkReferral })}>Save</Button>
          <span className={styles.headerDivider} />
        </>
      )}
    >
      {pdf ? (
        <SplitDrawerLayout
          left={(
            <>
              {docInfo}
              <FilePreview className={styles.contextPdf} src={pdf} name={fax?.documentName} ext="pdf" />
            </>
          )}
          right={form}
        />
      ) : <>{docInfo}{form}</>}
    </Drawer>
  );
}
