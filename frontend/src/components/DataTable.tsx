import type { ReactNode } from 'react'
import type { UseTableReturn } from '../hooks/useTable'
import Pagination from './Pagination'

/* ═══════════════════════════════════════════════
   Types
═══════════════════════════════════════════════ */
export interface Column<T> {
  key:       string
  label:     string
  sortable?: boolean
  width?:    number | string
  render?:   (row: T, index: number) => ReactNode
  align?:    'left' | 'center' | 'right'
}

interface Props<T> {
  table:       UseTableReturn<T>
  columns:     Column<T>[]
  rowKey?:     (row: T) => string | number
  actions?:    (row: T, index: number) => ReactNode
  title?:      string
  subtitle?:   string
  toolbar?:    ReactNode          // boutons à droite du search (Ajouter, Export…)
  emptyText?:  string
  compact?:    boolean
}

/* ── Icônes ── */
const IcoSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)
const IcoSort = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#1e40af' : '#94a3b8'} strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4, flexShrink: 0 }}>
    {dir === 'asc' || !active
      ? <><polyline points="18 15 12 9 6 15"/></>
      : <><polyline points="6 9 12 15 18 9"/></>
    }
  </svg>
)
const IcoRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)

/* ═══════════════════════════════════════════════
   Composant
═══════════════════════════════════════════════ */
export default function DataTable<T extends Record<string, unknown>>({
  table, columns, rowKey, actions, title, subtitle, toolbar, emptyText, compact = false,
}: Props<T>) {
  const { data, loading, error, meta, search, sortCol, sortDir, setSearch, setPage, setPerPage, setSort, reload } = table

  const cellPad = compact ? '7px 12px' : '10px 14px'

  return (
    <div className="card" style={{ overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {title && <span className="card-title">{title}</span>}
          {subtitle && <span style={{ fontSize: 12, color: '#64748b' }}>{subtitle}</span>}
          {!title && !subtitle && (
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {meta.total} résultat{meta.total > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Search */}
          <div className="search-bar">
            <IcoSearch />
            <input
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, lineHeight: 1 }}>
                ×
              </button>
            )}
          </div>

          {/* Refresh */}
          <button onClick={reload}
            style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b' }}
            title="Actualiser">
            <IcoRefresh />
          </button>

          {/* Toolbar custom (boutons Ajouter, Export…) */}
          {toolbar}
        </div>
      </div>

      {/* ── Tableau ── */}
      <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as 'touch' }}>
        {loading ? (
          <div className="loading-center">
            <div className="spinner" /> Chargement…
          </div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontSize: 13 }}>
            {error} —{' '}
            <button onClick={reload}
              style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>
              Réessayer
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', minWidth: 'max-content', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ background: '#1e3a8a', color: 'white', padding: cellPad, textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderRadius: '8px 0 0 0' }}>
                  #
                </th>
                {columns.map((col, ci) => (
                  <th
                    key={col.key}
                    onClick={col.sortable ? () => setSort(col.key) : undefined}
                    style={{
                      background: '#1e3a8a', color: 'white',
                      padding: cellPad, textAlign: col.align ?? 'left',
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', whiteSpace: 'nowrap',
                      width: col.width,
                      cursor: col.sortable ? 'pointer' : 'default',
                      userSelect: col.sortable ? 'none' : 'auto',
                      ...(ci === columns.length - 1 && !actions ? { borderRadius: '0 8px 0 0' } : {}),
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      {col.label}
                      {col.sortable && (
                        <IcoSort active={sortCol === col.key} dir={sortCol === col.key ? sortDir : 'asc'} />
                      )}
                    </span>
                  </th>
                ))}
                {actions && (
                  <th style={{ background: '#1e3a8a', color: 'white', padding: cellPad, textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: '0 8px 0 0', whiteSpace: 'nowrap' }}>
                    Action
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (actions ? 2 : 1)} style={{ padding: 0 }}>
                    <div className="empty-state">
                      {emptyText ?? (search ? `Aucun résultat pour « ${search} »` : 'Aucune donnée')}
                    </div>
                  </td>
                </tr>
              ) : data.map((row, idx) => (
                <tr key={rowKey ? rowKey(row) : idx}
                  style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Numéro de ligne absolu (pas relatif à la page) */}
                  <td style={{ padding: cellPad, color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {(meta.current_page - 1) * meta.per_page + idx + 1}
                  </td>
                  {columns.map(col => (
                    <td key={col.key} style={{
                      padding: cellPad, verticalAlign: 'middle',
                      textAlign: col.align ?? 'left',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: 220,
                    }}>
                      {col.render
                        ? col.render(row, idx)
                        : String(row[col.key] ?? '—')
                      }
                    </td>
                  ))}
                  {actions && (
                    <td style={{ padding: cellPad, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                        {actions(row, idx)}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {!loading && !error && meta.total > 0 && (
        <Pagination meta={meta} onPage={setPage} onPerPage={setPerPage} />
      )}
    </div>
  )
}