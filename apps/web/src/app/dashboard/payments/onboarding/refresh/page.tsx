import Link from 'next/link';

export default function PaymentOnboardingRefreshPage(): React.ReactElement {
  return (
    <main className="page">
      <section className="panel">
        <div className="panel-header">
          <h1>Setup link expired</h1>
        </div>
        <div className="panel-body form-stack">
          <p className="subtitle">Create a fresh onboarding link to keep setting up payouts.</p>
          <Link className="button button-primary" href="/barber/dashboard/payments">
            Return to payments
          </Link>
        </div>
      </section>
    </main>
  );
}
