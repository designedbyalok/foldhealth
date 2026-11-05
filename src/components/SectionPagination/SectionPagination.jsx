import { ActionButton } from '../ActionButton/ActionButton';
import styles from './SectionPagination.module.css';

/**
 * SectionPagination: the compact pager shown under a list/table section
 * (Figma 5732-276316). A left-aligned "start-end of total" range followed by
 * prev / next arrow buttons. Use it for in-section paging (e.g. a care-program
 * task section) where the full worklist `Pagination` (per-page selector +
 * go-to input) would be too heavy.
 *
 * @param {object}   props
 * @param {number}   props.page          – 1-based current page
 * @param {number}   props.perPage       – items per page
 * @param {number}   props.total         – total item count
 * @param {function} props.onPageChange  – (nextPage: number) => void
 */
export function SectionPagination({ page, perPage, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const end = Math.min(safePage * perPage, total);

  return (
    <div className={styles.root}>
      <span className={styles.range}>{start}-{end} of {total}</span>
      <ActionButton
        icon="solar:alt-arrow-left-linear"
        size="sm"
        tooltip="Previous"
        disabled={safePage <= 1}
        onClick={() => onPageChange(safePage - 1)}
      />
      <ActionButton
        icon="solar:alt-arrow-right-linear"
        size="sm"
        tooltip="Next"
        disabled={safePage >= totalPages}
        onClick={() => onPageChange(safePage + 1)}
      />
    </div>
  );
}
