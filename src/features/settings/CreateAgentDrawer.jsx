import { useState, useMemo, useRef, useEffect, useCallback, useId } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { Icon } from '../../components/Icon/Icon';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { CloseIcon } from '../../components/Icon/CloseIcon';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';
import styles from './CreateAgentDrawer.module.css';

const TEMPLATES = [
  { id: 'toc', name: 'TOC Agent', desc: 'Manages post-discharge outreach, safety checks, med reconciliation, and risk escalation.', category: 'care' },
  { id: 'followup', name: 'Follow-up Agent', desc: 'Automates post-visit outreach, symptom tracking, adherence checks, and risk routing.', category: 'care' },
  { id: 'awv', name: 'AWV Agent', desc: 'Drives wellness visit outreach, eligibility checks, scheduling, and gap closure.', category: 'care' },
  { id: 'optimizer', name: 'Care Optimizer', desc: 'Continuously refines care plans based on outcomes and new data.', category: 'care' },
  { id: 'chronic', name: 'Chronic Care', desc: 'Monitors and nudges patients with chronic conditions.', category: 'care' },
  { id: 'scheduler', name: 'Smart Scheduler', desc: 'Optimizes appointments based on priority and capacity.', category: 'ops' },
  { id: 'auth', name: 'Auth Assist', desc: 'Automates prior authorization documentation and submission.', category: 'revenue' },
  { id: 'navigator', name: 'Care Navigator', desc: 'Guides patients through their care journey effectively.', category: 'care' },
  { id: 'denial', name: 'Denial Guard', desc: 'Improves coding accuracy and billing efficiency.', category: 'revenue' },
  { id: 'capacity', name: 'Capacity AI', desc: 'Segments patients by clinical and social risk.', category: 'ops' },
];

const METHOD_OPTIONS = [
  { id: 'prompt', icon: 'solar:text-selection-linear', title: 'Create From Prompt', desc: 'Describe your agent in plain language and AI builds the workflow' },
  { id: 'template', icon: 'solar:document-add-linear', title: 'Create From Templates', desc: 'Start from a pre-built agent for your care use case' },
  { id: 'scratch', icon: 'solar:pen-new-square-linear', title: 'Create from Scratch', desc: 'Build your agent step-by-step with full control' },
  { id: 'import', icon: 'solar:tuning-2-linear', title: 'Prompt Only', desc: 'Skip the wizard and configure via a single prompt' },
];

const UTILITY_TYPES = [
  { value: 'appointment_type', label: 'Appointment Type' },
  { value: 'form', label: 'Form' },
  { value: 'user', label: 'User' },
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
];

const TIMEZONES = [
  'Pacific Time (US)', 'Mountain Time (US)', 'Central Time (US)', 'Eastern Time (US)',
  'Alaska Time', 'Hawaii Time', 'UTC', 'GMT', 'CET', 'IST',
];

const ACCEPTED_FILES = '.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.csv,.txt';

/* ── Step 1: Method Selection ── */
function StepMethodSelect({ agentName, setAgentName, onSelect }) {
  const uid = useId();
  return (
    <div className={styles.stepContent}>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`${uid}-agent-name`}>Agent Name <span className={styles.fieldRequired} /></label>
        <Input id={`${uid}-agent-name`} type="text" placeholder="Enter agent name" value={agentName} onChange={e => setAgentName(e.target.value)} />
      </div>
      <div className={styles.sectionHeading}>
        <div className={styles.sectionTitle}>Create Agent Workflow</div>
        <div className={styles.sectionDesc}>Select how you want to create the agent based on your ease</div>
      </div>
      <div className={styles.methodGrid}>
        {METHOD_OPTIONS.map(m => (
          <button key={m.id} className={styles.methodCard} onClick={() => onSelect(m.id)}>
            <div className={styles.methodIcon}><Icon name={m.icon} size={24} color="var(--primary-300)" /></div>
            <div className={styles.methodCardTitle}>{m.title}</div>
            <div className={styles.methodCardDesc}>{m.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Step 2: Template Selection ── */
function StepTemplateSelect({ agentName, setAgentName, selectedTemplate, setSelectedTemplate, onBack }) {
  const uid = useId();
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search.trim()) return TEMPLATES;
    const q = search.toLowerCase();
    return TEMPLATES.filter(t => t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q));
  }, [search]);

  return (
    <div className={styles.stepContent}>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`${uid}-agent-name`}>Agent Name <span className={styles.fieldRequired} /></label>
        <Input id={`${uid}-agent-name`} type="text" placeholder="Enter agent name" value={agentName} onChange={e => setAgentName(e.target.value)} />
      </div>
      <div className={styles.sectionHeading}>
        <div className={styles.sectionTitle}>Create Agent Workflow</div>
        <div className={styles.sectionDesc}>Select how you want to create the agent based on your ease</div>
      </div>
      <div className={styles.selectedBanner}>
        <div className={styles.bannerIcon}><Icon name="solar:document-add-linear" size={20} color="var(--primary-300)" /></div>
        <div className={styles.bannerText}>
          <div className={styles.bannerTitle}>Create From Templates</div>
          <div className={styles.bannerDesc}>Start from a pre-built agent for your care use case</div>
        </div>
        <button className={styles.bannerClose} onClick={onBack} aria-label="Back"><CloseIcon size={18} color="var(--neutral-300)" /></button>
      </div>
      <div className={styles.templateSection}>
        <div className={styles.sectionTitle}>Select from Agent Templates</div>
        <input aria-label="Search templates" className={styles.searchInput} type="text" placeholder="Search Templates" value={search} onChange={e => setSearch(e.target.value)} />
        <div className={styles.templateGrid}>
          {filtered.map(t => (
            <button type="button" key={t.id} aria-pressed={selectedTemplate === t.id} className={[styles.templateCard, selectedTemplate === t.id ? styles.templateCardSelected : ''].filter(Boolean).join(' ')} onClick={() => setSelectedTemplate(t.id === selectedTemplate ? null : t.id)}>
              <div className={styles.templateCardName}>{t.name}</div>
              <div className={styles.templateCardDesc}>{t.desc}</div>
              {selectedTemplate === t.id && <div className={styles.templateCheck}><Icon name="solar:check-read-linear" size={10} color="#fff" /></div>}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className={styles.emptyState}>
              <Icon name="solar:magnifer-linear" size={32} color="var(--neutral-150)" />
              <p style={{ color: 'var(--neutral-300)', fontSize: 14 }}>No templates match your search</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Step 3: Create From Prompt ── */
function StepPrompt({ agentName, setAgentName, onBack, prompt, setPrompt }) {
  const uid = useId();
  const [utilityRows, setUtilityRows] = useState([
    { type: 'appointment_type', key: 'awv_appointment', defaultVal: 'Annual Wellness Visit' },
    { type: 'form', key: 'hra_form', defaultVal: 'HRA Form (SCAN)' },
    { type: 'user', key: 'provider', defaultVal: 'Dr. Daniel Reddcliff' },
  ]);
  const [timezone, setTimezone] = useState('Pacific Time (US)');
  const [showTzDropdown, setShowTzDropdown] = useState(false);
  const [showVarDropdown, setShowVarDropdown] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const promptRef = useRef(prompt);
  const tzRef = useRef(null);
  const fileInputRef = useRef(null);

  // Keep promptRef in sync
  useEffect(() => { promptRef.current = prompt; }, [prompt]);

  const utilityKeys = [];
  for (const r of utilityRows) {
    if (r.key.trim()) utilityKeys.push(r.key);
  }

  const addRow = () => setUtilityRows(r => [...r, { type: '', key: '', defaultVal: '' }]);
  const removeRow = (i) => setUtilityRows(r => r.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) => setUtilityRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  // Handle {{ trigger
  const handlePromptKeyUp = (e) => {
    const ta = e.target;
    const cursorPos = ta.selectionStart;
    const textBefore = ta.value.substring(0, cursorPos);

    if (textBefore.endsWith('{{') && utilityKeys.length > 0) {
      setShowVarDropdown(true);
    } else if (!textBefore.includes('{{')) {
      setShowVarDropdown(false);
    }
  };

  const insertVariable = (key) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursorPos = ta.selectionStart;
    const before = prompt.substring(0, cursorPos);
    const after = prompt.substring(cursorPos);
    const newBefore = before.replace(/\{\{$/, `{{${key}}}`);
    setPrompt(newBefore + after);
    setShowVarDropdown(false);
    setTimeout(() => {
      ta.focus();
      const newPos = newBefore.length;
      ta.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Speech-to-text using Web Speech API
  const toggleRecording = useCallback(async () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome.');
      return;
    }

    // If already recording, stop
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      return;
    }

    // Request microphone permission explicitly first
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      alert('Microphone access is required for speech-to-text. Please allow microphone access in your browser settings and try again.');
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Track the baseline prompt so we only append final results
    const baseline = promptRef.current;
    let finalTranscript = '';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim = transcript;
        }
      }
      // Show interim + final text while recording
      const separator = baseline ? ' ' : '';
      setPrompt(baseline + separator + finalTranscript + (interim ? interim : ''));
    };

    recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
      if (e.error === 'not-allowed') {
        alert('Microphone access was denied. Please allow microphone access in your browser settings.');
      }
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsRecording(true);
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsRecording(false);
    }
  }, [isRecording, setPrompt]);

  // File upload
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setAttachedFiles(prev => [...prev, ...files.map(f => f.name)]);
    e.target.value = '';
  };

  const removeFile = (i) => setAttachedFiles(f => f.filter((_, idx) => idx !== i));

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  // Close tz dropdown on outside click
  useEffect(() => {
    if (!showTzDropdown) return;
    const handler = (e) => { if (tzRef.current && !tzRef.current.contains(e.target)) setShowTzDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTzDropdown]);

  // Close var dropdown on outside click
  useEffect(() => {
    if (!showVarDropdown) return;
    const handler = () => setShowVarDropdown(false);
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [showVarDropdown]);

  return (
    <div className={styles.stepContent}>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`${uid}-agent-name`}>Agent Name <span className={styles.fieldRequired} /></label>
        <Input id={`${uid}-agent-name`} type="text" placeholder="Enter agent name" value={agentName} onChange={e => setAgentName(e.target.value)} />
      </div>

      <div className={styles.sectionHeading}>
        <div className={styles.sectionTitle}>Create Agent Workflow</div>
        <div className={styles.sectionDesc}>Configure the modality settings for the AI agent on how it will interact with the audience</div>
      </div>

      <div className={styles.selectedBanner}>
        <div className={styles.bannerIcon}><Icon name="solar:text-selection-linear" size={20} color="var(--primary-300)" /></div>
        <div className={styles.bannerText}>
          <div className={styles.bannerTitle}>Create From Prompt</div>
          <div className={styles.bannerDesc}>Describe your agent in plain language and AI builds the workflow</div>
        </div>
        <button className={styles.bannerClose} onClick={onBack} aria-label="Back"><CloseIcon size={18} color="var(--neutral-300)" /></button>
      </div>

      {/* Utility Configuration */}
      <div className={styles.sectionHeading}>
        <div className={styles.sectionTitle}>Utility Configuration</div>
        <div className={styles.sectionDesc}>Configure the utilities that you are going to use in the system prompt to trigger actions</div>
      </div>

      <div className={styles.utilityTable}>
        <div className={styles.utilityHeader}>
          <span className={styles.utilityColType}>Type & Key</span>
          <span className={styles.utilityColDefault}>Default</span>
          <span style={{ width: 28 }} />
        </div>
        {utilityRows.map((row, i) => (
          <div key={i} className={styles.utilityRow}>
            <select aria-label="Utility type" className={styles.utilitySelect} value={row.type} onChange={e => updateRow(i, 'type', e.target.value)}>
              <option value="">Select Type</option>
              {UTILITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input aria-label="Variable key" className={styles.utilityInput} placeholder="Enter Key" value={row.key} onChange={e => updateRow(i, 'key', e.target.value)} />
            <input aria-label="Variable default value" className={styles.utilityDefaultInput} placeholder="Select Default" value={row.defaultVal} onChange={e => updateRow(i, 'defaultVal', e.target.value)} />
            <button className={styles.utilityDeleteBtn} onClick={() => removeRow(i)} aria-label="Remove utility">
              <Icon name="solar:trash-bin-minimalistic-linear" size={16} color="var(--neutral-300)" />
            </button>
          </div>
        ))}
        <button className={styles.addMoreBtn} onClick={addRow}>+ Add More</button>
      </div>

      {/* Prompt area */}
      <div className={styles.sectionHeading}>
        <div className={styles.sectionTitle}>Write Prompt to automatically generate the conversational flow</div>
      </div>

      <div className={styles.promptBox}>
        <div className={styles.promptTextareaWrap}>
          <textarea aria-label="Workflow prompt"
            ref={textareaRef}
            className={styles.promptTextarea}
            placeholder="Add Prompt to generate workflow"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyUp={handlePromptKeyUp}
            rows={5}
          />
          {showVarDropdown && (
            <div className={styles.varDropdown}>
              <div className={styles.varDropdownLabel}>Insert Variable</div>
              {utilityKeys.map(k => (
                <div key={k} className={styles.varDropdownItem} onMouseDown={(e) => { e.preventDefault(); insertVariable(k); }}>
                  <Icon name="solar:code-linear" size={14} color="var(--primary-300)" />
                  {k}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attached files */}
        {attachedFiles.length > 0 && (
          <div className={styles.attachedFiles}>
            {attachedFiles.map((f, i) => (
              <div key={i} className={styles.attachedFile}>
                <Icon name="solar:document-text-linear" size={14} color="var(--primary-300)" />
                <span>{f}</span>
                <CloseButton size={14} onClick={() => removeFile(i)} className={styles.removeFileBtn} label="Remove file" />
              </div>
            ))}
          </div>
        )}

        <div className={styles.promptFooter}>
          <div className={styles.promptFooterLeft}>
            <input ref={fileInputRef} type="file" accept={ACCEPTED_FILES} multiple onChange={handleFileSelect} style={{ display: 'none' }} />
            <button className={styles.footerIconBtn} onClick={() => fileInputRef.current?.click()} title="Attach file">
              <Icon name="solar:paperclip-linear" size={16} color="var(--neutral-300)" />
            </button>
            <span className={styles.footerDivider} />
            <span className={styles.promptHint}>{'Type {{ to add variables'}</span>
          </div>
          <div className={styles.promptFooterRight}>
            <div className={styles.tzWrap} ref={tzRef}>
              <button className={styles.timezoneChip} onClick={() => setShowTzDropdown(!showTzDropdown)}>
                <Icon name="solar:global-linear" size={14} color="var(--neutral-300)" />
                {timezone}
                <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-300)" />
              </button>
              {showTzDropdown && (
                <div className={styles.tzDropdown}>
                  {TIMEZONES.map(tz => (
                    <button type="button" key={tz} aria-pressed={tz === timezone} className={[styles.tzDropdownItem, tz === timezone ? styles.tzDropdownItemActive : ''].filter(Boolean).join(' ')} onClick={() => { setTimezone(tz); setShowTzDropdown(false); }}>
                      {tz}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className={[styles.micBtn, isRecording ? styles.micBtnActive : ''].filter(Boolean).join(' ')}
              onClick={toggleRecording}
              title={isRecording ? 'Stop recording' : 'Start voice input'}
            >
              <Icon name="solar:microphone-3-linear" size={16} color={isRecording ? '#fff' : 'var(--primary-300)'} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Drawer ── */
export function CreateAgentDrawer() {
  const showCreateAgent = useAppStore(s => s.showCreateAgent);
  const setShowCreateAgent = useAppStore(s => s.setShowCreateAgent);
  const openBuilder = useAppStore(s => s.openBuilder);
  const fetchAgents = useAppStore(s => s.fetchAgents);

  const [step, setStep] = useState('select');
  const [agentName, setAgentName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [creating, setCreating] = useState(false);

  if (!showCreateAgent) return null;

  const handleClose = () => {
    setShowCreateAgent(false);
    setStep('select');
    setAgentName('');
    setSelectedTemplate(null);
    setPrompt('');
  };

  const handleMethodSelect = (method) => {
    if (method === 'template') setStep('template');
    else if (method === 'prompt') setStep('prompt');
  };

  const handleBack = () => {
    setStep('select');
    setSelectedTemplate(null);
  };

  // Determine if form is complete enough to enable Create Agent
  const isFormValid = (() => {
    if (!agentName.trim()) return false;
    if (step === 'select') return false;
    if (step === 'template') return !!selectedTemplate;
    if (step === 'prompt') return prompt.trim().length > 0;
    return false;
  })();

  const handleCreateAgent = async () => {
    if (!isFormValid || creating) return;
    setCreating(true);
    try {
      // supabase already imported at top
      const newAgent = {
        id: 'a' + Date.now(),
        name: agentName.trim(),
        use_case: step === 'template'
          ? TEMPLATES.find(t => t.id === selectedTemplate)?.name || ''
          : 'Custom Agent',
        version: '1.0',
        voice: { name: 'Erica', gender: 'Female', language: 'English' },
        last_updated: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
        last_updated_by: 'Current User',
        enabled: false,
      };
      await supabase.from('agents').insert(newAgent);
      await fetchAgents();
      handleClose();
      // Navigate to canvas
      openBuilder({ id: newAgent.id, name: newAgent.name }, prompt || '');
    } catch (err) {
      console.error('Failed to create agent:', err);
    }
    setCreating(false);
  };

  const headerRight = (
    <Button
      variant={isFormValid ? 'primary' : 'secondary'}
      size="L"
      leadingIcon="solar:ghost-smile-linear"
      disabled={!isFormValid || creating}
      onClick={handleCreateAgent}
    >
      {creating ? 'Creating...' : 'Create Agent'}
    </Button>
  );

  return (
    <Drawer title="Create New Agent" onClose={handleClose} headerRight={headerRight}>
      {step === 'select' && (
        <StepMethodSelect agentName={agentName} setAgentName={setAgentName} onSelect={handleMethodSelect} />
      )}
      {step === 'template' && (
        <StepTemplateSelect agentName={agentName} setAgentName={setAgentName} selectedTemplate={selectedTemplate} setSelectedTemplate={setSelectedTemplate} onBack={handleBack} />
      )}
      {step === 'prompt' && (
        <StepPrompt agentName={agentName} setAgentName={setAgentName} onBack={handleBack} prompt={prompt} setPrompt={setPrompt} />
      )}
    </Drawer>
  );
}
