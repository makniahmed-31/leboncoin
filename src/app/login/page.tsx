import { redirect } from 'next/navigation'

import { getSession } from '@/lib/session'
import { ThemeToggle } from '@/shared/ui/theme-toggle'

import { LoginForm } from './login-form'

/**
 * A Server Component that renders one Client Component.
 *
 * The session check has to happen on the server — redirecting an already-authenticated user from
 * the client would mean shipping, hydrating and painting a login screen they never needed to
 * see. Only the form itself, which has state and an event handler, crosses into the browser.
 */
export default async function LoginPage() {
  if (await getSession()) redirect('/conversations')

  return (
    <main
      id="contenu"
      className="bg-muted flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10"
    >
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="bg-card w-full max-w-sm rounded-3xl p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Messagerie</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Identifiez-vous pour acceder a vos conversations.
        </p>

        <LoginForm />
      </div>

      {/*
        Named accounts, because the seeded corpus has no passwords and a reviewer should not have
        to read the fixtures to get in. This block is the demo affordance, and it is kept in the
        markup rather than in the authentication path so that removing it removes the whole of
        the shortcut.
      */}
      <p className="text-muted-foreground max-w-sm text-center text-xs">
        Jeu de donnees de demonstration : essayez <strong>Thibaut</strong>, <strong>Elodie</strong>{' '}
        ou <strong>Yasmine</strong>.
      </p>
    </main>
  )
}
