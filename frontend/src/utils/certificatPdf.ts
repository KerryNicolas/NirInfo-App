import { jsPDF } from 'jspdf'
import AttestationUrl from '../assets/attestation.png'
import TamponUrl from '../assets/tampon.png'
import SignatureUrl from '../assets/signature.png'

// FIX : génération d'un vrai PDF avec jsPDF, au lieu de s'appuyer sur
// window.print() + une règle CSS @media print { @page {...} }. C'est ça
// qui causait le bug de format (le certificat sortait en A5 au lieu de
// A4 paysage) : la règle @page est globale à toute l'impression du
// navigateur, donc si la page Facture (qui force @page A5 portrait) est
// restée montée/active en même temps que le Certificat (qui forçait @page
// A4 paysage), les deux règles entraient en conflit et l'une écrasait
// l'autre. Un vrai PDF généré par jsPDF a ses propres dimensions et n'est
// plus concerné par le CSS d'impression de la page.

// ─────────────────────────────────────────────────────────────────────────
// FIX (lenteur, toujours ~20s même avec le cache précédent) : la vraie
// cause n'était pas le chargement des images mais leur TAILLE. jsPDF doit
// redécoder/réencoder chaque pixel de chaque image à CHAQUE appel
// d'addImage() — donc à chaque génération de certificat, même si le
// fichier source est en cache. Si attestation.png est une image haute
// résolution (ce qui est courant pour un visuel pensé pour l'impression),
// c'est ce retraitement qui prenait ~20s, encore et encore.
//
// Solution : redimensionner ET recompresser chaque image UNE seule fois
// (mise en cache du résultat déjà optimisé, pas du fichier brut), et
// passer le fond en JPEG — bien plus rapide à intégrer pour jsPDF qu'un
// PNG (pas de canal alpha à traiter pixel par pixel). Le tampon et la
// signature restent en PNG (ils ont besoin de la transparence pour se
// superposer au fond) mais sont redimensionnés à une taille raisonnable.
// ─────────────────────────────────────────────────────────────────────────
interface OptimizeOpts { maxWidthPx?: number; format?: 'image/jpeg' | 'image/png'; quality?: number }

const optimizedImageCache = new Map<string, Promise<string>>()

function loadOptimizedImage(url: string, opts: OptimizeOpts = {}): Promise<string> {
  const { maxWidthPx = 1600, format = 'image/jpeg', quality = 0.85 } = opts
  const cacheKey = `${url}|${maxWidthPx}|${format}|${quality}`

  if (!optimizedImageCache.has(cacheKey)) {
    optimizedImageCache.set(cacheKey, new Promise<string>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const scale = Math.min(1, maxWidthPx / img.naturalWidth)
        const w = Math.max(1, Math.round(img.naturalWidth * scale))
        const h = Math.max(1, Math.round(img.naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas non supporté')); return }
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL(format, quality))
      }
      img.onerror = () => reject(new Error(`Impossible de charger l'image : ${url}`))
      img.src = url
    }).catch(err => {
      optimizedImageCache.delete(cacheKey)
      throw err
    }))
  }
  return optimizedImageCache.get(cacheKey)!
}

// Précharge et optimise les 3 images dès l'ouverture de la page
// Certification (import du module) plutôt qu'au premier clic — le tout
// premier certificat généré est donc déjà rapide, pas seulement les suivants.
void Promise.all([
  loadOptimizedImage(AttestationUrl, { maxWidthPx: 1600, format: 'image/jpeg', quality: 0.85 }),
  loadOptimizedImage(TamponUrl,      { maxWidthPx: 500,  format: 'image/png' }),
  loadOptimizedImage(SignatureUrl,   { maxWidthPx: 250,  format: 'image/png' }),
]).catch(() => { /* silencieux — se rechargera normalement au moment du print si besoin */ })

const fmtDateLongFR = (d: string) => {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export interface CertificatPdfData {
  nom_complet?: string; nom?: string; prenom?: string
  date_naissance?: string; lieu_naissance?: string
  nom_formation?: string; module_nom?: string
  debut_session: string; fin_session: string
  reference: string
}

// FIX : toutes les positions sont désormais exprimées en % de la largeur/
// hauteur de page (exactement les mêmes % que l'aperçu écran dans
// CertificatView, CertificationTab.tsx) au lieu de millimètres fixes.
// Avantage concret : pour passer le certificat en A5 au lieu de A4, il
// suffit de changer PAGE_FORMAT ci-dessous — toutes les positions et les
// tailles de police se recalculent automatiquement à l'échelle, sans
// avoir à retoucher une seule coordonnée. (A4 paysage = 297×210mm ;
// A5 paysage = 210×148mm, soit un format 70,7% plus petit — même
// proportion, donc rien ne se déforme.)
const PAGE_FORMAT: 'a4' | 'a5' = 'a5'

export async function generateCertificatPdf(certif: CertificatPdfData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: PAGE_FORMAT })
  const PAGE_W = doc.internal.pageSize.getWidth()
  const PAGE_H = doc.internal.pageSize.getHeight()
  // Échelle par rapport au format A4 (297mm) sur lequel les tailles de
  // police ci-dessous (17, 10, 24pt...) ont été calées à l'origine.
  const SCALE = PAGE_W / 297
  const pt = (size: number) => size * SCALE
  const x = (pct: number) => (pct / 100) * PAGE_W
  const y = (pct: number) => (pct / 100) * PAGE_H

  const [attestation, tampon, signature] = await Promise.all([
    loadOptimizedImage(AttestationUrl, { maxWidthPx: 1600, format: 'image/jpeg', quality: 0.85 }),
    loadOptimizedImage(TamponUrl,      { maxWidthPx: 500,  format: 'image/png' }),
    loadOptimizedImage(SignatureUrl,   { maxWidthPx: 250,  format: 'image/png' }),
  ])

  // Fond
  doc.addImage(attestation, 'JPEG', 0, 0, PAGE_W, PAGE_H)

  const nomComplet = certif.nom_complet?.trim() || `${certif.nom || ''} ${certif.prenom || ''}`.trim()

  // Nom & prénoms — emplacement inchangé (top 46.2%)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(pt(17))
  doc.setTextColor(30, 41, 59)
  doc.text(nomComplet || '—', PAGE_W / 2, y(49), { align: 'center' })

  // FIX : ligne manquante — "Né(e) le ... à ...", casée dans l'espace
  // déjà libre entre le nom et la session, sans déplacer aucun élément.
  if (certif.date_naissance) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(pt(10))
    doc.setTextColor(51, 65, 85)
    const naissanceTxt = certif.lieu_naissance
      ? `Né(e) le ${fmtDateLongFR(certif.date_naissance)} à ${certif.lieu_naissance}`
      : `Né(e) le ${fmtDateLongFR(certif.date_naissance)}`
    doc.text(naissanceTxt, PAGE_W / 2, y(52.4), { align: 'center' })
  }

  // Session — emplacement inchangé (top 54%)
  const fmtDebut = fmtDateLongFR(certif.debut_session)
  const fmtFin = fmtDateLongFR(certif.fin_session)
  const sessionTxt = fmtDebut === fmtFin
    ? `Séssion du ${fmtDebut}`
    : `Séssion du ${fmtDebut} au ${fmtFin}`
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(pt(10))
  doc.setTextColor(0, 0, 0)
  doc.text(sessionTxt, PAGE_W / 2, y(56.2), { align: 'center' })

  // Formation — emplacement inchangé (top 62.4%)
  const formation = (certif.nom_formation || certif.module_nom || '—').toUpperCase()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(pt(24))
  doc.setTextColor(38, 81, 134)
  const formationLines = doc.splitTextToSize(formation, PAGE_W * 0.933)
  const formationLineHeight = y(5.7) // ≈ 12mm sur A4 (297×210)
  formationLines.forEach((line: string, i: number) => {
    doc.text(line, PAGE_W / 2, y(66.2) + i * formationLineHeight, { align: 'center' })
  })

  // Tampon — emplacement inchangé (top 82.4%, left 74%, width 23.4%)
  doc.addImage(tampon, 'PNG', x(74), y(82.4), x(23.4), y(14.4))

  // Signature — emplacement inchangé (top 85%, left 84.2%, width 4.4%)
  doc.addImage(signature, 'PNG', x(84.2), y(85), x(4.4), y(9.1))

  // Nom du directeur (texte) — emplacement inchangé (top 87%, left 74.75%, width 21.9%)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(pt(10))
  doc.setTextColor(30, 41, 59)
  doc.text('MIHARISOA Maminirina', x(74.75) + x(21.9) / 2, y(90.5), { align: 'center' })

  // Référence — emplacement inchangé (top 89.05%, left 49.8%)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(pt(10))
  doc.setTextColor(51, 65, 85)
  doc.text(certif.reference || '', x(50), y(92.3))

  return doc
}