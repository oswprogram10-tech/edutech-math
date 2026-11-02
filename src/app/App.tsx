import { appStrings } from './strings.ko';
import styles from './App.module.css';

export function App() {
  return (
    <main className={styles.home}>
      <h1>{appStrings.title}</h1>
      <p>{appStrings.tagline}</p>
      <p className={styles.note}>{appStrings.comingSoon}</p>
    </main>
  );
}
