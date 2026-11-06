import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty } from '../MobileParts';
import common from '../mobile.module.css';

/** Shown in place of a Settings > Account screen without that permission. */
export function NoAccountAccess({ title }) {
  return (
    <div className={common.screen}>
      <MobileSubHeader title={title} />
      <div className={common.body}>
        <MobileEmpty icon="solar:lock-keyhole-linear" title="No access" description="Ask your admin for access to Settings > Account." />
      </div>
    </div>
  );
}
