import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { Icon } from '../../../components/Icon/Icon';
import avergentLogoUrl from '../assets/avergent-logo.png';
import prominenceLogoUrl from '../assets/prominence-logo.svg?url';
import { FieldLabel, CollapsibleSection, RichTextNote, DateRangePicker } from './InsurancePlanFormUtils';
import {
  readImagePreviewUrl, preventDefaultDrag, numericOnly, FIELD_INFO, MEDICAL_BENEFITS_OPTIONS,
} from './CreateInsurancePlanDrawer.utils';
import styles from './CreateInsurancePlanDrawer.module.css';

export function CreateInsurancePlanStepOne({
  form,
  set,
  setVal,
  setPhone,
  setForm,
  markDirty,
  handleZipChange,
  zipInvalid,
  err,
  logoChoice,
  handleLogoChoice,
  showErrors,
  hasLogo,
  customLogoUrl,
  fileInputRef,
  handleCustomLogoDrop,
  handleCustomLogoPick,
  clearCustomLogo,
  tpaLogoPreviewUrl,
  tpaFileInputRef,
  setTpaLogo,
  clearTpaLogo,
}) {
  return (
    <>
      <CollapsibleSection icon="solar:shield-user-linear" title="Plan Identifiers">
        <div className={styles.row}>
          <div className={styles.field}>
            <FieldLabel required>Plan Name</FieldLabel>
            <Input placeholder="Enter Plan Name" value={form.planName} onChange={set('planName')} invalid={err('planName')} />
            {err('planName') && <span className={styles.errorText}>Plan Name is required</span>}
          </div>
          <div className={styles.field}>
            <FieldLabel required>Plan Type</FieldLabel>
            <Input value={form.planType} disabled readOnly />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <FieldLabel>Plan Validity</FieldLabel>
            <DateRangePicker
              startDate={form.planStartDate}
              endDate={form.planEndDate}
              onChange={({ start, end }) => {
                markDirty();
                setForm(f => ({ ...f, planStartDate: start, planEndDate: end }));
              }}
            />
          </div>
          <div className={styles.field}>
            <FieldLabel required info={FIELD_INFO.groupNumber}>Group Number</FieldLabel>
            <Input placeholder="Enter Group Number" value={form.groupNumber} onChange={set('groupNumber')} invalid={err('groupNumber')} />
            {err('groupNumber') && <span className={styles.errorText}>Group Number is required</span>}
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <FieldLabel required info={FIELD_INFO.externalId}>External ID</FieldLabel>
            <Input placeholder="Enter External ID" value={form.externalId} onChange={set('externalId')} invalid={err('externalId')} />
            {err('externalId') && <span className={styles.errorText}>External ID is required</span>}
          </div>
          <div className={styles.field}>
            <FieldLabel required info={FIELD_INFO.ediPayerId}>EDI Payer ID</FieldLabel>
            <Input placeholder="Enter EDI Payer ID" value={form.ediPayerId} onChange={set('ediPayerId')} invalid={err('ediPayerId')} />
            {err('ediPayerId') && <span className={styles.errorText}>EDI Payer ID is required</span>}
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <FieldLabel>Provider Network Name</FieldLabel>
            <Input placeholder="Enter Provider Network Name" value={form.providerNetworkName} onChange={set('providerNetworkName')} />
          </div>
          <div className={styles.field}>
            <FieldLabel>Provider Portal</FieldLabel>
            <Input placeholder="Enter Provider Portal URL" value={form.providerPortal} onChange={set('providerPortal')} />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <FieldLabel>Medical Benefits</FieldLabel>
            <Select
              options={MEDICAL_BENEFITS_OPTIONS}
              value={form.medicalBenefits || undefined}
              onValueChange={setVal('medicalBenefits')}
              placeholder="Select Medical Benefits"
            />
          </div>
          <div className={styles.field} aria-hidden="true" />
        </div>

        <div className={styles.fieldFull}>
          <FieldLabel required>Choose Plan Logo (Front of Card)</FieldLabel>
          <div className={styles.logoTileRow}>
            {/* Wrapper stays a div: it contains the RadioButton <button>, and
                button-in-button is invalid interactive nesting. */}
            <div
              className={`${styles.logoTile} ${logoChoice === 'avergent' ? styles.logoTileSelected : ''}`}
              onClick={() => handleLogoChoice('avergent')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLogoChoice('avergent'); } }}
            >
              <RadioButton checked={logoChoice === 'avergent'} onChange={() => handleLogoChoice('avergent')} />
              <img src={avergentLogoUrl} alt="Avergent Health" className={styles.logoTileImgAvergent} />
              <span className={styles.logoRadioSpacer} />
            </div>
            <div
              className={`${styles.logoTile} ${logoChoice === 'prominence' ? styles.logoTileSelected : ''}`}
              onClick={() => handleLogoChoice('prominence')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLogoChoice('prominence'); } }}
            >
              <RadioButton checked={logoChoice === 'prominence'} onChange={() => handleLogoChoice('prominence')} />
              <img src={prominenceLogoUrl} alt="Prominence Health" className={styles.logoTileImgProminence} />
              <span className={styles.logoRadioSpacer} />
            </div>
            <div
              className={`${styles.logoTile} ${logoChoice === 'custom' ? styles.logoTileSelected : ''}`}
              onClick={() => handleLogoChoice('custom')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLogoChoice('custom'); } }}
            >
              <RadioButton checked={logoChoice === 'custom'} onChange={() => handleLogoChoice('custom')} />
              <span className={styles.logoTileUploadLabel}>Upload File</span>
              <span className={styles.logoRadioSpacer} />
            </div>
            <input ref={fileInputRef} type="file" accept=".svg,image/*" style={{ display: 'none' }} onChange={handleCustomLogoPick} />
          </div>
          {showErrors && !hasLogo && <span className={styles.errorText}>Plan Logo is required</span>}
          {logoChoice === 'custom' && (
            customLogoUrl ? (
              <div className={styles.logoPreviewContainer} style={{ marginTop: 8 }}>
                <div className={styles.logoImgWrap}>
                  <img src={customLogoUrl} alt="Custom Logo" className={styles.logoPreviewImg} />
                </div>
                <div className={styles.logoActions}>
                  <button className={styles.logoActionBtn} onClick={() => fileInputRef.current?.click()}>
                    <Icon name="solar:restart-linear" size={12} color="var(--neutral-300)" />
                    <span>Replace</span>
                  </button>
                  <button className={`${styles.logoActionBtn} ${styles.logoDeleteBtn}`} onClick={clearCustomLogo}>
                    <Icon name="solar:trash-bin-2-linear" size={12} color="#D72825" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.dropZone} style={{ marginTop: 8 }} onDragOver={e => e.preventDefault()} onDrop={handleCustomLogoDrop} onClick={() => fileInputRef.current?.click()}>
                  <Icon name="solar:upload-minimalistic-linear" size={24} color="var(--neutral-200)" />
                  <div className={styles.dropZoneText}>Drag and drop file here or <span className={styles.dropZoneLink}>Choose file</span></div>
                </div>
                <div className={styles.dropZoneMeta}>
                  <span className={styles.dropZoneMetaText}>Supported formats: SVG</span>
                  <span className={styles.dropZoneMetaText}>Max size: 5 MB</span>
                </div>
              </>
            )
          )}
        </div>

        <div className={styles.fieldFull}>
          <FieldLabel>Choose Third Party Administrator Logo (Back of Card)</FieldLabel>
          {tpaLogoPreviewUrl ? (
            <div className={styles.logoPreviewContainer}>
              <div className={styles.logoImgWrap}>
                <img src={tpaLogoPreviewUrl} alt="TPA Logo" className={styles.logoPreviewImg} />
              </div>
              <div className={styles.logoActions}>
                <button className={styles.logoActionBtn} onClick={() => tpaFileInputRef.current?.click()}>
                  <Icon name="solar:restart-linear" size={12} color="var(--neutral-300)" />
                  <span>Replace</span>
                </button>
                <button className={`${styles.logoActionBtn} ${styles.logoDeleteBtn}`} onClick={clearTpaLogo}>
                  <Icon name="solar:trash-bin-2-linear" size={12} color="#D72825" />
                  <span>Delete</span>
                </button>
              </div>
              <input ref={tpaFileInputRef} type="file" accept=".svg,image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files[0]; if (f) readImagePreviewUrl(f, setTpaLogo); }} />
            </div>
          ) : (
            <>
              <div className={styles.dropZone} onDragOver={preventDefaultDrag}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) readImagePreviewUrl(f, setTpaLogo); }}
                onClick={() => tpaFileInputRef.current?.click()}>
                <Icon name="solar:upload-minimalistic-linear" size={24} color="var(--neutral-200)" />
                <div className={styles.dropZoneText}>Drag and drop file here or <span className={styles.dropZoneLink}>Choose file</span></div>
                <input ref={tpaFileInputRef} type="file" accept=".svg,image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files[0]; if (f) readImagePreviewUrl(f, setTpaLogo); }} />
              </div>
              <div className={styles.dropZoneMeta}>
                <span className={styles.dropZoneMetaText}>Supported formats: SVG</span>
                <span className={styles.dropZoneMetaText}>Max size: 5 MB</span>
              </div>
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection icon="solar:phone-calling-linear" title="Support Info">
        <div className={styles.row}>
          <div className={styles.field}>
            <FieldLabel required>Member Support Phone Number</FieldLabel>
            <Input placeholder="Enter Phone Number" value={form.memberSupportPhone} onChange={setPhone('memberSupportPhone')} invalid={err('memberSupportPhone')} />
            {err('memberSupportPhone') && <span className={styles.errorText}>Member Support Phone Number is required</span>}
          </div>
          <div className={styles.field}>
            <FieldLabel required>Provider Support Phone Number</FieldLabel>
            <Input placeholder="Enter Phone Number" value={form.providerSupportPhone} onChange={setPhone('providerSupportPhone')} invalid={err('providerSupportPhone')} />
            {err('providerSupportPhone') && <span className={styles.errorText}>Provider Support Phone Number is required</span>}
          </div>
        </div>

        <div className={styles.sectionDivider} />

        <div className={styles.claimsGroup}>
          <span className={styles.groupHeading}>Claims Mailing Address</span>
          <div className={styles.addressStack}>
            <div className={styles.fieldFull}>
              <FieldLabel required>Address Line 1</FieldLabel>
              <Input placeholder="Address Line 1" value={form.addressLine1} onChange={set('addressLine1')} invalid={err('addressLine1')} />
              {err('addressLine1') && <span className={styles.errorText}>Address Line 1 is required</span>}
            </div>
            <div className={styles.fieldFull}>
              <FieldLabel>Address Line 2</FieldLabel>
              <Input placeholder="Address Line 2" value={form.addressLine2} onChange={set('addressLine2')} />
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <FieldLabel required>Zipcode</FieldLabel>
                <Input placeholder="Enter Zipcode" value={form.zipcode} onChange={handleZipChange} maxLength={5} invalid={zipInvalid || err('zipcode')} />
                {zipInvalid
                  ? <span className={styles.errorText}>Please enter valid zipcode</span>
                  : err('zipcode') && <span className={styles.errorText}>Zipcode is required</span>}
              </div>
              <div className={styles.field}>
                <FieldLabel required>City</FieldLabel>
                <Input placeholder="City" value={form.city} disabled readOnly />
              </div>
              <div className={styles.field}>
                <FieldLabel required>State</FieldLabel>
                <Input placeholder="State" value={form.state} disabled readOnly />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.sectionDivider} />

        <div className={styles.fieldFull}>
          <FieldLabel>Plan Website URL</FieldLabel>
          <Input placeholder="Paste Website URL" value={form.planWebsiteUrl} onChange={set('planWebsiteUrl')} />
        </div>

        <div className={styles.fieldFull}>
          <FieldLabel>Additional Note</FieldLabel>
          <RichTextNote
            value={form.additionalNote}
            onChange={(html) => { markDirty(); setForm(f => ({ ...f, additionalNote: html })); }}
            placeholder="Add Additional Note"
            maxLength={150}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection icon="solar:pill-linear" title="Prescription Benefits">
        <div className={styles.row}>
          <div className={styles.field}>
            <FieldLabel>Pharmacy Benefits Manager Name</FieldLabel>
            <Input placeholder="Select Pharmacy Benefits Manager" value={form.pbmName} onChange={set('pbmName')} />
          </div>
          <div className={styles.field}>
            <FieldLabel>Pharmacy Benefits Manager Phone</FieldLabel>
            <Input placeholder="Enter Pharmacy Benefits Manager Phone" value={form.pbmPhone} onChange={setPhone('pbmPhone')} />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <FieldLabel>Pharmacy Benefits Manager URL</FieldLabel>
            <Input placeholder="Select Pharmacy Benefits Manager URL" value={form.pbmUrl} onChange={set('pbmUrl')} />
          </div>
          <div className={styles.field}>
            <FieldLabel info={FIELD_INFO.rxBin}>Rx BIN</FieldLabel>
            <Input placeholder="Enter RxBIN" value={form.rxBin} onChange={e => { markDirty(); setForm(f => ({ ...f, rxBin: numericOnly(e.target.value) })); }} />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <FieldLabel info={FIELD_INFO.rxPcn}>Rx PCN</FieldLabel>
            <Input placeholder="Enter RxPCN" value={form.rxPcn} onChange={set('rxPcn')} />
          </div>
          <div className={styles.field}>
            <FieldLabel info={FIELD_INFO.rxGroup}>Rx Group</FieldLabel>
            <Input placeholder="Enter RxGroup" value={form.rxGroup} onChange={set('rxGroup')} />
          </div>
        </div>
      </CollapsibleSection>
    </>
  );
}
