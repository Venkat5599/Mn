import { LinkButton } from "./Button";
import { PixelClouds } from "./PixelClouds";
import s from "./SkyHero.module.css";

/**
 * Landing hero, ported from scrappypet (github.com/Venkat5599/Gameboy): a pixel-cloud sky, a two-line headline
 * that pops in, and stacked gloss buttons.
 * Every word is visible without JS; motion only moves things that are already on screen.
 */
export function SkyHero() {
  return (
    <section className={s.hero}>
      <PixelClouds cloudColor="#f7fbff" skyTopColor="#8ec0fa" skyBottomColor="#ffffff" />

      <div className={s.body}>
        <h1>
          <span className={s.pop}>Your GPU hours.</span>
          <span className={`${s.pop} ${s.blue}`} style={{ "--d": "0.14s" } as React.CSSProperties}>
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
      </div>
    </section>
  );
}
