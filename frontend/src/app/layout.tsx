import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import HealthCheckProvider from "@/components/HealthCheckProvider";
import { AuthProvider } from "@/components/AuthProvider";
import "@/utils/debugEnv";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TerraHost",
  description: "TerraHost - Modern hosting solution",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <HealthCheckProvider checkOnMount={true} periodicCheck={false}>
            {children}
          </HealthCheckProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
