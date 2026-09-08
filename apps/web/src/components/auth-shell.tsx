import Link from 'next/link';

type AuthAudience = 'CLIENT' | 'BARBER' | 'GENERAL';

/** One quiet line under the form. The old shell gave this a half-screen photo panel of its own. */
const note: Record<AuthAudience, string> = {
  CLIENT: 'Find trusted barbers and keep every appointment in one place.',
  BARBER: 'Your services, schedule, and customers in one calm workspace.',
  GENERAL: 'Book a trusted barber, or run your business from one workspace.',
};

/**
 * The frame around every sign-in, sign-up and password screen.
 *
 * Deliberately a single centred column. It used to be a two-column split with a background
 * photograph filling the left half — which cost a full-bleed image download on the one screen
 * where somebody is trying to do exactly one thing, and pushed the fields they came for off to
 * one side. Nothing here loads an image at all now.
 */
export function AuthShell({
  children,
  audience = 'GENERAL',
}: {
  children: React.ReactNode;
  audience?: AuthAudience;
}): React.ReactElement {
  return (
    <main className="auth-shell">
      <div className="auth-shell-inner">
        <Link className="auth-shell-brand" href="/">
          <span className="auth-shell-brand-mark">cut</span>
          <span>G</span>
        </Link>

        {children}

        <p className="auth-shell-note">{note[audience]}</p>
      </div>
    </main>
  );
}
