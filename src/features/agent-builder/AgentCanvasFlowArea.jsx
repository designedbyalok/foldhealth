import {
  ReactFlow,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import { Toggle } from '../../components/Toggle/Toggle';
import { Icon } from '../../components/Icon/Icon';
import { useAppStore } from '../../store/useAppStore';
import { SelectCursorIcon, PanHandIcon } from './AgentCanvasIcons';
import styles from './AgentCanvas.module.css';

export function AgentCanvasFlowArea({
  nodeTypes,
  nodes,
  edges,
  builderFlowLoading,
  builderFlow,
  builderVersions,
  canvasMode,
  setCanvasMode,
  zoomLevel,
  showVersions,
  setShowVersions,
  reactFlowWrapper,
  reactFlowInstance,
  wrappedOnNodesChange,
  wrappedOnEdgesChange,
  handleNodeDragStart,
  onConnect,
  onNodeClick,
  onPaneClick,
  onInit,
  onMoveEnd,
  onDragOver,
  onDrop,
  handleAutoArrange,
  handleSaveVersion,
}) {
  return (
    <div className={styles.flowArea} ref={reactFlowWrapper}>
      {builderFlowLoading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading workflow…</span>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={wrappedOnNodesChange}
          onEdgesChange={wrappedOnEdgesChange}
          onNodeDragStart={handleNodeDragStart}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onInit={onInit}
          onMoveEnd={onMoveEnd}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          deleteKeyCode={null}
          defaultEdgeOptions={{
            type: 'smoothstep',
            style: { stroke: 'var(--neutral-150)', strokeWidth: 1.5 },
          }}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          selectionOnDrag={canvasMode === 'select'}
          selectionMode="partial"
          panOnDrag={canvasMode === 'select' ? [1, 2] : true}
          className={canvasMode === 'pan' ? styles.flowPanMode : styles.flowSelectMode}
          multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--neutral-100)" />
          <MiniMap
            className={styles.minimap}
            maskColor="rgba(26,6,71,.08)"
            nodeColor={(n) => {
              if (n.type === 'startNode') return 'var(--status-success)';
              if (n.type === 'endNode') return 'var(--status-error)';
              return 'var(--primary-300)';
            }}
            nodeStrokeWidth={3}
            pannable
            zoomable
            position="bottom-left"
            style={{ width: 160, height: 100, marginBottom: 44, marginLeft: 12 }}
          />

          <Panel position="bottom-left" className={styles.bottomLeftCluster}>
            <div className={styles.zoomPanel}>
              <button className={styles.zoomBtn} onClick={handleAutoArrange} title="Auto-arrange nodes">
                <Icon name="solar:sort-horizontal-linear" size={14} />
                Auto-arrange
              </button>
              <span className={styles.zoomDivider} />
              <button className={styles.zoomBtn} onClick={() => reactFlowInstance.current?.fitView({ padding: 0.3 })}>
                <Icon name="solar:full-screen-linear" size={14} />
                Fit View
              </button>
              <span className={styles.zoomDivider} />
              <button className={styles.zoomBtn} onClick={() => reactFlowInstance.current?.zoomOut()} aria-label="Zoom out">
                <Icon name="solar:minus-circle-linear" size={14} />
              </button>
              <span className={styles.zoomLevel}>{zoomLevel}%</span>
              <button className={styles.zoomBtn} onClick={() => reactFlowInstance.current?.zoomIn()} aria-label="Zoom in">
                <Icon name="solar:add-circle-linear" size={14} />
              </button>
            </div>
            <div className={styles.modeTogglePill} title="Tool (V / H)">
              <Toggle
                size="S"
                active={canvasMode}
                onChange={setCanvasMode}
                items={[
                  { key: 'select', label: 'Select', icon: <SelectCursorIcon size={14} /> },
                  { key: 'pan', label: 'Pan', icon: <PanHandIcon size={14} /> },
                ]}
              />
            </div>
          </Panel>

          <Panel position="bottom-right" className={styles.versionPanel}>
            <div className={styles.versionWrap}>
              <button className={styles.versionBtn} onClick={() => setShowVersions(!showVersions)}>
                <Icon name="solar:history-linear" size={14} />
                v{builderFlow?.version || '1.0'}
              </button>
              {showVersions && (
                <div className={styles.versionDropdown}>
                  <div className={styles.versionDropdownHeader}>
                    <span>Versions</span>
                    <button className={styles.newVersionBtn} onClick={handleSaveVersion}>
                      + New Version
                    </button>
                  </div>
                  {builderVersions.map(v => (
                    <div
                      key={v.id}
                      className={`${styles.versionItem} ${v.is_current ? styles.versionItemActive : ''}`}
                      onClick={() => {
                        if (!v.is_current) {
                          useAppStore.getState().switchFlowVersion(v.id);
                          setShowVersions(false);
                        }
                      }}
                    >
                      <span>v{v.version}</span>
                      <span className={styles.versionDate}>
                        {new Date(v.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                      </span>
                      {v.is_current && <span className={styles.currentBadge}>Current</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </ReactFlow>
      )}
    </div>
  );
}
