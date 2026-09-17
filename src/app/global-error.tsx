'use client'

/**
 * The last resort: this replaces the root layout, so it ships its own html and body and cannot
 * rely on any provider, stylesheet or component above it. Inline styles for the same reason.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100dvh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          margin: 0,
          padding: '1.5rem',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.25rem' }}>La messagerie est indisponible</h1>
        <p style={{ color: '#5f6672', maxWidth: '28rem' }}>
          Une erreur inattendue a interrompu l&rsquo;application. Rechargez la page pour reprendre.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            // The token value, written out: this screen replaces the root layout, so there is
            // no stylesheet to read `--primary` from. The marketing orange belongs nowhere near
            // it — white on #ec5a13 is 3.48:1 and fails AA, which is the whole reason the palette
            // darkened it in the first place. #c9490c is 4.73:1.
            background: '#c9490c',
            color: '#fff',
            border: 0,
            borderRadius: '999px',
            padding: '0.625rem 1.25rem',
            cursor: 'pointer',
          }}
        >
          Recharger
        </button>
      </body>
    </html>
  )
}
