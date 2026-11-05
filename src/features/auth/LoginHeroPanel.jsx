import loginHero from '../../assets/login-hero.png';
import styles from './LoginPage.module.css';

export function LoginHeroPanel() {
  return (
    <div className={styles.leftPanel}>
      <div className={styles.heroWrap}>
        <div className={styles.gridBg} />
        <img src={loginHero} alt="Healthcare illustration" width={1200} height={675} className={styles.heroImg} />
      </div>
      <div className={styles.dots}>
        <span className={styles.dotActive} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </div>
  );
}
