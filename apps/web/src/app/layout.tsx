import { Sora, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const sora = Sora({
  weight: ['500', '600', '700'],
  variable: '--font-heading',
  subsets: ['latin'],
  display: 'swap',
});

const inter = Inter({
  weight: ['400', '500', '600'],
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: 'Griot — Get paid every time AI cites your work',
  description: 'A platform where creators register articles and earn USDC when AI agents cite their work on Arc Testnet.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`}>
      <body className="font-body">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
