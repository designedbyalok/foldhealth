/**
 * PopulationGroupsView.jsx, Fold Health · Population Groups panel
 * Ported from the Pop-group-creation-via-file-upload prototype.
 */

import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { usePopulationGroupsView } from './usePopulationGroupsView.js';
import { PopulationGroupsViewTable } from './PopulationGroupsViewTable.jsx';
import { PopulationGroupsCreateDrawer } from './PopulationGroupsCreateDrawer.jsx';
import { ImportRuleDrawer } from './ImportRuleDrawer.jsx';
import './popgroups.css';

function PopulationGroupsView({
  activeFilter,
  onMiniBarOpen,
  miniBarExpandRef,
  miniBarCloseRef,
  onModalClose,
  onBackdropChange,
  onGroupCreated,
  onUploadError,
  onMemberAdded,
}) {
  const vm = usePopulationGroupsView({
    activeFilter,
    onModalClose,
    onBackdropChange,
    onGroupCreated,
    onUploadError,
    onMemberAdded,
  });
  const openPgRuleBuilder = useAppStore(s => s.openPgRuleBuilder);
  const [importOpen, setImportOpen] = useState(false);

  const handleImport = (template) => {
    setImportOpen(false);
    openPgRuleBuilder({
      groupId: null,
      name: template.name,
      description: template.description || '',
      memberStatus: 'All Status',
      rule: template.rule,
    });
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--neutral-0)', minWidth:0, position:'relative' }}>
      <PopulationGroupsViewTable vm={vm} onImportRule={() => setImportOpen(true)} />
      <PopulationGroupsCreateDrawer vm={vm} onMemberAdded={onMemberAdded} onGroupCreated={onGroupCreated} />
      {importOpen && <ImportRuleDrawer onClose={() => setImportOpen(false)} onImport={handleImport} />}
    </div>
  );
}

export { PopulationGroupsView };
