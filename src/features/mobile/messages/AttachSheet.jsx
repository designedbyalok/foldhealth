import { forwardRef, useImperativeHandle, useRef } from 'react';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';

// What each picker accepts: the desktop Chat type box's Media and Attachment.
const ACCEPT = {
  camera: 'image/*',
  media: 'image/*,video/*',
  file: 'image/*,video/*,.pdf,.doc,.docx,.txt',
};

/**
 * The type box's attach menu (Figma 1041:38799). `media` shows Camera,
 * Photo Library and File; `share` shows Forms and Articles (into the
 * message box); `patientSend` shows Send Education and Send Assessment.
 */
export function AttachSheet({ onClose, onPick, media = false, share = false, patientSend = false }) {
  return (
    <BottomSheet title="Attach" onClose={onClose}>
      {share && <BottomSheetItem icon="solar:document-text-linear" label="Forms" onClick={() => onPick('form')} />}
      {share && <BottomSheetItem icon="solar:notebook-linear" label="Articles" onClick={() => onPick('article')} />}
      {media && <BottomSheetItem icon="solar:camera-linear" label="Camera" onClick={() => onPick('camera')} />}
      {media && <BottomSheetItem icon="solar:gallery-linear" label="Media" onClick={() => onPick('media')} />}
      {media && <BottomSheetItem icon="solar:paperclip-linear" label="File" onClick={() => onPick('file')} />}
      {patientSend && <BottomSheetItem icon="solar:book-2-linear" label="Send Education" onClick={() => onPick('education')} />}
      {patientSend && <BottomSheetItem icon="solar:clipboard-check-linear" label="Send Assessment" onClick={() => onPick('assessment')} />}
    </BottomSheet>
  );
}

/** Hidden file inputs; `ref.current.open('camera' | 'media' | 'file')` opens the phone's picker. */
export const FileInputs = forwardRef(function FileInputs({ onFiles }, ref) {
  const input = useRef(null);
  useImperativeHandle(ref, () => ({
    open(kind) {
      const el = input.current;
      if (!el || !ACCEPT[kind]) return;
      el.accept = ACCEPT[kind];
      // Camera opens the phone's camera straight away; the others the library / files.
      if (kind === 'camera') el.setAttribute('capture', 'environment');
      else el.removeAttribute('capture');
      el.multiple = kind !== 'camera';
      el.click();
    },
  }), []);
  return (
    <input
      ref={input}
      type="file"
      hidden
      aria-hidden="true"
      data-testid="attach-input"
      onChange={(e) => { onFiles([...(e.target.files || [])]); e.target.value = ''; }}
    />
  );
});
