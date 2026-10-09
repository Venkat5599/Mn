import { GameBoard } from "@/components/home/GameBoard";
import { ZoneReplay } from "@/components/home/ZoneReplay";
import { Wordmark } from "@/components/ui/Wordmark";
import styles from "./home.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Wordmark />
        <a className={styles.navLink} href="#how">
          How it settles
        </a>
      </nav>

      <h1 className={styles.headline}>
        Bet your friends
        <span className={styles.second}>on every pitch.</span>
      </h1>

      <section className={styles.board} aria-label="Tonight's games and a real at-bat">
        <div className={styles.games}>
          <GameBoard />
        </div>
        <div className={styles.tracker}>
          <ZoneReplay />
        </div>
      </section>

      <section id="how" className={styles.how}>
        <p className={styles.lede}>
          Open a room for a live game and send the link. Before every pitch, everyone calls it: ball,
          strike, foul or in play. Calls lock eight seconds after the last pitch. The room&rsquo;s pot pays
          out on Monad before the next one is thrown.
        </p>
        <dl className={styles.facts}>
          <div>
            <dt className="num">16 sec</dt>
            <dd>between pitches, the median in a real playoff game. A whole market lives inside it.</dd>
          </div>
          <div>
            <dt className="num">26</dt>
            <dd>Monad blocks in the 8-second calling window. On Ethereum it&rsquo;s under one.</dd>
          </div>
          <div>
            <dt>2 sources</dt>
            <dd>The relayer posts each pitch; Chainlink CRE checks it. If they disagree, everyone is refunded.</dd>
          </div>
        </dl>
      </section>

      <footer className={styles.footer}>
        <p>
          Points rooms are free play. Stakes rooms use AUSD and are off wherever real-money play isn&rsquo;t allowed.
          Game data from the MLB Stats API. Contracts are unaudited.
        </p>
      </footer>
    </main>
  );
}
