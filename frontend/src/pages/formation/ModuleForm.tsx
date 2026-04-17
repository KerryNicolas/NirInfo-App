import { IcoPlus, IcoSave, IcoX } from '../../components/icons'

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
  fontSize: 13.5,
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
    <div className="card" style={{ marginBottom: 20, maxWidth: 560 }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#00315C' }}>
        <span className="card-title" style={{ fontSize: 22, fontWeight: 700, color: '#FFF' }}>
          {editing ? 'Modifier le module' : 'Nouveau module'}
        </span>
        {editing && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onCancel}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <IcoX /> Annuler
          </button>
        )}
      </div>

      <div className="card-body">
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Code */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              Code <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              style={inputStyle(editing)}
              value={form.code_module}
              onChange={onChange('code_module')}
              required
              disabled={editing}
              placeholder="Ex: ACAD"
            />
          </div>

          {/* Nom */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              Nom <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              style={inputStyle(false)}
              value={form.nom}
              onChange={onChange('nom')}
              required
              placeholder="Nom du module"
            />
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Description</label>
            <input
              style={inputStyle(false)}
              value={form.description}
              onChange={onChange('description')}
              placeholder="Description du module"
            />
          </div>

          {/* Bouton */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, background: '#0c528f' }}
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Enregistrement…
              </>
            ) : editing ? (
              <><IcoSave /> Mettre à jour</>
            ) : (
              <><IcoPlus /> Enregistrer</>
            )}
          </button>

        </form>
      </div>
    </div>
  )
}
