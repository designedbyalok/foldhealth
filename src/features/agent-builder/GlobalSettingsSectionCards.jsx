import { Select } from '../../components/Select/Select';
import {
  Section, Field, StaticField, SliderField, ToggleRow, CheckRow, NumberUnit,
} from './GlobalSettingsParts';
import {
  LLM_MODELS, VOICES, LANGUAGES, BACKGROUND_SOUNDS, VOICEMAIL_ACTIONS, FALLBACK_BEHAVIORS,
} from './GlobalSettingsParts.constants';
import styles from './GlobalSettings.module.css';

export function GlobalSettingsIdentitySection({ settings, update, errors, markTouched, showAgentNameError, showUseCaseError }) {
  return (
    <Section
      icon="solar:user-rounded-linear"
      title="Agent Identity"
      description="Select from the library or add custom goals to guide instruction generation."
    >
      <StaticField label="Agent type" value={settings.agentType} />
      <Field label="Agent Name" required>
        <input aria-label="Agent Name"
          type="text"
          className={`${styles.input} ${showAgentNameError ? styles.inputError : ''}`}
          value={settings.agentName}
          onChange={e => update('agentName', e.target.value)}
          onBlur={() => markTouched('agentName')}
          placeholder="Enter agent name"
          aria-invalid={!!showAgentNameError}
        />
        {showAgentNameError && <span className={styles.errorMsg}>{errors.agentName}</span>}
      </Field>
      <Field
        label="Use Case"
        required
        footer={
          <>
            {showUseCaseError && <span className={styles.errorMsg}>{errors.useCaseName}</span>}
            <span className={styles.charCount} style={{ marginLeft: 'auto' }}>
              {settings.useCaseName.length}/500
            </span>
          </>
        }
      >
        <textarea aria-label="Use case name"
          className={`${styles.textarea} ${showUseCaseError ? styles.inputError : ''}`}
          value={settings.useCaseName}
          onChange={e => update('useCaseName', e.target.value.slice(0, 500))}
          onBlur={() => markTouched('useCaseName')}
          maxLength={500}
          rows={2}
          placeholder="Describe what this agent is for"
          aria-invalid={!!showUseCaseError}
        />
      </Field>
    </Section>
  );
}

export function GlobalSettingsPromptAndUtilitySection({ settings, update }) {
  return (
    <>
      <Section
        icon="solar:pen-new-square-linear"
        title="Global Prompt"
        defaultOpen={false}
        description="Persona, instructions, and guardrails applied across every node."
      >
        <Field label="Model">
          <Select
            options={LLM_MODELS.map(m => ({ value: m.id, label: m.label }))}
            value={settings.llmModel}
            onChange={v => update('llmModel', v)}
          />
        </Field>
        <textarea aria-label="Global prompt"
          className={styles.textarea}
          value={settings.globalPrompt}
          onChange={e => update('globalPrompt', e.target.value)}
          rows={8}
          placeholder="You are an AI assistant calling on behalf of the care team..."
        />
      </Section>

      <Section
        icon="solar:settings-linear"
        title="Utility Configuration"
        defaultOpen={false}
        description="Reusable variables and dynamic context available to every node. Reference with {{variable_name}} from any prompt."
      >
        <Field label="Utility Variables">
          <textarea aria-label="Utility Variables"
            className={styles.textarea}
            value={(settings.utilityVariables || []).join('\n')}
            onChange={e => update('utilityVariables', e.target.value.split('\n').filter(Boolean))}
            rows={4}
            placeholder="patient.name=Jane Doe&#10;patient.dob=1986-04-12&#10;previous_conversation=Discussed med refills"
          />
        </Field>
      </Section>
    </>
  );
}

export function GlobalSettingsInterfaceAndVoiceSection({ settings, update }) {
  return (
    <>
      <Section
        icon="solar:monitor-linear"
        title="Interface"
        defaultOpen={false}
        description="How the agent connects with users — voice, chat, or both — and which languages it speaks."
      >
        <Field label="Modality">
          <Select
            options={[
              { value: 'voice', label: 'Voice' },
              { value: 'chat', label: 'Chat' },
              { value: 'both', label: 'Both' },
            ]}
            value={settings.interfaceMode}
            onChange={v => update('interfaceMode', v)}
          />
        </Field>
        <ToggleRow
          label="Allow multiple languages"
          hint="Agent can switch between selected languages mid-call."
          checked={settings.multipleLanguages}
          onChange={v => update('multipleLanguages', v)}
        />
        <Field label={settings.multipleLanguages ? 'Languages' : 'Agent Language'}>
          {settings.multipleLanguages ? (
            <div className={styles.checkGrid}>
              {LANGUAGES.map(l => (
                <CheckRow
                  key={l}
                  label={l}
                  checked={(settings.languages || []).includes(l)}
                  onChange={(checked) => {
                    const list = settings.languages || [];
                    update('languages', checked ? [...list, l] : list.filter(x => x !== l));
                  }}
                />
              ))}
            </div>
          ) : (
            <Select
              options={LANGUAGES.map(l => ({ value: l, label: l }))}
              value={settings.agentLanguage}
              onChange={v => update('agentLanguage', v)}
            />
          )}
        </Field>
      </Section>

      <Section
        icon="solar:volume-loud-linear"
        title="Voice Configuration"
        defaultOpen={false}
      >
        <Field label="Voice">
          <Select
            options={VOICES.map(v => ({ value: v.id, label: v.label }))}
            value={settings.voiceId}
            onChange={v => update('voiceId', v)}
          />
        </Field>
        <SliderField
          label="Voice Temperature"
          hint="Lower is more stable, higher is more variant."
          value={settings.voiceTemperature}
          onChange={v => update('voiceTemperature', v)}
        />
        <SliderField
          label="Voice Speed"
          hint="Talking pace."
          value={settings.voiceSpeed}
          min={0.5}
          max={2}
          step={0.05}
          formatValue={v => `${v.toFixed(2)}×`}
          onChange={v => update('voiceSpeed', v)}
        />
        <SliderField
          label="Voice Volume"
          value={settings.voiceVolume}
          min={0}
          max={2}
          step={0.05}
          formatValue={v => `${Math.round(v * 100)}%`}
          onChange={v => update('voiceVolume', v)}
        />
      </Section>
    </>
  );
}

export function GlobalSettingsSpeechAndCallSection({ settings, update }) {
  return (
    <>
      <Section
        icon="solar:chat-round-dots-linear"
        title="Speech Settings"
        defaultOpen={false}
      >
        <Field label="Background Sound">
          <Select
            options={BACKGROUND_SOUNDS.map(s => ({ value: s.id, label: s.label }))}
            value={settings.backgroundSound}
            onChange={v => update('backgroundSound', v)}
          />
        </Field>

        <SliderField
          label="Responsiveness"
          hint="Control how fast the agent responds after users finish speaking."
          value={settings.responsiveness}
          min={0}
          max={1}
          step={0.05}
          formatValue={false}
          onChange={v => update('responsiveness', v)}
          extra={
            <CheckRow
              label="Dynamically adjust based on user input"
              checked={settings.responsivenessDynamic}
              onChange={v => update('responsivenessDynamic', v)}
            />
          }
        />

        <SliderField
          label="Interruption Sensitivity"
          hint="Control how sensitively AI can be interrupted by human speech."
          value={settings.interruptionSensitivity}
          min={0}
          max={1}
          step={0.05}
          formatValue={false}
          onChange={v => update('interruptionSensitivity', v)}
        />

        <ToggleRow
          label="Enable Backchanneling"
          hint='Enables the agent to use affirmations like "yeah" or "uh-huh" during conversations.'
          checked={settings.enableBackchanneling}
          onChange={v => update('enableBackchanneling', v)}
        />

        <ToggleRow
          label="Enable Speech Normalization"
          hint="Converts text elements like numbers, currency, and dates into human-like spoken forms."
          checked={settings.enableSpeechNormalization}
          onChange={v => update('enableSpeechNormalization', v)}
        />

        <Field label="Reminder Message Frequency" hint="Control how often AI will send a reminder message.">
          <div className={styles.numberUnitRow}>
            <NumberUnit
              value={settings.reminderEverySec}
              onChange={v => update('reminderEverySec', v)}
              unit="seconds"
              ariaLabel="Reminder interval in seconds"
              min={1}
              max={300}
            />
            <NumberUnit
              value={settings.reminderTimes}
              onChange={v => update('reminderTimes', v)}
              unit="times"
              ariaLabel="Number of reminders"
              min={1}
              max={20}
            />
          </div>
        </Field>
      </Section>

      <Section
        icon="solar:phone-linear"
        title="Call Settings"
        defaultOpen={false}
      >
        <ToggleRow
          label="Voicemail Detection"
          hint="Detect voicemail and decide what to do."
          checked={settings.voicemailDetection}
          onChange={v => update('voicemailDetection', v)}
        />
        {settings.voicemailDetection && (
          <>
            <Field label="When voicemail is detected">
              <Select
                options={VOICEMAIL_ACTIONS.map(a => ({ value: a.id, label: a.label }))}
                value={settings.voicemailAction}
                onChange={v => update('voicemailAction', v)}
              />
            </Field>
            {settings.voicemailAction === 'leave' && (
              <Field label="Voicemail Message">
                <textarea
                  className={styles.textarea}
                  value={settings.voicemailMessage}
                  onChange={e => update('voicemailMessage', e.target.value)}
                  rows={3}
                />
              </Field>
            )}
          </>
        )}
        <SliderField
          label="End Call on Silence"
          hint="Hang up after N seconds of silence."
          value={settings.endOnSilenceSec}
          min={5}
          max={120}
          step={1}
          formatValue={v => `${Math.round(v)}s`}
          onChange={v => update('endOnSilenceSec', v)}
        />
        <SliderField
          label="Maximum Call Duration"
          value={settings.maxCallDurationMin}
          min={1}
          max={120}
          step={1}
          formatValue={v => `${Math.round(v)} min`}
          onChange={v => update('maxCallDurationMin', v)}
        />
        <SliderField
          label="Pause Before Speaking"
          hint="Initial delay before agent speaks."
          value={settings.pauseBeforeSpeakingSec}
          min={0}
          max={3}
          step={0.1}
          formatValue={v => `${v.toFixed(1)}s`}
          onChange={v => update('pauseBeforeSpeakingSec', v)}
        />
        <Field label="Speaker Priority">
          <Select
            options={[
              { value: 'agent', label: 'Agent speaks first' },
              { value: 'user', label: 'User speaks first' },
            ]}
            value={settings.speakerPriority}
            onChange={v => update('speakerPriority', v)}
          />
        </Field>
      </Section>
    </>
  );
}

export function GlobalSettingsSecurityAndMessagesSection({ settings, update }) {
  return (
    <>
      <Section
        icon="solar:shield-check-linear"
        title="Security & Fallback Settings"
        defaultOpen={false}
      >
        <ToggleRow
          label="Opt out of sensitive data storage"
          hint="Don't persist potentially sensitive transcript data."
          checked={settings.optOutSensitive}
          onChange={v => update('optOutSensitive', v)}
        />
        <Field label="Webhook URL" hint="POST event payloads here.">
          <input aria-label="Webhook URL"
            type="url"
            className={styles.input}
            value={settings.webhookUrl}
            onChange={e => update('webhookUrl', e.target.value)}
            placeholder="https://api.example.com/retell/events"
          />
        </Field>
        <Field label="Fallback Behavior" hint="What to do if the agent fails or stalls.">
          <Select
            options={FALLBACK_BEHAVIORS.map(f => ({ value: f.id, label: f.label }))}
            value={settings.fallbackBehavior}
            onChange={v => update('fallbackBehavior', v)}
          />
        </Field>
      </Section>

      <Section
        icon="solar:pen-new-square-linear"
        title="Summary template"
        defaultOpen={false}
        description="Format the post-call summary the agent generates. Use {{variable}} placeholders."
      >
        <textarea aria-label="Summary template"
          className={styles.textarea}
          value={settings.summaryTemplate}
          onChange={e => update('summaryTemplate', e.target.value)}
          rows={6}
          placeholder={'Caller: {{caller_name}}\nReason: {{reason}}\nKey points: {{key_points}}\nNext step: {{next_step}}'}
        />
      </Section>

      <Section
        icon="solar:chat-round-dots-linear"
        title="Welcome message"
        defaultOpen={false}
        description="First thing the agent says when the call connects."
      >
        <textarea aria-label="Welcome message"
          className={styles.textarea}
          value={settings.welcomeMessage}
          onChange={e => update('welcomeMessage', e.target.value)}
          rows={3}
          placeholder="Hi, this is Anna calling from your care team. Is now a good time to talk?"
        />
      </Section>
    </>
  );
}
