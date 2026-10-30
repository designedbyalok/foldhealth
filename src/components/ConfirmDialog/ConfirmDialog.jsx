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
import { Checkbox } from '../ShadcnCheckbox/ShadcnCheckbox';

const VARIANT_DEFAULTS = {
  warning: { icon: 'solar:danger-triangle-linear', iconColor: 'var(--status-error)', button: { variant: 'soft', tone: 'danger' } },
  destructive: { icon: 'solar:danger-circle-bold', iconColor: 'var(--status-error)', button: { variant: 'soft', tone: 'danger' } },
  primary: { icon: 'solar:info-circle-linear', iconColor: 'var(--primary-300)', button: { variant: 'solid', tone: 'primary' } },
  // `error` retained as an alias for existing callers — same look as `warning`.
  error: { icon: 'solar:danger-triangle-linear', iconColor: 'var(--status-error)', button: { variant: 'soft', tone: 'danger' } },
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
 * @param {string|null} props.cancelLabel – Label for the cancel button. `null` leaves it out,
 *   for a notice with a single acknowledge button ("Okay, understood").
 * @param {function} props.onConfirm   – Called when user clicks the primary action.
 * @param {function} props.onCancel    – Called when user clicks cancel or overlay.
 * @param {boolean}  props.loading     – If true, disable buttons and show loading text.
 * @param {boolean}  [props.confirmDisabled=false] – Keeps the primary action off until
 *   the caller's own input (e.g. a required choice in `children`) is filled in.
 * @param {string}   [props.overlayClassName] – Override the scrim utility class
 *   (defaults to the shared `bg-black/40`), e.g. `bg-black/25` for a lighter
 *   backdrop.
 * @param {boolean}  [props.inline=false] – Render the same dialog in place,
 *   with no scrim and without taking focus, for a question that mustn't block
 *   the page (e.g. the CCM timer's inactivity reminder). The caller positions
 *   it.
 * @param {{label: string, checked: boolean, onChange: function}} [props.checkbox] –
 *   An option that rides along with either answer ("Don't show this message
 *   again"), shown above the buttons. The caller holds its state.
 * @param {'center'|'start'} [props.align='center'] – 'start' lays it out
 *   left-aligned: the icon inline with the title, the description under them,
 *   then the checkbox and the buttons (Figma Dialog Box 2, 2810:68907).
 * @param {'sm'|'md'|'lg'} [props.buttonSize='md']
 * @param {function} [props.onClose] – Adds a close (X) beside the title. When
 *   set, the X, Escape and the overlay call it instead of onCancel, so the
 *   cancel button can be a real second choice (e.g. "Save as Draft").
 *   Pass `icon={false}` to leave the icon out.
 * @param {React.ReactNode} [props.children] – Extra content (e.g. a choice the
 *   answer depends on), shown above the checkbox and buttons. Pairs with
 *   align="start".
 * @param {string}   [props.className] – Extra class on the dialog box.
 * @param {boolean}  [props.heroIcon=false] – Centred layout only: shows the icon
 *   large, in a ringed circle, with the close (X) in the top-right corner
 *   (Figma consent dialogs, 29:7133).
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
  confirmDisabled = false,
  overlayClassName,
  inline = false,
  checkbox,
  align = 'center',
  buttonSize = 'md',
  className,
  onClose,
  children,
  heroIcon = false,
}) {
  const preset = VARIANT_DEFAULTS[variant] ?? VARIANT_DEFAULTS.warning;
  const resolvedIcon = icon ?? preset.icon;
  const resolvedIconColor = iconColor ?? preset.iconColor;

  // Inline, the Radix title/description (which need the dialog root) give
  // way to plain elements with the same look.
  const Title = inline ? 'h2' : AlertDialogTitle;
  const Description = inline ? 'p' : AlertDialogDescription;
  const start = align === 'start';
  const boxClass = [
    start ? 'flex flex-col items-stretch gap-6 p-5 max-w-[400px]' : `flex flex-col items-center gap-4 p-5 ${heroIcon ? 'max-w-[350px]' : 'max-w-[340px]'}`,
    className,
  ].filter(Boolean).join(' ');

  const iconEl = resolvedIcon === false ? null : <Icon name={resolvedIcon} size={heroIcon ? 32 : 24} color={resolvedIconColor} />;
  const closeEl = onClose && (
    <button type="button" aria-label="Close" onClick={onClose} className="ml-auto flex p-0.5 border-0 bg-transparent cursor-pointer text-[var(--neutral-300)] hover:text-[var(--neutral-400)]">
      <Icon name="solar:close-linear" size={16} />
    </button>
  );
  const titleEl = (
    <Title className="m-0 text-base font-medium text-[var(--neutral-400)] leading-tight">
      {title}
    </Title>
  );
  const descriptionEl = description && (
    <Description className="m-0 text-sm font-normal text-[var(--neutral-200)] leading-snug">
      {description}
    </Description>
  );
  const checkboxEl = checkbox && (
    <label className="flex items-center gap-2 self-start text-sm text-[var(--neutral-300)] cursor-pointer select-none">
      <Checkbox checked={!!checkbox.checked} onCheckedChange={(c) => checkbox.onChange(!!c)} />
      {checkbox.label}
    </label>
  );
  const footerEl = (
    <AlertDialogFooter className="flex-row justify-center w-full gap-2 mt-0">
      {cancelLabel != null && (
        <Button variant="outline" size={buttonSize} onClick={onCancel} disabled={loading} className="flex-1">
          {cancelLabel}
        </Button>
      )}
      <Button variant={preset.button.variant} tone={preset.button.tone} size={buttonSize} onClick={onConfirm} disabled={loading || confirmDisabled} className="flex-1">
        {loading ? 'Processing…' : confirmLabel}
      </Button>
    </AlertDialogFooter>
  );

  const content = start ? (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          {iconEl}
          {titleEl}
          {closeEl}
        </div>
        {descriptionEl}
      </div>
      {children}
      <div className="flex flex-col gap-3">
        {checkboxEl}
        {footerEl}
      </div>
    </>
  ) : (
    <>
      {heroIcon && onClose && <div className="absolute top-4 right-4">{closeEl}</div>}
      {heroIcon ? (
        <div className="flex items-center justify-center w-24 h-24 shrink-0 rounded-full border border-[var(--neutral-100)]">
          <div className="flex items-center justify-center w-[76px] h-[76px] rounded-full bg-[var(--neutral-50)] border border-[var(--neutral-100)]">{iconEl}</div>
        </div>
      ) : (
        <div className="flex items-center justify-center w-6 h-6 shrink-0">{iconEl}</div>
      )}
      <AlertDialogHeader className="items-center text-center sm:text-center gap-1">
        {titleEl}
        {descriptionEl}
      </AlertDialogHeader>
      {children}
      {checkboxEl}
      {footerEl}
    </>
  );

  if (inline) {
    return (
      <div
        role="alertdialog"
        aria-label={title}
        className={`${boxClass} w-full rounded-xl bg-popover border border-border`}
      >
        {content}
      </div>
    );
  }

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) (onClose || onCancel)?.(); }}>
      <AlertDialogContent className={boxClass} overlayClassName={overlayClassName}>
        {content}
      </AlertDialogContent>
    </AlertDialog>
  );
}
