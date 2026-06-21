// All database traffic passes through this small API boundary.
export async function betsApi(path = '', options = {}) {
  const response = await fetch(`/api/bets${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Database request failed');
  }

  return response.status === 204 ? null : response.json();
}
