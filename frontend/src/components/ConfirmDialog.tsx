import { useEffect } from 'react'

// FIX : remplace les window.confirm() du navigateur (boîte système non
// stylée) par une boîte de confirmation centrée, cohérente avec le reste
// du design de l'appli. Composant générique — réutilisable partout où
// une suppression (ou une action sensible) doit être confirmée.

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const IcoAlert = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Supprimer', cancelLabel = 'Annuler',
  danger = true, onConfirm, onCancel,
}: ConfirmDialogProps) {

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onCancel}
    >
      <div
        style={{ width: 380, maxWidth: '100%', background: 'white', borderRadius: 14, padding: '26px 24px 20px', boxShadow: '0 24px 60px rgba(0,0,0,0.28)', textAlign: 'center', animation: 'confirmPop 0.15s ease-out' }}
        onClick={ev => ev.stopPropagation()}
      >
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: danger ? '#fef2f2' : '#eff6ff',
          color: danger ? '#dc2626' : 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
        }}>
          <IcoAlert />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 22, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            className="btn btn-secondary"
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, background: danger ? '#dc2626' : 'var(--accent)', color: 'white', border: 'none',
              borderRadius: 8, padding: '9px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
      <style>{`@keyframes confirmPop { from { transform: scale(0.94); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
    </div>
  )
}