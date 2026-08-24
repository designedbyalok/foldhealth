import { describe, expect, it } from 'vitest';
import {
  createCustomConsentItem,
  insertConsentItem,
  makeMemberConsent,
  reorderConsentItems,
  syncConsentQuestions,
} from './memberConsent';

const assignIds = (field) => ({ ...field, linkId: `id-${field.consentKey}` });

describe('member consent health component', () => {
  it('starts with the configured program, service, and other decisions', () => {
    const field = makeMemberConsent();

    expect(field.healthKey).toBe('memberConsent');
    expect(field.items).toHaveLength(9);
    // Consent items are non-mandatory (the per-item Required switch was removed)
    // and offer a single consent checkbox (the decline option was removed).
    expect(field.items.find((item) => item.consentKey === 'ccm')).toMatchObject({
      required: false,
      options: [
        { value: 'consented', label: 'I give my consent for CCM' },
      ],
    });
    expect(field.items.find((item) => item.consentKey === 'ccm').options).toHaveLength(1);
    expect(field.items.find((item) => item.consentKey === 'telehealth')).toMatchObject({
      consentCategory: 'others',
    });
  });

  it('removes excluded items and keeps existing question ids stable', () => {
    const field = makeMemberConsent();
    const existing = field.items.map(assignIds);
    const consentItems = field.consentItems.map((item) => (
      item.id === 'ccm' ? { ...item, mandatory: false } : item
    )).filter((item) => item.id !== 'podiatry');

    const questions = syncConsentQuestions(existing, consentItems, assignIds);

    expect(questions.some((item) => item.consentKey === 'podiatry')).toBe(false);
    expect(questions.find((item) => item.consentKey === 'ccm')).toMatchObject({
      linkId: 'id-ccm',
      required: false,
    });
  });

  it('creates a custom consent decision with a single consent option', () => {
    const item = createCustomConsentItem('Transportation', 'service', 'custom-1');
    const questions = syncConsentQuestions([], [item], assignIds);

    expect(questions[0]).toMatchObject({
      linkId: 'id-custom-1',
      consentCategory: 'service',
      options: [
        { value: 'consented', label: 'I give my consent for Transportation' },
      ],
    });
    expect(questions[0].options).toHaveLength(1);
  });

  it('adds a custom item at the end of its own category, not the whole list', () => {
    const field = makeMemberConsent();
    const item = createCustomConsentItem('Transportation', 'program', 'custom-1');

    const items = insertConsentItem(field.consentItems, item);
    const questions = syncConsentQuestions(field.items.map(assignIds), items, assignIds);

    expect(items.map((i) => i.id)).toEqual([
      'ccm', 'apcm', 'bhi', 'custom-1',
      'primary-care', 'podiatry', 'mental-health', 'wound-care', 'palliative-care', 'telehealth',
    ]);
    expect(questions.map((q) => q.consentKey)).toEqual([
      'ccm', 'apcm', 'bhi', 'custom-1',
      'primary-care', 'podiatry', 'mental-health', 'wound-care', 'palliative-care', 'telehealth',
    ]);
  });

  it('reorders items within a category and reorders the questions with them', () => {
    const field = makeMemberConsent();
    const items = reorderConsentItems(field.consentItems, 'ccm', 'bhi');
    const questions = syncConsentQuestions(field.items.map(assignIds), items, assignIds);

    expect(items.map((i) => i.id)).toEqual([
      'apcm', 'bhi', 'ccm', 'primary-care',
      'podiatry', 'mental-health', 'wound-care', 'palliative-care', 'telehealth',
    ]);
    expect(questions.map((q) => q.consentKey)).toEqual([
      'apcm', 'bhi', 'ccm', 'primary-care',
      'podiatry', 'mental-health', 'wound-care', 'palliative-care', 'telehealth',
    ]);
    expect(questions.find((q) => q.consentKey === 'ccm').linkId).toBe('id-ccm');
  });

  it('refuses to move an item across categories', () => {
    const field = makeMemberConsent();

    expect(reorderConsentItems(field.consentItems, 'podiatry', 'ccm')).toBe(field.consentItems);
  });

  it('keeps insertion order when the category has no items yet', () => {
    const item = createCustomConsentItem('Transportation', 'service', 'custom-2');
    const items = insertConsentItem([{ id: 'ccm', category: 'program' }], item);

    expect(items.map((i) => i.id)).toEqual(['ccm', 'custom-2']);
  });
});
