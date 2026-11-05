import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { supabase } from '../../lib/supabase';
import { FormPicker } from '../forms/FormPicker';
import { formShareLink } from '../forms/formLink';
import { ChatHeader } from './ChatHeader';
import { ChatMessagesList } from './ChatMessagesList';
import { MessageComposer } from '../../components/MessageComposer/MessageComposer';
import { Icon } from '../../components/Icon/Icon';
import { toast } from '../../components/Toast/sonnerToast';
import { getDisplayName } from './messageUtils';
import styles from './MessagesView.module.css';

export function ChatArea({ currentUser, otherUser, onConversationUpdate }) {
  const [messages, setMessages]           = useState([]);
  const [inputValue, setInputValue]       = useState('');
  const [loading, setLoading]             = useState(true);
  const [sending, setSending]             = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [replyTo, setReplyTo]             = useState(null);
  const [dragOver, setDragOver]           = useState(false);
  const [pending, setPending]             = useState([]);
  const [formPickerOpen, setFormPickerOpen] = useState(false);

  const messagesRef   = useRef(null);
  const channelRef    = useRef(null);
  const fileInputId   = useId();
  const typingTimer   = useRef(null);
  const stopTimer     = useRef(null);
  const onUpdateRef   = useRef(onConversationUpdate);
  useEffect(() => { onUpdateRef.current = onConversationUpdate; });

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

  useEffect(() => {
    if (isOtherTyping) scrollToBottom(false);
  }, [isOtherTyping, scrollToBottom]);

  useEffect(() => {
    channelRef.current?.unsubscribe();
    const key = `dm-${[currentUser.id, otherUser.id].sort().join('-')}`;
    const onInsert = (payload) => {
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
    };
    channelRef.current = supabase
      .channel(key)
      // Filtered to this user's rows, so Realtime doesn't check every message
      // in the system against RLS. One binding per side of the conversation.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${currentUser.id}` }, onInsert)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${currentUser.id}` }, onInsert)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${currentUser.id}` }, (payload) => {
        const msg = payload.new;
        if (msg.read_at) {
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read_at: msg.read_at } : m));
        }
      })
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

  const broadcastTyping = useCallback((isTyping) => {
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: currentUser.id, isTyping } });
  }, [currentUser.id]);

  // Files picked but not sent: they upload right away and wait in the type
  // box as cards until Send.
  const attach = useCallback(async (file) => {
    if (!file) return;
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const previewUrl = URL.createObjectURL(file);
    setPending(p => [...p, { id, name: file.name, size: file.size, type: file.type, previewUrl, uploading: true }]);
    const ext  = file.name.split('.').pop();
    const path = `${currentUser.id}/${Date.now()}-${id}.${ext}`;
    const { error } = await supabase.storage.from('chat-media').upload(path, file, { upsert: true });
    if (error) {
      URL.revokeObjectURL(previewUrl);
      setPending(p => p.filter(f => f.id !== id));
      toast.error(`Could not upload ${file.name}: ${error.message}`);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path);
    setPending(p => p.map(f => (f.id === id ? { ...f, url: publicUrl, uploading: false } : f)));
  }, [currentUser.id]);

  const removePending = (id) => setPending((p) => {
    const f = p.find(x => x.id === id);
    if (f) URL.revokeObjectURL(f.previewUrl);
    return p.filter(x => x.id !== id);
  });

  // One message per file (the text goes with the last), or just the text.
  const insertMessage = useCallback(async ({ content, media, replyId }) => {
    const optId = `opt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setMessages(prev => [...prev, {
      id: optId, sender_id: currentUser.id, recipient_id: otherUser.id,
      content, created_at: new Date().toISOString(), read_at: null,
      reply_to_id: replyId || null,
      media_url: media?.url || null, media_type: media?.type || null, media_name: media?.name || null,
    }]);
    scrollToBottom(false);
    // direct_messages.content is NOT NULL: an attachment alone sends ''.
    const payload = { sender_id: currentUser.id, recipient_id: otherUser.id, content: content || '' };
    if (replyId) payload.reply_to_id = replyId;
    if (media?.url) { payload.media_url = media.url; payload.media_type = media.type; payload.media_name = media.name; }
    const { data, error } = await supabase.from('direct_messages').insert(payload).select().single();
    if (error || !data) {
      setMessages(prev => prev.filter(m => m.id !== optId));
      throw new Error(error?.message || 'The message was not saved.');
    }
    setMessages(prev => prev.map(m => (m.id === optId ? data : m)));
    onUpdateRef.current?.();
  }, [currentUser.id, otherUser.id, scrollToBottom]);

  const doSend = useCallback(async (extraMedia = null) => {
    const content = inputValue.trim();
    const files = extraMedia ? [extraMedia] : pending.filter(f => f.url).map(f => ({
      url: f.url, name: f.name, type: f.type.startsWith('image/') ? 'image' : 'file', previewUrl: f.previewUrl,
    }));
    if (!content && !files.length) return;
    if (sending) return;
    setSending(true);
    broadcastTyping(false);
    clearTimeout(stopTimer.current);
    const savedReply = replyTo;
    setInputValue('');
    setReplyTo(null);
    if (!extraMedia) setPending([]);
    try {
      const items = files.length ? files : [null];
      for (let i = 0; i < items.length; i++) {
        await insertMessage({
          content: i === items.length - 1 ? content : '',
          media: items[i],
          replyId: i === 0 ? savedReply?.id : null,
        });
      }
      files.forEach(f => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    } catch (err) {
      setInputValue(content);
      toast.error(`Could not send: ${err.message}`);
    } finally {
      setSending(false);
    }
  }, [inputValue, pending, sending, replyTo, broadcastTyping, insertMessage]);

  const handleInput = (value) => {
    setInputValue(value);
    broadcastTyping(true);
    clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => broadcastTyping(false), 2000);
  };

  return (
    <div className={styles.chatPanel}>
      <ChatHeader otherUser={otherUser} isOtherTyping={isOtherTyping} />

      <ChatMessagesList
        messagesRef={messagesRef}
        loading={loading}
        messages={messages}
        currentUser={currentUser}
        otherUser={otherUser}
        isOtherTyping={isOtherTyping}
        onReply={setReplyTo}
      />

      <div
        className={dragOver ? styles.dragOver : undefined}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
        onDrop={e => { e.preventDefault(); setDragOver(false); [...(e.dataTransfer.files || [])].forEach(attach); }}
      >
        <MessageComposer
          value={inputValue}
          onChange={handleInput}
          onSend={() => doSend()}
          sending={sending}
          placeholder={dragOver ? 'Drop to attach…' : undefined}
          attachments={pending}
          onRemoveAttachment={removePending}
          tools={[
            { key: 'attach', icon: 'solar:paperclip-linear', tooltip: 'Attach file', onClick: () => document.getElementById(fileInputId)?.click() },
            { key: 'form', icon: 'solar:clipboard-text-linear', tooltip: 'Share a form', onClick: () => setFormPickerOpen(true) },
          ]}
          above={replyTo && (
            <div className={styles.replyPreview}>
              <div className={styles.replyPreviewBar} />
              <div className={styles.replyPreviewContent}>
                <div className={styles.replyPreviewName}>{replyTo.sender_id === currentUser.id ? 'You' : getDisplayName(otherUser)}</div>
                <div className={styles.replyPreviewText}>{replyTo.content || 'Attachment'}</div>
              </div>
              <button className={styles.replyPreviewClose} onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                <Icon name="solar:close-circle-linear" size={16} />
              </button>
            </div>
          )}
        />
        <input
          id={fileInputId}
          type="file"
          hidden
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.txt"
          onChange={e => { [...(e.target.files || [])].forEach(attach); e.target.value = ''; }}
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
