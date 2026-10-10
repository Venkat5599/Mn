"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, connectorsForWallets, lightTheme } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet, rabbyWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { chain } from "@/lib/chain";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

// Without a WalletConnect project id only browser wallets are offered; with one, mobile and QR wallets too.
const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: projectId ? [metaMaskWallet, rabbyWallet, walletConnectWallet, injectedWallet] : [injectedWallet, rabbyWallet],
    },
  ],
  { appName: "HYPERHEDGE", projectId: projectId ?? "browser-wallets-only" },
);

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors,
  transports: { [chain.id]: http(chain.rpcUrls.default.http[0]) },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={client}>
        <RainbowKitProvider
          theme={lightTheme({ accentColor: "#1f6f5c", accentColorForeground: "#ffffff", borderRadius: "medium" })}
          initialChain={chain}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
