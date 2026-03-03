import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GraphX.AI",
  description: "Gremlin-powered JanusGraph visualizer with agentic query generation",
  icons: {
    icon: [{ url: "/favicon.ico?v=2", type: "image/x-icon" }],
    shortcut: ["/favicon.ico?v=2"],
    apple: ["/favicon.ico?v=2"]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
