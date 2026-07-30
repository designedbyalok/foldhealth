import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

const Slider = React.forwardRef(({ className, ...props }, ref) => {
  // Radix forwards these to Root only — pull them off and forward to each Thumb
  // so screen readers announce the slider's purpose (axe: aria-input-field-name).
  const { 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...rootProps } = props;
  const thumbCount = Array.isArray(rootProps.value ?? rootProps.defaultValue) ? (rootProps.value ?? rootProps.defaultValue).length : 1;
  const thumbLabels = ['Minimum value', 'Maximum value'];
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn('relative flex w-full touch-none select-none items-center', className)}
      {...rootProps}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[var(--neutral-100)]">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          aria-label={ariaLabel ?? (thumbCount > 1 ? thumbLabels[i] : 'Value')}
          aria-labelledby={ariaLabelledBy}
          className="block h-4 w-4 rounded-full bg-white border-2 border-primary shadow-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
