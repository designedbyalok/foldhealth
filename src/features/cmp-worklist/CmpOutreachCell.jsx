import { OutreachStatus } from '../../components/OutreachStatus/OutreachStatus';
import { outreachFromCount } from '../../components/OutreachStatus/outreachStatusModel';

/** One CMP enrollment's outreach: the shared worklist outreach status. */
export function CmpOutreachCell({ member }) {
  return <OutreachStatus {...outreachFromCount(member.outreach, member.progSubStatus, member.lastOutreach)} />;
}
