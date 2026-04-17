import type { TableMeta } from '../hooks/useTable'

interface Props {
  meta:      TableMeta
  onPage:    (p: number) => void
  onPerPage: (n: number) => void
  perPageOptions?: number[]
}

const PER_PAGE_OPTIONS = [10, 15, 25, 50, 100]

const IcoChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

const IcoChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

export default function Pagination({
  meta,
  onPage,
  onPerPage,
  perPageOptions = PER_PAGE_OPTIONS,
}: Props) {
  const { current_page, last_page, total, from, to, per_page } = meta

  if (total === 0) return null

  /* Génère les numéros : 1 2 3 … 8 9 10 */
  const pages: (number | '...')[] = []
  if (last_page <= 7) {
    for (let i = 1; i <= last_page; i++) pages.push(i)
  } else {
    pages.push(1)
    if (current_page > 3)               pages.push('...')
    const start = Math.max(2, current_page - 1)
    const end   = Math.min(last_page - 1, current_page + 1)
    for (let i = start; i <= end; i++)  pages.push(i)
    if (current_page < last_page - 2)   pages.push('...')
    pages.push(last_page)
  }

  const canPrev = current_page > 1
  const canNext = current_page < last_page

  const btnStyle = (active = false, disabled = false): React.CSSProperties => ({
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    minWidth:       34,
    height:         34,
    padding:        '0 8px',
    borderRadius:   7,
    border:         active ? '2px solid #1e40af' : '1px solid #e2e8f0',
    background:     active ? '#1e40af' : 'white',
    color:          active ? 'white' : disabled ? '#cbd5e1' : '#374151',
    fontWeight:     active ? 700 : 500,
    fontSize:       13,
    fontFamily:     'inherit',
    cursor:         disabled ? 'not-allowed' : 'pointer',
    opacity:        disabled ? 0.5 : 1,
    transition:     'all 0.15s',
    lineHeight:     '1',
  })

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '12px 18px',
      borderTop:      '1px solid #f1f5f9',
      flexWrap:       'wrap',
      gap:            10,
      background:     '#fafbfc',
    }}>

      {/* Gauche : résultats + lignes/page */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          <b style={{ color: '#1e293b' }}>{from}</b>–<b style={{ color: '#1e293b' }}>{to}</b>
          {' '}sur <b style={{ color: '#1e293b' }}>{total}</b> résultats
        </span>
        <select
          value={per_page}
          onChange={e => onPerPage(Number(e.target.value))}
          style={{
            padding: '4px 10px', border: '1px solid #e2e8f0',
            borderRadius: 7, fontSize: 12, color: '#374151',
            background: 'white', cursor: 'pointer',
            fontFamily: 'inherit', outline: 'none',
          }}
        >
          {perPageOptions.map(n => (
            <option key={n} value={n}>{n} lignes</option>
          ))}
        </select>
      </div>

      {/* Droite : navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

        {/* ← Précédent */}
        <button
          disabled={!canPrev}
          onClick={() => canPrev && onPage(current_page - 1)}
          style={btnStyle(false, !canPrev)}
        >
          <IcoChevronLeft />
          <span style={{ marginLeft: 4, fontSize: 12 }}>Préc.</span>
        </button>

        {/* Numéros de pages */}
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dot-${i}`} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 24, height: 34, color: '#94a3b8', fontSize: 13,
            }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              style={btnStyle(p === current_page)}
            >
              {p}
            </button>
          )
        )}

        {/* Suivant → */}
        <button
          disabled={!canNext}
          onClick={() => canNext && onPage(current_page + 1)}
          style={btnStyle(false, !canNext)}
        >
          <span style={{ marginRight: 4, fontSize: 12 }}>Suiv.</span>
          <IcoChevronRight />
        </button>

      </div>
    </div>
  )
}