import type { Metadata } from 'next';
import 'maplibre-gl/dist/maplibre-gl.css';

import './globals.css';

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
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
