import { IcoDoc, IcoPrint } from './icons'
import Logo from '../assets/logo.png'

// FIX : ce composant est désormais l'UNIQUE modèle de facture de toute
// l'application — utilisé par le module Facture (FacturePage.tsx) ET par
// l'aperçu affiché juste après une inscription (InscriptionTab.tsx), et par
// tout autre écran qui a besoin d'afficher/imprimer une facture
// (Recouvrement, etc.). Avant, chaque écran avait sa propre reproduction :
// FacturePage.tsx reproduisait fidèlement l'ancien modèle FPDF (logo, NIF,
// STAT, tableau Formation/Frais/Montant payé, "Arrêté à la somme de...",
// "Le responsable", REF en bas), tandis que ce fichier avait un tout autre
// design "carte moderne" (encarts colorés, sans logo, sans NIF/STAT, sans
// montant en lettres). Résultat : la facture affichée après une inscription
// ne ressemblait pas du tout à la vraie facture du module Facture. La
// structure ci-dessous reprend donc exactement celle de FacturePage.tsx —
// structure, numérotation, référence, infos étudiant, montants, infos
// d'inscription et présentation générale identiques partout.

// ─── Conversion nombre → lettres (FR), pour "Arrêté à la somme de : ..." ──
const UNITES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']

function troisChiffresEnLettres(n: number): string {
  if (n === 0) return ''
  const c = Math.floor(n / 100)
  const r = n % 100
  let mots = ''
  if (c > 0) mots += (c === 1 ? 'cent' : UNITES[c] + ' cent') + (c > 1 && r === 0 ? 's' : '') + (r > 0 ? ' ' : '')
  if (r > 0) {
    if (r < 20) {
      mots += UNITES[r]
    } else {
      const d = Math.floor(r / 10)
      const u = r % 10
      if (d === 7 || d === 9) {
        mots += DIZAINES[d] + (u === 1 && d === 7 ? ' et onze' : '-' + UNITES[10 + u])
      } else {
        mots += DIZAINES[d] + (u === 0 ? '' : (u === 1 && (d === 2 || d === 3 || d === 4 || d === 5 || d === 6) ? ' et un' : '-' + UNITES[u]))
        if (d === 8 && u === 0) mots += 's'
      }
    }
  }
  return mots
}

function numberToWordsFR(n: number): string {
  n = Math.round(Math.abs(n))
  if (n === 0) return 'zéro'
  const tranches = [
    { valeur: 1_000_000_000, mot: 'milliard' },
    { valeur: 1_000_000, mot: 'million' },
    { valeur: 1_000, mot: 'mille' },
  ]
  let reste = n
  let mots: string[] = []
  for (const t of tranches) {
    const q = Math.floor(reste / t.valeur)
    if (q > 0) {
      if (t.valeur === 1000 && q === 1) {
        mots.push('mille')
      } else {
        mots.push(troisChiffresEnLettres(q) + ' ' + t.mot + (q > 1 && t.mot !== 'mille' ? 's' : ''))
      }
      reste -= q * t.valeur
    }
  }
  if (reste > 0) mots.push(troisChiffresEnLettres(reste))
  return mots.join(' ').replace(/\s+/g, ' ').trim()
}

export interface FactureData {
  reference: string; numero: string
  etudiant: { matricule: string; nom: string; prenom: string; telephone: string; email: string }
  session: { code_session: string; module_nom: string; date_debut: string; date_fin: string; frais_formation: number; lieu: string; horaire_desc: string }
  inscription: { montant_paye: number; somme_deja_paye: number; total_paye: number; reste: number; date_paiement: string; compte: string }
  date_facture: string
  centre: { nom: string; adresse: string; tel: string; email: string }
}

interface Props {
  factures: FactureData[]
  // Titre de la carte — personnalisable selon le contexte (module Facture vs juste après inscription)
  title?: string
}

const fmt = (n: number) => Number(n).toLocaleString('fr')

export default function FactureInvoice({ factures, title }: Props) {
  if (factures.length === 0) return null

  // FIX : impression fidèle A5 — scope le print CSS via une classe sur
  // <body> pour ne pas interférer avec l'impression #certificat-print (A4
  // paysage) qui vit sur une autre page de l'appli.
  const handlePrint = () => {
    document.body.classList.add('printing-facture')
    const cleanup = () => document.body.classList.remove('printing-facture')
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
    setTimeout(cleanup, 3000)
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <IcoDoc /> {title ?? (factures.length > 1 ? `${factures.length} factures` : 'Aperçu de la facture')}
        </span>
        <button className="btn btn-primary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={handlePrint}>
          <IcoPrint /> Imprimer
        </button>
      </div>

      {/* Réplique exacte de components/facture.php (FPDF, A5 148×210mm) —
          mêmes libellés, même ordre des lignes, mêmes bordures de tableau. */}
      <style>{'@media print { @page { size: A5 portrait; margin: 0; } } '}</style>
      <div className="card-body facture-screen-wrap" id="facture-print">
        {factures.map((facture) => (
          <div key={facture.reference} className="facture-sheet">

            {/* En-tête : logo + titre */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <img src={Logo} alt="Nir'Info" style={{ width: '37mm', height: '15mm', objectFit: 'contain' }} />
              <div style={{ fontSize: '13pt', fontWeight: 700, textAlign: 'right' }}>
                FACTURE N° {facture.numero}
              </div>
            </div>

            {/* Coordonnées centre / destinataire */}
            <table style={{ marginTop: '6mm' }}>
              <tbody>
                <tr>
                  <td style={{ width: '55%' }}>LOT IIA 80 C Ampandrana Ouest</td>
                  <td>Adressée à</td>
                </tr>
                <tr>
                  <td>ANTANANARIVO 101</td>
                  <td>{facture.etudiant.nom}</td>
                </tr>
                <tr>
                  <td>Tel: 034 36 176 60 - 034 77 775 34</td>
                  <td>{facture.etudiant.prenom}</td>
                </tr>
                <tr>
                  <td>Mail: admin@nir-info.mg</td>
                  <td>Matricule: {facture.etudiant.matricule}</td>
                </tr>
                <tr><td colSpan={2}>Site: https://nir-info.mg</td></tr>
                <tr><td colSpan={2}>NIF : 4003162374</td></tr>
                <tr><td colSpan={2}>STAT : 95110 11 2018 0059 47</td></tr>
              </tbody>
            </table>

            <div style={{ marginTop: '8mm', fontSize: '10pt' }}>
              Date: {facture.date_facture}
            </div>

            {/* Détail formation / frais / montant payé */}
            <table style={{ marginTop: '3mm', border: '1px solid #000' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #000', textAlign: 'left' }}>Formation</th>
                  <th style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', borderRight: '1px solid #000', textAlign: 'right' }}>Frais</th>
                  <th style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', borderRight: '1px solid #000', textAlign: 'right' }}>Montant payé</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}>{facture.session.module_nom}</td>
                  <td style={{ borderRight: '1px solid #000', textAlign: 'right' }}>{fmt(facture.session.frais_formation)} Ar</td>
                  <td style={{ borderRight: '1px solid #000', textAlign: 'right' }}>{fmt(facture.inscription.montant_paye)} Ar</td>
                </tr>
                <tr>
                  <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}>Session du {facture.session.date_debut}</td>
                  <td style={{ borderRight: '1px solid #000' }}></td>
                  <td style={{ borderRight: '1px solid #000' }}></td>
                </tr>
                <tr>
                  <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>au {facture.session.date_fin}</td>
                  <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000' }}></td>
                  <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000' }}></td>
                </tr>
                <tr>
                  <td></td>
                  <td colSpan={1} style={{ border: '1px solid #000', textAlign: 'left' }}>Montant déjà payé</td>
                  <td style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', borderRight: '1px solid #000', textAlign: facture.inscription.somme_deja_paye ? 'right' : 'center' }}>
                    {facture.inscription.somme_deja_paye ? `${fmt(facture.inscription.somme_deja_paye)} Ar` : '-'}
                  </td>
                </tr>
                <tr>
                  <td></td>
                  <td style={{ border: '1px solid #000', textAlign: 'left' }}>Total payé</td>
                  <td style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', borderRight: '1px solid #000', textAlign: 'right' }}>
                    {fmt(facture.inscription.total_paye)} Ar
                  </td>
                </tr>
                <tr>
                  <td></td>
                  <td style={{ border: '1px solid #000', textAlign: 'left' }}>Reste à payer</td>
                  <td style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', borderRight: '1px solid #000', textAlign: facture.inscription.reste ? 'right' : 'center' }}>
                    {facture.inscription.reste ? `${fmt(facture.inscription.reste)} Ar` : '-'}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: '8mm', fontSize: '10pt' }}>
              Arrêté à la somme de : {numberToWordsFR(facture.inscription.montant_paye).toUpperCase()} ARIARY
            </div>

            <div style={{ marginTop: '8mm', fontSize: '10pt' }}>
              Le responsable
            </div>

            <div style={{ marginTop: '18mm', textAlign: 'right', fontSize: '9pt' }}>
              REF : {facture.reference}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}