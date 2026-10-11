import { LinkButton } from "./Button";
import { PixelClouds } from "./PixelClouds";
import { Finn, HeroSprites } from "./HeroSprites";
import s from "./SkyHero.module.css";

/**
 * Landing hero, ported from scrappypet (github.com/Venkat5599/Gameboy): a pixel-cloud sky, drifting pixel sprites,
 * a two-line headline that pops in, stacked gloss buttons, one dark "how it goes" card and Finn with a tip.
 * Every word is visible without JS; motion only moves things that are already on screen.
 */
export function SkyHero() {
  return (
    <section className={s.hero}>
      <PixelClouds cloudColor="#f7fbff" skyTopColor="#8ec0fa" skyBottomColor="#ffffff" />

      <HeroSprites wrap={s.sprites} sprite={s.sprite} float={s.float} />

      <div className={s.body}>
        <h1>
          <span className={s.pop}>Your GPU hours.</span>
          <span className={`${s.pop} ${s.white}`} style={{ "--d": "0.14s" } as React.CSSProperties}>
            Protected by proof.
          </span>
        </h1>
        <p className={s.lead}>
          Protection against reserved compute that never shows up. The payout is locked before you buy, delivery is proven
          by real work, and claims settle on Monad.
        </p>

        <div className={s.actions}>
          <LinkButton href="/app">Launch App</LinkButton>
          <LinkButton href="/app/faucet">Get test funds</LinkButton>
          <span className={s.small}>Monad testnet · hhUSD</span>
          <span className={s.note}>Free to try. Connect a wallet when you buy.</span>
        </div>

        <figure className={s.card}>
          <figcaption>How a contract goes</figcaption>
          <p className={s.cardOne}>The seller locks the full payout first</p>
          <p className={s.cardTwo}>Prove delivery every 15 s. Miss it, the buyer is paid.</p>
          <p className={s.cardThree}>2 of 3 signed reports · 5 min dispute window · settled on Monad</p>
        </figure>

        <div className={s.tip}>
          <Finn className={`${s.finn} ${s.float}`} />
          <p>Psst! Paying a small premium so a failure pays you back is exactly what hedging is. You just learned it.</p>
        </div>
      </div>
    </section>
  );
}
