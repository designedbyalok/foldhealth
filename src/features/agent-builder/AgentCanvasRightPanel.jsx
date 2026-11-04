import { Toggle } from '../../components/Toggle/Toggle';
import { NodeSettings } from './NodeSettings';
import { ChatPanel } from './ChatPanel';
import { GlobalSettings } from './GlobalSettings';
import styles from './AgentCanvas.module.css';

export function AgentCanvasRightPanel({
  panelWidth,
  isResizing,
  handleResizeStart,
  showNodeSettings,
  selectedNode,
  nodes,
  edges,
  rightTab,
  setRightTab,
  onCloseNodeSettings,
  onDeleteNode,
  applyFlowUpdate,
  agentName,
  hasUnsavedChanges,
  handleSave,
}) {
  return (
    <div className={styles.rightPanelWrap} style={{ width: panelWidth }}>
      <div
        className={`${styles.resizeHandle} ${isResizing ? styles.resizeHandleActive : ''}`}
        onMouseDown={handleResizeStart}
      />
      {showNodeSettings ? (
        <NodeSettings
          node={selectedNode}
          allNodes={nodes}
          onSave={() => { hasUnsavedChanges.current = true; handleSave(); }}
          onClose={onCloseNodeSettings}
          onDelete={() => onDeleteNode(selectedNode.id)}
        />
      ) : (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <div style={{ padding: '10px 12px 6px', borderBottom: '0.5px solid var(--neutral-150)', flexShrink: 0 }}>
            <Toggle
              items={['Workflow Assistant', 'Global Settings']}
              value={rightTab}
              onValueChange={setRightTab}
              fullWidth
            />
          </div>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {rightTab === 'Workflow Assistant' ? (
              <ChatPanel
                nodes={nodes}
                edges={edges}
                onApplyFlow={applyFlowUpdate}
                agentName={agentName}
              />
            ) : (
              <GlobalSettings />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
