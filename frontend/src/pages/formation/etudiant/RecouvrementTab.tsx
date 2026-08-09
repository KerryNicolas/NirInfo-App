import { useEffect, useState } from 'react'
import api from '../../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../../hooks/useTable'
import Pagination from '../../../components/Pagination'
import FactureInvoice, { FactureData } from '../../../components/FactureInvoice'
import { IcoPlus, IcoEdit, IcoTrash, IcoSearch, IcoSave, IcoX } from '../../../components/icons'

interface Recouvrement {
  id_recouvrement: number; matricule: string; nom: string; prenom: string
  code_session: string; montant_paye: number; reste: number
  date_paiement: string; compte: string; lieu_paiement: string; editeur: string
  ref_facture: string
}
interface Session { code_session: string }
interface Compte { id_compte: number; libelle: string }

const EMPTY_R = {
  matricule: '', code_session: '', date_paiement: new Date().toISOString().split('T')[0],
  reste_a_payer: '', montant_paye: '', id_compte: '', lieu_paiement: 'Ampandrana',
}

const fmt2 = (n: number) => Number(n).toLocaleString('fr')

// ── Modal de détail — même pattern visuel que celui d'Étudiant / Inscription ──
function DetailModal({ r, onClose }: { r: Recouvrement; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Matricule', r.matricule],
    ['Étudiant', `${r.nom} ${r.prenom}`],
    ['Session', r.code_session],
    ['Date paiement', r.date_paiement || '—'],
    ['Montant payé', `${fmt2(r.montant_paye)} Ar`],
    ['Reste à payer', `${fmt2(r.reste)} Ar`],
    ['Compte encaissement', r.compte || '—'],
    ['Lieu de paiement', r.lieu_paiement || '—'],
    ['Réf. facture', r.ref_facture || '—'],
    ['Éditeur', r.editeur?.trim() || '—'],
  ]
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={onClose}>
      <div style={{ width:480, background:'white', borderRadius:12, padding:24 }} onClick={ev => ev.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontWeight:700, fontSize:16 }}>Détail du recouvrement</span>
          <button onClick={onClose} className="btn-icon"><IcoX /></button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'8px 14px', fontSize:13 }}>
          {rows.map(([label, val]) => (
            <div key={label} style={{ display:'contents' }}>
              <span style={{ color:'#64748b' }}>{label} :</span>
              <span style={{ fontWeight:500 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function RecouvrementTab() {
  const table    = useTable<Recouvrement>('/recouvrements', { perPage: 15 })
  const [sessions, setSessions] = useState<Session[]>([])
  const [comptes,  setComptes]  = useState<Compte[]>([])
  const [form,     setForm]     = useState(EMPTY_R)
  const [editing,  setEditing]  = useState<Recouvrement | null>(null)
  const [viewing,  setViewing]  = useState<Recouvrement | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [derniereFacture, setDerniereFacture] = useState<FactureData | null>(null)
  const [loadingFacture, setLoadingFacture]   = useState(false)

  useEffect(() => {
    api.get('/sessions').then(r => setSessions(r.data.data ?? [])).catch(() => {})
    api.get('/inscriptions/comptes')
      .then(r => setComptes(Array.isArray(r.data) ? r.data : []))
      .catch(() => setComptes([]))
  }, [])

  const reset = () => { setForm(EMPTY_R); setEditing(null); setDerniereFacture(null) }

  const handleEdit = (r: Recouvrement) => {
    setEditing(r)
    setDerniereFacture(null)
    setForm({
      matricule: r.matricule,
      code_session: r.code_session,
      date_paiement: r.date_paiement?.split('T')[0] || new Date().toISOString().split('T')[0],
      reste_a_payer: String(r.reste),
      montant_paye: String(r.montant_paye),
      id_compte: '',
      lieu_paiement: r.lieu_paiement || 'Ampandrana',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    setDerniereFacture(null)
    try {
      if (editing) {
        await api.put(`/recouvrements/${editing.id_recouvrement}`, {
          montant_paye: form.montant_paye,
          reste: form.reste_a_payer,
          id_compte: form.id_compte,
          lieu_paiement: form.lieu_paiement,
        })
        toast.success('Recouvrement mis à jour')
        reset()
      } else {
        const r = await api.post('/recouvrements', form)
        toast.success('Recouvrement enregistré')

        setLoadingFacture(true)
        try {
          const factureRes = await api.get(`/factures/${r.data.ref_facture}/print`)
          setDerniereFacture(factureRes.data)
        } catch {
          toast.error("Recouvrement enregistré, mais impossible de charger la facture pour impression")
        } finally {
          setLoadingFacture(false)
        }

        setForm(p => ({ ...p, matricule:'', code_session:'', montant_paye:'', reste_a_payer:'', id_compte:'' }))
      }
      table.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement") }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce recouvrement ?')) return
    try { await api.delete(`/recouvrements/${id}`); toast.success('Recouvrement supprimé'); table.reload() }
    catch { toast.error('Erreur lors de la suppression') }
  }

  const fmt = (n: number) => Number(n).toLocaleString('fr')

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>{editing ? <IcoEdit /> : <IcoPlus />} {editing ? 'Modifier le recouvrement' : 'Nouveau recouvrement'}</span>
          {editing && <button className="btn btn-sm" onClick={reset} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoX /> Annuler</button>}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Matricule </label>
                <input className="form-control" value={form.matricule}
                  onChange={e => setForm(p => ({ ...p, matricule: e.target.value.toUpperCase() }))}
                  required placeholder="Ex: NI-3824" disabled={!!editing} />
              </div>
              <div className="form-group">
                <label className="form-label">Session </label>
                <select className="form-control" value={form.code_session} onChange={set('code_session')} required disabled={!!editing}>
                  <option value="">-- Choisir une session --</option>
                  {sessions.map(s => <option key={s.code_session} value={s.code_session}>{s.code_session}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date paiement </label>
                <input className="form-control" type="date" value={form.date_paiement} onChange={set('date_paiement')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Reste à payer</label>
                <input className="form-control" type="number" value={form.reste_a_payer} onChange={set('reste_a_payer')} placeholder="Montant restant avant paiement" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Montant payé </label>
                <input className="form-control" type="number" value={form.montant_paye} onChange={set('montant_paye')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Compte</label>
                <select className="form-control" value={form.id_compte} onChange={set('id_compte')} required>
                  <option value="">-- Choisir un compte --</option>
                  {(comptes ?? []).map(c => <option key={c.id_compte} value={c.id_compte}>{c.libelle}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group" style={{ maxWidth: 280 }}>
              <label className="form-label">Lieu de paiement</label>
              <select className="form-control" value={form.lieu_paiement} onChange={set('lieu_paiement')}>
                <option>Ampandrana</option><option>Ampefiloha</option><option>Andravoahangy</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }} disabled={saving}>
              {saving ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Enregistrement…</> : editing ? <><IcoSave /> Mettre à jour</> : <><IcoPlus /> Enregistrer</>}
            </button>
          </form>
        </div>
      </div>

      {loadingFacture && (
        <div className="card" style={{ marginBottom: 20, padding: 24, textAlign: 'center', color: '#64748b' }}>
          <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: 8 }} />
          Chargement de la facture…
        </div>
      )}
      {derniereFacture && (
        <div style={{ marginBottom: 20 }}>
          <FactureInvoice factures={[derniereFacture]} title="Facture générée — Recouvrement" />
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="section-info">
            <div className="section-title">Liste de recouvrement(s)</div>
            <div className="section-count">{table.meta.total > 0 ? `${table.meta.total} recouvrement(s)` : `${table.data.length} recouvrement(s)`}</div>
          </div>
          <div className="search-bar">
            <IcoSearch />
            <input placeholder="Mot à rechercher..." value={table.search} onChange={e => table.setSearch(e.target.value)} />
            {table.search && <button onClick={() => table.setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0, fontSize:16 }}>×</button>}
          </div>
        </div>
        <div className="table-wrapper">
          {table.loading ? <div className="loading-center"><div className="spinner" /> Chargement…</div> : (
            <table>
              {/* Colonne Éditeur retirée — désormais visible dans le détail au clic sur une ligne */}
              <thead><tr><th>#</th><th>Étudiant</th><th>Session</th><th>Montant payé</th><th>Reste</th><th>Réf. facture</th><th>Date paiement</th><th>Action</th></tr></thead>
              <tbody>
                {table.data.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state">{table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucun recouvrement'}</div></td></tr>
                ) : table.data.map((r, idx) => (
                  <tr key={r.id_recouvrement} onClick={() => setViewing(r)} style={{ cursor: 'pointer' }}>
                    <td style={{ color:'#94a3b8', fontSize:12 }}>{(table.meta.current_page-1)*table.meta.per_page+idx+1}</td>
                    <td>
                      <div style={{ fontWeight:600 }}>{r.nom} {r.prenom}</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>{r.matricule.toUpperCase()}</div>
                    </td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{r.code_session}</td>
                    <td style={{ fontWeight:600, color:'#16a34a' }}>{fmt(Number(r.montant_paye))} Ar</td>
                    <td><span className={`badge ${Number(r.reste) === 0 ? 'badge-success' : 'badge-danger'}`}>{fmt(Number(r.reste))} Ar</span></td>
                    <td style={{ fontSize:11, color:'#2563eb', fontWeight:600 }}>{r.ref_facture || '—'}</td>
                    <td style={{ fontSize:12 }}>{r.date_paiement}</td>
                    <td onClick={ev => ev.stopPropagation()}><div className="table-actions">
                      <button className="btn-icon edit" onClick={() => handleEdit(r)}><IcoEdit /></button>
                      <button className="btn-icon delete" onClick={() => handleDelete(r.id_recouvrement)}><IcoTrash /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!table.loading && table.meta.total > 0 && <Pagination meta={table.meta} onPage={table.setPage} onPerPage={table.setPerPage} />}
      </div>

      {viewing && <DetailModal r={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}