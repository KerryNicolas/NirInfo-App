import { IcoPlus, IcoEdit, IcoSave, IcoX } from '../../../components/icons'

interface ModuleFormData {
  code_module: string
  nom: string
  description: string
}

interface ModuleFormProps {
  form: ModuleFormData
  editing: boolean
  saving: boolean
  onChange: (key: keyof ModuleFormData) => (e: React.ChangeEvent<HTMLInputElement>) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

const labelStyle: React.CSSProperties = {
  fontSize: 14.5,
  fontWeight: 500,
  color: '#3d4f6e',
  letterSpacing: '0.01em',
}

const inputStyle = (disabled: boolean): React.CSSProperties => ({
  width: '100%',
  boxSizing: 'border-box',
  border: '1.5px solid #dde2ee',
  borderRadius: 9,
  padding: '10px 14px',
  fontSize: 14.5,
  color: '#1e2a4a',
  background: disabled ? '#f4f6fb' : '#fafbfd',
  outline: 'none',
  opacity: disabled ? 0.7 : 1,
  cursor: disabled ? 'not-allowed' : 'text',
  transition: 'border-color 0.18s, box-shadow 0.18s',
})

export default function ModuleForm({ form, editing, saving, onChange, onSubmit, onCancel }: ModuleFormProps) {
  return (
    // Même carte que les autres formulaires : pas de largeur maximale, elle
    // suit donc la liste des modules en dessous à tous les niveaux de zoom.
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
                <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>{editing ? <IcoEdit /> : <IcoPlus />} {editing ? "Modifier le module" : 'Nouveau module'}</span>
                {editing && <button className="btn btn-sm" onClick={onCancel} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoX /> Annuler</button>}
      </div>

      <div className="card-body">
        <form onSubmit={onSubmit}>

          <div className="form-group">
            <label className="form-label">Code <span style={{ color: '#ef4444' }}></span></label>
            {/* FIX : code_module est maintenant modifiable même en édition.
                ⚠️ Vérifier d'abord qu'aucune autre table (session, etc.) ne
                référence ce code sans mise à jour en cascade côté backend
                avant d'utiliser ceci sur de vraies données. */}
            <input className="form-control" value={form.code_module} onChange={onChange('code_module')}
              required placeholder="Ex: ACAD" />
          </div>

          <div className="form-group">
            {/* Astérisque supprimé (points 1 et 10) ; le champ reste
                obligatoire (attribut required). La saisie est gardée telle
                quelle, majuscules et minuscules. */}
            <label className="form-label">Module</label>
            <input className="form-control" value={form.nom} onChange={onChange('nom')}
              required placeholder="Nom du module" />
          </div>

          <div className="form-group">
            {/* FIX : l'astérisque était affiché ici alors que ce champ n'a
                jamais été obligatoire (pas d'attribut required, et le
                backend l'accepte vide) — supprimé (point 10). */}
            <label className="form-label">Description</label>
            <input className="form-control" value={form.description} onChange={onChange('description')}
              placeholder="Description du module" />
          </div>

          <button type="submit" className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }} disabled={saving}>
            {saving
              ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Enregistrement…</>
              : editing ? <><IcoSave /> Mettre à jour</> : <><IcoPlus /> Enregistrer</>
            }
          </button>

        </form>
      </div>
    </div>
  )
}