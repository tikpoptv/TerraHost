import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import HealthCheckProvider from "@/components/HealthCheckProvider";
import { AuthProvider } from "@/components/AuthProvider";
import ConfigErrorBoundary from "@/components/ConfigErrorBoundary";
import { Toaster } from "react-hot-toast";
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
        <ConfigErrorBoundary>
          <AuthProvider>
            <HealthCheckProvider checkOnMount={true} periodicCheck={false}>
              {children}
            </HealthCheckProvider>
          </AuthProvider>
        </ConfigErrorBoundary>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10B981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#EF4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
