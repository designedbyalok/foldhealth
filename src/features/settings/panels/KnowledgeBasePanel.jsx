import { useState, useEffect, useMemo, useId } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Drawer } from '../../../components/Drawer/Drawer';
import { useAppStore } from '../../../store/useAppStore';
import { SimpleTableSkeleton } from '../../../components/SimpleTableSkeleton/SimpleTableSkeleton';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';

const CATEGORY_BADGE = {
  General: 'ai-care',
  Appointments: 'outreach-appointment',
  Medications: 'ai-med',
  Labs: 'compliance-warn',
  Compliance: 'ai-risk',
};

const CATEGORIES = ['General', 'Appointments', 'Medications', 'Labs', 'Compliance'];

const thStyle = {
  textAlign: 'left', padding: '8px 16px', color: 'var(--neutral-300)', fontWeight: 500,
  fontSize: 12, whiteSpace: 'nowrap', borderBottom: '1px solid var(--neutral-150)',
  background: 'var(--neutral-0)', position: 'sticky', top: 0,
};
const tdStyle = { padding: '10px 16px', fontSize: 13, color: 'var(--neutral-400)', verticalAlign: 'top', borderBottom: '0.5px solid var(--neutral-100)' };

const fieldLabel = { fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)', marginBottom: 6, display: 'block' };
const fieldInput = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '0.5px solid var(--neutral-150)',
  fontSize: 14, fontFamily: "'Inter', sans-serif", color: 'var(--neutral-400)', outline: 'none',
  transition: 'border-color .15s',
};
const fieldTextarea = {
  ...fieldInput, minHeight: 100, resize: 'vertical', lineHeight: 1.5,
};
const fieldSelect = {
  ...fieldInput, background: 'var(--neutral-0)', cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%236F7A90' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
  paddingRight: 32,
};
const fieldGroup = { marginBottom: 20 };

function FaqDrawer({ mode, faq, onClose, onSave, saving }) {
  const uid = useId();
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    question: faq?.question || '',
    answer: faq?.answer || '',
    category: faq?.category || 'General',
  });

  const canSave = form.question.trim() && form.answer.trim();

  const headerRight = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Button
        variant="primary"
        size="S"
        onClick={() => canSave && onSave(form)}
        disabled={!canSave || saving}
        style={{ opacity: saving ? 0.6 : 1 }}
      >
        {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add FAQ'}
      </Button>
    </div>
  );

  return (
    <Drawer
      title={isEdit ? 'Edit FAQ' : 'New FAQ'}
      onClose={onClose}
      headerRight={headerRight}
    >
      <div style={fieldGroup}>
        <label style={fieldLabel} htmlFor={`${uid}-question`}>Question</label>
        <input
          id={`${uid}-question`}
          style={fieldInput}
          placeholder="e.g. What is Transitional Care Management?"
          value={form.question}
          onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
          onFocus={e => e.target.style.borderColor = 'var(--primary-200)'}
          onBlur={e => e.target.style.borderColor = 'var(--neutral-150)'}
        />
      </div>

      <div style={fieldGroup}>
        <label style={fieldLabel} htmlFor={`${uid}-answer`}>Answer</label>
        <textarea
          id={`${uid}-answer`}
          style={fieldTextarea}
          placeholder="Provide a clear, helpful answer…"
          value={form.answer}
          onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
          onFocus={e => e.target.style.borderColor = 'var(--primary-200)'}
          onBlur={e => e.target.style.borderColor = 'var(--neutral-150)'}
        />
      </div>

      <div style={fieldGroup}>
        <label style={fieldLabel} htmlFor={`${uid}-category`}>Category</label>
        <select
          id={`${uid}-category`}
          style={fieldSelect}
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Preview */}
      {form.question.trim() && (
        <div style={{
          marginTop: 8, padding: 16, borderRadius: 10,
          background: 'var(--neutral-25, #FAFBFF)', border: '0.5px solid var(--neutral-100)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--neutral-200)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Preview</div>
          <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--neutral-500)', marginBottom: 6 }}>{form.question}</div>
          {form.answer.trim() && <div style={{ fontSize: 13, color: 'var(--neutral-300)', lineHeight: 1.5 }}>{form.answer}</div>}
          <div style={{ marginTop: 10 }}>
            <Badge variant={CATEGORY_BADGE[form.category] || 'ai-neutral'} label={form.category} />
          </div>
        </div>
      )}
    </Drawer>
  );
}

export function KnowledgeBasePanel({ searchQuery = '' }) {
  const faqsData = useAppStore(s => s.faqsData);
  const fetchFaqs = useAppStore(s => s.fetchFaqs);
  const addFaq = useAppStore(s => s.addFaq);
  const updateFaq = useAppStore(s => s.updateFaq);
  const deleteFaq = useAppStore(s => s.deleteFaq);
  const showToast = useAppStore(s => s.showToast);

  const [drawerMode, setDrawerMode] = useState(null); // null | 'add' | 'edit'
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchFaqs(); }, [fetchFaqs]);
  const faqs = faqsData || [];
  const isLoading = !faqsData;

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    const q = searchQuery.toLowerCase();
    return faqs.filter(f =>
      f.question.toLowerCase().includes(q) ||
      f.answer.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q)
    );
  }, [faqs, searchQuery]);

  // Listen for "add new" trigger from parent (AgentsTable)
  const kbAddTrigger = useAppStore(s => s.kbAddTrigger);
  const setKbAddTrigger = useAppStore(s => s.setKbAddTrigger);
  useEffect(() => {
    if (kbAddTrigger) {
      setDrawerMode('add');
      setEditTarget(null);
      setKbAddTrigger?.(false);
    }
  }, [kbAddTrigger, setKbAddTrigger]);

  const handleOpenEdit = (faq) => {
    setEditTarget(faq);
    setDrawerMode('edit');
  };

  const handleDrawerSave = async (form) => {
    setSaving(true);
    try {
      if (drawerMode === 'edit' && editTarget) {
        await updateFaq(editTarget.id, {
          question: form.question,
          answer: form.answer,
          category: form.category,
        });
        showToast('FAQ updated');
      } else {
        await addFaq(form);
        showToast('FAQ added');
      }
    } finally {
      setSaving(false);
    }
    setDrawerMode(null);
    setEditTarget(null);
  };

  const handleCloseDrawer = () => {
    setDrawerMode(null);
    setEditTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFaq(deleteTarget.id);
      showToast('FAQ deleted');
    } finally {
      setDeleting(false);
    }
    setDeleteTarget(null);
  };

  if (isLoading) {
    return <SimpleTableSkeleton rows={5} cols={4} />;
  }

  return (
    <>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Inter', sans-serif" }}>
        <thead>
          <tr>
            <th style={thStyle}>Question</th>
            <th style={thStyle}>Category</th>
            <th style={thStyle}>Last Updated</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--neutral-200)' }}>
              <Icon name="solar:book-linear" size={32} color="var(--neutral-150)" />
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-300)', marginTop: 8 }}>No FAQ articles found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                {searchQuery.trim() ? 'Try adjusting your search.' : 'Add your first FAQ to help patients and agents.'}
              </div>
            </td></tr>
          )}
          {filtered.map(faq => (
            <tr key={faq.id}
              style={{ cursor: 'pointer', transition: 'background .1s' }}
              onClick={() => handleOpenEdit(faq)}
              onMouseOver={e => e.currentTarget.style.background = 'var(--primary-25, #faf8ff)'}
              onMouseOut={e => e.currentTarget.style.background = ''}
            >
              <td style={tdStyle}>
                <div style={{ fontWeight: 500, marginBottom: 4, color: 'var(--neutral-500)' }}>{faq.question}</div>
                <div style={{ fontSize: 12, color: 'var(--neutral-200)', lineHeight: 1.4 }}>{faq.answer}</div>
              </td>
              <td style={tdStyle}>
                <Badge variant={CATEGORY_BADGE[faq.category] || 'ai-neutral'} label={faq.category} />
              </td>
              <td style={{ ...tdStyle, fontSize: 12, color: 'var(--neutral-200)', whiteSpace: 'nowrap' }}>{faq.updatedAt}</td>
              <td style={tdStyle} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ActionButton icon="solar:pen-linear" size="L" tooltip="Edit FAQ"
                    onClick={() => handleOpenEdit(faq)} />
                  <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
                  <ActionButton icon="solar:trash-bin-minimalistic-linear" size="L" tooltip="Delete FAQ"
                    onClick={() => setDeleteTarget(faq)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add / Edit Drawer */}
      {drawerMode && (
        <FaqDrawer
          mode={drawerMode}
          faq={editTarget}
          onClose={handleCloseDrawer}
          onSave={handleDrawerSave}
          saving={saving}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title="Delete FAQ"
          description={`Are you sure you want to delete "${deleteTarget.question}"? This action cannot be undone.`}
          confirmLabel="Delete FAQ"
          cancelLabel="Cancel"
          variant="error"
          loading={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
