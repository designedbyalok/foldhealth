import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { renderEmailHtml } from './patchEmailHtml';
import styles from './DevicePreview.module.css';

function EmailIframe({ html, renderWidth }) {
  const iframeRef = useRef(null);
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const f = iframeRef.current;
    if (!f) return;
    const doc = f.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
  }, [html]);

  useEffect(() => {
    if (!renderWidth) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
      setScale(width / renderWidth);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [renderWidth]);

  if (!renderWidth) {
    return (
      <iframe
        ref={iframeRef}
        title="Email preview"
        className={styles.emailIframe}
      />
    );
  }

  return (
    <div ref={wrapRef} className={styles.emailIframeScaled}>
      <iframe
        ref={iframeRef}
        title="Email preview"
        style={{
          width: renderWidth,
          height: scale ? size.h / scale : '100%',
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: 'top center',
          position: 'absolute',
          left: '50%',
          top: 0,
          border: 0,
          display: 'block',
          background: '#fff',
          colorScheme: 'light',
        }}
      />
    </div>
  );
}

function MacBookPro({ width = 900, screen }) {
  return (
    <div className={styles.macbook} style={{ width, maxWidth: '100%' }}>
      <div className={styles.macScreen}>
        <div className={styles.macViewport}>
          {screen}
        </div>
      </div>
      <div className={styles.macBase} />
      <div className={styles.macNotch} />
    </div>
  );
}

function IPhone17Pro({ width = 360, screen }) {
  const baseW = 420;
  const baseH = 885;
  const scale = width / baseW;
  const height = baseH * scale;

  return (
    <div style={{ width, height, position: 'relative' }}>
      <div
        className={styles.iphone}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        <div className={styles.iphoneBorder} />
        <div className={styles.iphoneSwitch} />
        <div className={styles.iphoneVolup} />
        <div className={styles.iphoneVoldown} />
        <div className={styles.iphonePower} />
        <div className={styles.iphoneScreen}>
          <div className={styles.iphoneInner}>
            {screen}
          </div>
          <div className={styles.iphoneIsland} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export function DevicePreview({ device }) {
  const doc = useAppStore(s => s.emailDocument);
  const htmlOverride = useAppStore(s => s.htmlPreviewOverride);
  const stageRef = useRef(null);
  const [stageW, setStageW] = useState(0);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setStageW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  let emailHtml = '';
  if (htmlOverride) {
    emailHtml = htmlOverride;
  } else if (doc) {
    emailHtml = renderEmailHtml(doc);
  }

  const avail = Math.max(280, stageW - 64);
  const macWidth = Math.min(1100, avail);
  const phoneWidth = Math.min(360, Math.max(260, avail * 0.7));

  return (
    <div className={styles.stage} ref={stageRef}>
      <div className={styles.deviceWrap} key={device}>
        {device === 'desktop' ? (
          <MacBookPro width={macWidth} screen={<EmailIframe html={emailHtml} renderWidth={1280} />} />
        ) : (
          <IPhone17Pro width={phoneWidth} screen={<EmailIframe html={emailHtml} renderWidth={420} />} />
        )}
        <div className={styles.meta}>
          {device === 'desktop' ? 'MacBook Pro · 16-inch' : 'iPhone 17 Pro · 6.3-inch'}
        </div>
      </div>
    </div>
  );
}
