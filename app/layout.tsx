import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import "./globals.css";
import { WalletProvider } from "@/components/providers/WalletProvider";
import FarcasterProvider from "@/components/providers/FarcasterProvider";

// const inter = Inter({ subsets: ["latin"] });

// Use GeistSans and GeistMono
const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  metadataBase: new URL('https://monad-treasure-hunt.vercel.app'), // Set base URL for relative paths
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
    url: 'https://monad-treasure-hunt.vercel.app/', // Add the canonical URL
  },
  // Add Farcaster frame meta tags
  other: {
    // Specify the frame details according to Farcaster docs
    // https://miniapps.farcaster.xyz/docs/guides/sharing
    'fc:frame': JSON.stringify({
      version: "next",
      imageUrl: "https://monad-treasure-hunt.vercel.app/cover.png", // Use the cover image
      button: {
        title: "Play Treasure Hunt",
        action: {
          type: "launch_frame",
          url: "https://monad-treasure-hunt.vercel.app/",
          name: "Treasure Hunt",
          splashImageUrl: "https://monad-treasure-hunt.vercel.app/logo200.png",
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
      <body>
        <FarcasterProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </FarcasterProvider>
      </body>
    </html>
  );
}
