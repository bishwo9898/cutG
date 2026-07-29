import { redirect } from 'next/navigation';

export default function PreviewPage(): never {
  redirect('/barber/dashboard/portfolio?view=preview');
}
