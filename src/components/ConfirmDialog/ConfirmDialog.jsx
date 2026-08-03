import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from './AlertDialogPrimitives';
import { Icon } from '../Icon/Icon';
import { Button } from '../Button/Button';

const VARIANT_DEFAULTS = {
  warning: { icon: 'solar:danger-triangle-linear', iconColor: 'var(--status-error)', button: 'danger' },
  destructive: { icon: 'solar:danger-circle-bold', iconColor: 'var(--status-error)', button: 'danger' },
  primary: { icon: 'solar:info-circle-linear', iconColor: 'var(--primary-300)', button: 'primary' },
  // `error` retained as an alias for existing callers — same look as `warning`.
  error: { icon: 'solar:danger-triangle-linear', iconColor: 'var(--status-error)', button: 'danger' },
};

/**
 * Reusable confirmation dialog — matches Fold Health design system.
 *
 * Pick a `variant` for the canonical look, or override individual props
 * (icon, iconColor, confirmLabel) when a specific caller needs it.
 *
 * @param {object}   props
 * @param {'warning'|'destructive'|'primary'} props.variant – Preset look.
 *   'warning' (default) = triangle-linear icon + danger button.
 *   'destructive' = filled danger-circle icon + danger button (delete/discard).
 *   'primary' = info icon + primary button.
 * @param {string}   props.icon        – Override the variant's default Iconify name.
 * @param {string}   props.iconColor   – Override icon color.
 * @param {string}   props.title       – Dialog heading.
 * @param {string}   props.description – Supporting text.
 * @param {string}   props.confirmLabel – Label for the primary action button.
 * @param {string}   props.cancelLabel  – Label for the cancel button.
 * @param {function} props.onConfirm   – Called when user clicks the primary action.
 * @param {function} props.onCancel    – Called when user clicks cancel or overlay.
 * @param {boolean}  props.loading     – If true, disable buttons and show loading text.
 */
export function ConfirmDialog({
  variant = 'warning',
  icon,
  iconColor,
  title = 'Are you sure?',
  description = '',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
}) {
  const preset = VARIANT_DEFAULTS[variant] ?? VARIANT_DEFAULTS.warning;
  const resolvedIcon = icon ?? preset.icon;
  const resolvedIconColor = iconColor ?? preset.iconColor;

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onCancel?.(); }}>
      <AlertDialogContent
        className="flex flex-col items-center gap-4 p-5 max-w-[340px]"
      >
        <div className="flex items-center justify-center w-6 h-6 shrink-0">
          <Icon name={resolvedIcon} size={24} color={resolvedIconColor} />
        </div>

        <AlertDialogHeader className="items-center text-center sm:text-center gap-1">
          <AlertDialogTitle className="text-base font-medium text-[var(--neutral-400)] leading-tight">
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-sm font-normal text-[var(--neutral-200)] leading-snug">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-row justify-center w-full gap-2 mt-0">
          <Button
            variant="secondary"
            size="L"
            onClick={onCancel}
            disabled={loading}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={preset.button}
            size="L"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Processing…' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
