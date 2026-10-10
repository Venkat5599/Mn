import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { WalletProvider } from "@/components/Wallet";
import "./globals.css";

// Sentient (Indian Type Foundry, via Fontshare, free licence), self-hosted.
const sentient = localFont({
  src: [
    { path: "./fonts/Sentient-Regular.woff2", weight: "400" },
    { path: "./fonts/Sentient-Medium.woff2", weight: "500" },
    { path: "./fonts/Sentient-Bold.woff2", weight: "700" },
  ],
  variable: "--font-sentient",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HYPERHEDGE",
  description:
    "Protection against GPU compute delivery failure. Collateral locked onchain, delivery proven by real compute, payouts settled on Monad.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#121211", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sentient.variable}>
      <body>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
