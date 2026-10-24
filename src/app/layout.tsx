import type { Metadata, Viewport } from 'next';
import { TooltipProvider } from "@/components/ui/tooltip"
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import ServerConnectionStatus from '@/components/ServerConnectionStatus';
import './globals.css';
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Meow Moments',
  description: 'Share moments with your special someone',
  applicationName: 'Meow Moments',
  formatDetection: { telephone: false },
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Meow Moments',
  },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      {
        url: '/icons/apple-touch-icon-152.png',
        sizes: '152x152',
        type: 'image/png',
      },
      {
        url: '/icons/apple-touch-icon-167.png',
        sizes: '167x167',
        type: 'image/png',
      },
      {
        url: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#FF6B9D',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body className="min-h-screen bg-soft-bg antialiased">
        <TooltipProvider>
          <ServerConnectionStatus />
          {children}
          <ServiceWorkerRegistrar />
        </TooltipProvider>
      </body>
    </html>
  );
}
