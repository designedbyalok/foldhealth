import { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../components/Icon/Icon';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { useAppStore } from '../../../store/useAppStore';
import { SimpleTableSkeleton } from '../../../components/SimpleTableSkeleton/SimpleTableSkeleton';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { AuditLogDrawer } from '../shared/AuditLogDrawer';

const thStyle = {
  textAlign: 'left', padding: '8px 16px', color: 'var(--neutral-300)', fontWeight: 500,
  fontSize: 'var(--font-sm)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--neutral-150)',
  background: 'var(--neutral-0)', position: 'sticky', top: 0,
};
const tdStyle = { padding: '10px 16px', fontSize: 'var(--font-md)', color: 'var(--neutral-400)', verticalAlign: 'middle' };

function RowActionMenu({ group, onClose, onEdit, onRequestDelete }) {
  return (
    <div style={{
      background: 'var(--neutral-0)', borderRadius: 8, border: '0.5px solid var(--neutral-150)',
      boxShadow: '0 4px 16px rgba(0,0,0,.10)', minWidth: 160, padding: '4px 0',
      fontFamily: "'Inter', sans-serif",
    }} onClick={e => e.stopPropagation()}>
      <button style={{
        width: '100%', padding: '8px 14px', border: 'none', background: 'none',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 'var(--font-md)', color: 'var(--neutral-400)', textAlign: 'left',
      }} onMouseOver={e => e.currentTarget.style.background = 'var(--neutral-50)'}
        onMouseOut={e => e.currentTarget.style.background = 'none'}
        onClick={() => { onEdit(); onClose(); }}>
        <Icon name="solar:pen-linear" size={16} color="var(--neutral-300)" />
        Edit Group
      </button>
      <div style={{ height: 1, background: 'var(--neutral-100)', margin: '4px 0' }} />
      <button style={{
        width: '100%', padding: '8px 14px', border: 'none', background: 'none',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 'var(--font-md)', color: 'var(--status-error)', textAlign: 'left',
      }} onMouseOver={e => e.currentTarget.style.background = 'var(--status-error-light)'}
        onMouseOut={e => e.currentTarget.style.background = 'none'}
        onClick={() => { onClose(); onRequestDelete(); }}>
        <Icon name="solar:trash-bin-minimalistic-linear" size={16} color="var(--status-error)" />
        Delete Group
      </button>
    </div>
  );
}

function ChatGroupRow({ g, onOpen }) {
  const showToast = useAppStore(s => s.showToast);
  const deleteChatGroup = useAppStore(s => s.deleteChatGroup);
  const setChatGroupDetailId = useAppStore(s => s.setChatGroupDetailId);

  const [auditDrawerEntity, setAuditDrawerEntity] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const moreBtnRef = useRef(null);

  const handleMoreClick = (e) => {
    e.stopPropagation();
    const btn = moreBtnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const menuH = 100;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      setMenuPos({
        top: spaceBelow < menuH ? Math.max(8, rect.top - menuH) : rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setMenuOpen(v => !v);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (moreBtnRef.current && !moreBtnRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  return (
    <tr
      style={{ borderBottom: '1px solid var(--neutral-100)', cursor: 'pointer', transition: 'background .1s' }}
      onClick={() => onOpen(g.id)}
      onMouseOver={e => e.currentTarget.style.background = 'var(--primary-25)'}
      onMouseOut={e => e.currentTarget.style.background = ''}
    >
      <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--neutral-500)' }}>
        {g.name}
      </td>
      <td style={tdStyle}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-md)', color: 'var(--neutral-400)' }}>
          <Icon name="solar:users-group-rounded-linear" size={14} color="var(--neutral-300)" />
          {g.activeChats}
        </span>
      </td>
      <td style={tdStyle}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {g.users.slice(0, 1).map((u, i) => (
            <span key={i} style={{ fontSize: 'var(--font-md)', color: 'var(--neutral-400)' }}>{u}</span>
          ))}
          {(g.users.length + g.roles.length) > 1 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '1px 6px', borderRadius: 4, fontSize: 'var(--font-xs)', fontWeight: 500,
              color: 'var(--primary-300)', background: 'var(--primary-50, #F5F0FF)',
              border: '0.5px solid var(--primary-200)',
            }}>
              <Icon name="solar:users-group-rounded-linear" size={10} color="var(--primary-300)" />
              +{g.users.length + g.roles.length - 1}
            </span>
          )}
        </div>
      </td>
      <td style={{ ...tdStyle, fontSize: 'var(--font-md)', color: 'var(--neutral-400)' }}>{g.location}</td>
      <td style={{ ...tdStyle, fontSize: 'var(--font-md)', color: 'var(--neutral-400)' }}>
        {g.updated} by {g.updatedBy}
      </td>
      <td style={tdStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ActionButton icon="solar:pen-linear" tooltip="Edit group"
            onClick={() => setChatGroupDetailId(g.id)} />
          <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
          <ActionButton icon="solar:history-linear" tooltip="Audit Log"
            onClick={() => setAuditDrawerEntity({ type: 'ChatGroup', name: g.name, id: g.id })} />
          <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
          <ActionButton icon="solar:menu-dots-linear" tooltip="More options"
            ref={moreBtnRef} onClick={handleMoreClick} />
        </div>
        {menuOpen && createPortal(
          <div style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}>
            <RowActionMenu
              group={g}
              onClose={() => setMenuOpen(false)}
              onEdit={() => setChatGroupDetailId(g.id)}
              onRequestDelete={() => setShowDeleteConfirm(true)}
            />
          </div>,
          document.body
        )}
        {showDeleteConfirm && (
          <ConfirmDialog
            icon="solar:danger-triangle-linear"
            iconColor="var(--status-error)"
            title={`Delete "${g.name}"`}
            description="Are you sure you want to delete this chat group? All messages, participants, and agent rules will be permanently removed. This action cannot be undone."
            confirmLabel="Delete Group"
            cancelLabel="Cancel"
            variant="error"
            loading={deleting}
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={async () => {
              setDeleting(true);
              try {
                await deleteChatGroup(g.id);
                showToast(`"${g.name}" deleted`);
              } finally {
                setDeleting(false);
              }
              setShowDeleteConfirm(false);
            }}
          />
        )}
        {auditDrawerEntity && <AuditLogDrawer entity={auditDrawerEntity} onClose={() => setAuditDrawerEntity(null)} />}
      </td>
    </tr>
  );
}

export function ChatSettingsPanel({ searchQuery = '' }) {
  const setChatGroupDetailId = useAppStore(s => s.setChatGroupDetailId);
  const chatGroupsData = useAppStore(s => s.chatGroupsData) || [];
  const chatGroupsLoading = useAppStore(s => s.chatGroupsLoading);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return chatGroupsData;
    const q = searchQuery.toLowerCase();
    return chatGroupsData.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.users.some(u => u.toLowerCase().includes(q)) ||
      (g.agentName || '').toLowerCase().includes(q)
    );
  }, [chatGroupsData, searchQuery]);

  if (chatGroupsLoading) {
    return <SimpleTableSkeleton rows={6} cols={6} />;
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Inter', sans-serif" }}>
      <thead>
        <tr>
          <th style={thStyle}>Group Name</th>
          <th style={thStyle}>Active Chat Groups</th>
          <th style={thStyle}>Group Users</th>
          <th style={{ ...thStyle, cursor: 'pointer' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Location <Icon name="solar:sort-vertical-linear" size={12} color="var(--neutral-200)" />
            </span>
          </th>
          <th style={thStyle}>Last Updated</th>
          <th style={thStyle}>Action</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map(g => (
          <ChatGroupRow key={g.id} g={g} onOpen={setChatGroupDetailId} />
        ))}
        {filtered.length === 0 && (
          <tr>
            <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--neutral-200)' }}>
              <Icon name="solar:chat-square-linear" size={32} color="var(--neutral-200)" />
              <div style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-300)', marginTop: '0.5rem' }}>No groups found</div>
              <div style={{ fontSize: 'var(--font-md)', marginTop: 4 }}>Try adjusting your search or create a new group.</div>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
