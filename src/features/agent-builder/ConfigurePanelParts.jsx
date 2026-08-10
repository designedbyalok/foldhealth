import { useState, useRef, useEffect, useMemo } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { useAppStore } from '../../store/useAppStore';
import styles from './ConfigurePanel.module.css';

function goalProgramBadgeClass(program) {
  if (program === 'TCM') return styles.programBadgePurple;
  if (program === 'Outreach') return styles.programBadgeBlue;
  return styles.programBadgeAmber;
}

/* ─────────────── SectionCard ─────────────── */
export function SectionCard({ id, icon, title, isComplete, expanded, onToggle, children }) {
  return (
    <div className={styles.card} id={`section-${id}`}>
      <button className={styles.cardHeader} onClick={onToggle} type="button">
        <div className={styles.cardHeaderLeft}>
          <Icon name={icon} size={16} color="#6F7A90" />
          <span className={styles.cardTitle}>{title}</span>
          {isComplete && (
            <span className={styles.completeBadge}>
              <Icon name="solar:check-read-linear" size={8} color="#fff" />
            </span>
          )}
        </div>
        <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}>
          <Icon name="solar:alt-arrow-down-linear" size={16} color="#6F7A90" />
        </span>
      </button>
      {expanded && <div className={styles.cardBody}>{children}</div>}
    </div>
  );
}

/* ─────────────── CustomSelect ─────────────── */
export function CustomSelect({ id, value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.id === value);

  return (
    <div className={styles.selectWrap} ref={ref}>
      <button id={id} className={styles.selectBtn} onClick={() => setOpen(!open)} type="button">
        <span className={`${styles.selectBtnText} ${!selected ? styles.selectBtnPlaceholder : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <Icon name="solar:alt-arrow-down-linear" size={12} color="#8A94A8" />
      </button>
      {open && (
        <div className={styles.selectDropdown}>
          {options.map(o => (
            <div
              key={o.id}
              className={`${styles.selectOption} ${value === o.id ? styles.selectOptionActive : ''}`}
              onClick={() => { onChange(o.id); setOpen(false); }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Slider ─────────────── */
function getSliderColor(value) {
  if (value >= 80) return { bg: 'var(--status-success)', border: '#34d399', light: 'var(--status-success-light)' };
  if (value >= 40) return { bg: '#F59E0B', border: '#FCD34D', light: '#FEF3C7' };
  return { bg: '#FA4335', border: '#FF766C', light: '#FEE2E2' };
}

export function ConfigureSlider({ value, onChange, label, badgeText }) {
  const color = getSliderColor(value);
  const badgeClass = value >= 80 ? styles.sliderBadgeHigh : value >= 40 ? styles.sliderBadgeMedium : styles.sliderBadgeLow;

  return (
    <div className={styles.sliderRow}>
      <div className={styles.sliderHeader}>
        <span className={styles.sliderLabel}>{label}</span>
        <span className={`${styles.sliderBadge} ${badgeClass}`}>{badgeText}</span>
      </div>
      <div className={styles.sliderTrackArea}>
        <div className={styles.sliderTrack}>
          <div className={styles.sliderFill} style={{ width: `${value}%`, background: color.bg }} />
        </div>
        {/* Glow behind thumb */}
        <div
          className={styles.sliderGlow}
          style={{ left: `${value}%`, background: color.bg }}
        />
        {/* Pill thumb */}
        <div
          className={styles.sliderThumb}
          style={{ left: `${value}%`, background: color.bg, borderColor: color.border }}
        >
          <Icon name="solar:bolt-bold" size={12} color="#fff" />
          <span className={styles.sliderThumbText}>{value}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={styles.sliderInput}
        />
      </div>
    </div>
  );
}

/* ─────────────── Checkbox ─────────────── */
export function ConfigureCheckbox({ checked, onChange, label }) {
  return (
    <label className={styles.checkboxItem}>
      <input
        type="checkbox"
        className={styles.srOnlyInput}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={`${styles.checkboxBox} ${checked ? styles.checkboxBoxChecked : ''}`}>
        {checked && <Icon name="solar:check-read-linear" size={14} color="#fff" />}
      </span>
      <span className={`${styles.checkboxLabel} ${checked ? styles.checkboxLabelChecked : ''}`}>
        {label}
      </span>
    </label>
  );
}

/* ─────────────── RadioCard ─────────────── */
export function RadioCard({ selected, onClick, title, desc, className }) {
  return (
    <div
      className={`${styles.radioCard} ${selected ? styles.radioCardSelected : ''} ${className || ''}`}
      onClick={onClick}
    >
      <span className={`${styles.radioDot} ${selected ? styles.radioDotSelected : ''}`} />
      <div className={styles.radioCardContent}>
        <span className={styles.radioCardTitle}>{title}</span>
        {desc && <span className={styles.radioCardDesc}>{desc}</span>}
      </div>
    </div>
  );
}

/* ─────────────── GoalSelector ─────────────── */
export function GoalSelector({ id, selectedIds, onToggle, onPreview }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const goalsData = useAppStore(s => s.goalsData) || [];
  const fetchGoals = useAppStore(s => s.fetchGoals);

  useEffect(() => {
    if (!goalsData.length) fetchGoals();
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedGoals = goalsData.filter(g => selectedIdSet.has(g.id));

  return (
    <div className={styles.goalSelector} ref={ref}>
      <button id={id} className={styles.selectBtn} onClick={() => setOpen(!open)} type="button">
        <span className={`${styles.selectBtnText} ${!selectedIds.length ? styles.selectBtnPlaceholder : ''}`}>
          {selectedIds.length ? `${selectedIds.length} goal${selectedIds.length > 1 ? 's' : ''} selected` : 'Select goals…'}
        </span>
        <Icon name="solar:alt-arrow-down-linear" size={12} color="#8A94A8" />
      </button>

      {open && (
        <div className={styles.goalDropdown}>
          {goalsData.length === 0 ? (
            <div className={styles.goalEmpty}>No goals found. Create goals in Settings.</div>
          ) : goalsData.map(g => {
            const isSelected = selectedIdSet.has(g.id);
            return (
              <div key={g.id} className={styles.goalOption} onClick={() => onToggle(g.id)}>
                <span className={`${styles.goalOptionCheck} ${isSelected ? styles.goalOptionCheckSelected : ''}`}>
                  {isSelected && <Icon name="solar:check-read-linear" size={10} color="#fff" />}
                </span>
                <div className={styles.goalOptionInfo}>
                  <div className={styles.goalOptionName}>{g.name}</div>
                  <div className={styles.goalOptionMeta}>{g.steps?.length || 0} steps &middot; {g.status}</div>
                </div>
                <span className={`${styles.programBadge} ${goalProgramBadgeClass(g.program)}`}>{g.program}</span>
              </div>
            );
          })}
        </div>
      )}

      {selectedGoals.length > 0 && (
        <div className={styles.goalTags}>
          {selectedGoals.map(g => (
            <span key={g.id} className={styles.goalTag}>
              {g.name}
              <button className={styles.goalTagPreview} type="button" onClick={() => onPreview(g.id)} title="Preview goal">
                <Icon name="solar:eye-linear" size={14} color="#8C5AE2" />
              </button>
              <CloseButton size={12} onClick={() => onToggle(g.id)} className={styles.goalTagRemove} label="Remove" />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
