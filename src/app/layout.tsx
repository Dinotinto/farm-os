import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  applicationName: "Farm OS",
  title: "Dinotinto Farm OS",
  description: "Farm operations dashboard for crop cycles, nursery records, inventory, tasks, harvests, sales, and profit.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Farm OS" },
  icons: {
    icon: [
      { url: "/icons/favicon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#193b28",
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
