import Link from 'next/link';

export default function StripeOnboardingCompletePage(): React.ReactElement {
  return (
    <main className="page">
      <section className="panel">
        <div className="panel-header">
          <h1>Stripe onboarding complete</h1>
        </div>
        <div className="panel-body form-stack">
          <p className="subtitle">Stripe will confirm your charges and payout status shortly.</p>
          <Link className="button button-primary" href="/dashboard/payments">
            Back to payments
          </Link>
        </div>
      </section>
    </main>
  );
}
