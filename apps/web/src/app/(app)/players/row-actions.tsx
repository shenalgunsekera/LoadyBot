'use client';

import { useRef, useState, useTransition } from 'react';
import { editPlayer, deletePlayer } from './actions';

interface Acct { platformId: string; platform: string; uid: string }

/** Edit + Delete for one player row. Both open a native <dialog> (top layer), so
 *  the table's horizontal overflow can never clip them — the bug with the old
 *  absolute-positioned popover. */
export function RowActions({ id, name, account }: { id: string; name: string; account: Acct | null }) {
  const editDlg = useRef<HTMLDialogElement>(null);
  const delDlg = useRef<HTMLDialogElement>(null);
  const [confirmName, setConfirmName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const doDelete = () => {
    setErr(null);
    start(async () => {
      const r = await deletePlayer(id);
      if (r.ok) delDlg.current?.close();
      else setErr(r.error ?? 'Could not delete.');
    });
  };

  return (
    <>
      <button type="button" className="btn btn-sm" onClick={() => editDlg.current?.showModal()}>Edit</button>
      <button type="button" className="btn btn-sm btn-danger" onClick={() => { setErr(null); setConfirmName(''); delDlg.current?.showModal(); }}>Delete</button>

      {/* Edit */}
      <dialog ref={editDlg} className="dlg" onClick={(e) => { if (e.target === editDlg.current) editDlg.current?.close(); }}>
        <form action={editPlayer} onSubmit={() => editDlg.current?.close()} style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 280 }}>
          <h3 style={{ margin: 0 }}>Edit {name}</h3>
          <input type="hidden" name="id" value={id} />
          <label className="dlg-label">Display name
            <input name="name" defaultValue={name} style={{ width: '100%', height: 36, marginTop: 4 }} />
          </label>
          {account && (
            <label className="dlg-label">{account.platform} ID
              <input type="hidden" name="platformId" value={account.platformId} />
              <input name="uid" defaultValue={account.uid} className="mono" style={{ width: '100%', height: 36, marginTop: 4 }} />
            </label>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-sm" onClick={() => editDlg.current?.close()}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">Save</button>
          </div>
        </form>
      </dialog>

      {/* Delete */}
      <dialog ref={delDlg} className="dlg" onClick={(e) => { if (e.target === delDlg.current) delDlg.current?.close(); }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 300, maxWidth: 360 }}>
          <h3 style={{ margin: 0 }}>Delete {name}?</h3>
          <p className="dim" style={{ margin: 0, fontSize: 13 }}>
            This erases <strong>{name}</strong> and all their data — game accounts, deposits, cash-outs, and receipts. It cannot be undone.
          </p>
          <label className="dlg-label">Type the player’s name to confirm
            <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={name} style={{ width: '100%', height: 36, marginTop: 4 }} />
          </label>
          {err && <div className="badge red" style={{ whiteSpace: 'normal', lineHeight: 1.4, padding: '6px 8px' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-sm" onClick={() => delDlg.current?.close()}>Cancel</button>
            <button type="button" className="btn btn-sm btn-danger" disabled={pending || confirmName.trim() !== name} onClick={doDelete}>
              {pending ? 'Deleting…' : 'Delete player'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
