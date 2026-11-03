import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["400", "600", "700", "800"],
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: {
    default: "Family Car Booker",
    template: "%s · Family Car Booker",
  },
  description:
    "Kids request a car from one household link. An admin approves on a private link. No app and no account.",
  applicationName: "Family Car Booker",
  appleWebApp: { capable: true, title: "Cars", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f3efe6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
