import { useEffect, useState } from 'react';
import videoVisit from '../assets/intro-video-visit.svg';
import medications from '../assets/intro-medications.svg';
import careRoutines from '../assets/intro-care-routines.svg';
import styles from './LoginPage.module.css';

// The three variants of the Figma "Intro card" component (node 701:5587).
const SLIDES = [
  { src: videoVisit, caption: 'Schedule remote visits or instant video visit' },
  { src: medications, caption: 'Refill meds, manage care plan & get care on demand' },
  { src: careRoutines, caption: 'Manage care routines for you and family' },
];
const INTERVAL_MS = 6000;

export function IntroCarousel() {
  const [index, setIndex] = useState(0);

  // Restarts after a manual pick, so a chosen slide gets its full time.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [index]);

  return (
    <section className={styles.intro} aria-label="What you can do with Fold Health">
      <div className={styles.introSlide}>
        {/* All slides stay mounted and stacked, so switching cross-fades
            without reloading and the layout never jumps between captions. */}
        <div className={styles.introStage}>
          {SLIDES.map((s, i) => (
            <img
              key={s.src}
              src={s.src}
              alt=""
              className={`${styles.introImg} ${i === index ? styles.introVisible : ''}`}
            />
          ))}
        </div>
        <div className={styles.introCaptions}>
          {SLIDES.map((s, i) => (
            <p
              key={s.src}
              className={`${styles.introCaption} ${i === index ? styles.introVisible : ''}`}
              aria-hidden={i !== index}
            >
              {s.caption}
            </p>
          ))}
        </div>
      </div>
      <div className={styles.dots}>
        {SLIDES.map((s, i) => (
          <button
            key={s.src}
            type="button"
            className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
            aria-label={`Show slide ${i + 1} of ${SLIDES.length}`}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  );
}
