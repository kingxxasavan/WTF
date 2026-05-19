import "./globals.css";
import type { Metadata } from "next";
import { ThemeBootstrap } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "WTF — messenger",
  description: "Private messaging with friends and groups.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </head>
      <body className="min-h-screen font-sans">
        <ThemeBootstrap />
        {children}
      </body>
    </html>
  );
}
