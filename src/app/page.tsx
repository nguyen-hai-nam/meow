import { redirect } from 'next/navigation';
import LoginScreen from '@/components/LoginScreen';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect('/feed');

  return <LoginScreen />;
}
