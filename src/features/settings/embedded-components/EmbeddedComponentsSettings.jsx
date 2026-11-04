import { useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../components/Button/Button';
import { SectionTitleBar } from '../../../components/SectionTitleBar/SectionTitleBar';
import { ProductTour } from '../../tours/ProductTour';
import { DomainRegistryPanel } from './DomainRegistryPanel';
import { ComponentLibraryPanel } from './ComponentLibraryPanel';
import styles from './EmbeddedComponentsSettings.module.css';

const TAB_MAP = {
  'domain-registry': 'Domain Registry',
  'component-library': 'Component Library',
};
const TAB_KEYS = Object.keys(TAB_MAP);
const TABS = TAB_KEYS.map(key => ({ key, label: TAB_MAP[key] }));

export function EmbeddedComponentsSettings() {
  const embeddedComponentsTab = useAppStore(s => s.embeddedComponentsTab) || 'domain-registry';
  const setEmbeddedComponentsTab = useAppStore(s => s.setEmbeddedComponentsTab);
  const setComponentWizard = useAppStore(s => s.setComponentWizard);
  const setDomainAddTrigger = useAppStore(s => s.setDomainAddTrigger);

  const [searchVal, setSearchVal] = useState('');
  const isComponentLibrary = embeddedComponentsTab === 'component-library';

  return (
    <div className={styles.wrapper} data-tour="embed-tabs">
      <SectionTitleBar
        tabs={TABS}
        activeTab={embeddedComponentsTab}
        onTabChange={setEmbeddedComponentsTab}
        actions={['search']}
        searchPlaceholder={isComponentLibrary ? 'Search components…' : 'Search domains…'}
        searchValue={searchVal}
        onSearchChange={setSearchVal}
        rightExtras={
          <Button
            variant="outline"
            leadingIcon="solar:add-circle-linear"
            data-tour="embed-register-btn"
            onClick={() => {
              if (isComponentLibrary) setComponentWizard(true, null);
              else setDomainAddTrigger(true);
            }}
          >
            {isComponentLibrary ? 'New Component' : 'Register Domain'}
          </Button>
        }
      />

      <div className={styles.tableWrap}>
        {embeddedComponentsTab === 'domain-registry' ? (
          <DomainRegistryPanel searchQuery={searchVal} />
        ) : (
          <ComponentLibraryPanel searchQuery={searchVal} />
        )}
      </div>

      <ProductTour tourId="embed-settings" steps={EMBED_TOUR_STEPS} />
    </div>
  );
}

const EMBED_TOUR_STEPS = [
  {
    target: '[data-tour="embed-tabs"]',
    title: 'Embed Settings',
    content: 'Switch between Domain Registry to manage allowed domains and Component Library to configure embeddable widgets.',
    icon: 'solar:code-linear',
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '[data-tour="embed-register-btn"]',
    title: 'Register New Domain',
    content: 'Add third-party domains that are authorized to host your embedded components. Each domain requires HIPAA verification.',
    icon: 'solar:add-circle-linear',
    placement: 'bottom-end',
    skipBeacon: true,
  },
  {
    target: '[data-tour="embed-toggle"]',
    title: 'Enable or Disable',
    content: 'Toggle domains on or off instantly. Disabled domains will stop serving all embedded components.',
    icon: 'solar:toggle-on-linear',
    placement: 'left',
    skipBeacon: true,
  },
  {
    target: '[data-tour="embed-actions"]',
    title: 'Domain Actions',
    content: 'Edit domain settings, view the audit log for change history, or remove a domain entirely.',
    icon: 'solar:widget-linear',
    placement: 'left',
    skipBeacon: true,
  },
];
