'use client';

import { useState } from 'react';

export interface ClubRow { id: string; name: string; deposited: number; withdrawn: number }
export interface PlatformRow { id: string; name: string; deposited: number; withdrawn: number; clubs: ClubRow[] }

const fmt = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const net = (c: number) => ({ color: c >= 0 ? 'var(--ok)' : 'var(--red)' });

/**
 * "By platform" table. A platform with more than one club expands into its clubs
 * (each attributed to the player's current club), summing back toward the row.
 */
export function ByPlatform({ rows }: { rows: PlatformRow[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const grandIn = rows.reduce((s, r) => s + r.deposited, 0);
  const grandOut = rows.reduce((s, r) => s + r.withdrawn, 0);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Platform</th>
            <th style={{ textAlign: 'right' }}>Deposited in</th>
            <th style={{ textAlign: 'right' }}>Cashed out</th>
            <th style={{ textAlign: 'right' }}>Net</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No platforms yet.</td></tr>
          ) : rows.map((r) => {
            const expandable = r.clubs.length > 1;
            const isOpen = !!open[r.id];
            return (
              <RowGroup key={r.id} row={r} expandable={expandable} isOpen={isOpen}
                onToggle={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))} />
            );
          })}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border-strong)' }}>
              <td style={{ fontWeight: 700 }}>All platforms</td>
              <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--ok)' }}>{fmt(grandIn)}</td>
              <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(grandOut)}</td>
              <td className="mono" style={{ textAlign: 'right', fontWeight: 700, ...net(grandIn - grandOut) }}>{fmt(grandIn - grandOut)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function RowGroup({ row, expandable, isOpen, onToggle }: { row: PlatformRow; expandable: boolean; isOpen: boolean; onToggle: () => void }) {
  return (
    <>
      <tr onClick={expandable ? onToggle : undefined} style={{ cursor: expandable ? 'pointer' : 'default' }}>
        <td style={{ fontWeight: 600 }}>
          {expandable && (
            <span aria-hidden style={{ display: 'inline-block', width: 16, transition: 'transform .15s', transform: isOpen ? 'rotate(90deg)' : 'none', color: 'var(--muted)' }}>▸</span>
          )}
          {row.name}
          {expandable && <span className="badge muted" style={{ marginLeft: 8 }}>{row.clubs.length} clubs</span>}
        </td>
        <td className="mono" style={{ textAlign: 'right', color: 'var(--ok)' }}>{fmt(row.deposited)}</td>
        <td className="mono" style={{ textAlign: 'right', color: 'var(--ink-dim)' }}>{fmt(row.withdrawn)}</td>
        <td className="mono" style={{ textAlign: 'right', fontWeight: 600, ...net(row.deposited - row.withdrawn) }}>{fmt(row.deposited - row.withdrawn)}</td>
      </tr>
      {expandable && isOpen && row.clubs.map((c) => (
        <tr key={c.id} style={{ background: 'var(--surface-2, rgba(0,0,0,.015))' }}>
          <td style={{ paddingLeft: 34, color: 'var(--ink-dim)' }}>{c.name}</td>
          <td className="mono" style={{ textAlign: 'right' }}>{fmt(c.deposited)}</td>
          <td className="mono" style={{ textAlign: 'right' }}>{fmt(c.withdrawn)}</td>
          <td className="mono" style={{ textAlign: 'right', ...net(c.deposited - c.withdrawn) }}>{fmt(c.deposited - c.withdrawn)}</td>
        </tr>
      ))}
    </>
  );
}
