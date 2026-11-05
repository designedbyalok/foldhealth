export const contentEmailsCache = new Map();
export const CONTENT_EMAILS_TTL_MS = 60_000;

export function invalidateContentEmailsCache() {
  contentEmailsCache.clear();
}

export const contentFormsCache = new Map();
export const CONTENT_FORMS_TTL_MS = 60_000;

export function invalidateContentFormsCache() {
  contentFormsCache.clear();
}

const campaignSaveTimers = new Map();

export function cancelScheduledCampaignSave(id) {
  const pending = campaignSaveTimers.get(id);
  if (pending) {
    clearTimeout(pending);
    campaignSaveTimers.delete(id);
  }
}

export function scheduleCampaignSave(id, fn) {
  const existing = campaignSaveTimers.get(id);
  if (existing) clearTimeout(existing);
  campaignSaveTimers.set(id, setTimeout(() => {
    campaignSaveTimers.delete(id);
    fn();
  }, 600));
}

const hccExtractQueue = { names: [], timer: null };

function flushHccExtractToast(getToast) {
  const { names } = hccExtractQueue;
  hccExtractQueue.names = [];
  hccExtractQueue.timer = null;
  if (names.length === 0) return;
  const toast = getToast?.();
  if (!toast) return;
  if (names.length === 1) {
    toast(`${names[0]}: extracting in the background`);
  } else {
    toast(`${names.length} files, extracting in the background`);
  }
}

export function queueHccExtractToast(fileName, getToast) {
  hccExtractQueue.names.push(fileName);
  if (hccExtractQueue.timer) return;
  hccExtractQueue.timer = setTimeout(() => flushHccExtractToast(getToast), 150);
}
