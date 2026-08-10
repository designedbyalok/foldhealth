import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { FormPicker } from '../forms/FormPicker';
import { formShareLink } from '../forms/formLink';
import styles from './MessagesView.module.css';

function getInitials(profile) {
  if (!profile) return '?';
  if (profile.first_name && profile.last_name)
    return (profile.first_name[0] + profile.last_name[0]).toUpperCase();
  if (profile.full_name)
    return profile.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  if (profile.email) return profile.email.slice(0, 2).toUpperCase();
  return '?';
}

function getDisplayName(profile) {
  if (!profile) return 'Unknown';
  if (profile.first_name && profile.last_name) return `${profile.first_name} ${profile.last_name}`;
  if (profile.full_name) return profile.full_name;
  return profile.email?.split('@')[0] || 'Unknown';
}

function formatMsgTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function shouldShowTimestamp(msg, prevMsg) {
  if (!prevMsg) return true;
  return new Date(msg.created_at) - new Date(prevMsg.created_at) > 5 * 60 * 1000;
}

export function ChatArea({ currentUser, otherUser, onConversationUpdate }) {
  const [messages, setMessages]           = useState([]);
  const [inputValue, setInputValue]       = useState('');
  const [loading, setLoading]             = useState(true);
  const [sending, setSending]             = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [replyTo, setReplyTo]             = useState(null);
  const [dragOver, setDragOver]           = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [formPickerOpen, setFormPickerOpen] = useState(false);

  const messagesRef   = useRef(null);
  const channelRef    = useRef(null);
  const textareaRef   = useRef(null);
  const fileInputRef  = useRef(null);
  const typingTimer   = useRef(null);
  const stopTimer     = useRef(null);
  const onUpdateRef   = useRef(onConversationUpdate);
  useEffect(() => { onUpdateRef.current = onConversationUpdate; });

  // ── Scroll helper: instant on load, smooth only when near bottom ──
  const scrollToBottom = useCallback((instant = false) => {
    const el = messagesRef.current;
    if (!el) return;
    if (instant) {
      el.scrollTop = el.scrollHeight;
    } else {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distFromBottom < 260) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }
  }, []);

  // ── Mark received messages as read ──
  const markRead = useCallback(async (msgs) => {
    const ids = [];
    for (const m of msgs) {
      if (m.recipient_id === currentUser.id && !m.read_at && !String(m.id).startsWith('opt-')) {
        ids.push(m.id);
      }
    }
    if (!ids.length) return;
    await supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).in('id', ids);
    onUpdateRef.current?.();
  }, [currentUser.id]);

  // ── Fetch conversation ──
  const fetchMessages = useCallback(async () => {
    setLoading(true);
    let msgs = [];
    try {
      const { data } = await supabase
        .from('direct_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${currentUser.id},recipient_id.eq.${otherUser.id}),` +
          `and(sender_id.eq.${otherUser.id},recipient_id.eq.${currentUser.id})`
        )
        .order('created_at', { ascending: true });
      msgs = data || [];
      setMessages(msgs);
    } finally {
      setLoading(false);
    }
    markRead(msgs);
    requestAnimationFrame(() => scrollToBottom(true));
  }, [currentUser.id, otherUser.id, markRead, scrollToBottom]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Scroll when typing indicator appears
  useEffect(() => {
    if (isOtherTyping) scrollToBottom(false);
  }, [isOtherTyping, scrollToBottom]);

  // ── Realtime: INSERT, UPDATE (read receipts), Broadcast (typing) ──
  useEffect(() => {
    channelRef.current?.unsubscribe();
    const key = `dm-${[currentUser.id, otherUser.id].sort().join('-')}`;
    channelRef.current = supabase
      .channel(key)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
        const msg = payload.new;
        const relevant =
          (msg.sender_id === currentUser.id && msg.recipient_id === otherUser.id) ||
          (msg.sender_id === otherUser.id   && msg.recipient_id === currentUser.id);
        if (!relevant) return;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        if (msg.recipient_id === currentUser.id) {
          supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id)
            .then(() => onUpdateRef.current?.());
        }
        scrollToBottom(false);
      })
      // Read-receipt updates: catch when recipient marks our message read
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages' }, (payload) => {
        const msg = payload.new;
        if (msg.sender_id === currentUser.id && msg.read_at) {
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read_at: msg.read_at } : m));
        }
      })
      // Typing indicator via ephemeral broadcast
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== otherUser.id) return;
        setIsOtherTyping(payload.isTyping);
        if (payload.isTyping) {
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setIsOtherTyping(false), 3000);
        }
      })
      .subscribe();
    return () => { channelRef.current?.unsubscribe(); clearTimeout(typingTimer.current); };
  }, [currentUser.id, otherUser.id, scrollToBottom]);

  // ── Broadcast typing state ──
  const broadcastTyping = useCallback((isTyping) => {
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: currentUser.id, isTyping } });
  }, [currentUser.id]);

  // ── Upload file to Supabase Storage ──
  const uploadFile = useCallback(async (file) => {
    setUploading(true);
    const ext  = file.name.split('.').pop();
    const path = `${currentUser.id}/${Date.now()}.${ext}`;
    let error;
    try {
      ({ error } = await supabase.storage.from('chat-media').upload(path, file, { upsert: true }));
    } finally {
      setUploading(false);
    }
    if (error) return null;
    const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path);
    return { url: publicUrl, type: file.type.startsWith('image/') ? 'image' : 'file', name: file.name };
  }, [currentUser.id]);

  // ── Send message (with optional media) ──
  const doSend = useCallback(async (mediaInfo = null) => {
    const content = inputValue.trim();
    if (!content && !mediaInfo) return;
    if (sending) return;
    setSending(true);
    broadcastTyping(false);
    clearTimeout(stopTimer.current);

    const savedReply = replyTo;
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setReplyTo(null);

    const optId = `opt-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: optId, sender_id: currentUser.id, recipient_id: otherUser.id,
      content: content || null, created_at: new Date().toISOString(), read_at: null,
      reply_to_id: savedReply?.id || null,
      media_url: mediaInfo?.url || null, media_type: mediaInfo?.type || null, media_name: mediaInfo?.name || null,
    }]);
    scrollToBottom(false);

    const payload = { sender_id: currentUser.id, recipient_id: otherUser.id, content: content || null };
    if (savedReply?.id)  payload.reply_to_id = savedReply.id;
    if (mediaInfo?.url) { payload.media_url = mediaInfo.url; payload.media_type = mediaInfo.type; payload.media_name = mediaInfo.name; }

    try {
      const { data } = await supabase.from('direct_messages').insert(payload).select().single();
      if (data) {
        setMessages(prev => prev.map(m => m.id === optId ? data : m));
        onUpdateRef.current?.();
      }
    } finally {
      setSending(false);
    }
    textareaRef.current?.focus();
  }, [inputValue, sending, currentUser.id, otherUser.id, replyTo, broadcastTyping, scrollToBottom]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    if (e.key === 'Escape') setReplyTo(null);
  };

  const handleInput = (e) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    broadcastTyping(true);
    clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => broadcastTyping(false), 2000);
  };

  const handleFileSelect = async (file) => {
    if (!file) return;
    const media = await uploadFile(file);
    if (media) doSend(media);
  };

  const initials    = getInitials(otherUser);
  const displayName = getDisplayName(otherUser);

  return (
    <div className={styles.chatPanel}>
      {/* ── Header ── */}
      <div className={styles.chatHeader}>
        <div className={styles.convAvatar} style={{ width: 40, height: 40, borderRadius: 10, fontSize: 14 }}>
          {initials}
        </div>
        <div className={styles.chatHeaderInfo}>
          <div className={styles.chatHeaderName}>
            {displayName}
            <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-300)" />
          </div>
          <div className={styles.chatHeaderMeta}>
            {isOtherTyping
              ? <span className={styles.typingMeta}>typing…</span>
              : otherUser.email}
          </div>
        </div>
        <div className={styles.chatHeaderActions}>
          <ActionButton icon="solar:phone-linear"       size="S" tooltip="Call" />
          <div className={styles.divider} />
          <ActionButton icon="solar:videocamera-linear" size="S" tooltip="Video" />
          <div className={styles.divider} />
          <ActionButton icon="solar:magnifer-linear"    size="S" tooltip="Search" />
          <div className={styles.divider} />
          <ActionButton icon="solar:info-circle-linear" size="S" tooltip="Info" />
          <div className={styles.divider} />
          <ActionButton icon="solar:menu-dots-bold"     size="S" tooltip="More" />
        </div>
      </div>

      {/* ── Messages ── */}
      <div ref={messagesRef} className={styles.chatMessages}>
        {loading ? (
          <div className={styles.skeletonMessages}>
            {[
              { own: false, w: 160 }, { own: true, w: 120 }, { own: false, w: 220 },
              { own: true, w: 80 }, { own: false, w: 140 }, { own: true, w: 180 },
            ].map((s, i) => (
              <div key={i} className={[styles.skeletonRow, s.own ? styles.skeletonOwn : ''].filter(Boolean).join(' ')}>
                {!s.own && <div className={styles.skeletonAvatar} />}
                <div className={styles.skeletonBubble} style={{ width: s.w }} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className={styles.chatEmpty}>
            <div className={styles.chatEmptyAvatar}>{initials}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--neutral-500)' }}>{displayName}</div>
            <div style={{ fontSize: 13, color: 'var(--neutral-300)' }}>No messages yet. Say hello!</div>
          </div>
        ) : messages.map((msg, idx) => {
          const isOwn    = msg.sender_id === currentUser.id;
          const prevMsg  = messages[idx - 1];
          const showTs   = shouldShowTimestamp(msg, prevMsg);
          const showAv   = !isOwn && (!prevMsg || prevMsg.sender_id !== msg.sender_id);
          const replyMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;
          const isPending = String(msg.id).startsWith('opt-');

          return (
            <div key={msg.id}>
              {showTs && <div className={styles.msgDateSep}>{formatMsgTime(msg.created_at)}</div>}
              <div
                className={[styles.msgRow, isOwn ? styles.own : ''].filter(Boolean).join(' ')}
                style={{ marginTop: showTs || showAv ? 8 : 2 }}
              >
                {!isOwn && (
                  <div className={styles.msgAvatar} style={{ visibility: showAv ? 'visible' : 'hidden' }}>
                    {initials}
                  </div>
                )}

                {/* Bubble + quote + read receipt */}
                <div className={styles.msgBubbleWrap}>
                  {replyMsg && (
                    <div className={[styles.msgReplyQuote, isOwn ? styles.own : ''].join(' ')}>
                      <div className={styles.msgReplyBar} />
                      <div>
                        <div className={styles.msgReplyName}>
                          {replyMsg.sender_id === currentUser.id ? 'You' : displayName}
                        </div>
                        <div className={styles.msgReplyText}>{replyMsg.content || '📎 Media'}</div>
                      </div>
                    </div>
                  )}
                  <div className={[styles.msgBubble, isOwn ? styles.mine : styles.other].join(' ')}>
                    {msg.media_url && msg.media_type === 'image' && (
                      <img
                        src={msg.media_url}
                        alt={msg.media_name || 'image'}
                        className={styles.msgImage}
                        onClick={() => window.open(msg.media_url, '_blank', 'noopener,noreferrer')}
                      />
                    )}
                    {msg.media_url && msg.media_type === 'file' && (
                      <a href={msg.media_url} target="_blank" rel="noreferrer" className={styles.msgFile}>
                        <Icon name="solar:file-bold" size={16} />
                        <span>{msg.media_name}</span>
                      </a>
                    )}
                    {msg.media_url && msg.media_type === 'form' && (
                      <a href={msg.media_url} className={styles.msgFormCard}>
                        <span className={styles.msgFormIcon}>
                          <Icon name="solar:clipboard-text-linear" size={18} color="var(--primary-300)" />
                        </span>
                        <span className={styles.msgFormMain}>
                          <span className={styles.msgFormLabel}>Form</span>
                          <span className={styles.msgFormName}>{msg.media_name || 'Open form'}</span>
                        </span>
                        <Icon name="solar:arrow-right-linear" size={14} color="var(--neutral-300)" />
                      </a>
                    )}
                    {msg.content && <span>{msg.content}</span>}
                  </div>
                  {isOwn && (
                    <div className={[styles.msgStatus, msg.read_at ? styles.msgStatusRead : ''].join(' ')}>
                      {isPending
                        ? <Icon name="solar:clock-circle-linear" size={11} />
                        : msg.read_at
                          ? <Icon name="solar:check-read-bold"   size={12} />
                          : <Icon name="solar:check-bold"        size={12} />}
                    </div>
                  )}
                </div>

                {/* Reply button — visible on row hover via CSS */}
                <button className={styles.msgReplyBtn} onClick={() => setReplyTo(msg)} title="Reply">
                  <Icon name="solar:reply-linear" size={14} />
                </button>
              </div>
            </div>
          );
        })}

        {/* Typing indicator bubble */}
        {isOtherTyping && (
          <div className={styles.typingRow}>
            <div className={styles.msgAvatar}>{initials}</div>
            <div className={styles.typingBubble}>
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
            </div>
          </div>
        )}
      </div>

      {/* ── Input ── */}
      <div
        className={[styles.chatInput, dragOver ? styles.dragOver : ''].filter(Boolean).join(' ')}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
      >
        {/* Reply preview */}
        {replyTo && (
          <div className={styles.replyPreview}>
            <div className={styles.replyPreviewBar} />
            <div className={styles.replyPreviewContent}>
              <div className={styles.replyPreviewName}>
                {replyTo.sender_id === currentUser.id ? 'You' : displayName}
              </div>
              <div className={styles.replyPreviewText}>{replyTo.content || '📎 Media'}</div>
            </div>
            <button className={styles.replyPreviewClose} onClick={() => setReplyTo(null)}>
              <Icon name="solar:close-circle-bold" size={16} />
            </button>
          </div>
        )}

        <div className={styles.chatInputToolbar}>
          <label className={styles.chatInputSwitch}>
            <div className={styles.switchTrack}><div className={styles.switchThumb} /></div>
            <span className={styles.switchLabel}>Internal</span>
          </label>
          <div className={styles.chatInputActions}>
            <ActionButton icon="solar:paperclip-linear"          size="S" tooltip="Attach file" onClick={() => fileInputRef.current?.click()} />
            <ActionButton icon="solar:emoji-funny-square-linear" size="S" tooltip="Emoji" />
            <ActionButton icon="solar:gallery-add-linear"        size="S" tooltip="Image"
              onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'image/*'; fileInputRef.current.click(); } }} />
            <ActionButton icon="solar:clipboard-text-linear"     size="S" tooltip="Share a form" onClick={() => setFormPickerOpen(true)} />
            <ActionButton icon="solar:clock-circle-linear"       size="S" tooltip="Schedule" />
          </div>
        </div>

        <div className={styles.chatInputRow}>
          <textarea
            ref={textareaRef}
            className={styles.chatInputBox}
            placeholder={dragOver ? 'Drop to send…' : 'Visible to everyone • Shift+Enter to change the line'}
            value={inputValue}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <Button
            variant="primary"
            size="L"
            iconOnly
            leadingIcon="solar:plain-2-bold"
            disabled={(!inputValue.trim() && !uploading) || sending || uploading}
            onClick={() => doSend()}
          />
        </div>

        <div className={styles.chatInputFooter}>
          <span style={{ fontSize: 12, color: 'var(--neutral-300)' }}>
            Press Enter to send •{' '}
            <span style={{ color: 'var(--primary-300)', cursor: 'pointer' }}>Change</span>
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--neutral-300)', cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 14, height: 14, accentColor: 'var(--primary-300)' }} />
            Archive on send
          </label>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          style={{ display: 'none' }}
          onChange={e => { handleFileSelect(e.target.files[0]); e.target.value = ''; }}
        />
      </div>

      {formPickerOpen && (
        <FormPicker
          onClose={() => setFormPickerOpen(false)}
          onSelect={(form) => {
            setFormPickerOpen(false);
            doSend({ url: formShareLink(form.id), type: 'form', name: form.name });
          }}
        />
      )}
    </div>
  );
}
