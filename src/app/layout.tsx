import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { CapacitorInit } from "@/components/capacitor-init";
import { AppSplash, SPLASH_CSS } from "@/components/app-splash";

// IRANYekanX variable font (one file covers weights 100–1000), bundled locally.
const iranYekanX = localFont({
  src: "./fonts/IRANYekanX-VF.ttf",
  variable: "--font-yekan",
  display: "swap",
  weight: "100 1000",
});

export const metadata: Metadata = {
  title: "Persian Calendar | تقویم شمسی و میلادی",
  description: "تقویم شمسی و میلادی با یادآور مناسبت ها و تولدها، محاسبه سن و تبدیل تاریخ",
  keywords: ["تقویم", "شمسی", "میلادی", "جلالی", "یادآور", "محاسبه سن", "تبدیل تاریخ", "Persian calendar", "Jalali"],
  authors: [{ name: "Persian Calendar" }],
  applicationName: "Persian Calendar",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Persian Calendar",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: [
      { url: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Persian Calendar — تقویم شمسی و میلادی",
    description: "تقویم شمسی و میلادی با یادآور مناسبت ها و تولدها",
    type: "website",
    locale: "fa_IR",
  },
};

export const viewport: Viewport = {
  themeColor: "#2B62EF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Inline, so it applies before any JS/CSS bundle loads: no black/blank screen at start-up. */}
        <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
      </head>
      <body
        className={`${iranYekanX.variable} font-sans antialiased bg-background text-foreground`}
      >
        <AppSplash />
        <CapacitorInit />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
