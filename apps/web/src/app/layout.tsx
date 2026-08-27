import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import 'maplibre-gl/dist/maplibre-gl.css';

import './globals.css';
import './styles/ivory-tokens.css';
import './styles/ivory-shared.css';
import './styles/ivory-landing.css';
import './styles/ivory-client.css';
import './styles/ivory-barber.css';
import './styles/ivory-responsive.css';
import './styles/ivory-contrast.css';

import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: {
    default: 'cutG',
    template: '%s | cutG',
  },
  description: 'Barber operations, without the busywork.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <Providers>{children}</Providers>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
