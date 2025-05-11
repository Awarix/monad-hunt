import type { Metadata } from "next";
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import "./globals.css";
import { WalletProvider } from "@/components/providers/WalletProvider";
import FarcasterProvider from "@/components/providers/FarcasterProvider";

// Use GeistSans and GeistMono
const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  metadataBase: new URL('https://monad-hunt.vercel.app'), 
  title: "Treasure Hunt",
  description: "Find the treasure in this classic treasure hunt game.",
  openGraph: {
    title: "Treasure Hunt",
    description: "Find the treasure in this classic treasure hunt game.",
    images: [
      {
        url: "/cover.png", // Relative path, uses metadataBase. Should be 1200x630
        width: 1200,      // Specify correct OG dimensions
        height: 630,
        alt: "Treasure Hunt Cover Image",
      },
    ],
    type: 'website',
    url: 'https://monad-hunt.vercel.app/', 
  },
  // Add Farcaster frame meta tags
  other: {
    // Specify the frame details according to Farcaster docs
    // https://miniapps.farcaster.xyz/docs/guides/sharing
    'fc:frame': JSON.stringify({
      version: "next",
      imageUrl: "https://monad-hunt.vercel.app/cover.png", 
      button: {
        title: "Play Treasure Hunt",
        action: {
          type: "launch_frame",
          url: "https://monad-hunt.vercel.app/",
          name: "Treasure Hunt",
          splashImageUrl: "https://monad-hunt.vercel.app/splash.png",
          splashBackgroundColor: "#111622"
        }
      }
    })
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className={`bg-gradient-to-br from-[var(--theme-bg-start)] to-[var(--theme-bg-end)] text-[var(--theme-text-primary)]`}>
        <FarcasterProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </FarcasterProvider>
      </body>
    </html>
  );
}
