import { Banner } from '../Banner/Banner';

// Now Banner variant="outline" (src/components/layers.json $deprecated). Kept so open branches build.
export function Alert({ tone = 'error', message, children, ...rest }) {
  return <Banner variant="outline" tone={tone === 'error' ? 'danger' : tone} {...rest}>{message ?? children}</Banner>;
}
