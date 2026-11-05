export function KanbanIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <path d="M7.75 6C7.75 5.59 7.41 5.25 7 5.25C6.59 5.25 6.25 5.59 6.25 6H7.75ZM6.25 17C6.25 17.41 6.59 17.75 7 17.75C7.41 17.75 7.75 17.41 7.75 17H6.25ZM12.75 6C12.75 5.59 12.41 5.25 12 5.25C11.59 5.25 11.25 5.59 11.25 6H12.75ZM11.25 12C11.25 12.41 11.59 12.75 12 12.75C12.41 12.75 12.75 12.41 12.75 12H11.25ZM17.75 6C17.75 5.59 17.41 5.25 17 5.25C16.59 5.25 16.25 5.59 16.25 6H17.75ZM16.25 15.5C16.25 15.91 16.59 16.25 17 16.25C17.41 16.25 17.75 15.91 17.75 15.5H16.25ZM12 22V21.25C9.62 21.25 7.91 21.25 6.61 21.07C5.34 20.9 4.56 20.57 3.99 20.01L3.46 20.54L2.93 21.07C3.83 21.96 4.97 22.366 6.41 22.56C7.84 22.75 9.66 22.75 12 22.75V22ZM2 12H1.25C1.25 14.34 1.25 16.16 1.44 17.59C1.63 19.031 2.04 20.17 2.93 21.07L3.46 20.54L3.99 20.01C3.43 19.44 3.1 18.66 2.93 17.39C2.75 16.09 2.75 14.38 2.75 12H2ZM22 12H21.25C21.25 14.38 21.25 16.09 21.07 17.39C20.9 18.66 20.57 19.44 20.01 20.01L20.54 20.54L21.07 21.07C21.96 20.17 22.366 19.031 22.56 17.59C22.75 16.16 22.75 14.34 22.75 12H22ZM12 22V22.75C14.34 22.75 16.16 22.75 17.59 22.56C19.031 22.366 20.17 21.96 21.07 21.07L20.54 20.54L20.01 20.01C19.44 20.57 18.66 20.9 17.39 21.07C16.09 21.25 14.38 21.25 12 21.25V22ZM12 2V2.75C14.38 2.75 16.09 2.75 17.39 2.93C18.66 3.1 19.44 3.43 20.01 3.99L20.54 3.46L21.07 2.93C20.17 2.04 19.031 1.63 17.59 1.44C16.16 1.25 14.34 1.25 12 1.25V2ZM22 12H22.75C22.75 9.66 22.75 7.84 22.56 6.41C22.366 4.97 21.96 3.83 21.07 2.93L20.54 3.46L20.01 3.99C20.57 4.56 20.9 5.34 21.07 6.61C21.25 7.91 21.25 9.62 21.25 12H22ZM12 2V1.25C9.66 1.25 7.84 1.25 6.41 1.44C4.97 1.63 3.83 2.04 2.93 2.93L3.46 3.46L3.99 3.99C4.56 3.43 5.34 3.1 6.61 2.93C7.91 2.75 9.62 2.75 12 2.75V2ZM2 12H2.75C2.75 9.62 2.75 7.91 2.93 6.61C3.1 5.34 3.43 4.56 3.99 3.99L3.46 3.46L2.93 2.93C2.04 3.83 1.63 4.97 1.44 6.41C1.25 7.84 1.25 9.66 1.25 12H2ZM7 6H6.25V17H7H7.75V6H7ZM12 6H11.25V12H12H12.75V6H12ZM17 6H16.25V15.5H17H17.75V6H17Z" fill="currentColor"/>
    </svg>
  );
}

export function SubtaskIcon({ size = 16, color = 'var(--primary-300)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M3.33 6H12.67C13.77 6 14.67 5.1 14.67 4C14.67 2.9 13.77 2 12.67 2H3.33C2.23 2 1.33 2.9 1.33 4C1.33 5.1 2.23 6 3.33 6ZM3.33 6L3.33 9.33C3.33 10.81 4.53 12 6 12M6 12C6 13.1 6.9 14 8 14H12.67C13.77 14 14.67 13.1 14.67 12C14.67 10.9 13.77 10 12.67 10H8C6.9 10 6 10.9 6 12Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Single checkmark for the completed-task checkbox (Solar only ships a
// double-tick `check-read`, so this is a custom 1px-stroke glyph).
export function CheckIcon({ size = 13, color = 'var(--neutral-0)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M3.5 8.5 6.5 11.5 12.5 5" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// PriorityIcon lives in src/components/PriorityIcon now: this re-export
// keeps the ~6 existing feature-local imports working without a bulk
// rewrite. New callers should import from the shared location.
export { PriorityIcon } from '../../components/PriorityIcon/PriorityIcon';

