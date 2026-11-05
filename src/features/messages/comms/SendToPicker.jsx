import { Select } from '../../../components/Select/Select';

/**
 * Send To for the patient send drawers: the member starts picked, and their
 * contacts (care giver, decision maker…) can be added. Children (Protect
 * links) sit right under it, so it's set before writing.
 * Everything but labelEnd/children is passed to the Select.
 *
 * @param {React.ReactNode} [props.labelEnd] – right end of the label row (e.g. Cc / Bcc)
 * @param {React.ReactNode} [props.children]
 */
export function SendToPicker({ labelEnd, children, ...select }) {
  return (
    <>
      <Select
        labelAction={labelEnd}
        label="Send To"
        required
        multiple
        checkboxes
        badges
        searchable
        searchPlaceholder="Search by name"
        {...select}
      />
      {children}
    </>
  );
}
