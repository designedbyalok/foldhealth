import { useState } from 'react';
import { Input } from '../../../components/Input/Input';

// Note saves when the field loses focus (or on Enter), if it changed.
// Key it by the saved note so a save elsewhere resets the draft.
export function DoseNoteInput({ saved, label, onSave }) {
  const [text, setText] = useState(saved);
  const commit = () => { if (text.trim() !== saved) onSave(text); };
  return (
    <Input
      variant="ghost"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      placeholder="Add a note"
      aria-label={label}
    />
  );
}
