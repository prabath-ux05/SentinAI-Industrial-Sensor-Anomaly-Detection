import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SentinAI - Industrial Monitoring",
  description: "Intelligent Industrial Monitoring. Predictive Maintenance. Smarter Decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-charcoal text-slate-100 flex h-screen overflow-hidden`}>
        <Sidebar />
        <main className="flex-1 h-screen overflow-y-auto bg-charcoal p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
