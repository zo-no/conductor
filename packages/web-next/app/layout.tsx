import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conductor",
  description: "Local-first task scheduling for humans and AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
