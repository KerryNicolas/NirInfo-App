import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import { useAuth } from '../../contexts/AuthContext'
import { useModuleSuggestions } from '../../hooks/useModuleSuggestions'
import { useMatriculeSuggestions } from '../../hooks/useMatriculeSuggestions'
import { useSessionSuggestions } from '../../hooks/useSessionSuggestions'
import ConfirmDialog from '../../components/ConfirmDialog'
import Attestation from '../../assets/attestation.png'
import Tampon from '../../assets/tampon.png'
import Signature from '../../assets/signature.png'
import { formatMontantInput, parseMontantInput, isValidMatriculeNI, invalidFieldStyle } from '../../utils/validators'
// FIX : génération PDF réelle (jsPDF) pour l'impression du certificat —
// voir certificatPdf.ts pour le détail et la raison du changement.
import { generateCertificatPdf } from '../../utils/certificatPdf'

interface Certification {
  id: number; reference: string; matricule: string
  nom: string; prenom: string; nom_complet: string
  module_nom: string; debut_session: string; fin_session: string
  date: string; prix: number; nom_formation?: string; code_module: string
  lieu_paiement?: string; code_session?: string
  accept: number
  // FIX : manquaient — nécessaires pour la ligne "Né(e) le ... à ..."
  date_naissance?: string; lieu_naissance?: string
}
interface Compte { id_compte: number; libelle: string }
interface PrixHistorique { id_prix_certificat: number; prix: number; date_modification: string }
type SubTab = 'certification' | 'prix' | 'montant'

const today = new Date().toISOString().split('T')[0]
const EMPTY = { matricule:'', code_module:'', date_debut:'', date_fin:'', nom_formation_certificat:'', lieu_paiement:'Ampandrana', code_session:'', prix:'' }

/* ── Icônes ── */
const IcoCertif = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
const IcoPrint  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
const IcoTrash  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const IcoSearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IcoMoney  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2M8.5 9.5a3.5 3.5 0 0 1 7 0c0 2-3.5 3-3.5 3s-3.5 1-3.5 3a3.5 3.5 0 0 0 7 0"/></svg>
const IcoAward  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
const IcoClose  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IcoEdit   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IcoSave   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>

function CertificatView({ certif, onClose }: { certif: Certification; onClose: () => void }) {
  const fmt = (d: string) => { if (!d) return '—'; return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }) }
  const [generating, setGenerating] = useState(false)

  // FIX : remplace window.print() par une vraie génération PDF (jsPDF).
  // Avant, ce composant forçait sa propre règle CSS @page (A4 paysage) —
  // si la page Facture (qui force @page A5 portrait) était encore active
  // en même temps, les deux règles @page entraient en conflit et le
  // certificat pouvait sortir au mauvais format (A5 au lieu de A4). Un PDF
  // généré par jsPDF a ses propres dimensions et ignore totalement le CSS
  // d'impression de la page — plus aucun risque de conflit.
  //
  // FIX 2 : doc.autoPrint() + window.open() ouvrait bien le PDF dans un
  // nouvel onglet, mais ne déclenchait jamais la boîte de dialogue
  // d'impression — autoPrint() insère une commande JavaScript DANS le PDF,
  // que la visionneuse PDF intégrée de Chrome/Edge n'exécute pas (bloqué
  // pour raisons de sécurité). Solution fiable : charger le PDF dans un
  // <iframe> caché et appeler window.print() dessus une fois chargé — ça
  // déclenche la vraie boîte de dialogue d'impression du navigateur.
  const handlePrint = async () => {
    setGenerating(true)
    try {
      const doc = await generateCertificatPdf(certif)
      const blobUrl = doc.output('bloburl') as unknown as string

      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)

      const cleanup = () => {
        if (iframe.parentNode) document.body.removeChild(iframe)
        URL.revokeObjectURL(blobUrl)
      }

      iframe.onload = () => {
        // Petit délai pour laisser la visionneuse PDF finir de se rendre
        // avant d'appeler print() — sinon la boîte de dialogue peut
        // s'ouvrir sur une page blanche sur certains navigateurs.
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
          } catch {
            // Si le navigateur bloque le print() programmatique, on retombe
            // sur l'ouverture d'un onglet — l'utilisateur imprime lui-même.
            window.open(blobUrl, '_blank')
          }
        }, 300)
      }
      iframe.src = blobUrl

      // Filet de sécurité : on retire l'iframe après un délai, qu'il y ait
      // eu impression ou non (le navigateur ne renvoie pas toujours un
      // événement fiable une fois la boîte de dialogue fermée).
      setTimeout(cleanup, 60000)
    } catch (err) {
      toast.error("Erreur lors de la génération du PDF du certificat")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ position:'absolute', top:20, right:20, display:'flex', gap:10, zIndex:201 }} className="no-print">
        <button onClick={handlePrint} disabled={generating} className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}>
          {generating ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Génération…</> : <><IcoPrint /> Imprimer</>}
        </button>
        <button onClick={onClose} className="btn btn-secondary" style={{ display:'flex', alignItems:'center', gap:6 }}><IcoClose /> Fermer</button>
      </div>
      {/* FIX : positions recalculées à partir des coordonnées mm exactes de
          components/certificat_pdf.php (FPDF 'L', A4 297×210mm), converties
          en % de la page (ex: SetY(97) sur 210mm → top 46.2%). Emplacements
          inchangés — la ligne "Né(e) le..." est juste insérée dans l'espace
          déjà libre entre le nom et la session. */}
      <div id="certificat-print" style={{ width:900, aspectRatio:'297/210', position:'relative' }}>
        <img src={Attestation} alt="Certificat Nir'Info" style={{ width:'100%', display:'block' }} />

        <div style={{ position:'absolute', top:'46.2%', left:'3.5%', width:'93%', textAlign:'center', fontFamily:'system-ui, sans-serif', fontSize:'1.9vw', fontWeight:500, color:'#1e293b' }}>
          {certif.nom_complet?.trim() || `${certif.nom || ''} ${certif.prenom || ''}`.trim() || '—'}
        </div>

        {/* FIX : ligne manquante — casée dans l'espace déjà libre entre le
            nom (46.2%) et la session (54%), sans rien déplacer. */}
        {certif.date_naissance && (
          <div style={{ position:'absolute', top:'50.3%', left:'3.5%', width:'93%', textAlign:'center', fontFamily:'sans-serif', fontSize:'0.85vw', color:'#334155' }}>
            Né(e) le {fmt(certif.date_naissance)}{certif.lieu_naissance ? ` à ${certif.lieu_naissance}` : ''}
          </div>
        )}

        <div style={{ position:'absolute', top:'54%', left:'3.5%', width:'93%', textAlign:'center', fontFamily:'sans-serif', fontSize:'0.85vw', color:'#334155' }}>
          Séssion du {fmt(certif.debut_session)}{fmt(certif.debut_session) !== fmt(certif.fin_session) ? ` au ${fmt(certif.fin_session)}` : ''}
        </div>

        <div style={{ position:'absolute', top:'62.4%', left:'3.5%', width:'93%', textAlign:'center', fontFamily:'system-ui, sans-serif', fontSize:'2.1vw', fontWeight:700, color:'#265186', textTransform:'uppercase' }}>
          {certif.nom_formation || certif.module_nom || '—'}
        </div>

        <img src={Tampon} alt="Tampon officiel" style={{ position:'absolute', top:'82.4%', left:'74%', width:'23.4%', opacity:0.9, mixBlendMode:'multiply' }} />

        <img src={Signature} alt="Signature du directeur" style={{ position:'absolute', top:'85%', left:'84.2%', width:'4.4%', mixBlendMode:'multiply' }} />

        <div style={{ position:'absolute', top:'89.05%', left:'49.8%', width:'16.8%', fontFamily:'Arial, sans-serif', fontSize:'0.78vw', color:'#334155' }}>
          {certif.reference}
        </div>

        <div style={{ position:'absolute', top:'87%', left:'74.75%', width:'21.9%', textAlign:'center', whiteSpace:'nowrap', fontFamily:'system-ui, sans-serif', fontSize:'0.8vw', fontWeight:600, color:'#1e293b' }}>
          MIHARISOA Maminirina
        </div>
      </div>
    </div>
  )
}

function ValiderModal({ certif, comptes, onClose, onConfirm }: { certif: Certification; comptes: Compte[]; onClose: () => void; onConfirm: (idCompte: number, prix: number) => Promise<void> }) {
  const [idCompte, setIdCompte] = useState<string>('')
  const [prix, setPrix] = useState<string>(formatMontantInput(String(certif.prix ?? '')))
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idCompte) { toast.error('Choisissez un compte'); return }
    setLoading(true)
    try { await onConfirm(Number(idCompte), Number(parseMontantInput(prix))) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:420, background:'white', borderRadius:12, padding:'4px 24px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontWeight:700, fontSize:16 }}>Valider le certificat {certif.reference}</span>
          <button onClick={onClose} className="btn-icon"><IcoClose /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Compte encaissement</label>
            <select className="form-control" value={idCompte} onChange={e => setIdCompte(e.target.value)} required>
              <option value="">-- Choisir un compte --</option>
              {comptes.map((c: Compte) => <option key={c.id_compte} value={c.id_compte}>{c.libelle}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Prix (Ar)</label>
            <input className="form-control" type="text" inputMode="numeric" value={prix} onChange={e => setPrix(formatMontantInput(e.target.value))} required placeholder="Ex: 25 000" />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width:'100%', marginTop:8 }} disabled={loading}>
            {loading ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Validation…</> : 'Confirmer la validation'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function CertificationPage() {
  const { hasPermission, isAdmin } = useAuth()
  const canValider = hasPermission('certifications.valider')
  const admin = isAdmin()

  // FIX : onglet "Modifier prix" — reproduit Formation/certification.php
  // (Prix-certification, réservé à $_SESSION['is_admin']) + components/table_prix_certificat.php
  const [prixActuel, setPrixActuel]         = useState<number>(0)
  const [prixHistorique, setPrixHistorique] = useState<PrixHistorique[]>([])
  const [newPrix, setNewPrix]               = useState<string>('')
  const [loadingPrix, setLoadingPrix]       = useState(false)
  const [savingPrix, setSavingPrix]         = useState(false)
  // FIX (point 2) : suppression d'une ligne de l'historique des prix.
  const [confirmDeletePrixId, setConfirmDeletePrixId] = useState<number | null>(null)

  const chargerPrix = async () => {
    setLoadingPrix(true)
    try {
      const [cur, hist] = await Promise.all([
        api.get('/certifications/prix'),
        api.get('/certifications/prix/historique'),
      ])
      setPrixActuel(cur.data.prix ?? 0)
      setNewPrix(formatMontantInput(String(cur.data.prix ?? '')))
      setPrixHistorique(hist.data ?? [])
    } catch {
      toast.error('Erreur de chargement du prix')
    } finally {
      setLoadingPrix(false)
    }
  }

  const handleSetPrix = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPrix === '') return
    setSavingPrix(true)
    try {
      await api.post('/certifications/prix', { prix: Number(parseMontantInput(newPrix)) })
      toast.success('Prix mis à jour avec succès.')
      chargerPrix()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur')
    } finally {
      setSavingPrix(false)
    }
  }

  const handleDeletePrixHistorique = async () => {
    if (!confirmDeletePrixId) return
    try {
      await api.delete(`/certifications/prix/historique/${confirmDeletePrixId}`)
      toast.success('Entrée supprimée')
      chargerPrix()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression')
    } finally {
      setConfirmDeletePrixId(null)
    }
  }

  const [tab, setTab]       = useState<SubTab>('certification')
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  // FIX (point 11) : modification d'une certification — le backend expose
  // maintenant PUT /certifications/{reference} (CertificationController::update).
  const [editing, setEditing] = useState<Certification | null>(null)

  const [etudiantInfo, setEtudiantInfo] = useState<{nom:string, prenom:string} | null>(null)
  const [checkingMatricule, setCheckingMatricule] = useState(false)

  // FIX : autocomplétion Matricule — en plus de la vérification "étudiant
  // trouvé/non trouvé" déjà existante (gardée telle quelle, toujours utile),
  // on propose maintenant des suggestions pendant la frappe.
  const matriculeSuggestions = useMatriculeSuggestions(form.matricule)

  const checkMatricule = async (matricule: string) => {
    if (matricule.length < 5) { setEtudiantInfo(null); return }
    setCheckingMatricule(true)
    try {
      const r = await api.get(`/etudiants/${matricule}`)
      setEtudiantInfo({ nom: r.data.nom_etudiant, prenom: r.data.prenom_etudiant })
    } catch {
      setEtudiantInfo(null)
    } finally {
      setCheckingMatricule(false)
    }
  }

  const [printCertif, setPrintCertif] = useState<Certification | null>(null)
  const [validerCertif, setValiderCertif] = useState<Certification | null>(null)
  const [comptes, setComptes] = useState<Compte[]>([])

  useEffect(() => {
    if (canValider) {
      api.get('/certifications/comptes')
        .then((r: { data: Compte[] }) => setComptes(r.data))
        .catch(() => setComptes([]))
    }
  }, [canValider])

  useEffect(() => {
    if (admin) chargerPrix()
  }, [admin])

  // FIX : remplace le chargement forcé de 200 modules d'un coup par une
  // vraie autocomplétion — cohérent avec SessionForm/EtatPage, et
  // pérenne si le nombre de modules dépasse un jour 200.
  const [moduleQuery, setModuleQuery] = useState('')
  const moduleSuggestions = useModuleSuggestions(moduleQuery)

  // FIX : nouveau champ Session — le backend acceptait déjà code_session en
  // option (pré-remplit debut_session/fin_session côté serveur si fourni),
  // mais aucun champ ne permettait de le renseigner dans le formulaire.
  const [sessionQuery, setSessionQuery] = useState('')
  const sessionSuggestions = useSessionSuggestions(sessionQuery, false)

  const certifTable = useTable<Certification>('/certifications', { perPage: 15 })

  const [dateDebut, setDateDebut]   = useState(today)
  const [dateFin,   setDateFin]     = useState(today)
  const [montantData, setMontantData] = useState<{ nb: number; montant: number } | null>(null)
  const [loadingMontant, setLoadingMontant] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const resetFormAux = () => { setModuleQuery(''); setSessionQuery(''); setEtudiantInfo(null) }

  const resetForm = () => { setForm(EMPTY); resetFormAux(); setEditing(null) }

  // FIX (point 11) : pré-remplit le formulaire à partir d'une ligne du
  // tableau — on ne peut pas connaître le code_module tapé à l'origine
  // dans l'autocomplétion (l'API ne renvoie que module_nom), donc on
  // pré-remplit la recherche avec le nom déjà connu ; si le gestionnaire
  // ne retouche pas ce champ, code_module reste celui déjà enregistré
  // côté serveur (update() ne l'écrase que si une nouvelle valeur est
  // envoyée — voir CertificationController::update).
  const handleEdit = (c: Certification) => {
    setEditing(c)
    setForm({
      matricule: c.matricule,
      code_module: c.code_module || '',
      date_debut: c.debut_session?.slice(0, 10) || '',
      date_fin: c.fin_session?.slice(0, 10) || '',
      nom_formation_certificat: c.nom_formation || '',
      lieu_paiement: c.lieu_paiement || 'Ampandrana',
      code_session: c.code_session || '',
      prix: formatMontantInput(String(c.prix ?? '')),
    })
    // FIX : si la jointure module échoue (code_module ne correspond plus à
    // aucun module existant — référence orpheline, voir explication), on
    // affiche au moins le code brut au lieu de laisser le champ vide.
    setModuleQuery(c.module_nom || c.code_module || '')
    setSessionQuery(c.code_session || '')
    checkMatricule(c.matricule)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleGenerer = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      // FIX : le champ Prix certificat est saisi formaté ("25 000") pour
      // l'affichage — on renvoie la valeur numérique brute à l'API.
      const payload = { ...form, prix: parseMontantInput(form.prix) }
      if (editing) {
        await api.put(`/certifications/${editing.reference}`, payload)
        toast.success('Certificat mis à jour')
      } else {
        await api.post('/certifications', payload)
        toast.success('Certificat généré')
      }
      resetForm()
      certifTable.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur') }
    finally { setSaving(false) }
  }

  // FIX : window.confirm() → ConfirmDialog (cohérent avec le reste de l'appli)
  const [confirmDeleteRef, setConfirmDeleteRef] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!confirmDeleteRef) return
    try { await api.delete(`/certifications/${confirmDeleteRef}`); toast.success('Supprimé'); certifTable.reload() }
    catch { toast.error('Erreur suppression') }
    finally { setConfirmDeleteRef(null) }
  }

  const handleConfirmValidation = async (idCompte: number, prix: number) => {
    if (!validerCertif) return
    try {
      await api.post(`/certifications/${validerCertif.reference}/valider`, { id_compte: idCompte, prix })
      toast.success('Certificat validé avec succès')
      setValiderCertif(null)
      certifTable.reload()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la validation')
    }
  }

  const handleVoirMontant = async () => {
    setLoadingMontant(true)
    try {
      const r = await api.get('/certifications/montant', { params: { date_debut: dateDebut, date_fin: dateFin } })
      setMontantData(r.data)
    } catch { setMontantData({ nb:0, montant:0 }) }
    finally { setLoadingMontant(false) }
  }

  const fmt = (n: number) => Number(n).toLocaleString('fr')
  const fmtDate = (d: string) => { if (!d) return '—'; const dt = new Date(d); return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' }) }

  return (
    <div className="app-layout">
      <Sidebar section="formation" />
      <div className="main-content">
        <div className="top-bar">
          <span className="top-bar-title" style={{ display:'flex', alignItems:'center', gap:8 }}><IcoCertif /> Certification</span>
        </div>
        <div style={{ padding:24, marginTop: -20 }}>
          <div className="tabs">
            {([
              ['certification','Certification'],
              ...(admin ? [['prix','Modifier prix']] as [SubTab,string][] : []),
              ['montant','Montant perçu'],
            ] as [SubTab,string][]).map(([t,l]) => (
              <button key={t} className={`tab-btn${tab===t?' active':''}`} onClick={() => setTab(t)}>{l}</button>
            ))}
          </div>

          {tab === 'certification' && (<>
            <div className="card" style={{ marginBottom:20 }}>
              <div className="card-header">
                <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>
                  {editing ? <IcoEdit /> : <IcoAward />} {editing ? 'Modifier le certificat' : 'Générer un certificat'}
                </span>
                {editing && <button type="button" className="btn btn-sm" onClick={resetForm} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoClose /> Annuler</button>}
              </div>
              <div className="card-body">
                {editing && editing.accept === 1 && (
                  <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:7, padding:'8px 12px', fontSize:12.5, color:'#92400e', marginBottom:14 }}>
                    Ce certificat est déjà validé. Si vous changez le prix, la transaction et le solde du compte déjà enregistrés seront automatiquement ajustés.
                  </div>
                )}
                <form onSubmit={handleGenerer}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Matricule *</label>
                      <input
                        className="form-control"
                        list="certif-matricule-suggestions"
                        value={form.matricule}
                        onChange={e => {
                          const val = e.target.value.toUpperCase()
                          setForm(p => ({ ...p, matricule: val }))
                          checkMatricule(val)
                        }}
                        style={form.matricule && !isValidMatriculeNI(form.matricule) ? invalidFieldStyle : undefined}
                        required={!editing}
                        placeholder="Ex: NI-3757"
                      />
                      <datalist id="certif-matricule-suggestions">
                        {matriculeSuggestions.map(s => (
                          <option key={s.matricule} value={s.matricule}>{s.nom} {s.prenom}</option>
                        ))}
                      </datalist>
                      {checkingMatricule && (
                        <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>
                          Vérification...
                        </div>
                      )}
                      {!checkingMatricule && etudiantInfo && (
                        <div style={{ fontSize:13, color:'#16a34a', marginTop:4, fontWeight:600 }}>
                          ✓ {etudiantInfo.nom} {etudiantInfo.prenom}
                        </div>
                      )}
                      {!checkingMatricule && !etudiantInfo && form.matricule.length >= 5 && (
                        <div style={{ fontSize:13, color:'#dc2626', marginTop:4 }}>
                          ✗ Étudiant non trouvé — créez d'abord la fiche étudiant
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Module *</label>
                      {/* FIX : autocomplétion au lieu du select à 200 lignes */}
                      <input
                        className="form-control"
                        list="certif-module-suggestions"
                        value={moduleQuery}
                        onChange={e => {
                          const v = e.target.value
                          setModuleQuery(v)
                          const match = moduleSuggestions.find(m => m.nom === v)
                          setForm(p => ({ ...p, code_module: match ? match.code_module : '' }))
                        }}
                        required={!editing} placeholder="Tapez pour rechercher un module…" />
                      <datalist id="certif-module-suggestions">
                        {moduleSuggestions.map(m => (
                          <option key={m.code_module} value={m.nom}>{m.code_module}</option>
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Session liée (optionnel)</label>
                      {/* FIX : nouveau champ — le backend acceptait déjà
                          code_session (pré-remplit les dates ci-dessous si
                          laissées vides), mais aucun champ n'existait pour
                          le renseigner. */}
                      <input
                        className="form-control"
                        list="certif-session-suggestions"
                        value={sessionQuery}
                        onChange={e => {
                          const v = e.target.value
                          setSessionQuery(v)
                          const match = sessionSuggestions.find(s => s.code_session === v)
                          setForm(p => ({ ...p, code_session: match ? v : '' }))
                        }}
                        placeholder="Tapez pour rechercher une session…" />
                      <datalist id="certif-session-suggestions">
                        {sessionSuggestions.map(s => (
                          <option key={s.code_session} value={s.code_session}>{s.module_nom}</option>
                        ))}
                      </datalist>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Lieu de paiement</label>
                      <select className="form-control" value={form.lieu_paiement} onChange={set('lieu_paiement')}>
                        <option>Ampandrana</option><option>Ampefiloha</option><option>Andravoahangy</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Nom affiché sur le certificat</label>
                      <input className="form-control" value={form.nom_formation_certificat} onChange={set('nom_formation_certificat')} placeholder="Ex: Excel Avancé" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Prix certificat (Ar)</label>
                      {/* FIX (point 2) : formatage dynamique avec séparateur de milliers */}
                      <input className="form-control" type="text" inputMode="numeric" value={form.prix}
                        onChange={e => setForm(p => ({ ...p, prix: formatMontantInput(e.target.value) }))}
                        placeholder="Ex: 25 000" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Début session</label>
                      <input className="form-control" type="date" value={form.date_debut} onChange={set('date_debut')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Fin session</label>
                      <input className="form-control" type="date" value={form.date_fin} onChange={set('date_fin')} />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:7 }} disabled={saving}>
                    {saving ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> {editing ? 'Mise à jour…' : 'Génération…'}</> : editing ? <><IcoSave /> Mettre à jour</> : <><IcoCertif /> Générer le certificat</>}
                  </button>
                </form>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="section-info">
                  <div className="section-title">Liste des certifications</div>
                  <div className="section-count">{certifTable.meta.total} certificat(s)</div>
                </div>
                <div className="search-bar">
                  <IcoSearch />
                  <input placeholder="Rechercher (matricule, nom, réf)..." value={certifTable.search} onChange={e => certifTable.setSearch(e.target.value)} />
                  {certifTable.search && <button onClick={() => certifTable.setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0, fontSize:16 }}>×</button>}
                </div>
              </div>
              <div className="table-wrapper">
                {certifTable.loading ? <div className="loading-center"><div className="spinner" /> Chargement…</div> : (
                  <table>
                    <thead><tr><th>#</th><th>Référence</th><th>Étudiant</th><th>Formation</th><th>Début</th><th>Fin</th><th>Prix</th><th>Statut</th><th>Action</th></tr></thead>
                    <tbody>
                      {certifTable.data.length === 0
                        ? <tr><td colSpan={9}><div className="empty-state">Aucune certification trouvée</div></td></tr>
                        : certifTable.data.map((c: Certification, idx: number) => (
                          <tr key={c.reference}>
                            <td style={{ color:'#94a3b8', fontSize:12 }}>{(certifTable.meta.current_page-1)*certifTable.meta.per_page+idx+1}</td>
                            <td style={{ fontWeight:600, color:'#2563eb', fontSize:12 }}>{c.reference}</td>
                            <td>
                              <div style={{ fontWeight:600 }}>{c.nom_complet?.trim() || `${c.nom || ''} ${c.prenom || ''}`.trim() || '—'}</div>
                              <div style={{ fontSize:11, color:'#94a3b8' }}>{c.matricule}</div>
                            </td>
                            <td><span className="badge badge-warning">{c.module_nom}</span></td>
                            <td style={{ fontSize:12 }}>{fmtDate(c.debut_session)}</td>
                            <td style={{ fontSize:12 }}>{fmtDate(c.fin_session)}</td>
                            <td style={{ fontWeight:600, color:'#16a34a', fontSize:12 }}>{c.prix ? fmt(c.prix)+' Ar' : '—'}</td>
                            <td>
                              {c.accept === 1
                                ? <span className="badge badge-success">Validé</span>
                                : <span className="badge badge-warning">En attente</span>
                              }
                            </td>
                            <td><div className="table-actions">
                              {canValider && c.accept === 0 && (
                                <button className="btn-icon" style={{ color: '#16a34a' }} onClick={() => setValiderCertif(c)} title="Valider">
                                  <IcoAward />
                                </button>
                              )}
                              {/* FIX (point 11) : bouton de modification — corriger une
                                  erreur de saisie sans créer de doublon. Disponible même
                                  sur un certificat déjà validé : si le prix change, le
                                  backend répercute automatiquement la différence sur la
                                  transaction et le solde du compte déjà enregistrés. */}
                              <button className="btn-icon edit" onClick={() => handleEdit(c)} title="Modifier"><IcoEdit /></button>
                              <button className="btn-icon" style={{ color:'#16a34a' }} onClick={() => setPrintCertif(c)} title="Imprimer"><IcoPrint /></button>
                              <button className="btn-icon delete" onClick={() => setConfirmDeleteRef(c.reference)} title="Supprimer"><IcoTrash /></button>
                            </div></td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                )}
              </div>
              {!certifTable.loading && certifTable.meta.total > 0 && (
                <Pagination meta={certifTable.meta} onPage={certifTable.setPage} onPerPage={certifTable.setPerPage} />
              )}
            </div>
          </>)}

          {tab === 'prix' && admin && (
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
                        {/* FIX (point 2) : formatage dynamique avec séparateur de milliers */}
                        <input className="form-control" type="text" inputMode="numeric" value={newPrix} onChange={e => setNewPrix(formatMontantInput(e.target.value))} required placeholder="Ex: 25 000" />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-success" disabled={savingPrix}>
                      {savingPrix ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Modification…</> : 'Modifier'}
                    </button>
                  </form>
                  {!loadingPrix && (
                    <div style={{ fontSize:12, color:'#94a3b8', marginTop:10 }}>
                      Prix actuellement appliqué par défaut aux nouvelles certifications : <b>{fmt(prixActuel)} Ar</b>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Historique de modification</span>
                </div>
                <div className="table-wrapper">
                  {loadingPrix ? <div className="loading-center"><div className="spinner" /> Chargement…</div> : (
                    <table>
                      {/* FIX (point 2) : colonne Action + bouton de suppression
                          ajoutés — le tableau n'avait aucun moyen de retirer
                          une entrée erronée de l'historique. */}
                      <thead><tr><th>Prix</th><th>Date de modification</th><th>Action</th></tr></thead>
                      <tbody>
                        {prixHistorique.length === 0
                          ? <tr><td colSpan={3}><div className="empty-state">Aucun historique</div></td></tr>
                          : prixHistorique.map(p => (
                            <tr key={p.id_prix_certificat}>
                              <td>{fmt(p.prix)} Ar</td>
                              <td>{fmtDate(p.date_modification)}</td>
                              <td><div className="table-actions">
                                <button className="btn-icon delete" onClick={() => setConfirmDeletePrixId(p.id_prix_certificat)} title="Supprimer"><IcoTrash /></button>
                              </div></td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'montant' && (
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}><IcoMoney /> Montant perçu — Certifications</span>
              </div>
              <div className="card-body">
                <div style={{ display:'flex', alignItems:'flex-end', gap:12, flexWrap:'wrap', marginBottom:24 }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Date début</label>
                    <input className="form-control" type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Date fin</label>
                    <input className="form-control" type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />
                  </div>
                  <button className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }} onClick={handleVoirMontant} disabled={loadingMontant}>
                    {loadingMontant ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Chargement…</> : <><IcoSearch /> Voir</>}
                  </button>
                </div>
                {montantData ? (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                    <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:24, textAlign:'center' }}>
                      <div style={{ width:48, height:48, borderRadius:'50%', background:'#dcfce7', color:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}><IcoAward /></div>
                      <p style={{ fontSize:12, color:'#64748b', marginBottom:6 }}>Certificats délivrés</p>
                      <p style={{ fontSize:40, fontWeight:800, color:'#16a34a', lineHeight:1 }}>{montantData.nb}</p>
                    </div>
                    <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:12, padding:24, textAlign:'center' }}>
                      <div style={{ width:48, height:48, borderRadius:'50%', background:'#dbeafe', color:'#2563eb', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}><IcoMoney /></div>
                      <p style={{ fontSize:12, color:'#64748b', marginBottom:6 }}>Montant total perçu</p>
                      <p style={{ fontSize:32, fontWeight:800, color:'#2563eb', lineHeight:1 }}>{fmt(montantData.montant)} Ar</p>
                    </div>
                  </div>
                ) : <div className="empty-state">Sélectionnez une période et cliquez sur <b>Voir</b></div>}
              </div>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!confirmDeleteRef}
        title="Supprimer ce certificat ?"
        message={confirmDeleteRef ? `Le certificat « ${confirmDeleteRef} » sera définitivement supprimé. Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteRef(null)}
      />
      <ConfirmDialog
        open={!!confirmDeletePrixId}
        title="Supprimer cette entrée de l'historique ?"
        message="Cette entrée sera définitivement supprimée de l'historique des prix. Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={handleDeletePrixHistorique}
        onCancel={() => setConfirmDeletePrixId(null)}
      />
      {printCertif && <CertificatView certif={printCertif} onClose={() => setPrintCertif(null)} />}
      {validerCertif && (
        <ValiderModal
          certif={validerCertif}
          comptes={comptes}
          onClose={() => setValiderCertif(null)}
          onConfirm={handleConfirmValidation}
        />
      )}
    </div>
  )
}