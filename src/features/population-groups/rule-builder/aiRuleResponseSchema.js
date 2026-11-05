/**
 * Gemini responseSchema for pop-group NL rules.
 * Leaf nodes must declare field/operator/value explicitly, a bare `object`
 * item schema causes the model to emit `{}` placeholders.
 */

const VALUE_SCHEMA = {
  type: 'object',
  properties: {
    amount: { type: 'number' },
    text: { type: 'string' },
    asOfMode: { type: 'string' },
    asOfDate: { type: 'string' },
    code: { type: 'string' },
    display: { type: 'string' },
    system: { type: 'string' },
    numericValue: { type: 'number' },
    unit: { type: 'string' },
    eventType: { type: 'string' },
    count: { type: 'number' },
  },
};

const RULE_LEAF = {
  type: 'object',
  properties: {
    field: { type: 'string', description: 'Field key from the catalog' },
    operator: { type: 'string' },
    value: VALUE_SCHEMA,
  },
  required: ['field', 'operator', 'value'],
};

/** One level of nesting (OR inside AND, etc.). */
const RULE_NODE = {
  type: 'object',
  properties: {
    field: { type: 'string' },
    operator: { type: 'string' },
    value: VALUE_SCHEMA,
    combinator: { type: 'string' },
    rules: {
      type: 'array',
      items: RULE_LEAF,
    },
  },
};

export const AI_RULE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Brief chat reply, max 12 words. No lists.',
    },
    rule: {
      type: 'object',
      properties: {
        combinator: { type: 'string' },
        rules: {
          type: 'array',
          items: RULE_NODE,
        },
      },
      required: ['combinator', 'rules'],
    },
  },
  required: ['summary', 'rule'],
};
