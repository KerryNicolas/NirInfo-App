import { useEffect, useState } from 'react'
import LieuSelect from '../../../components/LieuSelect'
import api from '../../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../../hooks/useTable'
import { useModuleSuggestions } from '../../../hooks/useModuleSuggestions'
import Pagination from '../../../components/Pagination'
import ConfirmDialog from '../../../components/ConfirmDialog'
import { useAuth } from '../../../contexts/AuthContext'
import { IcoPlus, IcoEdit, IcoTrash, IcoSearch, IcoSave, IcoX } from '../../../components/icons'
import { formatMontantInput, parseMontantInput } from '../../../utils/validators'

interface Session {
  code_session: string; date_debut: string; date_fin: string
  date_echeance: string; horaire_description: string
  frais_formation: number; module_nom: string; code_module: string; code_horaire: string
  editeur: string; formateur_nom: string; lieu: string
}
interface Horaire { code_horaire: string; designation: string; horaire: string }

const EMPTY = { date_debut:'', date_fin:'', date_echeance:'', code_horaire:'', code_module:'', frais_formation:'', lieu:'Ampandrana', id_formateur:'' }

const DEFAULT_HORAIRES: Horaire[] = [
  { code_horaire:'MAT', designation:'Matin',          horaire:'Lundi–Vendredi  07h30–12h00' },
  { code_horaire:'APM', designation:'Après-midi',     horaire:'Lundi–Vendredi  13h00–17h30' },
  { code_horaire:'SS',  designation:'Soir semaine',   horaire:'Lundi–Vendredi  18h00–21h00' },
  { code_horaire:'WE',  designation:'Week-end matin', horaire:'Sam–Dim         08h00–12h00' },
  { code_horaire:'WES', designation:'Week-end soir',  horaire:'Sam–Dim         13h00–17h00' },
  { code_horaire:'INT', designation:'Intensif',       horaire:'Tous les jours  08h00–17h00' },
]

export default function SessionForm() {
  const { isAdmin } = useAuth()
  const table    = useTable<Session>('/sessions', { perPage: 15 })
  const [horaires, setHoraires] = useState<Horaire[]>([])
  const [form,     setForm]     = useState(EMPTY)
  const [editing,  setEditing]  = useState<Session | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [confirmDeleteCode, setConfirmDeleteCode] = useState<string | null>(null)

  // FIX : Module en autocomplétion — corrige le bug où le <select> ne
  // chargeait que 15 modules sur 65 (pas de per_page envoyé côté fetch initial).
  const [moduleQuery, setModuleQuery] = useState('')
  const moduleSuggestions = useModuleSuggestions(moduleQuery)

  useEffect(() => {
    // Horaires : peu nombreux (6 par défaut + quelques personnalisés),
    // per_page élevé suffit largement, pas besoin d'autocomplétion ici.
    api.get('/horaires', { params: { per_page: 100 } })
      .then(r => setHoraires(r.data.data ?? []))
      .catch(() => {})
  }, [])

  const allHoraires = [...horaires, ...DEFAULT_HORAIRES.filter(d => !horaires.find(h => h.code_horaire === d.code_horaire))]
  const selectedHoraire = allHoraires.find(h => h.code_horaire === form.code_horaire)

  const reset = () => { setForm(EMPTY); setModuleQuery(''); setEditing(null) }

  const handleEdit = (s: Session) => {
    setEditing(s)
    setForm({
      date_debut:      s.date_debut      || '',
      date_fin:        s.date_fin        || '',
      date_echeance:   s.date_echeance   || '',
      code_horaire:    s.code_horaire    || '',
      code_module:     s.code_module     || '',
      frais_formation: formatMontantInput(String(s.frais_formation)) || '',
      lieu:            s.lieu            || 'Ampandrana',
      id_formateur:    '',
    })
    setModuleQuery(s.module_nom || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) {
        // FIX : code_horaire, code_module et lieu sont maintenant envoyés en
        // édition — jamais code_session lui-même (voir commentaire backend).
        await api.put(`/sessions/${editing.code_session}`, {
          date_debut: form.date_debut, date_fin: form.date_fin, date_echeance: form.date_echeance,
          frais_formation: parseMontantInput(form.frais_formation), code_horaire: form.code_horaire,
          code_module: form.code_module, lieu: form.lieu,
        })
        toast.success('Session mise à jour'); reset()
      } else {
        await api.post('/sessions', { ...form, frais_formation: parseMontantInput(form.frais_formation), id_formateur: form.id_formateur || undefined })
        toast.success('Session créée avec succès'); setForm(EMPTY); setModuleQuery('')
      }
      table.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement") }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirmDeleteCode) return
    try { await api.delete(`/sessions/${confirmDeleteCode}`); toast.success('Session supprimée'); table.reload() }
    catch { toast.error('Erreur lors de la suppression') }
    finally { setConfirmDeleteCode(null) }
  }

  const fmt = (n: number) => Number(n).toLocaleString('fr')

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>
            {editing ? <IcoEdit /> : <IcoPlus />}
            {editing ? `Modifier — ${editing.code_session}` : 'Nouvelle session'}
          </span>
          {/* FIX : style harmonisé avec le bouton Annuler d'Étudiant */}
          {editing && <button className="btn btn-sm" onClick={reset} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoX /> Annuler</button>}
        </div>
        <div className="card-body">

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group" >
                <label className="form-label">Date de début </label>
                <input className="form-control" type="date" value={form.date_debut} onChange={set('date_debut')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Date de fin </label>
                <input className="form-control" type="date" value={form.date_fin} onChange={set('date_fin')} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date d'échéance </label>
                <input className="form-control" type="date" value={form.date_echeance} onChange={set('date_echeance')} />
              </div>
              <div className="form-group">
                <label className="form-label">Horaire</label>
                {/* FIX : code_horaire modifiable même en édition — sans
                    risque, ne touche que cette session (pas de cascade). */}
                <select className="form-control" value={form.code_horaire} onChange={set('code_horaire')} required>
                  <option value="">-- Choisir un horaire --</option>
                  {horaires.filter(h => !DEFAULT_HORAIRES.find(d => d.code_horaire === h.code_horaire)).length > 0 && (
                    <optgroup label="Horaires personnalisés">
                      {horaires.filter(h => !DEFAULT_HORAIRES.find(d => d.code_horaire === h.code_horaire)).map(h => <option key={h.code_horaire} value={h.code_horaire}>{h.designation} — {h.horaire}</option>)}
                    </optgroup>
                  )}
                  <optgroup label="Horaires standards">
                    {allHoraires.filter(h => DEFAULT_HORAIRES.find(d => d.code_horaire === h.code_horaire)).map(h => <option key={h.code_horaire} value={h.code_horaire}>{h.designation} — {h.horaire}</option>)}
                  </optgroup>
                </select>
                {selectedHoraire && (
                  <div style={{ marginTop:6, padding:'6px 10px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:7, fontSize:13, color:'#1d4ed8', display:'flex', alignItems:'center', gap:6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {selectedHoraire.horaire}
                  </div>
                )}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Module </label>
                {/* FIX : autocomplétion au lieu du <select> qui ne chargeait
                    que 15 des 65 modules. Modifiable même en édition — ne
                    touche que cette session (code_session jamais recalculé). */}
                <input
                  className="form-control"
                  list="module-suggestions"
                  value={moduleQuery}
                  onChange={e => {
                    const v = e.target.value
                    setModuleQuery(v)
                    const match = moduleSuggestions.find(m => m.nom === v)
                    setForm(p => ({ ...p, code_module: match ? match.code_module : '' }))
                  }}
                  required placeholder="Tapez pour rechercher un module…" />
                <datalist id="module-suggestions">
                  {moduleSuggestions.map(m => (
                    <option key={m.code_module} value={m.nom}>{m.code_module}</option>
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Frais de formation (Ar) </label>
                {/* FIX : formatage en direct avec espaces "1 000 000" — type="text" nécessaire, "number" refuse les espaces */}
                <input className="form-control" type="text" inputMode="numeric" value={form.frais_formation}
                  onChange={e => setForm(p => ({ ...p, frais_formation: formatMontantInput(e.target.value) }))}
                  required placeholder="Ex: 100 000" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Lieu </label>
                {/* FIX : réellement sauvegardé maintenant (colonne
                    session.lieu ajoutée) — avant, cette valeur était perdue
                    silencieusement. Modifiable même en édition. */}
                {/* Liste gérée dans l'onglet « Lieu ». */}
                <LieuSelect value={form.lieu} onChange={set('lieu')} />
              </div>
              <div className="form-group">
                <label className="form-label">ID Formateur</label>
                {/* FIX : déverrouillé même en édition — même traitement que
                    les autres champs (lieu, code_horaire, code_module...). */}
                <input className="form-control" type="number" value={form.id_formateur} onChange={set('id_formateur')} placeholder="Ex: 4" />
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
            <div className="section-title">Liste des session(s)</div>
            <div className="section-count">{table.meta.total > 0 ? `${table.meta.total} session(s) — page ${table.meta.current_page}/${table.meta.last_page}` : `${table.data.length} session(s)`}</div>
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
              <thead><tr><th>#</th><th>Code</th><th>Début</th><th>Fin</th><th>Échéance</th><th>Horaire</th><th>Frais</th><th>Module</th><th>Lieu</th><th>Action</th></tr></thead>
              <tbody>
                {table.data.length === 0 ? (
                  <tr><td colSpan={10}><div className="empty-state">{table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucune session trouvée'}</div></td></tr>
                ) : table.data.map((s, idx) => (
                  <tr key={s.code_session}>
                    <td style={{ color:'#94a3b8', fontSize:13 }}>{(table.meta.current_page-1)*table.meta.per_page+idx+1}</td>
                    <td style={{ fontWeight:500, fontSize:12 }}>{s.code_session}</td>
                    <td style={{ fontSize:13 }}>{s.date_debut}</td>
                    <td style={{ fontSize:13 }}>{s.date_fin}</td>
                    <td style={{ fontSize:13 }}>{s.date_echeance}</td>
                    <td style={{ fontSize:13, color:'#64748b' }}>{s.horaire_description}</td>
                    <td style={{ fontWeight:600, color:'#16a34a', whiteSpace:'nowrap' }}>{fmt(s.frais_formation)} Ar</td>
                    <td><span className="badge badge-info">{s.module_nom}</span></td>
                    <td style={{ fontSize:13 }}>{s.lieu ? <span style={{ textTransform:'capitalize' }}>{s.lieu}</span> : <span style={{ color:'#cbd5e1' }}>—</span>}</td>
                    <td><div className="table-actions">
                      <button className="btn-icon edit" onClick={() => handleEdit(s)}><IcoEdit /></button>
                      {isAdmin() && <button className="btn-icon delete" onClick={() => setConfirmDeleteCode(s.code_session)}><IcoTrash /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!table.loading && table.meta.total > 0 && <Pagination meta={table.meta} onPage={table.setPage} onPerPage={table.setPerPage} />}
      </div>

      <ConfirmDialog
        open={!!confirmDeleteCode}
        title="Supprimer cette session ?"
        message={confirmDeleteCode ? `La session « ${confirmDeleteCode} » sera définitivement supprimée. Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteCode(null)}
      />
    </>
  )
}