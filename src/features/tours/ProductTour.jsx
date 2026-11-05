import { ProductTour as BaseProductTour } from '../../components/ProductTour/ProductTour';
import { tourStore } from './tourStore';

/** ProductTour that remembers seen tours per user across devices. */
export function ProductTour(props) {
  return <BaseProductTour store={tourStore} {...props} />;
}
