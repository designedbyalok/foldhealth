import { useEffect } from 'react';

/** Dispatches header/toolbar panel requests (versions, sign, note, etc.). */
export function runCarePlanPanelRequest(request, actions) {
  if (!request) return;
  switch (request) {
    case 'versions':
      actions.setVersionsOpen(true);
      break;
    case 'template':
      actions.setTemplateName('');
      actions.pickTemplateSource(actions.defaultTemplateSourceId);
      actions.setTemplateOpen(true);
      break;
    case 'templates':
      actions.setTemplatesDrawerOpen(true);
      break;
    case 'history':
      actions.setHistoryOpen(true);
      break;
    case 'filter':
      actions.setFiltersOpen(true);
      break;
    case 'note':
      actions.openNoteDrawer();
      break;
    case 'sign':
      actions.setSignNote('');
      actions.setSignOpen(true);
      break;
    case 'scan-duplicates':
      actions.scanForDuplicates();
      break;
    default:
      break;
  }
}

/** Consumes `carePlanPanelRequest` from the store once handlers are available. */
export function useCarePlanViewPanelRequest(carePlanPanelRequest, clearCarePlanPanelRequest, actionsRef) {
  useEffect(() => {
    if (!carePlanPanelRequest) return;
    runCarePlanPanelRequest(carePlanPanelRequest, actionsRef.current);
    clearCarePlanPanelRequest();
  }, [carePlanPanelRequest, clearCarePlanPanelRequest, actionsRef]);
}
