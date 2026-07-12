import { Scissors } from 'lucide-react';

type AuthAudience = 'CLIENT' | 'BARBER' | 'GENERAL';

const copy: Record<AuthAudience, { heading: string; body: string }> = {
  CLIENT: {
    heading: 'Your next cut, without the back-and-forth.',
    body: 'Find trusted barbers, compare services, and keep every appointment in one place.',
  },
  BARBER: {
    heading: 'More time behind the chair. Less time behind a screen.',
    body: 'Keep your services, schedule, clients, and daily appointments in one calm workspace.',
  },
  GENERAL: {
    heading: 'One platform. Two focused experiences.',
    body: 'Book a trusted barber or run your business with a workspace built around the way you work.',
  },
};

export function AuthShell({
  children,
  audience = 'GENERAL',
}: {
  children: React.ReactNode;
  audience?: AuthAudience;
}): React.ReactElement {
  const message = copy[audience];
  return (
    <main className="auth-page">
      <section className="auth-brand">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Scissors size={19} />
          </span>
          cutG
        </div>
        <div className="auth-quote">
          <h2>{message.heading}</h2>
          <p>{message.body}</p>
        </div>
        <small>Built for the craft.</small>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
