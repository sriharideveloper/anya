import { ImageResponse } from 'next/og';

export const alt = 'Anya AI — one photo to a WhatsApp-ready storefront';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          padding: '74px 82px',
          overflow: 'hidden',
          background: '#faf7f2',
          color: '#201714',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 34, fontWeight: 600 }}>
          <div
            style={{
              width: 66,
              height: 66,
              display: 'flex',
              borderRadius: 999,
              background: '#96362e',
              color: '#fffdf9',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'serif',
              fontSize: 42,
            }}
          >
            A
          </div>
          Anya AI
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: '#96362e', fontSize: 22, fontWeight: 600, letterSpacing: 3 }}>
            ONE PHOTO · ONE STOREFRONT
          </div>
          <div style={{ width: 880, marginTop: 18, fontFamily: 'serif', fontSize: 94, lineHeight: 0.92 }}>
            From camera roll to sold.
          </div>
        </div>
        <div style={{ display: 'flex', color: '#705e55', fontSize: 22, justifyContent: 'space-between' }}>
          <span>AI merchandising · model visuals · WhatsApp checkout</span>
          <span>Made for Kerala boutiques</span>
        </div>
        <div
          style={{
            position: 'absolute',
            right: -55,
            top: 80,
            color: 'rgba(150,54,46,.055)',
            fontFamily: 'serif',
            fontSize: 300,
          }}
        >
          A
        </div>
      </div>
    ),
    size,
  );
}
