import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Button } from '../../../components/Button/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { Icon } from '../../../components/Icon/Icon';
import { ProductTour } from '../../tours/ProductTour';
import { AutomationCanvas } from '../canvas/AutomationCanvas';
import { nodeDef } from '../lib/catalog';
import { allowedAt, getNode, whyNotAllowed } from '../lib/graph';
import { nodeStats } from '../lib/analytics';
import { HistoryLogDrawer } from '../list/HistoryLogDrawer';
import { TestRunPanel } from '../test/TestRunPanel';
import { useTestRun } from '../test/useTestRun';
import { useAutomationBuilder, defaultSlot } from './useAutomationBuilder';
import { BuilderHeader } from './BuilderHeader';
import { Palette } from './Palette';
import { TriggerPanel } from './TriggerPanel';
import { NodeEditPanel } from './NodeEditPanel';
import { SavePanel } from './SavePanel';
import { MicroAutomationPicker } from './MicroAutomationPicker';
import { DuplicateWarning } from './DuplicateWarning';
import styles from './AutomationBuilder.module.css';

const TOUR = [
  { target: '#automation-tour-trigger', content: 'Start by selecting a trigger: the event in Fold that starts this automation.', disableBeacon: true },
  { target: '#automation-tour-palette', content: 'Drag conditions and actions onto a + on the canvas, or click one to add it under the selected step.' },
];

/**
 * The automation builder (Settings > Automations > an automation). Owns the
 * whole Settings area: header, palette, canvas, and one right panel at a time
 * (trigger, step editor, save, or the test run).
 */
export function AutomationBuilder({ id }) {
  const exists = useAppStore(s => id === 'new' || s.automations.some(a => a.id === id));
  const automationsStatus = useAppStore(s => s.automationsStatus);
  const openAutomationsList = useAppStore(s => s.openAutomationsList);
  if (exists) return <BuilderScreen id={id} />;
  if (automationsStatus !== 'ready') return <div className={styles.loading}><span className={styles.spinner} />Loading automation…</div>;
  return (
    <div className={styles.loading}>
      <EmptyState
        icon="solar:bolt-linear"
        title="Automation not found"
        description="It may have been deleted."
        action={<Button variant="soft" leadingIcon="solar:arrow-left-linear" onClick={() => openAutomationsList()}>Back to automations</Button>}
      />
    </div>
  );
}

function BuilderScreen({ id }) {
  const b = useAutomationBuilder(id);
  const activity = useAppStore(s => s.automationActivity[id]);
  const fetchAutomationActivity = useAppStore(s => s.fetchAutomationActivity);
  const emailOptions = useAppStore(s => s.automationEmailOptions);
  const fetchEmailOptions = useAppStore(s => s.fetchAutomationEmailOptions);
  const openAutomationsList = useAppStore(s => s.openAutomationsList);
  const openAutomationBuilder = useAppStore(s => s.openAutomationBuilder);
  const duplicateAutomation = useAppStore(s => s.duplicateAutomation);
  const markAutomationTested = useAppStore(s => s.markAutomationTested);
  const setSettingsNavItem = useAppStore(s => s.setSettingsNavItem);
  const openEmailBuilder = useAppStore(s => s.openEmailBuilder);
  const showToast = useAppStore(s => s.showToast);

  const [paletteOpen, setPaletteOpen] = useState(true);
  const [confirm, setConfirm] = useState(null); // { kind: 'delete' | 'close' | 'leave', … }
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testErrors, setTestErrors] = useState(null);

  useEffect(() => { fetchAutomationActivity(id); fetchEmailOptions(); }, [id, fetchAutomationActivity, fetchEmailOptions]);

  const testing = b.panel?.kind === 'test';
  const test = useTestRun(b.graph);
  useEffect(() => { if (test.phase === 'done' && !b.isNew) markAutomationTested(id); }, [test.phase, b.isNew, id, markAutomationTested]);

  const templateName = useCallback((tid) => emailOptions.find(o => o.id === String(tid))?.name, [emailOptions]);
  const stats = useMemo(() => (activity?.members ? nodeStats(activity.members, b.graph) : null), [activity, b.graph]);

  // Palette rules at the spot a click would land.
  const targetSlot = b.selectedSlot || defaultSlot(b.graph, b.selectedId);
  const isAllowed = useCallback((type) => !!targetSlot && allowedAt(b.graph, targetSlot)(type), [b.graph, targetSlot]);
  const whyNot = useCallback((type) => (targetSlot ? whyNotAllowed(b.graph, targetSlot, type) : 'Select a step on the canvas first.'), [b.graph, targetSlot]);

  const closePanel = () => { b.setPanel(null); setTestErrors(null); };
  const selectNode = (nodeId) => {
    if (testing) return;
    b.setSelectedSlot(null);
    b.setSelectedId(nodeId);
    if (!nodeId) { closePanel(); return; }
    const node = getNode(b.graph, nodeId);
    if (nodeId === 'trigger') b.setPanel({ kind: 'trigger' });
    else if (node && node.type !== 'and' && node.type !== 'or') b.setPanel({ kind: 'node', id: nodeId });
    else b.setPanel(null);
  };

  const requestDelete = (nodeId) => {
    const node = getNode(b.graph, nodeId);
    const below = b.subtreeSize(nodeId);
    const members = stats?.nodes?.[nodeId]?.members || 0;
    setConfirm({ kind: 'delete', nodeId, label: nodeDef(node?.type)?.nodeLabel || 'step', below, members });
  };

  const leave = () => openAutomationsList();
  const requestClose = () => (b.dirty ? setConfirm({ kind: 'close' }) : leave());

  const editTemplate = (campaign) => {
    const go = () => { setSettingsNavItem('content'); openEmailBuilder(campaign); };
    if (b.dirty) setConfirm({ kind: 'leave', go });
    else go();
  };

  const doSave = async (values) => {
    setSaving(true);
    const saved = await b.save(values);
    setSaving(false);
    if (!saved) return;
    showToast(values.status === 'active' ? 'Automation published successfully!' : `“${saved.name}” saved${values.status === 'draft' ? ' as a draft' : ''}`);
    openAutomationsList('mine');
  };

  const duplicate = async () => {
    const copy = await duplicateAutomation(id);
    if (copy) { showToast(`Created “${copy.name}”`); openAutomationBuilder(copy.id); }
  };

  const annotations = testing ? [] : b.duplicates.map(d => ({
    anchorId: d.secondId,
    width: 380,
    content: (
      <DuplicateWarning
        first={getNode(b.graph, d.firstId)}
        second={getNode(b.graph, d.secondId)}
        onEdit={() => selectNode(d.secondId)}
        onAddDelay={() => b.addDelayBefore(d.secondId)}
        onDelete={() => requestDelete(d.secondId)}
      />
    ),
  }));
  const flagged = new Set(b.duplicates.flatMap(d => [d.firstId, d.secondId]));

  let panel = null;
  if (b.panel?.kind === 'trigger') {
    panel = (
      <TriggerPanel
        graph={b.graph}
        current={getNode(b.graph, 'trigger')}
        onClose={closePanel}
        onSave={(type, config) => { b.chooseTrigger(type, config); closePanel(); b.setSelectedId(null); }}
      />
    );
  } else if (b.panel?.kind === 'node') {
    const node = getNode(b.graph, b.panel.id);
    if (node) {
      panel = (
        <NodeEditPanel
          key={node.id}
          node={node}
          initialErrors={testErrors}
          onClose={closePanel}
          onSave={(config) => { b.updateConfig(node.id, config); closePanel(); }}
          onEditTemplate={editTemplate}
        />
      );
    }
  } else if (b.panel?.kind === 'save') {
    panel = (
      <SavePanel
        state={b.state}
        graph={b.graph}
        problems={b.problems}
        saving={saving}
        onClose={closePanel}
        onSave={doSave}
        onShowProblem={(nodeId) => { setTestErrors(true); selectNode(nodeId); }}
      />
    );
  } else if (testing) {
    panel = (
      <TestRunPanel
        test={test}
        isActive={b.state.status === 'active'}
        onConfigChange={(nodeId, p) => b.updateConfig(nodeId, p)}
        onClose={() => { test.stop(); closePanel(); }}
        onPublish={() => { b.patch({ status: 'active' }); b.setPanel({ kind: 'save' }); }}
      />
    );
  }

  const canTest = !!b.triggerType && b.graph.nodes.length > 1;

  return (
    <div className={styles.page}>
      <BuilderHeader
        name={b.state.name}
        onRename={(name) => b.patch({ name })}
        status={b.state.status}
        onStatus={(status) => b.patch({ status })}
        dirty={b.dirty}
        lastAutosave={b.lastAutosave}
        isNew={b.isNew}
        canTest={canTest}
        testing={testing}
        onTest={() => { b.setSelectedId(null); b.setSelectedSlot(null); b.setPanel({ kind: 'test' }); }}
        onHistory={() => setHistoryOpen(true)}
        onDuplicate={duplicate}
        onClose={requestClose}
        onSave={() => b.setPanel({ kind: 'save' })}
      />
      {b.hasDraftCopy && !b.dirty && (
        <div className={styles.banner}>
          <Icon name="solar:info-circle-linear" size={16} />
          <span>You’re editing a working copy saved {new Date(b.automation.updatedAt).toLocaleDateString('en-US')}. The published version keeps running until you save.</span>
          <Button variant="soft" size="sm" onClick={b.discardDraftCopy}>Discard working copy</Button>
        </div>
      )}
      <div className={styles.body}>
        {paletteOpen && !testing && (
          <Palette
            triggerType={b.triggerType}
            onPickTrigger={() => selectNode('trigger')}
            isAllowed={isAllowed}
            whyNot={whyNot}
            onAdd={(type) => {
              const node = b.insertAt(type, b.selectedSlot);
              if (!node && type !== 'microAutomation' && !targetSlot) showToast('Select a step on the canvas to add after it.');
            }}
            tourIds={{ trigger: 'automation-tour-trigger', palette: 'automation-tour-palette' }}
          />
        )}
        <div className={styles.canvasArea}>
          <AutomationCanvas
            graph={b.graph}
            mode={testing ? 'test' : 'edit'}
            selectedId={b.selectedId}
            selectedSlot={b.selectedSlot}
            onSelectNode={selectNode}
            onSelectSlot={(slot) => { if (!testing) { b.setSelectedSlot(slot); b.setSelectedId(null); if (b.panel?.kind !== 'save') closePanel(); } }}
            onDropType={(type, slot) => b.insertAt(type, slot)}
            onDeleteNode={requestDelete}
            isAllowed={isAllowed}
            nodeState={testing ? test.nodeState : undefined}
            focusId={testing ? test.current?.id : null}
            flagged={flagged}
            annotations={annotations}
            templateName={templateName}
            leftControl={!testing && (
              <ActionButton
                icon={paletteOpen ? 'solar:sidebar-minimalistic-linear' : 'solar:list-linear'}
                tooltip={paletteOpen ? 'Hide side bar' : 'Open side bar'}
                onClick={() => setPaletteOpen(o => !o)}
              />
            )}
          />
        </div>
        {panel}
      </div>

      {confirm?.kind === 'delete' && (
        <ConfirmDialog
          variant="destructive"
          icon="solar:link-broken-minimalistic-linear"
          title="Delete step?"
          description={[
            `Deleting this ${confirm.label.toLowerCase()} step`,
            confirm.below ? ` also removes the ${confirm.below} step${confirm.below === 1 ? '' : 's'} below it` : '',
            '.',
            confirm.members ? ` ${confirm.members} member${confirm.members === 1 ? '' : 's'} reached it in the last 90 days; members already past it aren’t affected.` : '',
          ].join('')}
          confirmLabel="Delete"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { b.removeNode(confirm.nodeId); setConfirm(null); }}
        />
      )}
      {(confirm?.kind === 'close' || confirm?.kind === 'leave') && (
        <ConfirmDialog
          variant="warning"
          title="Discard unsaved changes?"
          description={b.isNew ? 'This automation hasn’t been saved yet.' : 'Changes since your last save will be lost. The published version keeps running.'}
          confirmLabel="Discard"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const c = confirm; setConfirm(null); if (c.kind === 'leave') c.go(); else leave(); }}
        />
      )}
      {b.panel?.kind === 'micro' && (
        <MicroAutomationPicker
          onClose={closePanel}
          onPick={(template) => { b.insertMicro(template, b.panel.slot); showToast(`Added “${template.name}” as a micro automation`); }}
        />
      )}
      {historyOpen && b.automation && <HistoryLogDrawer automation={b.automation} onClose={() => setHistoryOpen(false)} />}
      <ProductTour tourId="automation-builder-v1" steps={TOUR} run={b.isNew && !b.triggerType} />
    </div>
  );
}
