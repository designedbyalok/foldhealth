import { useEffect, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { BulkBar } from '../../../components/BulkBar/BulkBar';
import { CloseIcon } from '../../../components/Icon/CloseIcon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { LeftWorkspace } from './LeftWorkspace';
import { RejectRecordDialog } from './DiagPanelRejectDialog';
import { RecordsRequestDialog } from './RecordsRequestDialog';
import { DiagPanelViewHeader } from './DiagPanelViewHeader';
import { DiagPanelViewToolbar } from './DiagPanelViewToolbar';
import { DiagPanelViewCards } from './DiagPanelViewCards';
import { useAppStore } from '../../../store/useAppStore';
import { openDiagInSidePanel, returnDiagToDrawer } from './diagPanelSplit';
import styles from './DiagPanel.module.css';

export function DiagPanelView(props) {
  const {
    embedded = false,
    member,
    closeDiagPanel,
    diagLeftPanel,
    contentRowRef,
    diagActivityIcd,
    activeIcdCode,
    setDiagTab,
    setFocusIdx,
    setDiagLeftPanel,
    startResize,
    rhsWidth,
    bulkMode,
    selectedKeys,
    setSelectedKeys,
    bulkApply,
    bulkUndo,
    openDocsFromToolbar,
    rejectPrompt,
    setRejectPrompt,
    confirmReject,
    recordsRequestPrompt,
    recordsRequestSupportUser,
    confirmRecordsRequest,
    cancelRecordsRequest,
  } = props;

  // Progressive expansion: the drawer opens at right-pane-only width first
  // (LeftWorkspace mounted but at 0 width thanks to flex), then widens
  // leftward. As the drawer's width transition runs, LeftWorkspace fills
  // the newly-opened left space via `flex: 1 1 auto`. No slide, no gap.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!diagLeftPanel) { setExpanded(false); return; }
    const t = setTimeout(() => setExpanded(true), 260);
    return () => clearTimeout(t);
  }, [diagLeftPanel]);
  const initialWidth = rhsWidth != null ? rhsWidth + 1 : 641;
  // "Open in Side Panel" moves this into the patient split, which only the
  // floating shell has.
  const floating = useAppStore(s => s.sidebarShape === 'floating');

  if (!member) return null;

  // In the side panel the documents and ICD panes split it 50/50 (35% of
  // the screen each beside the 30% patient card) until the divider is dragged.
  const rhsFlex = !diagLeftPanel ? undefined
    : rhsWidth != null || !embedded ? `0 0 ${rhsWidth ?? 640}px`
      : '0 0 50%';
  const body = (
    <>
      <div className={styles.titleRow}>
        <span className={styles.titleText}>Diagnosis Gaps Details</span>
        {embedded ? (
          <>
            <ActionButton
              icon="solar:minimize-square-minimalistic-linear"
              size="L"
              tooltip="Open as Drawer"
              onClick={returnDiagToDrawer}
            />
            <span className={styles.titleDivider} />
          </>
        ) : floating && (
          <>
            <ActionButton
              icon="solar:sidebar-minimalistic-linear"
              size="L"
              tooltip="Open in Side Panel"
              onClick={openDiagInSidePanel}
            />
            <span className={styles.titleDivider} />
          </>
        )}
        <ActionButton size="L" tooltip="Close" onClick={closeDiagPanel}>
          <CloseIcon size={20} color="var(--neutral-300)" />
        </ActionButton>
      </div>

      <div className={styles.contentRow} ref={contentRowRef}>
        {diagLeftPanel && (
          <>
            <LeftWorkspace
              active={diagLeftPanel}
              icdScope={activeIcdCode ?? diagActivityIcd ?? null}
              onChange={setDiagTab}
              onClose={() => { setFocusIdx(-1); setDiagLeftPanel(null); }}
              member={member}
            />
            <div
              className={styles.resizeHandle}
              onPointerDown={startResize}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize document workspace"
            />
          </>
        )}
        <div
          className={diagLeftPanel ? styles.rightPane : styles.rightPaneFull}
          style={rhsFlex ? { flex: rhsFlex } : undefined}
        >
          <DiagPanelViewHeader {...props} />
          <DiagPanelViewToolbar {...props} />
          <DiagPanelViewCards {...props} />

          {bulkMode && (
            <BulkBar
              className={styles.bulkBarInDrawer}
              selectedIds={[...selectedKeys]}
              onClear={() => setSelectedKeys(new Set())}
              iconActions={[
                { label: 'Upload document', icon: 'solar:upload-minimalistic-linear', onClick: openDocsFromToolbar },
                { label: 'Add comment', icon: 'solar:chat-round-line-linear', onClick: () => setDiagLeftPanel('comments') },
              ]}
              actions={[
                { label: 'Accept', icon: 'solar:check-read-linear', variant: 'primary', onClick: () => bulkApply('accepted') },
                { label: 'Dismiss', icon: 'solar:close-circle-linear', variant: 'secondary', onClick: () => bulkApply('rejected') },
              ]}
              moreActions={[
                { label: 'Missed Opportunity', icon: 'solar:flag-linear', onClick: () => bulkApply('missed') },
                { label: 'Defer', icon: 'solar:alarm-linear', onClick: () => bulkApply('deferred') },
                { label: 'Undo', icon: 'solar:undo-left-round-linear', onClick: bulkUndo },
              ]}
            />
          )}
        </div>
      </div>

      {rejectPrompt && (
        <RejectRecordDialog
          onCancel={() => setRejectPrompt(null)}
          onConfirm={confirmReject}
        />
      )}
      {recordsRequestPrompt && (
        <RecordsRequestDialog
          lastAssignees={{
            coder: member?.cdr || null,
            support: member?.sup || null,
            qa: member?.r1 || null,
          }}
          supportUser={recordsRequestSupportUser}
          onCancel={cancelRecordsRequest}
          onConfirm={confirmRecordsRequest}
        />
      )}
    </>
  );

  if (embedded) return <div className={styles.embedded} data-diag-split>{body}</div>;

  return (
    <Drawer
      title={<span className={styles.drawerTitle}>Diagnosis Gaps Details</span>}
      onClose={closeDiagPanel}
      width={diagLeftPanel ? initialWidth : undefined}
      className={[styles.panel, expanded ? styles.panelExpanded : ''].join(' ')}
      bodyClassName={[styles.body, expanded ? styles.bodyExpanded : ''].join(' ')}
      headerStyle={{ display: 'none' }}
    >
      {body}
    </Drawer>
  );
}
