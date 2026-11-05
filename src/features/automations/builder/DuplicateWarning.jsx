import { Button } from '../../../components/Button/Button';
import { AIIcon } from '../../../components/Icon/AIIcon';
import { nodeDef } from '../lib/catalog';
import styles from './AutomationBuilder.module.css';

/**
 * The AI card under a pair of duplicate message steps (Figma 141): the same
 * content would go out twice back to back. Offers the three fixes drawn:
 * edit the second step, put a delay between them, or delete the second.
 */
export function DuplicateWarning({ first, second, onEdit, onAddDelay, onDelete }) {
  const a = nodeDef(first.type)?.nodeLabel;
  const b = nodeDef(second.type)?.nodeLabel;
  return (
    <div className={styles.dupCard}>
      <p className={styles.dupText}>
        <AIIcon size={16} />
        <span>
          {a === b ? `Two “${a}” steps` : `“${a}” and “${b}”`} send the same content back to back, so members would get it twice at the same time.
        </span>
      </p>
      <div className={styles.dupActions}>
        <Button variant="outline" size="sm" leadingIcon="solar:pen-linear" onClick={onEdit}>Edit Content</Button>
        <Button variant="outline" size="sm" leadingIcon="solar:clock-circle-linear" onClick={onAddDelay}>Add Delay</Button>
        <Button variant="outline" size="sm" leadingIcon="solar:trash-bin-trash-linear" onClick={onDelete}>Delete</Button>
      </div>
    </div>
  );
}
