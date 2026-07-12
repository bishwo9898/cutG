import Link from 'next/link';

export default function SubscriptionSuccessPage(): React.ReactElement {
  return (
    <main className="page">
      <section className="panel">
        <div className="panel-header">
          <h1>Subscription updated</h1>
        </div>
        <div className="panel-body form-stack">
          <p className="subtitle">
            Stripe is confirming your subscription. Webhooks will sync the final status.
          </p>
          <Link className="button button-primary" href="/barber/dashboard/subscription">
            Back to subscription
          </Link>
        </div>
      </section>
    </main>
  );
}
