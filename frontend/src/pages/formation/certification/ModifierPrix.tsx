import { useState, useEffect } from 'react'
import api from '../../../api/axios'
import toast from 'react-hot-toast'
import ConfirmDialog from '../../../components/ConfirmDialog'
import { formatMontantInput, parseMontantInput } from '../../../utils/validators'
import { IcoMoney, IcoTrash } from '../../../components/icons'
import { prixToInput, fmtMontant, fmtDateCourt } from './types'
import type { PrixHistorique } from './types'

// Onglet « Modifier prix » — réservé à l'admin (filtré dans CertificationTab).
export default function ModifierPrix() {
  const [prixActuel, setPrixActuel] = useState<number>(0)
  const [historique, setHistorique] = useState<PrixHistorique[]>([])
  const [newPrix, setNewPrix]       = useState<string>('')
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const charger = async () => {
    setLoading(true)
    try {
      const [cur, hist] = await Promise.all([
        api.get('/certifications/prix'),
        api.get('/certifications/prix/historique'),
      ])
      setPrixActuel(Number(cur.data.prix ?? 0))
      setNewPrix(prixToInput(cur.data.prix))
      setHistorique(hist.data ?? [])
    } catch {
      toast.error('Erreur de chargement du prix')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { charger() }, [])

  const handleSetPrix = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPrix === '') return
    setSaving(true)
    try {
      await api.post('/certifications/prix', { prix: Number(parseMontantInput(newPrix)) })
      toast.success('Prix mis à jour avec succès.')
      charger()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDeleteId) return
    try {
      await api.delete(`/certifications/prix/historique/${confirmDeleteId}`)
      toast.success('Entrée supprimée')
      charger()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression')
    } finally {
      setConfirmDeleteId(null)
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}><IcoMoney /> Prix standard du certificat</span>
        </div>
        <div className="card-body">
          <form onSubmit={handleSetPrix}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Prix</label>
                <input className="form-control" type="text" inputMode="numeric" value={newPrix} onChange={e => setNewPrix(formatMontantInput(e.target.value))} required placeholder="Ex: 10 000" />
              </div>
            </div>
            <button type="submit" className="btn btn-success" disabled={saving}>
              {saving ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Modification…</> : 'Modifier'}
            </button>
          </form>
          {!loading && (
            <div style={{ fontSize:12, color:'#94a3b8', marginTop:10 }}>
              Prix actuellement appliqué par défaut aux nouvelles certifications : <b>{fmtMontant(prixActuel)} Ar</b>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Historique de modification</span>
        </div>
        <div className="table-wrapper">
          {loading ? <div className="loading-center"><div className="spinner" /> Chargement…</div> : (
            <table>
              <thead><tr><th>Prix</th><th>Date de modification</th><th>Action</th></tr></thead>
              <tbody>
                {historique.length === 0
                  ? <tr><td colSpan={3}><div className="empty-state">Aucun historique</div></td></tr>
                  : historique.map(p => (
                    <tr key={p.id_prix_certificat}>
                      <td>{fmtMontant(p.prix)} Ar</td>
                      <td>{fmtDateCourt(p.date_modification)}</td>
                      <td><div className="table-actions">
                        <button className="btn-icon delete" onClick={() => setConfirmDeleteId(p.id_prix_certificat)} title="Supprimer"><IcoTrash /></button>
                      </div></td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Supprimer cette entrée de l'historique ?"
        message="Cette entrée sera définitivement supprimée de l'historique des prix. Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </>
  )
}