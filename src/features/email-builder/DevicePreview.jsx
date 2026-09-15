import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { renderPreviewHtml } from './renderEmail';
import { Toggle } from '../../components/Toggle/Toggle';
import styles from './DevicePreview.module.css';

export function EmailIframe({ html, renderWidth, theme = 'light' }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Preview surface mirrors the in-component theme toggle, not the app theme —
  // recipients see emails on a device with its own light/dark setting, so the
  // iframe and its wrapper must paint together to prevent a white flash before
  // the email HTML loads.
  const previewBg = theme === 'dark' ? '#0F1117' : '#fff';

  // Inject a thin transparent scrollbar into the iframe document so the email
  // preview doesn't render with the OS-default scrollbar (which paints as a
  // wide dark bar over the rendered design). Preview-only — does not affect
  // the actual email HTML delivered to recipients. Always prepended (no head
  // matching) and forced with !important so we win the cascade vs whatever
  // styles the email template ships with.
  const scrollbarThumb = theme === 'dark' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)';
  const scrollbarThumbHover = theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const scrollbarCss = `<style>
    html, body { scrollbar-width: thin !important; scrollbar-color: ${scrollbarThumb} transparent !important; }
    ::-webkit-scrollbar { width: 8px !important; height: 8px !important; background: transparent !important; }
    ::-webkit-scrollbar-track { background: transparent !important; border: none !important; box-shadow: none !important; }
    ::-webkit-scrollbar-corner { background: transparent !important; }
    ::-webkit-scrollbar-thumb { background: ${scrollbarThumb} !important; border-radius: 4px !important; border: 2px solid transparent !important; background-clip: padding-box !important; }
    ::-webkit-scrollbar-thumb:hover { background: ${scrollbarThumbHover} !important; background-clip: padding-box !important; }
  </style>`;

  // Render the email HTML via srcdoc + sandbox — isolates the iframe from the
  // parent origin so any <script> in the email markup cannot run in the app.
  // Always prepend the scrollbar style; HTML parsers tolerate <style> outside
  // <head> and hoist it.
  const srcDoc = html ? scrollbarCss + html : '<!DOCTYPE html><html><body></body></html>';

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
        title="Email preview"
        className={styles.emailIframe}
        sandbox="allow-same-origin"
        srcDoc={srcDoc}
        style={{ background: previewBg, colorScheme: theme }}
      />
    );
  }

  return (
    <div ref={wrapRef} className={styles.emailIframeScaled} style={{ background: previewBg }}>
      <iframe
        title="Email preview"
        sandbox="allow-same-origin"
        srcDoc={srcDoc}
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
          background: previewBg,
          colorScheme: theme,
        }}
      />
    </div>
  );
}

export function MacBookPro({ width = 900, screen }) {
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

export function IPhone17Pro({ width = 360, screen }) {
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
  // Theme override for the device preview — lets the user see how the email
  // would render on a device with system dark mode versus light mode without
  // changing their actual OS theme.
  const [theme, setTheme] = useState('light');

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
    emailHtml = renderPreviewHtml(doc, { theme });
  }

  const avail = Math.max(280, stageW - 64);
  const macWidth = Math.min(1100, avail);
  const phoneWidth = Math.min(360, Math.max(260, avail * 0.7));

  return (
    <div className={styles.stage} ref={stageRef}>
      <div className={styles.themeBar}>
        <Toggle
          size="S"
          items={[
            { key: 'light', label: 'Light', icon: 'solar:sun-linear' },
            { key: 'dark',  label: 'Dark',  icon: 'solar:moon-linear' },
          ]}
          active={theme}
          onChange={setTheme}
        />
      </div>
      <div className={styles.deviceWrap} key={device}>
        {device === 'desktop' ? (
          <MacBookPro width={macWidth} screen={<EmailIframe html={emailHtml} renderWidth={1280} theme={theme} />} />
        ) : (
          <IPhone17Pro width={phoneWidth} screen={<EmailIframe html={emailHtml} renderWidth={420} theme={theme} />} />
        )}
        <div className={styles.meta}>
          {device === 'desktop' ? 'MacBook Pro · 16-inch' : 'iPhone 17 Pro · 6.3-inch'}
          {theme === 'dark' && <span className={styles.themeBadge}>· Dark mode</span>}
        </div>
      </div>
    </div>
  );
}
