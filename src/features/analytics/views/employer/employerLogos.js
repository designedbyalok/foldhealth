/**
 * Logos for the sample employers (see employerImpactSeed.js). These are
 * made-up companies, so their marks are drawn here rather than supplied.
 *
 * Each logo is an SVG in the Fold Health wordmark's proportions (about
 * 5.4 : 1, so it fits the same header and cover slots), built for a text
 * colour: dark for light covers and page headers, white for dark covers.
 * Marks keep their brand colour, except those too dark to read on a dark
 * cover, which turn white with the text.
 *
 * SVG text can't use the page's web fonts once turned into an image, so the
 * wordmarks use a system sans-serif.
 */
const H = 40;
const FONT = "font-family='Helvetica Neue, Helvetica, Arial, sans-serif'";

const wordmark = (name, sub, ink) => `
  <text x='50' y='21' ${FONT} font-size='19' font-weight='700' fill='${ink}' letter-spacing='-0.3'>${name}</text>
  <text x='51' y='34' ${FONT} font-size='8.5' font-weight='600' fill='${ink}' fill-opacity='0.72' letter-spacing='2.2'>${sub}</text>`;

const isWhite = (ink) => /^#?f{3}(f{3})?$/i.test(ink.replace('#', '')) || ink.toLowerCase() === 'white';

// Each logo's width hugs its artwork: the mark starts 3 units in, and the
// longest wordmark line ends about 3 units short of the edge, so centring
// the image centres the logo.
const svg = (w, body, room = 0) => `<svg xmlns='http://www.w3.org/2000/svg' width='${w + room}' height='${H}' viewBox='0 0 ${w + room} ${H}'>${body}</svg>`;

export const EMPLOYER_LOGOS = [
  {
    key: 'northwind',
    name: 'Northwind Logistics',
    width: 144,
    // A compass needle pointing north in a ring.
    svg: (ink, room) => {
      const mark = isWhite(ink) ? '#FFFFFF' : '#0E7C86';
      return svg(144, `
      <circle cx='20' cy='20' r='17' fill='none' stroke='${mark}' stroke-width='3'/>
      <path d='M20 7 L25 20 L20 17.5 L15 20 Z' fill='${mark}'/>
      <path d='M20 33 L15 20 L20 22.5 L25 20 Z' fill='${mark}' fill-opacity='0.45'/>
      <circle cx='20' cy='20' r='2' fill='${mark}'/>
      ${wordmark('Northwind', 'LOGISTICS', ink)}`, room);
    },
  },
  {
    key: 'brightline',
    name: 'Brightline Schools',
    width: 137,
    // A rising sun over a horizon line.
    svg: (ink, room) => svg(137, `
      <path d='M6 27 A14 14 0 0 1 34 27 Z' fill='#F5A524'/>
      <g stroke='#F5A524' stroke-width='2.4' stroke-linecap='round'>
        <line x1='20' y1='4' x2='20' y2='8.5'/>
        <line x1='8' y1='9.5' x2='11' y2='12.5'/>
        <line x1='32' y1='9.5' x2='29' y2='12.5'/>
        <line x1='3' y1='20' x2='7' y2='20.5'/>
        <line x1='37' y1='20' x2='33' y2='20.5'/>
      </g>
      <rect x='3' y='30' width='34' height='3' rx='1.5' fill='#E0781F'/>
      ${wordmark('Brightline', 'SCHOOLS', ink)}`, room),
  },
  {
    key: 'harbor',
    name: 'Harbor Manufacturing',
    width: 158,
    // A gear with a wave running through it.
    svg: (ink, room) => {
      const mark = isWhite(ink) ? '#FFFFFF' : '#2F5D8C';
      // The gear is a ring with teeth, open in the middle, so it reads on any background.
      return svg(158, `
      <g fill='${mark}'>
        ${Array.from({ length: 8 }, (_, i) => `<rect x='17.5' y='2' width='5' height='7' rx='1' transform='rotate(${i * 45} 20 20)'/>`).join('')}
      </g>
      <circle cx='20' cy='20' r='10.75' fill='none' stroke='${mark}' stroke-width='4.5'/>
      <path d='M12.5 21 C14.8 18.2 17 18.2 19.3 21 S23.8 23.8 27.5 21' fill='none' stroke='${mark}' stroke-width='2.6' stroke-linecap='round'/>
      ${wordmark('Harbor', 'MANUFACTURING', ink)}`, room);
    },
  },
];

export const EMPLOYER_LOGO_HEIGHT = H;

/**
 * The logo as an image URL. `room` widens the canvas on the right so a
 * wider system font can't clip the wordmark; the PDF path adds it and then
 * trims to the visible pixels.
 */
export const employerLogoUrl = (logo, ink, room = 0) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logo.svg(ink, room))}`;
export const LOGO_ROOM = 40;

/** Logo for an employer name, if one of the sample employers. */
export const logoForEmployer = (name) => EMPLOYER_LOGOS.find(l => l.name === name) || null;
