'use client';

import { barberBillingApi } from '@barber-saas/api-client';
import { useQuery } from '@tanstack/react-query';
import { DollarSign } from 'lucide-react';
import { useState } from 'react';

import { browserApi } from '@/lib/browser-api';

type Earnings = {
  period: 'week' | 'month' | 'all';
  summary: {
    totalEarnings: number;
    platformFees: number;
    appointmentsCompleted: number;
    pendingPayout: number;
    paidOut: number;
  };
  recentPayments: Array<{
    id: string;
    amount: number;
    grossAmount: number;
    platformFee: number;
    status: string;
    capturedAt: string | null;
    appointment: {
      scheduledAt: string | null;
      service: { name: string };
      client: { firstName: string; lastInitial: string };
    };
  }>;
  payoutHistory: Array<{
    id: string;
    amount: number;
    status: string;
    appointmentCount: number;
    paidAt: string | null;
  }>;
};

export default function EarningsPage(): React.ReactElement {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');
  const earnings = useQuery({
    queryKey: ['earnings', period],
    queryFn: () => barberBillingApi.earnings<Earnings>(browserApi, { period }),
  });
  const summary = earnings.data?.summary;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Earnings</span>
          <h1>Money movement</h1>
          <p>Track paid bookings, platform fees, and payout batches.</p>
        </div>
        <select
          className="select"
          value={period}
          onChange={(event) => setPeriod(event.target.value as typeof period)}
        >
          <option value="week">Week</option>
          <option value="month">Month</option>
          <option value="all">All time</option>
        </select>
      </div>
      <div className="stats-grid">
        {[
          ['Total earnings', summary?.totalEarnings ?? 0],
          ['Pending payout', summary?.pendingPayout ?? 0],
          ['Paid out', summary?.paidOut ?? 0],
          ['Platform fees', summary?.platformFees ?? 0],
        ].map(([label, value]) => (
          <section className="stat" key={label}>
            <div className="stat-icon">
              <DollarSign size={18} />
            </div>
            <div className="stat-value">${Number(value).toFixed(2)}</div>
            <div className="stat-label">{label}</div>
          </section>
        ))}
      </div>
      <section className="panel">
        <div className="panel-header">
          <h2>Recent payments</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Service</th>
                <th>Gross</th>
                <th>Earned</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(earnings.data?.recentPayments ?? []).map((payment) => (
                <tr key={payment.id}>
                  <td>
                    {payment.appointment.client.firstName} {payment.appointment.client.lastInitial}.
                  </td>
                  <td>{payment.appointment.service.name}</td>
                  <td>${payment.grossAmount.toFixed(2)}</td>
                  <td>${payment.amount.toFixed(2)}</td>
                  <td>{payment.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
