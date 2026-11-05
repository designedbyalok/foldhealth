/**
 * Callback ref that opens a <dialog> as a modal as soon as it mounts (in the
 * browser's top layer, with focus kept inside). Removing it from the page
 * closes it.
 */
export function openModal(dialog) {
  if (dialog && !dialog.open) dialog.showModal();
}
