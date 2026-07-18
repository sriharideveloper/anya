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
        <div className="heritageTicker" aria-hidden="true">
          <span>✦ ONE PHOTO TO STOREFRONT</span>
          <span>✦ MADE FOR KERALA BOUTIQUES</span>
          <span>✦ WHATSAPP-FIRST COMMERCE</span>
          <span>✦ ഒരു ചിത്രം · ഒരു കട</span>
          <span>✦ ONE PHOTO TO STOREFRONT</span>
          <span>✦ MADE FOR KERALA BOUTIQUES</span>
        </div>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
