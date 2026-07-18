import { Instrument_Serif, Poppins } from 'next/font/google';
import LenisProvider from '@/components/LenisProvider/LenisProvider';
import './globals.scss';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument',
});

export const metadata = {
  title: 'Anya AI — Photo to storefront in seconds',
  description: 'Turn one product photo into a premium WhatsApp-first storefront.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${poppins.variable} ${instrumentSerif.variable}`}>
      <body>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
