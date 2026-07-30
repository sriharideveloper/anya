import LandingPage from '@/components/LandingPage/LandingPage';

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Anya AI',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'AI merchandising and WhatsApp-first storefronts for local boutiques and creators.',
  creator: { '@type': 'Person', name: 'Srihari Muralikrishnan' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
};

export const metadata = {
  alternates: { canonical: '/' },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <LandingPage />
    </>
  );
}
