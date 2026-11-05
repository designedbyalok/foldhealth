import { useAppStore } from '../../../store/useAppStore';
import { NewChatDrawer, NewSmsDrawer, VoiceCallDrawer } from './CommsDrawers';
import { ComposeEmailDrawer } from './ComposeEmailDrawer';
import { SendContentDrawer, SendAssessmentDrawer } from './PatientSendDrawers';
import { SendFormDrawer, SendArticleDrawer } from './ThreadShareDrawers';

/**
 * The Comms create drawers, mounted once for the whole app so Comms and the
 * top bar's Create New open the same ones. After a chat, SMS or email goes
 * out, Comms opens on that thread.
 */
export function CommsDrawerHost() {
  const drawer = useAppStore(s => s.commsDrawer);
  const close = useAppStore(s => s.closeCommsDrawer);
  const goToComms = useAppStore(s => s.goToComms);
  const setPendingChatUserEmail = useAppStore(s => s.setPendingChatUserEmail);

  if (!drawer) return null;

  const show = (conv) => {
    close();
    if (!conv) return;
    goToComms({ channel: conv.channel, conversationId: conv.id });
  };

  if (drawer.type === 'chat' || drawer.type === 'internal') {
    return (
      <NewChatDrawer
        {...drawer.props}
        onClose={close}
        onCreated={show}
        onInternalChat={(person) => {
          close();
          setPendingChatUserEmail(person.email);
          goToComms();
        }}
      />
    );
  }
  // Sending an SMS keeps you where you are; the toast confirms it.
  if (drawer.type === 'sms') return <NewSmsDrawer {...drawer.props} onClose={close} onSent={close} />;
  if (drawer.type === 'call') return <VoiceCallDrawer {...drawer.props} onClose={close} />;
  if (drawer.type === 'content') return <SendContentDrawer {...drawer.props} onClose={close} />;
  if (drawer.type === 'assessment') return <SendAssessmentDrawer {...drawer.props} onClose={close} />;
  if (drawer.type === 'forms') return <SendFormDrawer {...drawer.props} onClose={close} />;
  if (drawer.type === 'article') return <SendArticleDrawer {...drawer.props} onClose={close} />;
  if (drawer.type === 'email') {
    return (
      <ComposeEmailDrawer
        key={drawer.props.initial?.draft?.id || 'new'}
        initial={drawer.props.initial || {}}
        onClose={close}
        onSent={show}
      />
    );
  }
  return null;
}
