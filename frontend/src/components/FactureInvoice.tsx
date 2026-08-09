import { IcoDoc, IcoPrint } from './icons'

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

  const handlePrint = () => window.print()

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

      <div className="card-body" id="facture-print">
        {factures.map((facture, idx) => (
          <div key={facture.reference}
            style={{ maxWidth: 700, margin: '0 auto', ...(idx > 0 ? { marginTop: 40, paddingTop: 40, borderTop: '2px dashed #e2e8f0' } : {}) }}>

            {/* En-tête */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingBottom: 20, borderBottom: '2px solid #1e3a8a' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#1e3a8a' }}>{facture.centre.nom}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{facture.centre.adresse}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{facture.centre.tel} | {facture.centre.email}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1e3a8a' }}>FACTURE</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Réf : <b>{facture.reference}</b></div>
                <div style={{ fontSize: 13, color: '#64748b' }}>N° : <b>{facture.numero}</b></div>
                <div style={{ fontSize: 13, color: '#64748b' }}>Date : <b>{facture.date_facture}</b></div>
              </div>
            </div>

            {/* Étudiant */}
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 10, textTransform: 'uppercase' }}>Étudiant</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div><span style={{ color: '#64748b' }}>Matricule : </span><b>{facture.etudiant.matricule}</b></div>
                <div><span style={{ color: '#64748b' }}>Nom : </span><b>{facture.etudiant.nom} {facture.etudiant.prenom}</b></div>
                <div><span style={{ color: '#64748b' }}>Téléphone : </span>{facture.etudiant.telephone}</div>
                <div><span style={{ color: '#64748b' }}>Email : </span>{facture.etudiant.email}</div>
              </div>
            </div>

            {/* Formation */}
            <div style={{ background: '#eff6ff', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 10, textTransform: 'uppercase' }}>Formation</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div><span style={{ color: '#64748b' }}>Module : </span><b>{facture.session.module_nom}</b></div>
                <div><span style={{ color: '#64748b' }}>Session : </span>{facture.session.code_session}</div>
                <div><span style={{ color: '#64748b' }}>Début : </span>{facture.session.date_debut}</div>
                <div><span style={{ color: '#64748b' }}>Fin : </span>{facture.session.date_fin}</div>
                <div><span style={{ color: '#64748b' }}>Lieu : </span>{facture.session.lieu}</div>
                <div><span style={{ color: '#64748b' }}>Horaire : </span>{facture.session.horaire_desc}</div>
              </div>
            </div>

            {/* Paiement */}
            <div style={{ border: '2px solid #1e3a8a', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 14, textTransform: 'uppercase' }}>Détail du paiement</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#1e3a8a', color: 'white' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right' }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 14px' }}>Frais de formation — {facture.session.module_nom}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{fmt(facture.session.frais_formation)} Ar</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>Déjà versé (avant cette facture)</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>{fmt(facture.inscription.somme_deja_paye)} Ar</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 14px', color: '#16a34a', fontWeight: 600 }}>Montant payé (cette facture)</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{fmt(facture.inscription.montant_paye)} Ar</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>Total versé</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{fmt(facture.inscription.total_paye)} Ar</td>
                  </tr>
                  <tr style={{ background: '#fef2f2' }}>
                    <td style={{ padding: '10px 14px', color: '#dc2626', fontWeight: 600 }}>Reste à payer</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{fmt(facture.inscription.reste)} Ar</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
              Merci pour votre confiance — {facture.centre.nom} © {new Date().getFullYear()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}