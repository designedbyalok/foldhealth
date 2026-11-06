import styles from './messageForm.module.css';

/**
 * The email as it will be sent, in a frame that runs no scripts. A new
 * frame per change: changing an existing frame's srcdoc adds a browser
 * history entry, and the phone's Back would then step through previews
 * instead of closing the screen.
 */
export function EmailPreview({ html }) {
  return <iframe key={html} title="Email preview" className={styles.preview} srcDoc={html} sandbox="" />;
}
