export type SessionUser = {
  id: string;
  email: string;
  role: 'free' | 'client' | 'admin';
  subscriptionStatus: 'free' | 'active' | 'past_due' | 'cancelled';
};

export function getDemoSession(headers: Headers): SessionUser {
  const roleHeader = headers.get('x-demo-role') as SessionUser['role'] | null;
  const paidHeader = headers.get('x-demo-paid');
  const role = roleHeader ?? (paidHeader === 'true' ? 'client' : 'free');
  return {
    id: headers.get('x-demo-user-id') ?? 'demo-user',
    email: headers.get('x-demo-email') ?? 'demo@example.com',
    role,
    subscriptionStatus: role === 'free' ? 'free' : 'active'
  };
}

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
