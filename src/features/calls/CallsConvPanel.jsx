import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Input } from '../../components/Input/Input';
import { Toggle } from '../../components/Toggle/Toggle';
import { Select } from '../../components/Select/Select';
import { CallListItem, CallListSkeleton } from './CallsViewHelpers';
import styles from './CallsView.module.css';

export function CallsConvPanel({
  activeLabel,
  activeCount,
  showSearch,
  onToggleSearch,
  callsConfigLoading,
  callLines,
  callLine,
  onCallLineChange,
  listSearch,
  onListSearchChange,
  listFilter,
  onListFilterChange,
  filteredList,
  activeCallId,
  onActiveCallChange,
  dialCountry,
  onDialCountryChange,
  dialNumber,
  onDialNumberChange,
  onDialPadClick,
}) {
  return (
    <div className={styles.convPanel}>
      <div className={styles.convHeader}>
        <div className={styles.convHeaderLeft}>
          <div className={styles.convHeaderTitle}>{activeLabel}</div>
          {activeCount > 0 && (
            <div className={styles.convHeaderSub}>
              {activeCount} call{activeCount !== 1 ? 's' : ''} to return
            </div>
          )}
        </div>
        <div className={styles.convHeaderActions}>
          <ActionButton
            icon="solar:magnifer-linear"
            tooltip="Search"
            active={showSearch}
            onClick={onToggleSearch}
          />
          <div className={styles.convDivider} />
          <ActionButton icon="solar:refresh-linear" tooltip="Refresh" />
          <div className={styles.convDivider} />
          <ActionButton icon="custom:filter" tooltip="Filter" />
        </div>
      </div>

      <div className={styles.convSelectWrap}>
        {callsConfigLoading ? (
          <div className={styles.skeletonSelect} />
        ) : (
          <Select
            className={styles.callLineTrigger}
            options={callLines.map(line => ({ value: line.id, label: line.label }))}
            value={callLine}
            onValueChange={onCallLineChange}
          />
        )}
      </div>

      {showSearch && (
        <div className={styles.convSearch}>
          <div className={styles.convSearchWrap}>
            <span className={styles.convSearchIcon}>
              <Icon name="solar:magnifer-linear" size={13} />
            </span>
            <Input
              placeholder="Search calls…"
              value={listSearch}
              onChange={e => onListSearchChange(e.target.value)}
              style={{ paddingLeft: 28, fontSize: 'var(--font-md)' }}
              autoFocus
            />
          </div>
        </div>
      )}

      <div className={styles.convTabs}>
        <Toggle
          items={[
            { key: 'all',      label: 'All' },
            { key: 'incoming', label: 'Incoming' },
            { key: 'outgoing', label: 'Outgoing' },
          ]}
          value={listFilter}
          onValueChange={onListFilterChange}
          size="sm"
          fullWidth
        />
      </div>

      <div className={styles.convList}>
        {callsConfigLoading
          ? Array.from({ length: 6 }).map((_, i) => <CallListSkeleton key={i} />)
          : filteredList.map(c => (
              <CallListItem
                key={c.id}
                entry={c}
                selected={activeCallId === c.id}
                onClick={() => onActiveCallChange(c.id)}
              />
            ))}
      </div>

      <div className={styles.dialPad}>
        <div className={styles.dialLabel}>Dial a Number</div>
        <div className={styles.dialRow}>
          <Select
            className={styles.countryTrigger}
            options={[
              { value: 'us', label: '🇺🇸 +1' },
              { value: 'gb', label: '🇬🇧 +44' },
              { value: 'in', label: '🇮🇳 +91' },
            ]}
            value={dialCountry}
            onValueChange={onDialCountryChange}
          />
          <div className={styles.dialInputWrap}>
            <Input
              placeholder="Enter Number Here"
              value={dialNumber}
              onChange={e => onDialNumberChange(e.target.value)}
              style={{ paddingRight: 32 }}
            />
            <button
              type="button"
              className={styles.dialBtn}
              onClick={onDialPadClick}
              aria-label="Open dial pad"
            >
              <Icon name="solar:dialpad-linear" size={16} color="var(--primary-300)" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
