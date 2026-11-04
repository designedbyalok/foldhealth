import { Skeleton } from '../Skeleton/Skeleton';

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--neutral-0)', border: '0.5px solid var(--neutral-100)', borderRadius: 10,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <Skeleton style={{ width: 50, height: 20, borderRadius: 4 }} />
          <Skeleton style={{ width: 60, height: 20, borderRadius: 4 }} />
        </div>
        <Skeleton style={{ width: 50, height: 20, borderRadius: 4 }} />
      </div>
      <Skeleton style={{ width: '75%', height: 14 }} />
      <Skeleton style={{ width: '100%', height: 10 }} />
      <Skeleton style={{ width: '60%', height: 10 }} />
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <Skeleton style={{ width: 80, height: 18, borderRadius: 10 }} />
        <Skeleton style={{ width: 100, height: 18, borderRadius: 10 }} />
        <Skeleton style={{ width: 70, height: 18, borderRadius: 10 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '0.5px solid var(--neutral-100)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          <Skeleton style={{ width: 36, height: 16 }} />
          <Skeleton style={{ width: 50, height: 8 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          <Skeleton style={{ width: 36, height: 16 }} />
          <Skeleton style={{ width: 30, height: 8 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          <Skeleton style={{ width: 36, height: 16 }} />
          <Skeleton style={{ width: 40, height: 8 }} />
        </div>
        <Skeleton style={{ width: 40, height: 26, borderRadius: 6 }} />
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12, padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
