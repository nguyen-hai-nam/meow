import { redirect } from 'next/navigation';
import FeedScreen from '@/components/FeedScreen';
import { getSessionUser } from '@/lib/auth';
import { getMoments } from '@/lib/storage';
import type { Moment } from '@/lib/types';
import { USERS } from '@/lib/users';

export const dynamic = 'force-dynamic';

export default async function FeedPage() {
  const user = await getSessionUser();
  if (!user) redirect('/');

  let moments: Moment[] = [];
  try {
    moments = await getMoments();
  } catch (error) {
    console.error('Failed to load moments:', error);
  }

  return <FeedScreen user={user} users={USERS} initialMoments={moments} />;
}
