import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Kairos — Macro-Aware Probabilistic Intelligence",
  description:
    "AI-powered investment research platform built on TimesFM 2.5. Probabilistic asset forecasts, macro signals, portfolio risk, and historical pattern matching.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-kairos-bg text-kairos-text min-h-screen flex">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen bg-grid">
          {children}
        </main>
      </body>
    </html>
  );
}
