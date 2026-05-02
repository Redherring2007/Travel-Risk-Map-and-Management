export type SessionUser = {
  id: string;
  email: string;
  role: 'free' | 'client' | 'admin';
  subscriptionStatus: 'free' | 'active' | 'past_due' | 'cancelled';
};

const DEMO_FREE_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEMO_CLIENT_USER_ID = '00000000-0000-4000-8000-000000000002';
const DEMO_ADMIN_USER_ID = '00000000-0000-4000-8000-000000000003';

export function getSession(headers: Headers): SessionUser {
  const roleHeader = headers.get('x-demo-role') as SessionUser['role'] | null;
  const paidHeader = headers.get('x-demo-paid');
  const role = roleHeader ?? (paidHeader === 'true' ? 'client' : 'free');
  const id = headers.get('x-demo-user-id') ?? (role === 'admin' ? DEMO_ADMIN_USER_ID : role === 'client' ? DEMO_CLIENT_USER_ID : DEMO_FREE_USER_ID);
  return {
    id,
    email: headers.get('x-demo-email') ?? `${role}@atlasinsight.example`,
    role,
    subscriptionStatus: role === 'free' ? 'free' : 'active'
  };
}

export const getDemoSession = getSession;

export function requirePaid(user: SessionUser) {
  if (user.subscriptionStatus !== 'active' && user.role !== 'admin') {
    return { ok: false as const, status: 402, message: 'Paid client subscription required for this action.' };
  }
  return { ok: true as const };
}

export function requireAdmin(user: SessionUser) {
  if (user.role !== 'admin') {
    return { ok: false as const, status: 403, message: 'Admin role required.' };
  }
  return { ok: true as const };
}
