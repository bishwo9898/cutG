import Link from 'next/link';

export default function PaymentOnboardingCompletePage(): React.ReactElement {
  return (
    <main className="page">
      <section className="panel">
        <div className="panel-header">
          <h1>Online payment setup complete</h1>
        </div>
        <div className="panel-body form-stack">
          <p className="subtitle">Your payment and payout status will update shortly.</p>
          <Link className="button button-primary" href="/barber/dashboard/payments">
            Back to payments
          </Link>
        </div>
      </section>
    </main>
  );
}
