import React, { useState } from 'react'
import logo from '../../../assets/logo.png'
import './factureni.css'



const unites = ['', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF',
'DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE', 'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF']
const dizaines = ['', '', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE', 'QUATRE-VINGT', 'QUATRE-VINGT']

function centaines(n: number): string {
    if (n === 0) return ''
    if (n < 20) return unites[n]
    const d = Math.floor(n / 10), u = n % 10
    if (d === 7) return 'SOIXANTE-' + unites[10 + u]
    if (d === 9) return 'QUATRE-VINGT-' + (u === 0 ? 'S' : unites[u])
    if (d === 8) return u === 0 ? 'QUATRE-VINGTS' : 'QUATRE-VINGT-' + unites[u]
    return dizaines[d] + (u === 1 ? '-ET-UN' : u !== 0 ? '-' + unites[u] : '')
}

function parCentaine(n: number): string {
    if (n === 0) return ''
    const c = Math.floor(n / 100), reste = n % 100
    let result = c === 1 ? 'CENT' : c > 1 ? unites[c] + ' CENT' + (reste === 0 ? 'S' : '') : ''
    if (reste > 0) result += (result ? ' ' : '') + centaines(reste)
    return result
}

function nombreEnLettres(n: number): string {
    if (n === 0) return 'ZÉRO'
    const milliards = Math.floor(n / 1_000_000_000)
    const millions  = Math.floor((n % 1_000_000_000) / 1_000_000)
    const milliers  = Math.floor((n % 1_000_000) / 1_000)
    const reste     = n % 1_000
    const parts: string[] = []
    if (milliards > 0) parts.push(parCentaine(milliards) + ' MILLIARD' + (milliards > 1 ? 'S' : ''))
    if (millions  > 0) parts.push(parCentaine(millions)  + ' MILLION'  + (millions  > 1 ? 'S' : ''))
    if (milliers  > 0) parts.push(milliers === 1 ? 'MILLE' : parCentaine(milliers) + ' MILLE')
    if (reste     > 0) parts.push(parCentaine(reste))
    return parts.join(' ')
}

export default function Certificat() {
    const [nom, setNom] = useState('')
    const [localite, setLocalite] = useState('')
    const [matricule, setMatricule] = useState('')
    const [formation, setFormation] = useState('')
    const [frais, setFrais] = useState('')
    const [montantPaye, setMontantPaye] = useState('')
    const [dateDebut, setDateDebut] = useState('')
    const [dateFin, setDateFin] = useState('')
    const [numFacture, setNumFacture] = useState('')
    const [dateFacture, setDateFacture] = useState('')

    const handlePrint = () => {
    window.print()
    }

    const formatDate = (d: string) => {
    if (!d) return '___/___/______'
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
    }

    const resteAPayer =
    frais && montantPaye
        ? Number(frais.replace(/\s/g, '')) - Number(montantPaye.replace(/\s/g, ''))
        : null

    return (
        <div style={{ 
            position: 'fixed',
            inset: 0,
            overflow: 'auto',
            background: '#f0f2f5',
            zIndex: 0
            }}>
            <div className="page-wrapper">

            {/* FORMULAIRE */}
                <div className="no-print form-panel">
                    <div className="form-header">
                {/* <span className="form-logo">Nir'Info</span> */}
                    <h2>Générer une Facture</h2>
                </div>

                <label>Numéro de facture</label>
                <input value={numFacture} onChange={e => setNumFacture(e.target.value)} />

                <label>Date de la facture</label>
                <input type="date" value={dateFacture} onChange={e => setDateFacture(e.target.value)} />

                <div className="form-divider">Destinataire</div>

                <label>Nom complet</label>
                <input placeholder="Son nom complet" value={nom} onChange={e => setNom(e.target.value)} />

                <label>Addresse</label>
                <input  value={localite} onChange={e => setLocalite(e.target.value)} />

                <label>Matricule *</label>
                <input value={matricule} onChange={e => setMatricule(e.target.value)} />

                <div className="form-divider">Formation</div>

                <label>Intitulé de la formation</label>
                <input value={formation} onChange={e => setFormation(e.target.value)} />

                <label>Date de début (session)</label>
                <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />

                <label>Date de fin</label>
                <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />

                <div className="form-divider">Paiement</div>

                <label>Frais (Ar)</label>
                <input value={frais} onChange={e => setFrais(e.target.value)} />

                <label>Montant payé (Ar)</label>
                <input value={montantPaye} onChange={e => setMontantPaye(e.target.value)} />

                <button className="print-btn" onClick={handlePrint}>🖨️ Imprimer la facture</button>
            </div>

            {/* FACTURE */}
            <div className="facture">

                {/* EN-TÊTE */}
                <div className="facture-header">
                <div className="facture-emetteur">
                    {/* <div className="facture-logo">Nir'Info <span className="logo-icon"></span></div> */}
                    <img src={logo} alt="Nir'Info" className="logo-img" />
                    <p>LOT IIA 80 C Ampandrana Ouest</p>
                    <p>ANTANANARIVO 101</p>
                    <p>Tel: 034 36 176 60 – 034 77 775 34</p>
                    <p>Mail: admin@nir-info.mg</p>
                    <p>Site: https://nir-info.mg</p>
                    <p>NIF : 4003162374</p>
                    <p>STAT : 95110 11 2018 0059 47</p>
                </div>

                <div className="facture-ref">
                    <h1 className="facture-titre">FACTURE N° {numFacture || '____-____'}</h1>
                    <p><strong>Adressée à</strong></p>
                    <p className="facture-nom">{nom || 'NOM PRÉNOM'}</p>
                    <p>{localite || 'Localité'}</p>
                    <p>Matricule : {matricule || 'XX-XXXX'}</p>
                </div>
                </div>

                {/* DATE */}
                <p className="facture-date">Date : {formatDate(dateFacture)}</p>

                {/* TABLEAU */}
                <table className="facture-table">
                <thead>
                    <tr>
                    <th>Formation</th>
                    <th>Frais</th>
                    <th>Montant payé (Ar)</th>
                    </tr>
                </thead>

                <tbody>
                    <tr>
                    <td>
                        {formation || 'Nom de la formation'}<br />
                        {dateDebut && <>Session du {formatDate(dateDebut)}<br /></>}
                        {dateFin && <>au {formatDate(dateFin)}</>}
                    </td>
                    <td>{frais ? `${frais} Ar` : '– Ar'}</td>
                    <td>{montantPaye ? `${montantPaye} Ar` : ''}</td>
                    </tr>
                    <tr>
                    <td colSpan={1}></td>
                    <td><strong>Montant déjà payé</strong></td>
                    <td>–</td>
                    </tr>
                    <tr>
                    <td colSpan={1}></td>
                    <td><strong>Total payé</strong></td>
                    <td>{montantPaye ? `${montantPaye} Ar` : ''}</td>
                    </tr>
                    <tr>
                    <td colSpan={1}></td>
                    <td><strong>Reste à payer</strong></td>
                    <td>{resteAPayer !== null ? (resteAPayer > 0 ? `${resteAPayer} Ar` : '–') : '–'}</td>
                    </tr>
                </tbody>
                </table>

                {/* ARRÊTÉ */}
            <p className="facture-arrete">
                    Arrêté à la somme de : <strong>
                {montantPaye ? nombreEnLettres(Number(montantPaye.replace(/\s/g, ''))) + ' ARIARY': '-------------------------'}
                </strong>
            </p>

                {/* SIGNATURE */}
                <div className="facture-signature">
                <div className="signature-bloc">
                    <p>Le responsable</p>
                    {/* <div className="signature-zone"></div>
                    <div className="cachet-box">
                    <p>LOGICIELS ET FORMATIONS INFORMATIQUES</p>
                    <p>Adresse : LOT IIA 80 C Ampandrana Ouest, Antananarivo 101</p>
                    <p>Tél : +261 34 36 176 60</p>
                    <p>Site web : nir-info.mg</p>
                    </div> */}
                </div>
                </div>

            </div>
            </div>
        </div>
)
}
