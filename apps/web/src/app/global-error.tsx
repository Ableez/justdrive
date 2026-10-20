'use client';

// The root layout is not rendered when this boundary catches an error, so the
// page carries its own styles instead of relying on the global stylesheet.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Arial, Helvetica, sans-serif',
          color: '#171717',
          background: '#ffffff',
        }}
      >
        <main style={{ maxWidth: '28rem', padding: '1rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
          <p style={{ fontSize: '0.875rem', color: '#52525b', marginBottom: '1.5rem' }}>
            The app could not be loaded. Try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: '#18181b',
              color: '#ffffff',
              border: 0,
              borderRadius: '0.375rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
