import { useMemo, useState } from 'react';
import { Drawer } from '../Drawer/Drawer';
import { Button } from '../Button/Button';
import { Input } from '../Input/Input';
import { Textarea } from '../Textarea/Textarea';
import { Select } from '../Select/Select';
import { useAppStore } from '../../store/useAppStore';
import { useReviewerOptions } from './featureReviewHooks';
import styles from './FeatureReviewsDrawer.module.css';

/** Add a feature, or a sub-item when `parentId` is set. Managers only. */
export function FeatureReviewForm({ parentId: initialParentId = null, onClose, onDone }) {
  const reviews = useAppStore(s => s.featureReviews);
  const addFeatureReview = useAppStore(s => s.addFeatureReview);
  const { options, byEmail } = useReviewerOptions();
  const parent = reviews.find(r => r.id === initialParentId);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState(parent?.kind || 'feature');
  const [parentId, setParentId] = useState(initialParentId || '');
  const [area, setArea] = useState(parent?.area || '');
  const [link, setLink] = useState(() => parent?.link || window.location.hash || '');
  const [description, setDescription] = useState('');
  const [reviewerEmails, setReviewerEmails] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const parentOptions = useMemo(() => [
    { value: '', label: 'None (top-level feature)' },
    ...reviews.filter(r => !r.parentId).map(r => ({ value: r.id, label: r.title })),
  ], [reviews]);
  const linkValid = !link || link.startsWith('#/');

  const save = async () => {
    if (!title.trim() || !reviewerEmails.length || !linkValid) { setShowErrors(true); return; }
    setSaving(true);
    const id = await addFeatureReview({
      title: title.trim(),
      kind,
      area: area.trim(),
      link: link.trim(),
      description: description.trim(),
      parentId: parentId || null,
      reviewers: reviewerEmails.map(e => byEmail.get(e)).filter(Boolean),
    });
    setSaving(false);
    if (id) onDone(id);
  };

  return (
    <Drawer
      title={initialParentId ? 'Add Sub-item' : 'Add Feature'}
      onClose={onClose}
      noCloseDivider
      closeOnOverlayClick={false}
      headerRight={(
        <>
          <Button variant="secondary" size="S" onClick={() => onDone(null)} disabled={saving}>Cancel</Button>
          <Button variant="primary" size="S" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          <span className={styles.headerDivider} />
        </>
      )}
    >
      <div className={styles.form}>
        <Input
          label="Feature"
          required
          placeholder="e.g. Pharmacy worklist filters"
          value={title}
          onChange={e => setTitle(e.target.value)}
          errorText={showErrors && !title.trim() ? 'Name the feature' : undefined}
        />
        <Select
          label="Type"
          options={[{ value: 'feature', label: 'Feature' }, { value: 'fix', label: 'Bug fix' }]}
          value={kind}
          onChange={setKind}
        />
        <Select
          label="Reviewers"
          required
          multiple
          badges
          checkboxes
          searchable
          placeholder="Select who signs off"
          options={options}
          value={reviewerEmails}
          onChange={setReviewerEmails}
          errorText={showErrors && !reviewerEmails.length ? 'Assign at least one reviewer' : undefined}
        />
        <Select
          label="Part of"
          searchable
          options={parentOptions}
          value={parentId}
          onChange={setParentId}
        />
        <Input
          label="Area"
          placeholder="e.g. Population · Pharmacy"
          value={area}
          onChange={e => setArea(e.target.value)}
        />
        <Input
          label="Link to section"
          placeholder="#/population/pharmacy"
          helperText="The page the reviewer should open. Defaults to the page you're on."
          value={link}
          onChange={e => setLink(e.target.value)}
          errorText={showErrors && !linkValid ? 'Use an in-app link starting with #/' : undefined}
        />
        <Textarea
          title="What changed"
          rows={4}
          placeholder="What the reviewer should check"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
    </Drawer>
  );
}
