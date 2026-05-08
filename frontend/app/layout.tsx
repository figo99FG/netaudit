import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetAudit — Network Config Security Analyzer",
  description: "Scan network device configs for vulnerabilities. Get a security score and remediation guidance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
