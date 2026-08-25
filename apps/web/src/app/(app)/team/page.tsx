import { db } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';
import { inviteMember } from './actions';
import { LinkButtons } from './link-buttons';

export const dynamic = 'force-dynamic';

interface Member {
  id: string; email: string; role: string; display_name: string | null;
  telegram_user_id: string | null; discord_user_id: string | null; accepted_at: Date | null;
}

export default async function Team() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');

  const members = await db()<Member[]>`
    select id, email, role, display_name, telegram_user_id, discord_user_id, accepted_at
      from account_members where account_id = ${ctx.accountId} order by role = 'owner' desc, created_at`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Team</h1>
        <p className="dim" style={{ marginTop: 6 }}>Your admins can verify payments and manage cash-outs — every action tracked to their name.</p>
      </header>

      {/* Invite */}
      <div className="card">
        <form action={inviteMember} className="grid cols-3" style={{ alignItems: 'end' }}>
          <div className="field"><label>Email</label><input name="email" type="email" placeholder="admin@club.com" required /></div>
          <div className="field"><label>Role</label><select name="role"><option value="admin">Admin</option><option value="owner">Owner</option></select></div>
          <button className="btn btn-dark" type="submit">Add admin</button>
        </form>
        <p className="stat-note" style={{ marginTop: 12 }}>They sign in with a magic link, then link their Telegram / Discord below so the bots recognise them.</p>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Member</th><th>Role</th><th>Bot identities</th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{m.display_name ?? m.email}</div>
                  {m.display_name && <div className="stat-note">{m.email}</div>}
                  {m.id === ctx.memberId && <span className="badge muted" style={{ marginTop: 4 }}>You</span>}
                </td>
                <td><span className={`badge ${m.role === 'owner' ? 'ok' : 'muted'}`} style={{ textTransform: 'capitalize' }}>{m.role}</span></td>
                <td><LinkButtons memberId={m.id} tgLinked={!!m.telegram_user_id} dcLinked={!!m.discord_user_id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
