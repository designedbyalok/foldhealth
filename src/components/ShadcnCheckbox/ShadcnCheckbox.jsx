import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { cn } from '@/lib/utils'

const Checkbox = React.forwardRef(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer shrink-0 rounded-[5px] border border-[var(--neutral-200)] bg-[var(--neutral-0)] ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--primary-300)] data-[state=checked]:border-[var(--primary-300)] data-[state=checked]:text-white data-[state=indeterminate]:bg-[var(--primary-200)] data-[state=indeterminate]:border-[var(--primary-200)] data-[state=indeterminate]:text-white cursor-pointer',
      className
    )}
    style={{ width: 16, height: 16 }}
    {...props}
  >
    {/* forceMount keeps the Indicator in the DOM regardless of state so the
        button's baseline calc is identical when checked vs unchecked. Without
        this, unmounting the SVG shifts the surrounding line-box by ~3px in
        inline layouts (Radix mounts the indicator only when active). */}
    <CheckboxPrimitive.Indicator
      forceMount
      className={cn('flex items-center justify-center text-current', 'data-[state=unchecked]:invisible')}
    >
      {props.checked === 'indeterminate' ? (
        <svg width="8" height="2" viewBox="0 0 8 2" fill="none">
          <rect width="8" height="2" rx="1" fill="white" />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5L4.2 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
