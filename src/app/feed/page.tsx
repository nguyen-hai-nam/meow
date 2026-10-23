import { redirect } from 'next/navigation';
import FeedScreen from '@/components/FeedScreen';
import { getSessionUser } from '@/lib/auth';
import { USERS } from '@/lib/users';

export const dynamic = 'force-dynamic';

export default async function FeedPage() {
  const user = await getSessionUser();
  if (!user) redirect('/');

  return <FeedScreen user={user} users={USERS} />;
}
