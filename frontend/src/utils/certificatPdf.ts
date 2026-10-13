import type { jsPDF } from 'jspdf'
import AttestationUrl from '../assets/attestation.png'
// Tampon et signature : copies réduites (500 px de large), suffisantes pour
// l'aperçu et pour le PDF, qui les ramène de toute façon à 500 et 250 px.
// Les originaux (tampon.png, signature.png) restent dans assets/.
import TamponUrl from '../assets/tampon-web.png'
import SignatureUrl from '../assets/signature-web.png'

// Génération d'un vrai PDF avec jsPDF (et non window.print() + @page CSS) :
// le PDF a ses propres dimensions et n'est pas concerné par le CSS
// d'impression des autres pages (Facture en A5 portrait, etc.).

// ─────────────────────────────────────────────────────────────────────────
// Images : redimensionnées et recompressées UNE seule fois, puis mises en
// cache (le fond en JPEG, tampon et signature en PNG pour la transparence).
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

// Préchargement dès l'import du module : le premier certificat est déjà rapide.
void Promise.all([
  loadOptimizedImage(AttestationUrl, { maxWidthPx: 1600, format: 'image/jpeg', quality: 0.85 }),
  loadOptimizedImage(TamponUrl,      { maxWidthPx: 500,  format: 'image/png' }),
  loadOptimizedImage(SignatureUrl,   { maxWidthPx: 250,  format: 'image/png' }),
]).catch(() => { /* silencieux — rechargé au moment de la génération si besoin */ })

// FIX : exportée pour que l'aperçu écran utilise EXACTEMENT le même format
// de date que le PDF (avant : « 09 février » à l'écran, « 9 février » au PDF).
export const fmtDateLongFR = (d: string) => {
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

// FIX : A4 paysage (297×210 mm). En 'a5', le PDF faisait 210 mm de large,
// soit la largeur d'un A4 portrait : le navigateur le posait donc en haut
// d'une feuille A4 portrait, d'où le certificat sur une demi-page.
const PAGE_FORMAT: 'a4' | 'a5' = 'a4'

// ─────────────────────────────────────────────────────────────────────────
// FIX : SOURCE UNIQUE de la mise en page, utilisée par le PDF ET par
// l'aperçu écran (CertificatView). Avant, chacun avait ses propres
// coordonnées, donc l'aperçu ne correspondait pas à l'impression.
//
//  - x, y, w, cx, maxW, lineH : en % de la page (x/w/cx/maxW → largeur,
//    y/lineH → hauteur). Pour un texte, y est la LIGNE DE BASE.
//  - size : taille de police en points, calée sur A4.
//
// Pour déplacer un élément, il suffit de changer sa valeur ici.
// ─────────────────────────────────────────────────────────────────────────
export const CERT_LAYOUT = {
  nom:       { y: 49,   size: 17, maxW: 42 },            // maxW = longueur du trait sous le nom
  naissance: { y: 52.4, size: 10 },
  session:   { y: 56.2, size: 10 },
  formation: { y: 66.2, size: 24, maxW: 93.3, lineH: 5.7 },
  reference: { x: 50,   y: 92.3, size: 10 },
  // Bloc directeur : le tampon garde son emplacement d'origine, mais il
  // est éclairci (opacity) et dessiné EN PREMIER ; la signature et le nom
  // du directeur passent par-dessus, le nom avec un liseré clair (halo)
  // pour rester bien lisibles. opacity : 1 = tampon plein, 0.4 = très pâle.
  tampon:    { x: 74,   y: 82.4, w: 23.4, opacity: 0.5 }, // hauteur calculée (proportions réelles)
  signature: { x: 84.2, y: 83.5, w: 4.4 },               // idem
  directeur: { cx: 87,  y: 93.5, size: 10 },             // cx = centre du trait de signature
} as const

export const NOM_DIRECTEUR = 'MIHARISOA Maminirina'

// Couleur du papier du certificat, utilisée pour le halo autour du nom du
// directeur (à ajuster si le fond d'attestation.png change de teinte).
export const HALO_RGB: [number, number, number] = [248, 247, 238]

export async function generateCertificatPdf(certif: CertificatPdfData): Promise<jsPDF> {
  // jsPDF n'est téléchargé qu'ici, à la première génération d'un certificat :
  // il ne pèse plus sur le chargement des autres pages.
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: PAGE_FORMAT })
  const PAGE_W = doc.internal.pageSize.getWidth()
  const PAGE_H = doc.internal.pageSize.getHeight()
  const SCALE = PAGE_W / 297 // les tailles de police sont calées sur A4
  const pt = (size: number) => size * SCALE
  const x = (pct: number) => (pct / 100) * PAGE_W
  const y = (pct: number) => (pct / 100) * PAGE_H
  const L = CERT_LAYOUT

  const [attestation, tampon, signature] = await Promise.all([
    loadOptimizedImage(AttestationUrl, { maxWidthPx: 1600, format: 'image/jpeg', quality: 0.85 }),
    loadOptimizedImage(TamponUrl,      { maxWidthPx: 500,  format: 'image/png' }),
    loadOptimizedImage(SignatureUrl,   { maxWidthPx: 250,  format: 'image/png' }),
  ])

  // Fond pleine page
  doc.addImage(attestation, 'JPEG', 0, 0, PAGE_W, PAGE_H)

  // Nom & prénoms
  const nomComplet = (certif.nom_complet?.trim() || `${certif.nom || ''} ${certif.prenom || ''}`.trim()) || '—'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(pt(L.nom.size))
  doc.setTextColor(30, 41, 59)
  // FIX : un nom très long est réduit pour ne jamais dépasser le trait.
  const nomW = doc.getTextWidth(nomComplet)
  const nomMax = x(L.nom.maxW)
  if (nomW > nomMax) doc.setFontSize(pt(L.nom.size) * (nomMax / nomW))
  doc.text(nomComplet, PAGE_W / 2, y(L.nom.y), { align: 'center' })

  // Né(e) le ... à ...
  if (certif.date_naissance) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(pt(L.naissance.size))
    doc.setTextColor(51, 65, 85)
    const naissanceTxt = certif.lieu_naissance
      ? `Né(e) le ${fmtDateLongFR(certif.date_naissance)} à ${certif.lieu_naissance}`
      : `Né(e) le ${fmtDateLongFR(certif.date_naissance)}`
    doc.text(naissanceTxt, PAGE_W / 2, y(L.naissance.y), { align: 'center' })
  }

  // Session (FIX orthographe : « Séssion » → « Session »)
  const fmtDebut = fmtDateLongFR(certif.debut_session)
  const fmtFin = fmtDateLongFR(certif.fin_session)
  const sessionTxt = fmtDebut === fmtFin
    ? `Session du ${fmtDebut}`
    : `Session du ${fmtDebut} au ${fmtFin}`
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(pt(L.session.size))
  doc.setTextColor(0, 0, 0)
  doc.text(sessionTxt, PAGE_W / 2, y(L.session.y), { align: 'center' })

  // Formation
  const formation = (certif.nom_formation || certif.module_nom || '—').toUpperCase()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(pt(L.formation.size))
  doc.setTextColor(38, 81, 134)
  const formationLines: string[] = doc.splitTextToSize(formation, x(L.formation.maxW))
  formationLines.forEach((line, i) => {
    doc.text(line, PAGE_W / 2, y(L.formation.y) + i * y(L.formation.lineH), { align: 'center' })
  })

  // Tampon et signature — FIX : la hauteur est calculée à partir des
  // proportions réelles de l'image (avant : hauteur forcée, image déformée).
  const tp = doc.getImageProperties(tampon)
  const tamponW = x(L.tampon.w)
  doc.saveGraphicsState()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc.setGState(new (doc as any).GState({ opacity: L.tampon.opacity }))
  doc.addImage(tampon, 'PNG', x(L.tampon.x), y(L.tampon.y), tamponW, tamponW * (tp.height / tp.width))
  doc.restoreGraphicsState()

  const sp = doc.getImageProperties(signature)
  const signatureW = x(L.signature.w)
  doc.addImage(signature, 'PNG', x(L.signature.x), y(L.signature.y), signatureW, signatureW * (sp.height / sp.width))

  // Nom du directeur — sous le trait, par-dessus le tampon. Il est tracé
  // deux fois : d'abord un contour épais couleur papier (halo) qui efface
  // le tampon juste autour des lettres, puis le texte lui-même.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(pt(L.directeur.size))
  doc.setDrawColor(...HALO_RGB)
  doc.setLineWidth(1.1 * SCALE)
  doc.setLineJoin('round')
  doc.text(NOM_DIRECTEUR, x(L.directeur.cx), y(L.directeur.y), { align: 'center', renderingMode: 'stroke' })
  doc.setTextColor(15, 23, 42)
  doc.text(NOM_DIRECTEUR, x(L.directeur.cx), y(L.directeur.y), { align: 'center', renderingMode: 'fill' })

  // Référence
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(pt(L.reference.size))
  doc.setTextColor(51, 65, 85)
  doc.text(certif.reference || '', x(L.reference.x), y(L.reference.y))

  return doc
}