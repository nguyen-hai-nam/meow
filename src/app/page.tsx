import { redirect } from 'next/navigation';
import LoginScreen from '@/components/LoginScreen';
import { getSessionUser } from '@/lib/auth';
import { USERS } from '@/lib/users';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect('/feed');

  return <LoginScreen users={USERS} />;
}
