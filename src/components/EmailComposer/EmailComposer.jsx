import { Fragment } from 'react';
import { Input } from '../Input/Input';
import { Icon } from '../Icon/Icon';
import { ActionButton } from '../ActionButton/ActionButton';
import { UnityIcon } from '../UnityIcon/UnityIcon';
import { Avatar } from '../Avatar/Avatar';
import styles from './EmailComposer.module.css';

const DEFAULT_NOTICE = 'Do not send PHI via email or text without verifying and obtaining consent.';

/**
 * EmailComposer — Subject line, "Compose email with UnityAI" bar, and the
 * message box (PHI notice, body, signature, toolbar) from the Communications
 * email compose design (Figma Communications 1:24499). Controlled: the host
 * owns subject / body and decides what Generate does.
 *
 * @param {object}   props
 * @param {string}   props.subject
 * @param {function} props.onSubjectChange   – (value) => void
 * @param {string}   props.body
 * @param {function} props.onBodyChange      – (value) => void
 * @param {boolean}  [props.subjectRequired=true]
 * @param {boolean}  [props.bodyRequired=false] – shows a required dot on the message label
 * @param {function} [props.onGenerate]      – shows the UnityAI bar when set
 * @param {boolean}  [props.generating]      – disables Generate while a draft is on its way
 * @param {{ name: string, lines?: string[], details?: Array<{ label: string, value: string }> }} [props.signature]
 * @param {Array<{ key: string, icon: string, tooltip: string, onClick: function }>} [props.toolbarActions]
 * @param {Array<{ key: string, name: string, meta?: string, onRemove?: function }>} [props.attachments]
 *                                            – shown as chips inside the message box
 * @param {Array<{ key: string, name: string, initials?: string, role?: string }>} [props.cc]
 *                                            – read-only CC tags (e.g. the member the email is about)
 * @param {string}   [props.footerNote]      – helper text under the message box
 * @param {boolean}  [props.footerNoteError] – renders footerNote in the error color
 * @param {string}   [props.notice]          – PHI notice text ('' hides it)
 * @param {string}   [props.placeholder='Type message here']
 */
export function EmailComposer({
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  subjectRequired = true,
  bodyRequired = false,
  onGenerate,
  generating = false,
  signature,
  toolbarActions = [],
  attachments = [],
  cc = [],
  footerNote,
  footerNoteError = false,
  notice = DEFAULT_NOTICE,
  placeholder = 'Type message here',
}) {
  return (
    <div className={styles.root}>
      {cc.length > 0 && (
        <div className={styles.field}>
          <span className={styles.label}>CC</span>
          <div className={styles.ccTags}>
            {cc.map(c => (
              <span key={c.key} className={styles.ccTag}>
                <Avatar variant="patient" size="XS" initials={c.initials || (c.name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()} />
                {c.name}
                {c.role && <span className={styles.ccRole}>{c.role}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
      <Input
        label="Subject"
        required={subjectRequired}
        value={subject}
        onChange={e => onSubjectChange(e.target.value)}
        placeholder="Enter subject"
      />

      {onGenerate && (
        <div className={styles.aiBar}>
          <UnityIcon size={16} color="var(--primary-300)" />
          <span className={styles.aiLabel}>Compose email with UnityAI</span>
          <button type="button" className={styles.aiAction} onClick={onGenerate} disabled={generating}>
            <Icon name={generating ? 'solar:refresh-linear' : 'solar:add-square-linear'} size={16} color="currentColor" className={generating ? styles.spin : undefined} />
            {generating ? 'Generating…' : 'Generate Email'}
          </button>
        </div>
      )}

      <div className={styles.field}>
        <span className={styles.label}>
          Message
          {bodyRequired && <span className={styles.required} aria-hidden="true" />}
        </span>
        <div className={styles.box}>
          {notice && (
            <div className={styles.notice}>
              <Icon name="solar:info-circle-linear" size={16} color="var(--status-warning)" />
              <span>{notice}</span>
            </div>
          )}
          <div className={styles.typeBox}>
            <div className={styles.scroll}>
              <textarea
                className={styles.textarea}
                value={body}
                onChange={e => onBodyChange(e.target.value)}
                placeholder={placeholder}
                aria-label="Message"
              />
              {signature?.name && (
                <div className={styles.signature}>
                  <span className={styles.sigDash}>--</span>
                  <span className={styles.sigName}>{signature.name}</span>
                  {(signature.lines || []).filter(Boolean).map(l => <span key={l} className={styles.sigLine}>{l}</span>)}
                  {(signature.details || []).filter(d => d.value).length > 0 && (
                    <ul className={styles.sigDetails}>
                      {signature.details.filter(d => d.value).map(d => (
                        <li key={d.label}><strong>{d.label}:</strong> {d.value}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {attachments.length > 0 && (
              <ul className={styles.attachments} aria-label="Attachments">
                {attachments.map(a => (
                  <li key={a.key} className={styles.attachment}>
                    <Icon name="solar:paperclip-linear" size={14} color="var(--neutral-300)" />
                    <span className={styles.attachmentName} title={a.name}>{a.name}</span>
                    {a.meta && <span className={styles.attachmentMeta}>{a.meta}</span>}
                    {a.onRemove && (
                      <button type="button" className={styles.attachmentRemove} onClick={a.onRemove} aria-label={`Remove ${a.name}`}>
                        <Icon name="solar:close-circle-linear" size={14} color="currentColor" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {toolbarActions.length > 0 && (
              <div className={styles.toolbar}>
                {toolbarActions.map((a, i) => (
                  <Fragment key={a.key}>
                    {i > 0 && <span className={styles.toolbarDivider} />}
                    <ActionButton size="S" icon={a.icon} tooltip={a.tooltip} onClick={a.onClick} />
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
        {footerNote && (
          <span className={[styles.footerNote, footerNoteError ? styles.footerNoteError : ''].filter(Boolean).join(' ')}>
            <Icon name="solar:info-circle-linear" size={12} color="currentColor" />
            {footerNote}
          </span>
        )}
      </div>
    </div>
  );
}
