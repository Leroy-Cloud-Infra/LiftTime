import type { Metadata } from "next";
import { DM_Mono } from "next/font/google";

import "./globals.css";

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono"
});

export const metadata: Metadata = {
  title: "LiftTime Active Workout",
  description: "Phase 1 Active Workout UI prototype"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
