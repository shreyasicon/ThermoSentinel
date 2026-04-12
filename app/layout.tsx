import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Geist, Geist_Mono } from 'next/font/google'
import { Providers } from '@/components/Providers'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'ThermoSentinel - Datacenter Monitoring System',
  description: 'Real time Edge Fog Cloud monitoring system for temperature and environmental data with dynamic risk assessment',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // `headers()` is not available for fully static export (`STATIC_EXPORT` / Amplify `out/`).
  const requestHost =
    process.env.STATIC_EXPORT === 'true'
      ? null
      : (await headers()).get('host')
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <Providers requestHost={requestHost}>{children}</Providers>
      </body>
    </html>
  )
}
