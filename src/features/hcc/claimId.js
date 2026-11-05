// Deterministic claim-id derivation: used by both the DOS-source hover
// tooltip (worklist) and the Claim Preview drawer so a given (member, DOS)
// tuple always renders the same claim number across the two surfaces.
// In production this would come from the claims service; keep the shape
// synced with that response so the swap is a one-liner.
export function deriveClaimId(memberId, dosDate) {
  const suffix = String(memberId || 'X').slice(-4).toUpperCase();
  const stamp = String(dosDate || '').replace(/\D/g, '').slice(0, 6) || '000000';
  return `CLM-${suffix}-${stamp}`;
}
