// The patient page has no session, so its chat attachments (private
// `chat-media` bucket) are signed by /api/patient-media-url, which checks the
// file belongs to this token's conversation. Same shape as the `sign` that
// signStorageUrl() takes.
export function patientMediaSigner(token) {
  return async (bucket, path) => {
    if (bucket !== 'chat-media') throw new Error('Only chat attachments open here.');
    const res = await fetch('/api/patient-media-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, path }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.signedUrl) throw new Error(json?.error?.message || 'The attachment couldn\'t be opened.');
    return json.signedUrl;
  };
}
