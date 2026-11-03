import { useState } from 'react';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../../../../../../components/MenuPopover/MenuPopover';
import { Tooltip } from '../../../../../../../components/Tooltip/Tooltip';
import { AddIconMinimalist } from '../../../../../../../components/Icon/AddIconMinimalist';
import { GbiStatusButton } from '../tables/carePlanTableShared';
import {
  REFERRAL_PARTNERS, REFERRAL_STATUSES, SDOH_DOMAINS, referralPartner, referralsFor,
} from '../lib/sdohTaxonomy';
import styles from './SdohSection.module.css';

const REFERRAL_TONE = { Draft: 'neutral', Sent: 'info', Accepted: 'warning', Completed: 'success', Declined: 'danger' };

/**
 * Social Needs (SDOH): the six domains with the needs recorded under each.
 * A need is a barrier with sdohDomain / sdohNeed (lib/sdohTaxonomy); its
 * community referrals are 'sdoh-referral' interventions on it. Shared by the
 * applied plan (`mode="plan"`: status, referrals and their status) and
 * template authoring (`mode="template"`: needs plus suggested referral
 * partners). Every callback is optional; without it the control is hidden,
 * so a read-only rendering stays read-only.
 *
 * @param {object[]} props.barriers       – SDOH barriers only
 * @param {object[]} [props.interventions] – where referrals are found
 * @param {'plan'|'template'} [props.mode='plan']
 * @param {function} [props.onAddNeed]    – (needKey) => void
 * @param {function} [props.onRemoveNeed] – (barrier) => void
 * @param {function} [props.onStatusMenu] – ({ kind: 'barrier', item, rect }) => void (plan)
 * @param {function} [props.onRefer]      – (barrier, partnerKey) => void
 * @param {function} [props.onReferralStatus] – (referral, status) => void (plan)
 * @param {function} [props.onRemoveReferral] – (referral) => void
 */
export function SdohSection({
  barriers = [],
  interventions = [],
  mode = 'plan',
  onAddNeed,
  onRemoveNeed,
  onStatusMenu,
  onRefer,
  onReferralStatus,
  onRemoveReferral,
}) {
  // { type: 'add' | 'refer' | 'referral', rect, domain?, barrier?, referral? }
  const [menu, setMenu] = useState(null);
  const open = (type, e, extra) => setMenu({ type, rect: e.currentTarget.getBoundingClientRect(), ...extra });

  const menuItems = () => {
    if (!menu) return [];
    if (menu.type === 'add') {
      const taken = new Set(barriers.filter(b => b.sdohDomain === menu.domain.key).map(b => b.sdohNeed));
      return menu.domain.needs.map(n => ({ key: n.key, label: n.label, disabled: taken.has(n.key) }));
    }
    if (menu.type === 'refer') {
      const used = new Set(referralsFor(menu.barrier, interventions).map(r => r.config?.partner));
      return REFERRAL_PARTNERS.map(p => ({
        key: p.key, icon: p.icon, label: mode === 'template' ? `Suggest ${p.label}` : `Refer via ${p.label}`,
        disabled: mode === 'template' && used.has(p.key),
      }));
    }
    return [
      ...(onReferralStatus ? REFERRAL_STATUSES.map(st => ({ key: st, label: st, selected: menu.referral.config?.referralStatus === st })) : []),
      ...(onRemoveReferral ? [{ divider: true }, { key: '__remove', icon: 'solar:trash-bin-trash-linear', label: 'Remove Referral', danger: true }] : []),
    ];
  };
  const onSelect = (key) => {
    const m = menu;
    setMenu(null);
    if (m.type === 'add') onAddNeed?.(key);
    else if (m.type === 'refer') onRefer?.(m.barrier, key);
    else if (key === '__remove') onRemoveReferral?.(m.referral);
    else onReferralStatus?.(m.referral, key);
  };

  return (
    <div className={styles.domains}>
      {SDOH_DOMAINS.map(domain => {
        const needs = barriers.filter(b => b.sdohDomain === domain.key);
        return (
          <div key={domain.key} className={styles.domain}>
            <div className={styles.domainHead}>
              <Icon name={domain.icon} size={16} color="var(--neutral-400)" />
              <span className={styles.domainLabel}>{domain.label}</span>
              {needs.length > 0 && <Badge size="xs" label={String(needs.length)} />}
              {onAddNeed && (
                <ActionButton size="sm" tooltip={`Add ${domain.label.toLowerCase()} need`} onClick={e => open('add', e, { domain })}>
                  <AddIconMinimalist size={16} color="var(--neutral-300)" />
                </ActionButton>
              )}
            </div>
            {needs.length === 0 ? (
              <span className={styles.none}>No {domain.label.toLowerCase()} needs recorded</span>
            ) : (
              <ul className={styles.needs}>
                {needs.map(b => {
                  const referrals = referralsFor(b, interventions);
                  return (
                    <li key={b.id || b.title} className={styles.need}>
                      <span className={styles.needTitle}>{b.title}</span>
                      {b.zCode && (
                        <Tooltip label="Suggested ICD-10-CM Z-code">
                          <span className={styles.zCode}>{b.zCode}</span>
                        </Tooltip>
                      )}
                      <span className={styles.needActions}>
                        {referrals.map(r => {
                          const p = referralPartner(r.config?.partner);
                          const st = r.config?.referralStatus;
                          const label = mode === 'plan' ? `${p?.label || 'Referral'} · ${st || 'Sent'}` : `${p?.label || 'Referral'} suggested`;
                          const canMenu = (mode === 'plan' && onReferralStatus) || onRemoveReferral;
                          return canMenu ? (
                            <button key={r.id || r.title} type="button" className={styles.referralBtn} onClick={e => open('referral', e, { referral: r })}>
                              <Badge tone={mode === 'plan' ? REFERRAL_TONE[st] || 'neutral' : 'primary'} size="sm" icon={p?.icon} label={label} chevron />
                            </button>
                          ) : (
                            <Badge key={r.id || r.title} tone={mode === 'plan' ? REFERRAL_TONE[st] || 'neutral' : 'primary'} size="sm" icon={p?.icon} label={label} />
                          );
                        })}
                        {onRefer && (
                          <ActionButton size="sm" icon="solar:share-circle-linear" tooltip={mode === 'template' ? 'Suggest a referral' : 'Refer to a community partner'} onClick={e => open('refer', e, { barrier: b })} />
                        )}
                        {mode === 'plan' && (
                          <GbiStatusButton
                            value={b.status || 'Not Started'} reason={b.statusReason}
                            disabled={!onStatusMenu}
                            onOpen={rect => onStatusMenu?.({ kind: 'barrier', item: b, rect })}
                          />
                        )}
                        {onRemoveNeed && (
                          <ActionButton size="sm" icon="solar:trash-bin-trash-linear" tooltip="Remove need" onClick={() => onRemoveNeed(b)} />
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
      {menu && (
        <MenuPopover
          anchorRect={menu.rect}
          align="right"
          width={menu.type === 'add' ? 300 : 200}
          ariaLabel={menu.type === 'add' ? `Add ${menu.domain.label} need` : menu.type === 'refer' ? 'Refer' : 'Referral'}
          items={menuItems()}
          onSelect={onSelect}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
