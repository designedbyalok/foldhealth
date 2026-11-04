import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

const THUMB_LABELS = ['Minimum value', 'Maximum value'];

// variant 'neutral': grey range and a small thumb (Print drawer logo scale).
const Slider = React.forwardRef(({ className, variant = 'primary', ...props }, ref) => {
  const neutral = variant === 'neutral';
  // Radix forwards these to Root only, pull them off and forward to each Thumb
  // so screen readers announce the slider's purpose (axe: aria-input-field-name).
  const { 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...rootProps } = props;
  const thumbCount = Array.isArray(rootProps.value ?? rootProps.defaultValue) ? (rootProps.value ?? rootProps.defaultValue).length : 1;
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn('relative flex w-full touch-none select-none items-center', className)}
      {...rootProps}
    >
      <SliderPrimitive.Track className={cn('relative h-1.5 w-full grow overflow-hidden rounded-full', neutral ? 'bg-[var(--neutral-50)] border-[0.5px] border-[var(--neutral-150)]' : 'bg-[var(--neutral-100)]')}>
        <SliderPrimitive.Range className={cn('absolute h-full rounded-full', neutral ? 'bg-[var(--neutral-300)]' : 'bg-primary')} />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          aria-label={ariaLabel ?? (thumbCount > 1 ? THUMB_LABELS[i] : 'Value')}
          aria-labelledby={ariaLabelledBy}
          className={cn(
            'block rounded-full bg-white shadow-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
            neutral ? 'h-2.5 w-2.5 border border-[var(--neutral-300)]' : 'h-4 w-4 border-2 border-primary',
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
