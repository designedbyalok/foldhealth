// Hand-drawn to match the kit's main outline icon set:
// 1.75 stroke, round caps and joins, 24x24 viewBox. Keep this file in sync
// visually with src/icons.jsx, same weight, same vocabulary of shapes.
const S = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

export const ANNOTATOR_ICONS = {
  // Pointer with a small marquee corner, cursor + selection.
  select: `<path ${S} d="M6 4 L15 11 L11 12 L13 17 L11 18 L9 13 L6 15 Z"/>`,

  // Simple rounded rectangle.
  rect: `<rect x="4" y="6" width="16" height="12" rx="2" ${S}/>`,

  // Diagonal arrow with a modest head.
  arrow: `<path ${S} d="M5 19 L19 5 M11 5 H19 V13"/>`,

  // Pencil, matching the main PenIcon.
  pen: `<path ${S} d="M4 20 L5 15.5 L15.8 4.7 a1.4 1.4 0 0 1 2 0 L19.3 6.2 a1.4 1.4 0 0 1 0 2 L8.5 19 Z"/><path ${S} d="M14 5.5 L18 9.5"/>`,

  // Capital T inside a square: the text tool.
  text: `<path ${S} d="M8 7 H16 M12 7 V17"/><rect x="4" y="4" width="16" height="16" rx="3" ${S}/>`,

  // Eye crossed through: redact.
  redact: `<path ${S} d="M3 12 C 6 7, 9 5, 12 5 C 15 5, 18 7, 21 12 C 18 17, 15 19, 12 19 C 9 19, 6 17, 3 12 Z"/><path ${S} d="M5 5 L19 19"/>`,

  // Crop corners.
  crop: `<path ${S} d="M8 4 V15 a1 1 0 0 0 1 1 H20"/><path ${S} d="M4 8 H15 a1 1 0 0 1 1 1 V20"/>`,

  // Undo: curved arrow left.
  undo: `<path ${S} d="M9 7 L5 11 L9 15"/><path ${S} d="M5 11 H14 a5 5 0 0 1 5 5 v1"/>`,

  // Redo: curved arrow right (mirror of undo).
  redo: `<path ${S} d="M15 7 L19 11 L15 15"/><path ${S} d="M19 11 H10 a5 5 0 0 0 -5 5 v1"/>`,

  // Trash can.
  remove: `<path ${S} d="M4 7 H20"/><path ${S} d="M10 4 H14 M6 7 L7 19 a2 2 0 0 0 2 2 h6 a2 2 0 0 0 2 -2 L18 7"/><path ${S} d="M10 11 V17 M14 11 V17"/>`,

  // Single checkmark: this is the "Done" affirmation.
  done: `<path ${S} d="M5 12.5 L10 17.5 L19 7.5"/>`,

  // Filled soft rect: highlighter swatch.
  highlight: `<rect x="4" y="6" width="16" height="12" rx="2.5" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,

  // Clean circle.
  ellipse: `<circle cx="12" cy="12" r="7.5" ${S}/>`,

  // Straight diagonal line.
  line: `<path ${S} d="M5 19 L19 5"/>`,

  // Numbered step marker: circle with a small "1" inside.
  step: `<circle cx="12" cy="12" r="7.5" ${S}/><path ${S} d="M11 9.5 L12.5 8.5 V15.5"/>`,

  // Zoom in: magnifier with a plus.
  'zoom-in': `<circle cx="11" cy="11" r="6.5" ${S}/><path ${S} d="M15.75 15.75 L20 20"/><path ${S} d="M8 11 H14 M11 8 V14"/>`,

  // Zoom out: magnifier with a minus.
  'zoom-out': `<circle cx="11" cy="11" r="6.5" ${S}/><path ${S} d="M15.75 15.75 L20 20"/><path ${S} d="M8 11 H14"/>`,
};
