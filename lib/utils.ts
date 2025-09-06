export const ok = (data: any = {}) => Response.json({ ok: true, ...data }, { status: 200 });
export const fail = (error: string, code = 500) => Response.json({ ok: false, error }, { status: code });

export function requireToken(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('token');
  const env = process.env.ADMIN_INIT_TOKEN;
  if (!env) throw new Error('ADMIN_INIT_TOKEN not set');
  if (q !== env) throw new Error('Unauthorized');
}
