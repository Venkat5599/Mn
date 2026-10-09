import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Tanker (Indian Type Foundry, via Fontshare, free license): a condensed scoreboard face.
const tanker = localFont({
  src: "../fonts/Tanker-Regular.woff2",
  variable: "--font-tanker",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Pitchside",
  description: "Bet your friends on every pitch. A new market every pitch, settled on Monad before the next one.",
  applicationName: "Pitchside",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  appleWebApp: { capable: true, title: "Pitchside", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#07100c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={tanker.variable}>
      <body>{children}</body>
    </html>
  );
}
