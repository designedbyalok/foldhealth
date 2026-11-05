import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { InsuranceCardPreview } from './InsuranceCardPreview';
import { TierForm } from './CreateInsurancePlanTierForm';
import { CreateInsurancePlanStepOne } from './CreateInsurancePlanStepOne';
import { CreateInsurancePlanDialogs } from './CreateInsurancePlanDialogs';
import { useCreateInsurancePlanDrawer } from './useCreateInsurancePlanDrawer';
import styles from './CreateInsurancePlanDrawer.module.css';

export function CreateInsurancePlanDrawer({ onClose, onSave = () => {}, initialPlan, mode = 'create' }) {
  const plan = useCreateInsurancePlanDrawer({ initialPlan, mode, onClose, onSave });

  return (
    <>
      <Drawer
        title={plan.isEdit ? 'Edit Insurance Plan' : 'New Insurance Plan'}
        onClose={plan.handleClose}
        headerRight={
          <>
            {plan.showPreview ? (
              <Button variant="outline" leadingIcon="solar:eye-closed-linear" onClick={() => plan.setShowPreview(false)}>
                Hide ID Preview
              </Button>
            ) : (
              <Button variant="outline" leadingIcon="solar:eye-linear" onClick={() => plan.setShowPreview(true)}>
                Show ID Preview
              </Button>
            )}
            <span className={styles.headerDivider} />
            <Button onClick={plan.handleSave} style={plan.canSave ? undefined : { opacity: 0.5 }}>Save</Button>
            <span className={styles.headerDivider} />
          </>
        }
        className={`insurancePlanPanel ${plan.showPreview ? styles.widePanel : styles.narrowPanel}`}
        bodyClassName={styles.drawerBody}
        headerStyle={{ padding: '8px 12px 8px 16px', borderBottom: '0.5px solid var(--neutral-150)' }}
        titleStyle={{ fontSize: 'var(--font-lg)', fontWeight: 500 }}
      >
        <div className={styles.leftPanel}>
          <div className={styles.stageNavRow}>
            <div className={styles.stageNav}>
              <button className={styles.stageItem} onClick={() => plan.setStep(1)}>
                <span className={`${styles.stageBadge} ${plan.step === 1 ? styles.stageBadgeActive : styles.stageBadgeInactive}`}>1</span>
                <span className={`${styles.stageLabel} ${plan.step === 1 ? styles.stageLabelActive : styles.stageLabelInactive}`}>Plan Information</span>
              </button>
              <span className={styles.stageConnector} />
              <button className={styles.stageItem} onClick={() => (plan.step === 1 ? plan.goToStep2() : plan.setStep(2))} style={{ cursor: 'pointer' }}>
                <span className={`${styles.stageBadge} ${plan.step === 2 ? styles.stageBadgeActive : styles.stageBadgeInactive}`}>2</span>
                <span className={`${styles.stageLabel} ${plan.step === 2 ? styles.stageLabelActive : styles.stageLabelInactive}`}>Cost Sharing(Tier)</span>
              </button>
            </div>
            <div className={styles.stageNavRight}>
              {plan.step === 1 ? (
                <Button onClick={plan.goToStep2} style={plan.canSave ? undefined : { opacity: 0.5 }}>Next</Button>
              ) : (
                <Button variant="outline" onClick={() => plan.setStep(1)}>Previous</Button>
              )}
            </div>
          </div>

          {plan.step === 2 && (
            <div className={styles.tiersHeaderRow}>
              <div className={styles.tiersHeaderLeft}>
                <Icon name="solar:layers-minimalistic-linear" size={16} color="var(--primary-300)" />
                <span className={styles.tiersHeaderLabel}>Tier</span>
              </div>
              <Button variant="soft" size="sm" leadingIcon="solar:add-circle-linear" onClick={plan.addTier}>Add New</Button>
            </div>
          )}

          <div className={styles.leftScroll}>
            {plan.step === 1 ? (
              <CreateInsurancePlanStepOne
                form={plan.form}
                set={plan.set}
                setVal={plan.setVal}
                setPhone={plan.setPhone}
                setForm={plan.setForm}
                markDirty={plan.markDirty}
                handleZipChange={plan.handleZipChange}
                zipInvalid={plan.zipInvalid}
                err={plan.err}
                logoChoice={plan.logoChoice}
                handleLogoChoice={plan.handleLogoChoice}
                showErrors={plan.showErrors}
                hasLogo={plan.hasLogo}
                customLogoUrl={plan.customLogoUrl}
                fileInputRef={plan.fileInputRef}
                handleCustomLogoDrop={plan.handleCustomLogoDrop}
                handleCustomLogoPick={plan.handleCustomLogoPick}
                clearCustomLogo={plan.clearCustomLogo}
                tpaLogoPreviewUrl={plan.tpaLogoPreviewUrl}
                tpaFileInputRef={plan.tpaFileInputRef}
                setTpaLogo={plan.setTpaLogo}
                clearTpaLogo={plan.clearTpaLogo}
              />
            ) : (
              <div className={styles.costSharingContent}>
                {plan.tiers.map((tier, index) => (
                  <div key={tier.id} ref={el => { plan.tierRefs.current[tier.id] = el; }} style={{ scrollMarginTop: 8 }}>
                    <TierForm
                      tier={tier}
                      index={index}
                      expanded={plan.expandedTiers.has(tier.id)}
                      isActive={tier.id === plan.activeTierId}
                      onToggle={() => plan.toggleTier(tier.id)}
                      onUpdate={plan.updateTier}
                      onDelete={plan.deleteTier}
                      isOnly={plan.tiers.length === 1}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {plan.showPreview && (
          <div className={styles.rightPanel}>
            <div className={styles.previewHeader}>
              <span className={styles.previewTitle}>Card Preview</span>
            </div>
            <InsuranceCardPreview
              data={plan.previewData}
              logoPreviewUrl={plan.activeLogoUrl}
              tpaLogoPreviewUrl={plan.tpaLogoPreviewUrl}
              cardTheme={plan.cardTheme}
              onThemeChange={plan.setCardTheme}
              logoChoice={plan.logoChoice}
              coverageFamily={plan.firstTier.coverageFamily ?? false}
            />
          </div>
        )}
      </Drawer>

      <CreateInsurancePlanDialogs
        showDiscardDialog={plan.showDiscardDialog}
        setShowDiscardDialog={plan.setShowDiscardDialog}
        showSaveDialog={plan.showSaveDialog}
        setShowSaveDialog={plan.setShowSaveDialog}
        onClose={onClose}
        onSave={plan.handleSave}
      />
    </>
  );
}
