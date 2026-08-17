import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { Drawer } from '../../components/Drawer/Drawer';
import { UpdatePopGroupDrawer } from './UpdatePopGroupDrawer';
import { PopulationGroupsCreateDrawerWide } from './PopulationGroupsCreateDrawerWide.jsx';
import { PopulationGroupsCreateDrawerForm } from './PopulationGroupsCreateDrawerForm.jsx';

const ConfigProvider = ({ children }) => <>{children}</>;
const DangerCircleLinear = ({ size = 16, color = 'currentColor', style }) => (
  <Icon name="solar:danger-circle-linear" size={size} color={color} style={style} />
);

export function PopulationGroupsCreateDrawer({ vm, onMemberAdded, onGroupCreated }) {
  const {
    modalOpen, editGroupId, isCsvMode, uploadState, canSave, isDirty,
    showCloseConfirm, setShowCloseConfirm, showSaveConfirm, setShowSaveConfirm,
    editingGroup, setEditingGroup, closeModal, saveGroup, updatePopGroup, showToast,
  } = vm;

  return (
    <>
      {modalOpen && (
        <Drawer
          title={editGroupId ? 'Edit Audience Group' : 'Create Audience Group'}
          onClose={() => {
            if (editGroupId) {
              if (isDirty) setShowSaveConfirm(true);
              else closeModal();
            } else if (isCsvMode && (uploadState === 'loading' || uploadState === 'complete')) {
              setShowCloseConfirm(true);
            } else {
              closeModal();
            }
          }}
          headerRight={(
            <>
              <Button variant="primary" size="L" disabled={!canSave} onClick={() => { if (canSave) saveGroup(); }}>
                {editGroupId ? 'Save' : 'Create'}
              </Button>
              <span className="pg-header-divider" />
            </>
          )}
          noCloseDivider
          className={`pg-create-panel${(isCsvMode && (uploadState === 'loading' || uploadState === 'complete')) ? ' pg-create-panel--wide' : ''}`}
          bodyClassName="pg-create-body"
        >
          <ConfigProvider theme={{ token: { fontFamily: 'Inter, sans-serif' } }}>
            {isCsvMode && (uploadState === 'loading' || uploadState === 'complete') ? (
              <PopulationGroupsCreateDrawerWide vm={vm} onMemberAdded={onMemberAdded} />
            ) : (
              <PopulationGroupsCreateDrawerForm vm={vm} />
            )}
          </ConfigProvider>
        </Drawer>
      )}

      {editingGroup && (
        <UpdatePopGroupDrawer
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onSubmit={async ({ name, description, members }) => {
            // Only the fields this drawer actually edits may change. It used
            // to hardcode filterType to 'static-csv' and derive the counts
            // from the chips, so renaming a Dynamic group silently converted
            // it to a CSV group and zeroed its active/inactive counts — the
            // edit persisted, but persisted the wrong row. A Dynamic group's
            // membership comes from its rule, not from this drawer.
            const isStatic = (editingGroup.type || 'Static') === 'Static';
            // The chips only own membership when there is a member list to
            // edit, or the user actually picked some. Otherwise a group whose
            // count came from elsewhere (a rule, an import) would have it
            // zeroed just by opening the drawer and pressing Submit.
            const hasMemberList = (editingGroup.memberIds || []).length > 0;
            const chipsOwnMembership = isStatic && (hasMemberList || members.length > 0);
            const saved = await updatePopGroup(editingGroup.id, {
              name,
              description,
              type: editingGroup.type || 'Static',
              filterType: editingGroup.filterType || null,
              memberStatus: editingGroup.memberStatus || 'All Status',
              memberIds: chipsOwnMembership ? members.map(m => m.id) : (editingGroup.memberIds || []),
              count: chipsOwnMembership ? members.length : (editingGroup.count ?? 0),
              inactive: editingGroup.inactive ?? 0,
            });
            if (!saved) return;
            onGroupCreated?.(name);
            showToast('Population Group Updated Successfully');
            setEditingGroup(null);
          }}
        />
      )}

      {showCloseConfirm && (
        <>
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.25)', zIndex:10000 }} onClick={() => setShowCloseConfirm(false)} />
          <div
            onClick={e => e.stopPropagation()}
            style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:340, background:'var(--neutral-0)', borderRadius:12, border:'0.5px solid var(--neutral-100)', padding:20, boxShadow:'0 4px 20px rgba(0,0,0,0.14)', zIndex:10001, display:'flex', flexDirection:'column', alignItems:'center', gap:16, fontFamily:'Inter,sans-serif' }}
          >
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, width:'100%' }}>
              <DangerCircleLinear size={18} color="var(--status-error)" />
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, width:'100%' }}>
                <span style={{ fontSize:16, fontWeight:500, color:'var(--neutral-400)', textAlign:'center' }}>Quit without saving?</span>
                <p style={{ fontSize:14, color:'var(--neutral-200)', textAlign:'center', lineHeight:1.5, margin:0 }}>
                  You will need to reupload the file if you quit now. Any progress will be lost.
                </p>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, width:'100%' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <Button variant="secondary" size="L" fullWidth onClick={() => setShowCloseConfirm(false)}>Cancel</Button>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <Button variant="danger" size="L" fullWidth onClick={() => { setShowCloseConfirm(false); closeModal(); }}>Quit Anyway</Button>
              </div>
            </div>
          </div>
        </>
      )}

      {showSaveConfirm && (
        <>
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.25)', zIndex:10000 }} onClick={() => setShowSaveConfirm(false)} />
          <div
            onClick={e => e.stopPropagation()}
            style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:440, maxWidth:'calc(100vw - 32px)', background:'var(--neutral-0)', borderRadius:12, border:'0.5px solid var(--neutral-100)', padding:20, boxShadow:'0 4px 20px rgba(0,0,0,0.14)', zIndex:10001, display:'flex', flexDirection:'column', gap:16, fontFamily:'Inter,sans-serif' }}
          >
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                <span style={{ fontSize:16, fontWeight:500, color:'var(--neutral-400)' }}>Save Changes ?</span>
                <CloseButton size={20} onClick={() => setShowSaveConfirm(false)} />
              </div>
              <p style={{ margin:0, fontSize:14, color:'var(--neutral-200)', lineHeight:1.5 }}>
                Please confirm to save the changes you made for this population group.
              </p>
            </div>
            <div style={{ display:'flex', gap:8, width:'100%' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <Button variant="secondary" size="L" fullWidth onClick={() => { setShowSaveConfirm(false); closeModal(); }}>Discard</Button>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <Button variant="primary" size="L" fullWidth onClick={() => { setShowSaveConfirm(false); saveGroup(); }}>Save Changes</Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
