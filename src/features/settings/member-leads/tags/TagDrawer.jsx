import { useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Input } from '../../../../components/Input/Input';
import { Textarea } from '../../../../components/Textarea/Textarea';
import { ColorDotButton } from '../../../../components/ColorPicker/ColorPicker';
import { toast } from '../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../store/useAppStore';
import { DEFAULT_TAG_COLOR, TAG_COLOR_SUGGESTIONS } from './contactTags';
import styles from './Tags.module.css';

/**
 * Add / edit a member tag (Figma Settings 1:6384): name, with the tag's
 * colour as a dot at the end of the field (it opens the colour picker), and
 * description.
 *
 * @param {object|null} props.tag – the tag to edit; null adds one
 * @param {() => void} props.onClose
 */
export function TagDrawer({ tag, onClose }) {
  const tags = useAppStore(s => s.contactTags);
  const saveContactTag = useAppStore(s => s.saveContactTag);
  const [name, setName] = useState(tag?.name || '');
  const [description, setDescription] = useState(tag?.description || '');
  const [color, setColor] = useState(tag?.color || DEFAULT_TAG_COLOR);
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const taken = tags.some(t => t.id !== tag?.id && t.name.toLowerCase() === trimmed.toLowerCase());
  const canSave = !!trimmed && !!description.trim() && !taken && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const saved = await saveContactTag({ id: tag?.id, name: trimmed, description: description.trim(), color });
    setSaving(false);
    if (!saved) { toast.error('The tag could not be saved. Try again.'); return; }
    toast.success(tag ? 'Tag Updated Successfully' : 'Tag Created Successfully');
    onClose();
  };

  return (
    <Drawer
      title={tag ? 'Edit Tag' : 'Add Tag'}
      onClose={onClose}
      primaryAction={(
        <Button
          onClick={save}
          disabled={!canSave}
          disabledReason={!trimmed ? 'Add a tag name' : taken ? 'A tag with this name already exists' : !description.trim() ? 'Add a description' : null}
        >
          {tag ? 'Save' : 'Create'}
        </Button>
      )}
    >
      <div className={styles.form}>
        <Input
          label="Tag Name"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Enter tag name"
          maxLength={40}
          errorText={taken ? 'A tag with this name already exists.' : undefined}
          trailingElement={<ColorDotButton value={color} onChange={setColor} suggestions={TAG_COLOR_SUGGESTIONS} ariaLabel="Tag color" />}
        />
        <Textarea
          title="Tag Description"
          mandatory
          value={description}
          onValueChange={setDescription}
          placeholder="What is this tag for?"
          rows={4}
        />
      </div>
    </Drawer>
  );
}
