export default function Team() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 860 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28 }}>Team</h1>
          <p className="dim" style={{ marginTop: 6 }}>Bring in your admins. They can run bot commands and manage cash-outs — every action tracked to their name.</p>
        </div>
        <button className="btn btn-primary">+ Invite admin</button>
      </header>

      {/* Invite form (TODO: server action → account_members insert + email invite) */}
      <div className="card">
        <div className="grid cols-3" style={{ alignItems: 'end' }}>
          <div className="field"><label>Email</label><input placeholder="admin@club.com" /></div>
          <div className="field"><label>Role</label>
            <select><option>Admin</option><option>Owner</option></select>
          </div>
          <button className="btn btn-dark">Send invite</button>
        </div>
        <p className="stat-note" style={{ marginTop: 12 }}>They’ll get a magic-link email to join, and can link their Telegram / Discord so the bots recognise them.</p>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Member</th><th>Role</th><th>Bot identities</th><th>Status</th><th style={{ width: 60 }} /></tr></thead>
          <tbody>
            <tr>
              <td>
                <div style={{ fontWeight: 600 }}>you@club.com</div>
                <div className="stat-note">You</div>
              </td>
              <td><span className="badge muted">Owner</span></td>
              <td className="dim" style={{ fontSize: 13 }}>Link Telegram · Link Discord</td>
              <td><span className="badge ok">Active</span></td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
