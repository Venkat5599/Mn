import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/Providers";
import "./globals.css";

// Sentient and Switzer (Indian Type Foundry, via Fontshare, free licence), self-hosted.
const sentient = localFont({
  src: [
    { path: "./fonts/Sentient-Regular.woff2", weight: "400" },
    { path: "./fonts/Sentient-Medium.woff2", weight: "500" },
    { path: "./fonts/Sentient-Bold.woff2", weight: "700" },
  ],
  variable: "--font-sentient",
  display: "swap",
});

// Supreme (Indian Type Foundry, via Fontshare, free licence): the landing page voice, one family in three weights.
const supreme = localFont({
  src: [
    { path: "./fonts/Supreme-400.woff2", weight: "400" },
    { path: "./fonts/Supreme-500.woff2", weight: "500" },
    { path: "./fonts/Supreme-700.woff2", weight: "700" },
  ],
  variable: "--font-supreme",
  display: "swap",
});

// Pally (Indian Type Foundry, via Fontshare, free licence): the hero voice, as on the scrappypet landing.
const pally = localFont({
  src: [
    { path: "./fonts/Pally-400.woff2", weight: "400" },
    { path: "./fonts/Pally-500.woff2", weight: "500" },
    { path: "./fonts/Pally-700.woff2", weight: "700" },
  ],
  variable: "--font-pally",
  display: "swap",
});

const switzer = localFont({
  src: [
    { path: "./fonts/Switzer-400.woff2", weight: "400" },
    { path: "./fonts/Switzer-500.woff2", weight: "500" },
    { path: "./fonts/Switzer-600.woff2", weight: "600" },
  ],
  variable: "--font-switzer",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HYPERHEDGE",
  description:
    "Protection against GPU compute delivery failure. Collateral locked onchain, delivery proven by real compute, payouts settled on Monad.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#1b211e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sentient.variable} ${switzer.variable} ${supreme.variable} ${pally.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
