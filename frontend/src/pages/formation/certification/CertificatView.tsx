import { useState } from 'react'
import toast from 'react-hot-toast'
import Attestation from '../../../assets/attestation.png'
import Tampon from '../../../assets/tampon.png'
import Signature from '../../../assets/signature.png'
import { generateCertificatPdf, CERT_LAYOUT, NOM_DIRECTEUR, HALO_RGB, fmtDateLongFR } from '../../../utils/certificatPdf'
import type { CertificatPdfData } from '../../../utils/certificatPdf'
import { IcoPrint, IcoSave, IcoClose } from '../../../components/icons'

// Aperçu + impression du certificat. Utilisé par le mode automatique ET
// par la saisie manuelle : il ne dépend que des données à afficher.

// Taille de police en points (calée sur A4) → % de la largeur du certificat.
const cqw = (ptSize: number) => (ptSize * (25.4 / 72) / 297) * 100

const HALO = `rgb(${HALO_RGB.join(',')})`
// Liseré couleur papier autour des lettres (même effet que le halo du PDF).
const HALO_SHADOW = [[-1,-1],[1,-1],[-1,1],[1,1],[0,-1],[0,1],[-1,0],[1,0]]
  .map(([dx, dy]) => `${dx * 0.14}cqw ${dy * 0.14}cqw 0 ${HALO}`).join(', ')

// Texte positionné par sa LIGNE DE BASE, comme doc.text() dans jsPDF.
function CertText({ y, size, color, bold, halo, left = 0, width = 100, align = 'center', lineH, upper, children }: {
  y: number; size: number; color: string; bold?: boolean; halo?: boolean
  left?: number; width?: number; align?: 'center' | 'left'
  lineH?: number; upper?: boolean; children: React.ReactNode
}) {
  const f = cqw(size)
  const lh = lineH ? lineH * 210 / 297 : f
  return (
    <div style={{
      position:'absolute', left:`${left}%`, width:`${width}%`,
      top:`calc(${y}% - ${(lh / 2 + 0.3465 * f).toFixed(3)}cqw)`,
      fontFamily:'Arial, Helvetica, sans-serif', fontSize:`${f}cqw`, lineHeight:`${lh}cqw`,
      fontWeight: bold ? 700 : 400, color, textAlign: align,
      whiteSpace: lineH ? 'normal' : 'nowrap',
      textTransform: upper ? 'uppercase' : undefined,
      textShadow: halo ? HALO_SHADOW : undefined,
    }}>{children}</div>
  )
}

export default function CertificatView({ certif, onClose }: { certif: CertificatPdfData; onClose: () => void }) {
  const [generating, setGenerating] = useState(false)
  const L = CERT_LAYOUT

  // Impression via un vrai PDF (jsPDF) chargé dans un <iframe> caché.
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
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
          } catch {
            window.open(blobUrl, '_blank')
          }
        }, 300)
      }
      iframe.src = blobUrl
      setTimeout(cleanup, 60000)
    } catch {
      toast.error("Erreur lors de la génération du PDF du certificat")
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async () => {
    setGenerating(true)
    try {
      const doc = await generateCertificatPdf(certif)
      doc.save(`${certif.reference || 'certificat'}.pdf`)
    } catch {
      toast.error("Erreur lors de la génération du PDF du certificat")
    } finally {
      setGenerating(false)
    }
  }

  const nomComplet = certif.nom_complet?.trim() || `${certif.nom || ''} ${certif.prenom || ''}`.trim() || '—'
  const debut = fmtDateLongFR(certif.debut_session)
  const fin = fmtDateLongFR(certif.fin_session)

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ position:'absolute', top:20, right:20, display:'flex', gap:10, zIndex:201 }} className="no-print">
        <button onClick={handlePrint} disabled={generating} className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}>
          {generating ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Génération…</> : <><IcoPrint /> Imprimer</>}
        </button>
        <button onClick={handleDownload} disabled={generating} className="btn btn-secondary" style={{ display:'flex', alignItems:'center', gap:6 }}><IcoSave /> Télécharger PDF</button>
        <button onClick={onClose} className="btn btn-secondary" style={{ display:'flex', alignItems:'center', gap:6 }}><IcoClose /> Fermer</button>
      </div>

      <div id="certificat-print" style={{
        width:'min(900px, 100%, calc((100vh - 48px) * 297 / 210))',
        aspectRatio:'297 / 210', position:'relative', containerType:'inline-size', overflow:'hidden',
      }}>
        <img src={Attestation} alt="Certificat Nir'Info" style={{ width:'100%', height:'100%', display:'block' }} />

        <CertText y={L.nom.y} size={L.nom.size} color="#1e293b">{nomComplet}</CertText>

        {certif.date_naissance && (
          <CertText y={L.naissance.y} size={L.naissance.size} color="#334155">
            Né(e) le {fmtDateLongFR(certif.date_naissance)}{certif.lieu_naissance ? ` à ${certif.lieu_naissance}` : ''}
          </CertText>
        )}

        <CertText y={L.session.y} size={L.session.size} color="#000">
          Session du {debut}{debut !== fin ? ` au ${fin}` : ''}
        </CertText>

        <CertText y={L.formation.y} size={L.formation.size} color="#265186" bold upper
          left={(100 - L.formation.maxW) / 2} width={L.formation.maxW} lineH={L.formation.lineH}>
          {certif.nom_formation || certif.module_nom || '—'}
        </CertText>

        <img src={Tampon} alt="Tampon officiel" style={{ position:'absolute', top:`${L.tampon.y}%`, left:`${L.tampon.x}%`, width:`${L.tampon.w}%`, opacity: L.tampon.opacity, mixBlendMode:'multiply' }} />

        <img src={Signature} alt="Signature du directeur" style={{ position:'absolute', top:`${L.signature.y}%`, left:`${L.signature.x}%`, width:`${L.signature.w}%`, mixBlendMode:'multiply' }} />

        <CertText y={L.directeur.y} size={L.directeur.size} color="#0f172a" bold halo left={L.directeur.cx - 15} width={30}>
          {NOM_DIRECTEUR}
        </CertText>

        <CertText y={L.reference.y} size={L.reference.size} color="#334155" left={L.reference.x} width={40} align="left">
          {certif.reference}
        </CertText>
      </div>
    </div>
  )
}