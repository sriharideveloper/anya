import { Instrument_Serif, Poppins } from 'next/font/google';
import LenisProvider from '@/components/LenisProvider/LenisProvider';
import './globals.scss';

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (productionHost ? `https://${productionHost}` : 'http://localhost:3000');

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

const tickerItems = [
  '✦ ONE PHOTO TO STOREFRONT',
  '✦ MADE FOR KERALA BOUTIQUES',
  '✦ WHATSAPP-FIRST COMMERCE',
  '✦ ഒരു ചിത്രം · ഒരു കട',
];

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Anya AI — Photo to storefront in seconds',
    template: '%s | Anya AI',
  },
  description: 'Turn one product photo into a premium WhatsApp-first storefront.',
  applicationName: 'Anya AI',
  keywords: ['AI storefront', 'WhatsApp commerce', 'boutique storefront', 'saree AI', 'Kerala business'],
  authors: [{ name: 'Srihari Muralikrishnan' }],
  creator: 'Srihari Muralikrishnan',
  category: 'technology',
  icons: { icon: '/anya-mark.svg' },
  openGraph: {
    title: 'Anya AI — From camera roll to sold',
    description: 'Create a polished, WhatsApp-ready boutique storefront from one product photo.',
    url: '/',
    siteName: 'Anya AI',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anya AI — From camera roll to sold',
    description: 'One product photo becomes a polished WhatsApp-ready storefront.',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${poppins.variable} ${instrumentSerif.variable}`}>
      <body>
        <div className="heritageTicker" aria-hidden="true">
          {[0, 1].map((copy) => (
            <div className="heritageTickerTrack" key={copy}>
              {tickerItems.map((item) => <span key={`${copy}-${item}`}>{item}</span>)}
            </div>
          ))}
        </div>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
