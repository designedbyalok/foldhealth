import { Banner } from '../Banner/Banner';

// Now Banner (src/components/layers.json $deprecated). Kept so open branches build.
export function InfoBar({ tone = 'info', variant, icon = 'solar:info-circle-linear', ...rest }) {
  return <Banner tone={tone === 'error' ? 'danger' : tone} size={variant === 'inline' ? 'sm' : 'md'} icon={icon} {...rest} />;
}
