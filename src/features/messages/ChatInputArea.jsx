import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { getDisplayName } from './messageUtils';
import styles from './MessagesView.module.css';

export function ChatInputArea({
  currentUser,
  otherUser,
  inputValue,
  replyTo,
  dragOver,
  sending,
  uploading,
  textareaRef,
  fileInputRef,
  onInput,
  onKeyDown,
  onSend,
  onClearReply,
  onDragOver,
  onDragLeave,
  onDrop,
  onAttachClick,
  onImageClick,
  onFormPickerOpen,
  onFileSelect,
}) {
  const displayName = getDisplayName(otherUser);

  return (
    <div
      className={[styles.chatInput, dragOver ? styles.dragOver : ''].filter(Boolean).join(' ')}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {replyTo && (
        <div className={styles.replyPreview}>
          <div className={styles.replyPreviewBar} />
          <div className={styles.replyPreviewContent}>
            <div className={styles.replyPreviewName}>
              {replyTo.sender_id === currentUser.id ? 'You' : displayName}
            </div>
            <div className={styles.replyPreviewText}>{replyTo.content || '📎 Media'}</div>
          </div>
          <button className={styles.replyPreviewClose} onClick={onClearReply} aria-label="Cancel reply">
            <Icon name="solar:close-circle-bold" size={16} />
          </button>
        </div>
      )}

      <div className={styles.chatInputToolbar}>
        <span className={styles.chatInputSwitch}>
          <div className={styles.switchTrack}><div className={styles.switchThumb} /></div>
          <span className={styles.switchLabel}>Internal</span>
        </span>
        <div className={styles.chatInputActions}>
          <ActionButton icon="solar:paperclip-linear"          size="S" tooltip="Attach file" onClick={onAttachClick} />
          <ActionButton icon="solar:emoji-funny-square-linear" size="S" tooltip="Emoji" />
          <ActionButton icon="solar:gallery-add-linear"        size="S" tooltip="Image" onClick={onImageClick} />
          <ActionButton icon="solar:clipboard-text-linear"     size="S" tooltip="Share a form" onClick={onFormPickerOpen} />
          <ActionButton icon="solar:clock-circle-linear"       size="S" tooltip="Schedule" />
        </div>
      </div>

      <div className={styles.chatInputRow}>
        <textarea
          ref={textareaRef}
          className={styles.chatInputBox}
          placeholder={dragOver ? 'Drop to send…' : 'Visible to everyone • Shift+Enter to change the line'}
          value={inputValue}
          onChange={onInput}
          onKeyDown={onKeyDown}
          rows={1}
        />
        <Button
          variant="primary"
          size="L"
          iconOnly
          leadingIcon="solar:plain-2-bold"
          disabled={(!inputValue.trim() && !uploading) || sending || uploading}
          onClick={onSend}
        />
      </div>

      <div className={styles.chatInputFooter}>
        <span style={{ fontSize: 12, color: 'var(--neutral-300)' }}>
          Press Enter to send •{' '}
          <span style={{ color: 'var(--primary-300)', cursor: 'pointer' }}>Change</span>
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--neutral-300)', cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 14, height: 14, accentColor: 'var(--primary-300)' }} />
          Archive on send
        </label>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.txt"
        style={{ display: 'none' }}
        onChange={e => { onFileSelect(e.target.files[0]); e.target.value = ''; }}
      />
    </div>
  );
}
