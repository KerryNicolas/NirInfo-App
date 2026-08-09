import { useEffect, useState } from 'react'
import api from '../../../api/axios'
import toast from 'react-hot-toast'
import { useMatriculeSuggestions } from '../../../hooks/useMatriculeSuggestions'
import { useTable } from '../../../hooks/useTable'
import Pagination from '../../../components/Pagination'
import FactureInvoice, { FactureData } from '../../../components/FactureInvoice'
import { IcoPlus, IcoEdit, IcoTrash, IcoSearch, IcoSave, IcoX } from '../../../components/icons'

interface Inscription {
  id_paiement: number; matricule: string; nom: string; prenom: string
  code_session: string; date_paiement: string; montant_paye: number
  reste: number; compte: string; lieu_paiement: string; editeur: string
  ref_facture: string
}
interface Session { code_session: string }
interface Compte { id_compte: number; libelle: string }

const EMPTY_I = {
  matricule: '', date_paiement: new Date().toISOString().split('T')[0],
  code_session: '', montant_paye: '', id_compte: '', lieu_paiement: 'Ampandrana',
}

const fmt2 = (n: number) => Number(n).toLocaleString('fr')

// ── Modal de détail — même pattern visuel que celui d'Étudiant ──
function DetailModal({ i, onClose }: { i: Inscription; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Matricule', i.matricule],
    ['Étudiant', `${i.nom} ${i.prenom}`],
    ['Session', i.code_session],
    ['Date paiement', i.date_paiement || '—'],
    ['Montant payé', `${fmt2(i.montant_paye)} Ar`],
    ['Reste à payer', `${fmt2(i.reste)} Ar`],
    ['Compte encaissement', i.compte || '—'],
    ['Lieu de paiement', i.lieu_paiement || '—'],
    ['Réf. facture', i.ref_facture || '—'],
    ['Éditeur', i.editeur?.trim() || '—'],
  ]
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={onClose}>
      <div style={{ width:480, background:'white', borderRadius:12, padding:24 }} onClick={ev => ev.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontWeight:700, fontSize:16 }}>Détail de l'inscription</span>
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

export default function InscriptionTab() {
  const table    = useTable<Inscription>('/inscriptions', { perPage: 15 })
  const [sessions, setSessions] = useState<Session[]>([])
  const [comptes,  setComptes]  = useState<Compte[]>([])
  const [form,     setForm]     = useState(EMPTY_I)
  const matriculeSuggestions = useMatriculeSuggestions(form.matricule)
  const [editing,  setEditing]  = useState<Inscription | null>(null)
  const [viewing,  setViewing]  = useState<Inscription | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [derniereFacture, setDerniereFacture] = useState<FactureData | null>(null)
  const [loadingFacture, setLoadingFacture]   = useState(false)

  useEffect(() => {
  api.get('/sessions').then(r => setSessions(r.data.data ?? [])).catch(() => {})
  api.get('/inscriptions/comptes')
    .then(r => setComptes(Array.isArray(r.data) ? r.data : []))
    .catch(() => setComptes([]))
}, [])

  const reset = () => { setForm(EMPTY_I); setEditing(null); setDerniereFacture(null) }

  const handleEdit = (i: Inscription) => {
    setEditing(i)
    setDerniereFacture(null)
    setForm({
      matricule: i.matricule,
      date_paiement: i.date_paiement?.split('T')[0] || new Date().toISOString().split('T')[0],
      code_session: i.code_session,
      montant_paye: String(i.montant_paye),
      id_compte: '',
      lieu_paiement: i.lieu_paiement || 'Ampandrana',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    setDerniereFacture(null)
    try {
      if (editing) {
        await api.put(`/inscriptions/${editing.id_paiement}`, { montant_paye: form.montant_paye, lieu_paiement: form.lieu_paiement })
        toast.success('Inscription mise à jour')
        reset()
      } else {
        const r = await api.post('/inscriptions', form)
        toast.success('Inscription enregistrée')

        setLoadingFacture(true)
        try {
          const factureRes = await api.get(`/factures/${r.data.ref_facture}/print`)
          setDerniereFacture(factureRes.data)
        } catch {
          toast.error("Inscription enregistrée, mais impossible de charger la facture pour impression")
        } finally {
          setLoadingFacture(false)
        }

        setForm(p => ({ ...p, matricule:'', code_session:'', montant_paye:'', id_compte:'' }))
      }
      table.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement") }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette inscription ?')) return
    try { await api.delete(`/inscriptions/${id}`); toast.success('Inscription supprimée'); table.reload() }
    catch { toast.error('Erreur lors de la suppression') }
  }

  const fmt = (n: number) => Number(n).toLocaleString('fr')

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>{editing ? <IcoEdit /> : <IcoPlus />} {editing ? "Modifier l'inscription" : 'Nouvelle inscription'}</span>
          {editing && <button className="btn btn-sm" onClick={reset} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoX /> Annuler</button>}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Matricule </label>
                <input
                  className="form-control"
                  list="matricule-suggestions"
                  value={form.matricule}
                  onChange={e => setForm(p => ({ ...p, matricule: e.target.value.toUpperCase() }))}
                  required placeholder="Ex: NI-3824" disabled={!!editing} />
                <datalist id="matricule-suggestions">
                  {matriculeSuggestions.map(s => (
                    <option key={s.matricule} value={s.matricule}>{s.nom} {s.prenom}</option>
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Date paiement </label>
                <input className="form-control" type="date" value={form.date_paiement} onChange={set('date_paiement')} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Session </label>
                <select className="form-control" value={form.code_session} onChange={set('code_session')} required disabled={!!editing}>
                  <option value="">-- Choisir une session --</option>
                  {sessions.map(s => <option key={s.code_session} value={s.code_session}>{s.code_session}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Montant payé </label>
                <input className="form-control" type="number" value={form.montant_paye} onChange={set('montant_paye')} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Compte encaissement</label>
                <select className="form-control" value={form.id_compte} onChange={set('id_compte')} required={!editing} disabled={!!editing}>
                  <option value="">-- Choisir un compte --</option>
                  {(comptes ?? []).map(c => <option key={c.id_compte} value={c.id_compte}>{c.libelle}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Lieu de paiement</label>
                <select className="form-control" value={form.lieu_paiement} onChange={set('lieu_paiement')}>
                  <option>Ampandrana</option><option>Ampefiloha</option><option>Andravoahangy</option>
                </select>
              </div>
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
          <FactureInvoice factures={[derniereFacture]} title="Facture générée — Inscription" />
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="section-info">
            <div className="section-title">Liste d'inscrit(s)</div>
            <div className="section-count">{table.meta.total > 0 ? `${table.meta.total} inscrit(s)` : `${table.data.length} inscrit(s)`}</div>
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
              <thead><tr><th>#</th><th>Étudiant</th><th>Session</th><th>Date</th><th>Montant payé</th><th>Reste</th><th>Réf. facture</th><th>Action</th></tr></thead>
              <tbody>
                {table.data.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state">{table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucune inscription'}</div></td></tr>
                ) : table.data.map((i, idx) => (
                  <tr key={i.id_paiement} onClick={() => setViewing(i)} style={{ cursor: 'pointer' }}>
                    <td style={{ color:'#94a3b8', fontSize:12 }}>{(table.meta.current_page-1)*table.meta.per_page+idx+1}</td>
                    <td>
                      <div style={{ fontWeight:600 }}>{i.nom} {i.prenom}</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>{i.matricule.toUpperCase()}</div>
                    </td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{i.code_session}</td>
                    <td style={{ fontSize:12 }}>{i.date_paiement}</td>
                    <td style={{ fontWeight:600, color:'#16a34a' }}>{fmt(Number(i.montant_paye))} Ar</td>
                    <td><span className={`badge ${Number(i.reste) === 0 ? 'badge-success' : 'badge-danger'}`}>{fmt(Number(i.reste))} Ar</span></td>
                    <td style={{ fontSize:11, color:'#2563eb', fontWeight:600 }}>{i.ref_facture || '—'}</td>
                    <td onClick={ev => ev.stopPropagation()}><div className="table-actions">
                      <button className="btn-icon edit" onClick={() => handleEdit(i)}><IcoEdit /></button>
                      <button className="btn-icon delete" onClick={() => handleDelete(i.id_paiement)}><IcoTrash /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!table.loading && table.meta.total > 0 && <Pagination meta={table.meta} onPage={table.setPage} onPerPage={table.setPerPage} />}
      </div>

      {viewing && <DetailModal i={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}