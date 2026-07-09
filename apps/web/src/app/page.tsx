import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home(): Promise<never> {
  const cookieStore = await cookies();
  redirect(
    cookieStore.has('barber_access') || cookieStore.has('barber_refresh') ? '/dashboard' : '/login',
  );
}
