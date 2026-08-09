import { useEffect, useRef, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { IcoCamera, IcoExcel, IcoSearch,  IcoEdit, IcoPlus, IcoSave, IcoTrash, IcoX, } from '../../components/icons'


interface Personnel {
  matricule_pers: string
  nom_pers: string
  prenom_pers: string
  ddn_pers: string
  ldn_pers: string
  cin_pers: string
  dcin_pers: string
  lcin_pers: string
  tel_pers: string
  email_pers: string
  dembauche_pers: string
  salaire_pers: number
  diplome_pers: string
  adresse_pers: string
  id_fonction: number
  photo_pers: string
  nom_fonction?: string
}

interface Fonction {
  id_fonction: number
  nom_fonction: string
}

const UserPlaceholder = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)

const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(n)

const emptyForm = {
  matricule_pers: '', nom_pers: '', prenom_pers: '', ddn_pers: '', ldn_pers: '', cin_pers: '',
  dcin_pers: '', lcin_pers: '', tel_pers: '', email_pers: '', dembauche_pers: '',
  salaire_pers: '', diplome_pers: '', adresse_pers: '', id_fonction: '', photo_pers: ''
}

export default function PersonnelTab() {
  const [personnels, setPersonnels] = useState<Personnel[]>([])
  const [fonctions, setFonctions]   = useState<Fonction[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [form, setForm]             = useState({ ...emptyForm })
  const [editMatricule, setEditMatricule] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [photoPreview, setPhotoPreview]   = useState('')
  const [activeSection, setActiveSection] = useState<'identite' | 'professionnel'>('identite')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    api.get('/personnels', { params: { search } })
      .then(r => setPersonnels(r.data.data ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search])
  useEffect(() => {
    api.get('/fonctions').then(r => setFonctions(r.data.data ?? r.data)).catch(() => {})
  }, [])

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    const fd = new FormData(); fd.append('photo', file)
    try {
      const res = await api.post('/personnels/upload-photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setForm(f => ({ ...f, photo_pers: res.data.path ?? '' }))
    } catch {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.matricule_pers || !form.nom_pers || !form.prenom_pers) { toast.error('Matricule, nom et prénom sont obligatoires'); return }
    setSubmitting(true)
    const payload = { ...form, salaire_pers: parseInt(form.salaire_pers) || 0, id_fonction: parseInt(form.id_fonction) || null }
    try {
      if (editMatricule) { await api.put(`/personnels/${editMatricule}`, payload); toast.success('Personnel modifié') }
      else { await api.post('/personnels', payload); toast.success('Personnel enregistré') }
      setForm({ ...emptyForm }); setEditMatricule(null); setPhotoPreview(''); load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erreur lors de l\'enregistrement')
    }
    finally { setSubmitting(false) }
  }

  const handleEdit = (p: Personnel) => {
    setEditMatricule(p.matricule_pers)
    setForm({
      matricule_pers: p.matricule_pers, nom_pers: p.nom_pers, prenom_pers: p.prenom_pers,
      ddn_pers: p.ddn_pers?.slice(0,10) ?? '', ldn_pers: p.ldn_pers ?? '', cin_pers: p.cin_pers ?? '',
      dcin_pers: p.dcin_pers?.slice(0,10) ?? '', lcin_pers: p.lcin_pers ?? '', tel_pers: p.tel_pers ?? '',
      email_pers: p.email_pers ?? '', dembauche_pers: p.dembauche_pers?.slice(0,10) ?? '',
      salaire_pers: String(p.salaire_pers), diplome_pers: p.diplome_pers ?? '',
      adresse_pers: p.adresse_pers ?? '', id_fonction: String(p.id_fonction ?? ''), photo_pers: p.photo_pers ?? ''
    })
    setPhotoPreview(p.photo_pers ? `http://localhost:8000/storage/${p.photo_pers}` : '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (matricule: string) => {
    if (!confirm('Supprimer ce personnel ?')) return
    try { await api.delete(`/personnels/${matricule}`); toast.success('Personnel supprimé'); load() }
    catch { toast.error('Erreur lors de la suppression') }
  }

  const handleCancel = () => { setForm({ ...emptyForm }); setEditMatricule(null); setPhotoPreview('') }

  const exportCSV = () => {
    const rows = [['Matricule','Nom','Prénom','Téléphone','Email','Fonction','Salaire'],
      ...personnels.map(p => [p.matricule_pers, p.nom_pers, p.prenom_pers, p.tel_pers, p.email_pers, p.nom_fonction ?? '', p.salaire_pers])]
    const csv = rows.map(r => r.join(';')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); a.download = 'personnel.csv'; a.click()
  }

  const inputStyle = { padding:'8px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, outline:'none', fontFamily:'inherit', background:'#fafbfc', width:'100%', boxSizing:'border-box' as const }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Formulaire */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{editMatricule ? 'Modifier le personnel' : 'Nouveau personnel'}</span>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setActiveSection('identite')}
              style={{ padding:'5px 12px', borderRadius:7, border:`1px solid ${activeSection==='identite'?'#2563eb':'#e2e8f0'}`, background: activeSection==='identite'?'#eff6ff':'#f8fafc', color: activeSection==='identite'?'#2563eb':'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              Identité
            </button>
            <button onClick={() => setActiveSection('professionnel')}
              style={{ padding:'5px 12px', borderRadius:7, border:`1px solid ${activeSection==='professionnel'?'#2563eb':'#e2e8f0'}`, background: activeSection==='professionnel'?'#eff6ff':'#f8fafc', color: activeSection==='professionnel'?'#2563eb':'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              Professionnel
            </button>
            {editMatricule && <button onClick={handleCancel} style={{ display:'flex', alignItems:'center', gap:5, background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0', borderRadius:7, padding:'5px 10px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}><IcoX /> Annuler</button>}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Photo + matricule */}
          <div style={{ display:'flex', gap:20, marginBottom:20, alignItems:'flex-start' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
              <div style={{ width:80, height:80, borderRadius:12, border:'2px solid #e2e8f0', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
                {photoPreview ? <img src={photoPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <UserPlaceholder />}
              </div>
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ display:'flex', alignItems:'center', gap:5, background:'#f1f5f9', color:'#374151', border:'1px solid #e2e8f0', borderRadius:7, padding:'6px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                <IcoCamera /> Photo
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display:'none' }} />
            </div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>Matricule <span style={{ color:'#ef4444' }}>*</span></label>
              <input value={form.matricule_pers} onChange={e => setForm(f => ({ ...f, matricule_pers: e.target.value }))}
                placeholder="Ex: PERS-001" disabled={!!editMatricule}
                style={{ ...inputStyle, background: editMatricule ? '#f1f5f9' : '#fafbfc' }}
                onFocus={e => e.target.style.borderColor='#3b82f6'} onBlur={e => e.target.style.borderColor='#e2e8f0'} />
            </div>
          </div>

          {activeSection === 'identite' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 18px' }}>
              {[
                { label:'Nom', key:'nom_pers', req:true },
                { label:'Prénom', key:'prenom_pers', req:true },
                { label:'Date de naissance', key:'ddn_pers', type:'date' },
                { label:'Lieu de naissance', key:'ldn_pers' },
                { label:'N° CIN', key:'cin_pers' },
                { label:'Date CIN', key:'dcin_pers', type:'date' },
                { label:'Lieu CIN', key:'lcin_pers' },
                { label:'Téléphone', key:'tel_pers' },
                { label:'Email', key:'email_pers', type:'email' },
                { label:'Adresse', key:'adresse_pers' },
              ].map(({ label, key, type='text', req }) => (
                <div key={key} style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>{label} {req && <span style={{ color:'#ef4444' }}>*</span>}</label>
                  <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={inputStyle} onFocus={e => e.target.style.borderColor='#3b82f6'} onBlur={e => e.target.style.borderColor='#e2e8f0'} />
                </div>
              ))}
            </div>
          )}

          {activeSection === 'professionnel' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 18px' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Fonction</label>
                <select value={form.id_fonction} onChange={e => setForm(f => ({ ...f, id_fonction: e.target.value }))}
                  style={{ ...inputStyle }}>
                  <option value="">-- Choisir une fonction --</option>
                  {fonctions.map(f => <option key={f.id_fonction} value={f.id_fonction}>{f.nom_fonction}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Date d'embauche</label>
                <input type="date" value={form.dembauche_pers} onChange={e => setForm(f => ({ ...f, dembauche_pers: e.target.value }))} style={inputStyle} onFocus={e => e.target.style.borderColor='#3b82f6'} onBlur={e => e.target.style.borderColor='#e2e8f0'} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Salaire (Ar)</label>
                <input type="number" value={form.salaire_pers} onChange={e => setForm(f => ({ ...f, salaire_pers: e.target.value }))} placeholder="0" style={inputStyle} onFocus={e => e.target.style.borderColor='#3b82f6'} onBlur={e => e.target.style.borderColor='#e2e8f0'} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Diplôme</label>
                <input value={form.diplome_pers} onChange={e => setForm(f => ({ ...f, diplome_pers: e.target.value }))} style={inputStyle} onFocus={e => e.target.style.borderColor='#3b82f6'} onBlur={e => e.target.style.borderColor='#e2e8f0'} />
              </div>
            </div>
          )}

          <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:16 }}>
            <button type="submit" disabled={submitting}
              style={{ display:'flex', alignItems:'center', gap:7, background: editMatricule ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#1e40af,#2563eb)', color:'white', border:'none', borderRadius:9, padding:'9px 22px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 2px 10px rgba(30,64,175,0.3)', opacity: submitting ? 0.7 : 1 }}>
              <IcoSave /> {submitting ? 'Enregistrement...' : (editMatricule ? 'Modifier' : 'Enregistrer')}
            </button>
          </div>
        </form>
      </div>

      {/* Liste */}
      <div className="card">
        <div className="card-header">
          <div>
            <span className="card-title">Liste du personnel</span>
            <p style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>{personnels.length} membre(s)</p>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', display:'flex' }}><IcoSearch /></span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." style={{ paddingLeft:32, paddingRight:12, paddingTop:7, paddingBottom:7, borderRadius:8, border:'1px solid #e2e8f0', fontSize:12, outline:'none', fontFamily:'inherit', width:180 }} />
            </div>
            <button onClick={exportCSV} style={{ display:'flex', alignItems:'center', gap:6, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:8, padding:'7px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}><IcoExcel /> Exporter</button>
            <button onClick={handleCancel} style={{ display:'flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,#1e40af,#2563eb)', color:'white', border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(30,64,175,0.25)' }}><IcoPlus /> Nouveau</button>
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? <div className="loading-center"><div className="spinner"/></div> : (
            <table style={{ minWidth:860 }}>
              <thead><tr><th>#</th><th>Photo</th><th>Matricule</th><th>Nom</th><th>Prénom</th><th>Téléphone</th><th>Fonction</th><th>Salaire</th><th>Action</th></tr></thead>
              <tbody>
                {personnels.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign:'center', padding:'32px 0', color:'#94a3b8', fontSize:13 }}>Aucun personnel enregistré</td></tr>
                ) : personnels.map((p, i) => (
                  <tr key={p.matricule_pers}>
                    <td style={{ color:'#94a3b8', fontSize:12 }}>{i+1}</td>
                    <td>
                      <div style={{ width:36, height:36, borderRadius:'50%', border:'1px solid #e2e8f0', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                        {p.photo_pers ? <img src={`http://localhost:8000/storage/${p.photo_pers}`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <UserPlaceholder />}
                      </div>
                    </td>
                    <td><span className="badge badge-info">{p.matricule_pers}</span></td>
                    <td style={{ fontWeight:600, color:'#1e293b' }}>{p.nom_pers}</td>
                    <td style={{ color:'#374151' }}>{p.prenom_pers}</td>
                    <td style={{ color:'#64748b', fontSize:12 }}>{p.tel_pers}</td>
                    <td><span className="badge" style={{ background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0' }}>{p.nom_fonction ?? '—'}</span></td>
                    <td style={{ fontWeight:700, color:'#7c3aed' }}>{fmt(p.salaire_pers)} Ar</td>
                    <td>
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={() => handleEdit(p)} style={{ display:'flex', alignItems:'center', gap:4, background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:6, padding:'5px 9px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}><IcoEdit /> Modifier</button>
                        <button onClick={() => handleDelete(p.matricule_pers)} style={{ display:'flex', alignItems:'center', gap:4, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:6, padding:'5px 9px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}><IcoTrash /> Suppr.</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}