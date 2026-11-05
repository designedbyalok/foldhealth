import { useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { CommentsTimeline } from '../../hcc/DiagPanel/LeftWorkspace';
import { currentAuthor, mentionProfileIds } from '../../hcc/DiagPanel/commentAuthor';

const pad = (n) => String(n).padStart(2, '0');

// The member's comments, in the same timeline as the HCC Comments tab. They
// are saved on the member's row (see addPharmacyComment).
export function PharmacyCommentsTab({ member }) {
  const addPharmacyComment = useAppStore(s => s.addPharmacyComment);
  const editPharmacyComment = useAppStore(s => s.editPharmacyComment);
  const deletePharmacyComment = useAppStore(s => s.deletePharmacyComment);
  const platformUsers = useAppStore(s => s.platformUsers);

  // Anyone on the platform can be @-mentioned; the member's assignee first.
  const mentionUsers = useMemo(() => (platformUsers || [])
    .filter(u => u?.name)
    .map(u => ({ id: u.id, name: u.name, initials: u.initials, role: (u.clinicalRoles || [])[0], realProfile: true }))
    .toSorted((a, b) => (b.name === member.assigneeName) - (a.name === member.assigneeName) || a.name.localeCompare(b.name)),
  [platformUsers, member.assigneeName]);

  const add = (body, mentions) => {
    if (!body) return;
    const me = useAppStore.getState().currentUserProfile;
    const { author, authorId } = currentAuthor(me);
    const now = new Date();
    const hours = now.getHours();
    addPharmacyComment(member.id, {
      id: `pc${now.getTime()}`,
      author: author || 'Unknown author',
      authorId,
      role: (me?.clinicalRoles || [])[0] || 'Care Team',
      date: `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`,
      time: `${((hours + 11) % 12) + 1}:${pad(now.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`,
      body,
      mentionIds: mentionProfileIds(mentions),
    });
  };

  return (
    <CommentsTimeline
      items={member.comments || []}
      mentionUsers={mentionUsers}
      onAdd={add}
      onEdit={(id, body, mentions) => editPharmacyComment(member.id, id, body, mentionProfileIds(mentions))}
      onDelete={(id) => deletePharmacyComment(member.id, id)}
    />
  );
}
