/**
 * Request-size caps for the AI routes, so a signed-in caller can't send a
 * huge body and run up the model bill with one call.
 */

export const AI_BODY_MAX = 64 * 1024;

/** Answers 413 and returns false when the parsed body is over `max` characters as JSON. */
export function bodyWithinLimit(req, res, max = AI_BODY_MAX) {
  let size;
  try { size = JSON.stringify(req.body ?? null).length; } catch { size = Infinity; }
  if (size <= max) return true;
  res.status(413).json({ error: { message: 'That request is too large. Try again with less content.' } });
  return false;
}
