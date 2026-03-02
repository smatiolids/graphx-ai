import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JanusGraph Visualizer Agent",
  description: "Gremlin-powered JanusGraph visualizer with agentic query generation"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
