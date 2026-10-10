import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useAuth } from '../../contexts/AuthContext'
import { IcoPlus, IcoEdit, IcoTrash, IcoSearch, IcoSave, IcoX } from '../../components/icons'
import { formatMontantInput, parseMontantInput } from '../../utils/validators'

interface Recouvrement {
  id_prestation: number; benefit_date: string; client_name: string; service_name: string
  benefit_costs: number; payroll_amount: number; account_number: string
}
interface Client  { id_client: number; client_name: string }
interface ServiceItem { id_services: number; service_name: string }
interface Compte  { id_compte: number; libelle: string }

const EMPTY = {
  benefit_date: new Date().toISOString().split('T')[0],
  benefit_client: '', benefit_service: '', payroll_amount: '', account: '',
}

const fmt = (n: number) => Number(n).toLocaleString('fr')

function DetailModal({ r, onClose }: { r: Recouvrement; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Client', r.client_name], ['Service', r.service_name],
    ['Date', r.benefit_date], ['Montant payé', `${fmt(r.payroll_amount)} Ar`],
    ['Compte', r.account_number],
  ]
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={onClose}>
      <div style={{ width:420, background:'white', borderRadius:12, padding:24 }} onClick={ev => ev.stopPropagation()}>
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

export default function RecouvrementPrestationTab() {
  const { isAdmin } = useAuth()
  const table = useTable<Recouvrement>('/recouvrements-prestation', { perPage: 15 })
  const [clients,  setClients]  = useState<Client[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [comptes,  setComptes]  = useState<Compte[]>([])
  const [form,     setForm]     = useState(EMPTY)
  const [resteAPayer, setResteAPayer] = useState<number | null>(null)
  const [viewing,  setViewing]  = useState<Recouvrement | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  // FIX : aucune modification n'était possible — seule la suppression
  // existait, alors que le backend expose déjà PUT /prestations/{id}.
  const [editing, setEditing] = useState<Recouvrement | null>(null)

  useEffect(() => {
    api.get('/clients', { params: { per_page: 500 } }).then(r => setClients(r.data.data ?? [])).catch(() => {})
    api.get('/services', { params: { per_page: 500 } }).then(r => setServices(r.data.data ?? [])).catch(() => {})
    api.get('/comptes-budget/simple').then(r => setComptes(r.data ?? [])).catch(() => {})
  }, [])

  // ── Récupère le reste à payer dès que client + service sont choisis ──
  useEffect(() => {
    if (form.benefit_client && form.benefit_service) {
      api.get('/prestations/reste-a-payer', { params: { benefit_client: form.benefit_client, benefit_service: form.benefit_service } })
        .then(r => setResteAPayer(r.data.reste_a_payer))
        .catch(() => setResteAPayer(null))
    } else {
      setResteAPayer(null)
    }
  }, [form.benefit_client, form.benefit_service])

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleEdit = (r: Recouvrement) => {
    setEditing(r)
    setForm({
      benefit_date: r.benefit_date?.slice(0, 10) || new Date().toISOString().split('T')[0],
      benefit_client: '', benefit_service: '',
      payroll_amount: formatMontantInput(String(r.payroll_amount)), account: String(r.account_number),
    })
    setResteAPayer(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => { setForm(EMPTY); setEditing(null); setResteAPayer(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) {
        // FIX : l'API de listing ne renvoie pas l'id_client/id_service de la
        // ligne existante (seulement leurs noms) — seuls date, montant payé
        // et compte sont modifiables (mêmes champs verrouillés en édition
        // que dans PrestationTab.tsx, même limitation).
        await api.put(`/prestations/${editing.id_prestation}`, {
          benefit_date: form.benefit_date,
          // FIX : le champ Montant payé est saisi formaté ("1 000 000")
          // pour l'affichage — on renvoie la valeur numérique brute à l'API.
          payroll_amount: parseMontantInput(form.payroll_amount),
          account: form.account,
        })
        toast.success('Recouvrement mis à jour')
      } else {
        await api.post('/prestations/recouvrement', { ...form, payroll_amount: parseMontantInput(form.payroll_amount) })
        toast.success('Recouvrement enregistré avec succès')
      }
      resetForm()
      table.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement") }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirmDeleteId) return
    try { await api.delete(`/prestations/${confirmDeleteId}`); toast.success('Recouvrement supprimé'); table.reload() }
    catch { toast.error('Erreur lors de la suppression') }
    finally { setConfirmDeleteId(null) }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>
            {editing ? <IcoEdit /> : <IcoPlus />} {editing ? 'Modifier le recouvrement' : 'Nouveau recouvrement'}
          </span>
          {/* FIX : style harmonisé avec le bouton Annuler d'Étudiant */}
          {editing && <button type="button" className="btn btn-sm" onClick={resetForm} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoX /> Annuler</button>}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date </label>
                <input className="form-control" type="date" value={form.benefit_date} onChange={set('benefit_date')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Client </label>
                {editing ? (
                  // FIX : non modifiable en édition — l'API ne renvoie pas
                  // l'id_client/id_service de la ligne existante.
                  <input className="form-control" disabled value={editing.client_name} />
                ) : (
                  <select className="form-control" value={form.benefit_client} onChange={set('benefit_client')} required>
                    <option value="">-- Choisir un client --</option>
                    {clients.map(c => <option key={c.id_client} value={c.id_client}>{c.client_name}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Service </label>
                {editing ? (
                  <input className="form-control" disabled value={editing.service_name} />
                ) : (
                  <select className="form-control" value={form.benefit_service} onChange={set('benefit_service')} required>
                    <option value="">-- Choisir un service --</option>
                    {services.map(s => <option key={s.id_services} value={s.id_services}>{s.service_name}</option>)}
                  </select>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Reste à payer</label>
                <input className="form-control" disabled value={resteAPayer !== null ? `${fmt(resteAPayer)} Ar` : ''} placeholder="Choisir client + service" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Montant payé </label>
                <input className="form-control" type="text" inputMode="numeric" value={form.payroll_amount} onChange={e => setForm(p => ({ ...p, payroll_amount: formatMontantInput(e.target.value) }))} required placeholder="Ex: 100 000" />
              </div>
              <div className="form-group">
                <label className="form-label">Compte encaissement </label>
                <select className="form-control" value={form.account} onChange={set('account')} required>
                  <option value="">-- Choisir un compte --</option>
                  {comptes.map(c => <option key={c.id_compte} value={c.id_compte}>{c.libelle}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }} disabled={saving}>
              {saving ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Enregistrement…</> : editing ? <><IcoSave /> Mettre à jour</> : <><IcoPlus /> Enregistrer</>}
            </button>
          </form>
        </div>
      </div>

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
              <thead><tr><th>#</th><th>Client</th><th>Service</th><th>Date</th><th>Montant payé</th><th>Compte</th><th>Action</th></tr></thead>
              <tbody>
                {table.data.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state">{table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucun recouvrement'}</div></td></tr>
                ) : table.data.map((r, idx) => (
                  <tr key={r.id_prestation} onClick={() => setViewing(r)} style={{ cursor:'pointer' }}>
                    <td style={{ color:'#94a3b8', fontSize:12 }}>{(table.meta.current_page-1)*table.meta.per_page+idx+1}</td>
                    <td style={{ fontWeight:600 }}>{r.client_name}</td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{r.service_name}</td>
                    <td style={{ fontSize:12 }}>{r.benefit_date}</td>
                    <td style={{ fontWeight:600, color:'#16a34a' }}>{fmt(r.payroll_amount)} Ar</td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{r.account_number}</td>
                    <td onClick={ev => ev.stopPropagation()}><div className="table-actions">
                      {/* FIX : bouton Modifier ajouté — manquait totalement */}
                      <button className="btn-icon edit" onClick={() => handleEdit(r)}><IcoEdit /></button>
                      {isAdmin() && <button className="btn-icon delete" onClick={() => setConfirmDeleteId(r.id_prestation)}><IcoTrash /></button>}
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

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Supprimer ce recouvrement ?"
        message="Ce recouvrement sera définitivement supprimé. Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </>
  )
}