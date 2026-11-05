import { useState } from 'react';
import { Avatar } from '../Avatar/Avatar';
import { Icon } from '../Icon/Icon';
import { Button } from '../Button/Button';
import { ActionButton } from '../ActionButton/ActionButton';
import { useAppStore } from '../../store/useAppStore';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../Dialog/Dialog';

const AGENTS = [
  { name: 'Ricardo', role: 'SNP Agent' },
  { name: 'Erica', role: 'TOC Agent' },
  { name: 'Maria', role: 'AWV Agent' },
  { name: 'Jia', role: 'Follow-up Agent' },
  { name: 'Dubois', role: 'SDOH Agent' },
];

export function InvokeAgentModal() {
  const [selected, setSelected] = useState(null);
  const selectedIds = useAppStore(s => s.selectedIds);
  const invokeAgent = useAppStore(s => s.invokeAgent);
  const showInvokeModal = useAppStore(s => s.showInvokeModal);
  const setShowInvokeModal = useAppStore(s => s.setShowInvokeModal);

  const handleConfirm = () => {
    if (!selected) return;
    const agent = AGENTS.find(a => a.name === selected);
    invokeAgent(selectedIds, agent.name, agent.role);
  };

  const handleOpenChange = (open) => {
    if (!open) {
      setShowInvokeModal(false);
      setSelected(null);
    }
  };

  return (
    <Dialog open={showInvokeModal} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[340px] p-0 gap-0 overflow-hidden rounded-lg">
        <DialogTitle className="sr-only">Select Agent to Invoke</DialogTitle>
        <DialogDescription className="sr-only">
          Choose an agent to invoke for the selected patients.
        </DialogDescription>

        {/* Title section */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '8px',
          borderBottom: '0.5px solid var(--neutral-150)',
        }}>
          <span style={{
            flex: 1, fontSize: 'var(--font-base)', fontWeight: 500,
            color: 'var(--neutral-400)', fontFamily: "'Inter', sans-serif",
          }}>
            Select Agent to Invoke
          </span>
        </div>

        {/* Agent list section */}
        <div style={{
          padding: 8,
          borderBottom: '0.5px solid var(--neutral-150)',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {AGENTS.map(agent => {
            const isSelected = selected === agent.name;
            return (
              <button
                key={agent.name}
                type="button"
                onClick={() => setSelected(agent.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                  border: isSelected ? '0.5px solid var(--primary-200)' : '0.5px solid transparent',
                  background: isSelected ? 'var(--primary-50)' : 'transparent',
                  fontFamily: "'Inter', sans-serif", textAlign: 'left',
                  width: '100%', transition: 'background .12s, border-color .12s',
                }}
                onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = 'var(--neutral-50)'; }}
                onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Radio circle */}
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  border: isSelected ? '5px solid var(--primary-300)' : '1.5px solid var(--neutral-200)',
                  background: isSelected ? 'var(--neutral-0)' : 'var(--neutral-0)',
                  boxSizing: 'border-box',
                }} />
                {/* Avatar */}
                <Avatar variant="invokeAgent" agentName={agent.name} style={{ width: 32, height: 32, borderRadius: 4, flexShrink: 0 }} />
                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-base)', fontWeight: 400, color: 'var(--neutral-400)', lineHeight: 1.2 }}>
                    {agent.name}
                  </div>
                  <div style={{ fontSize: 'var(--font-sm)', fontWeight: 400, color: 'var(--neutral-200)', lineHeight: 1.2, marginTop: 4 }}>
                    {agent.role}
                  </div>
                </div>
                {/* Play icon for selected */}
                {isSelected && (
                  <ActionButton
                    icon="solar:play-linear"
                    size="sm"
                    tooltip="Preview agent"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer buttons */}
        <div style={{
          display: 'flex', gap: 12, padding: 8,
        }}>
          <Button
            variant="outline"
            fullWidth
            style={{ flex: 1, minWidth: 0 }}
            onClick={() => setShowInvokeModal(false)}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            style={{ flex: 1, minWidth: 0 }}
            disabled={!selected}
            onClick={handleConfirm}
          >
            Invoke Agent
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
