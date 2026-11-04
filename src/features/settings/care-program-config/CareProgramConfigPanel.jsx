import { useCallback, useEffect, useMemo, useState } from 'react';
import { CardSkeleton } from '../../../components/CardSkeleton/CardSkeleton';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Select } from '../../../components/Select/Select';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { RingEmptyState } from '../../../components/RingEmptyState/RingEmptyState';
import { useAppStore } from '../../../store/useAppStore';
import { PROGRAM_STATUSES, blankProgramType, cloneSteps, programTypeId, stepCounts } from './careProgramConfigModel';
import { ProgramTypeDetail } from './ProgramTypeDetail';
import styles from './CareProgramConfig.module.css';

const BLANK = '__blank';
const CODE_MAX = 12;

const statusOf = value => PROGRAM_STATUSES.find(s => s.value === value) || PROGRAM_STATUSES[0];
/** New Program Type: name, code, description, and the steps to start from. */
function CreateProgramDrawer({ types, onCreate, onClose }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [from, setFrom] = useState(BLANK);
  const cleanCode = code.trim().toUpperCase();
  const taken = types.some(t => t.code.toUpperCase() === cleanCode || t.id === programTypeId(cleanCode));
  const canSave = name.trim() && cleanCode && !taken;
  return (
    <Drawer
      title="New Program Type"
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <>
          <Button
            disabled={!canSave}
            onClick={() => onCreate({ name: name.trim(), code: cleanCode, description: description.trim(), from })}
          >
            Create
          </Button>
          <span className={styles.headerDivider} />
        </>
      )}
    >
      <div className={styles.drawerBody}>
        <Input label="Program Name" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Remote Patient Monitoring" maxLength={80} />
        <Input
          label="Program Code"
          required
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. RPM"
          maxLength={CODE_MAX}
          helperText="Short code shown on badges and worklists. It can't be changed later."
          errorText={taken ? 'A program type already uses this code.' : undefined}
        />
        <Textarea title="Description" value={description} onValueChange={setDescription} placeholder="What this program is for (optional)" rows={3} maxLength={300} />
        <Select
          label="Start from"
          portal
          options={[{ value: BLANK, label: 'No steps (start empty)' }, ...types.map(t => ({ value: t.id, label: `${t.name}'s steps` }))]}
          value={from}
          onValueChange={setFrom}
          helperText="Copies the other program's steps; you can change them after."
        />
      </div>
    </Drawer>
  );
}

function ProgramCard({ type, selected, onOpen, onMenu }) {
  const counts = stepCounts(type.steps);
  const status = statusOf(type.status);
  return (
    <div
      role="button"
      tabIndex={0}
      className={[styles.programCard, selected ? styles.programCardOn : ''].join(' ')}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      aria-current={selected || undefined}
    >
      <span className={styles.programCardText}>
        <span className={styles.programCardName}>{type.name}</span>
        <span className={styles.programCardMeta}>{type.code} · {counts.on} of {counts.total} steps · {status.label}</span>
      </span>
      <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More" onClick={(e) => { e.stopPropagation(); onMenu(e.currentTarget.getBoundingClientRect()); }} />
    </div>
  );
}

/**
 * Settings > Care Program Configuration (Figma Simplifying-Implementation
 * 55:42451): the program types on the left, the selected one's
 * configuration on the right. The program view reads each type's steps.
 */
export function CareProgramConfigPanel() {
  const types = useAppStore(s => s.careProgramTypes);
  const loading = useAppStore(s => s.careProgramTypesLoading);
  const didFetch = useAppStore(s => s.careProgramTypesDidFetch);
  const fetchTypes = useAppStore(s => s.fetchCareProgramTypes);
  const saveType = useAppStore(s => s.saveCareProgramType);
  const deleteType = useAppStore(s => s.deleteCareProgramType);
  const openId = useAppStore(s => s.careProgramConfigId);
  const openTab = useAppStore(s => s.careProgramConfigTab);
  const openConfig = useAppStore(s => s.openCareProgramConfig);
  const showToast = useAppStore(s => s.showToast);
  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [menu, setMenu] = useState(null); // { rect, type }
  const [deleting, setDeleting] = useState(null);
  // Unsaved edits on the open program: switching away asks first.
  const [dirty, setDirty] = useState(false);
  const onDirtyChange = useCallback(d => setDirty(d), []);
  const [pendingOpen, setPendingOpen] = useState(null); // { id, tab }
  const goTo = (id, tab) => {
    if (dirty && id !== (types.find(t => t.id === openId) || types[0])?.id) setPendingOpen({ id, tab });
    else openConfig(id, tab);
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? types.filter(t => `${t.name} ${t.code} ${t.description}`.toLowerCase().includes(q)) : types;
  }, [types, search]);
  // The open program, else the first one.
  const selected = types.find(t => t.id === openId) || types[0] || null;

  const create = async ({ name, code, description, from }) => {
    const base = blankProgramType({ code, name, description }, types.length);
    const source = types.find(t => t.id === from);
    const created = await saveType(source ? { ...base, steps: cloneSteps(source.steps) } : base);
    if (!created) return;
    setCreateOpen(false);
    showToast?.(`${name} created as a draft`);
    setDirty(false);
    openConfig(created.id, 'steps');
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.split}>
        <aside className={styles.listPane}>
          <div className={styles.paneHead}>
            <h2 className={styles.paneTitle}>Programs</h2>
            <span className={styles.paneActions}>
              <ActionButton
                icon="solar:magnifer-linear"
                tooltip="Search"
                active={searchOpen}
                onClick={() => { setSearchOpen(o => !o); if (searchOpen) setSearch(''); }}
              />
              <span className={styles.headerDivider} />
              <Button variant="outline" leadingIcon="solar:add-circle-linear" onClick={() => setCreateOpen(true)}>New Program</Button>
            </span>
          </div>
          {searchOpen && (
            <Input
              autoFocus
              leadingIcon="solar:magnifer-linear"
              placeholder="Search programs"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          )}
          <div className={styles.programList}>
            {loading && !didFetch ? <CardSkeleton count={6} /> : shown.length === 0 ? (
              <RingEmptyState icon="solar:health-linear" label={search.trim() ? 'No programs match' : 'No program types yet'} />
            ) : shown.map(t => (
              <ProgramCard
                key={t.id}
                type={t}
                selected={selected?.id === t.id}
                onOpen={() => goTo(t.id, selected?.id === t.id ? openTab : 'overview')}
                onMenu={rect => setMenu({ rect, type: t })}
              />
            ))}
          </div>
        </aside>
        <section className={styles.detailPane}>
          {selected && (
            <ProgramTypeDetail
              key={selected.id}
              type={selected}
              tab={selected.id === openId ? openTab : 'overview'}
              onTab={tab => openConfig(selected.id, tab)}
              onDirtyChange={onDirtyChange}
            />
          )}
        </section>
      </div>
      {menu && (
        <MenuPopover
          anchorRect={menu.rect}
          ariaLabel={`${menu.type.name} actions`}
          items={[
            { key: 'configure', icon: 'solar:settings-linear', label: 'Configure' },
            { key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Delete', danger: true },
          ]}
          onSelect={(key) => {
            const { type } = menu;
            setMenu(null);
            if (key === 'configure') goTo(type.id, 'overview');
            else setDeleting(type);
          }}
          onClose={() => setMenu(null)}
        />
      )}
      {pendingOpen && (
        <ConfirmDialog
          variant="warning"
          title="Leave without saving?"
          description={`Your changes to ${selected?.name} haven't been saved.`}
          confirmLabel="Discard Changes"
          onCancel={() => setPendingOpen(null)}
          onConfirm={() => { const { id, tab } = pendingOpen; setPendingOpen(null); setDirty(false); openConfig(id, tab); }}
        />
      )}
      {createOpen && <CreateProgramDrawer types={types} onCreate={create} onClose={() => setCreateOpen(false)} />}
      {deleting && (
        <ConfirmDialog
          variant="destructive"
          title={`Delete ${deleting.name}?`}
          description="The program type and its configuration are removed. Patients already enrolled keep their enrollment, but new patients can't be enrolled in it."
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            const ok = await deleteType(deleting.id);
            if (ok) {
              showToast?.(`${deleting.name} deleted`);
              if (deleting.id === openId) openConfig(null);
            }
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
