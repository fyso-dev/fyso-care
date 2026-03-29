import { useState, useEffect } from 'react';
import { apiUpdate, apiList, field, getRecordDisplayName } from '../../lib/api-client';

const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent";

const estadoBadge: Record<string, { bg: string; text: string; label: string }> = {
  pendiente: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Pendiente' },
  confirmado: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Confirmado' },
  en_sala: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'En sala' },
  atendido: { bg: 'bg-green-50', text: 'text-green-700', label: 'Atendido' },
  cancelado: { bg: 'bg-red-50', text: 'text-red-600', label: 'Cancelado' },
  ausente: { bg: 'bg-gray-50', text: 'text-gray-500', label: 'Ausente' },
};

interface PatientModalProps {
  patient: any;
  onClose: () => void;
  onPatientUpdated: (updated: any) => void;
  networksLookup: Record<string, any>;
  doctorsLookup: Record<string, any>;
}

export default function PatientModal({ patient, onClose, onPatientUpdated, networksLookup, doctorsLookup }: PatientModalProps) {
  const [tab, setTab] = useState<'datos' | 'historial'>('datos');
  const [saving, setSaving] = useState(false);
  const [historial, setHistorial] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const [form, setForm] = useState({
    first_name: patient.data?.first_name || '',
    last_name: patient.data?.last_name || '',
    dni: patient.data?.dni || '',
    date_of_birth: patient.data?.date_of_birth?.split('T')[0] || '',
    email: patient.data?.email || '',
    phone: patient.data?.phone || '',
    network_id: patient.data?.network_id || '',
    address: patient.data?.address || '',
    city: patient.data?.city || '',
    sex: patient.data?.sex || '',
    medical_record: patient.data?.medical_record || '',
  });

  const networksList = Object.values(networksLookup);

  useEffect(() => {
    if (tab === 'historial' && historial.length === 0) {
      loadHistorial();
    }
  }, [tab]);

  async function loadHistorial() {
    setLoadingHistorial(true);
    try {
      const res = await apiList('appointments', { limit: '200' });
      const patientTurnos = res.data
        .filter((t: any) => field(t, 'patient_id') === patient.id)
        .sort((a: any, b: any) => {
          const fa = field(a, 'date') || '';
          const fb = field(b, 'date') || '';
          return fb.localeCompare(fa);
        });
      setHistorial(patientTurnos);
    } catch (err) {
      console.error('Error loading historial:', err);
    } finally {
      setLoadingHistorial(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiUpdate('patients', patient.id, form);
      onPatientUpdated({ ...patient, data: { ...patient.data, ...form } });
    } catch (err: any) {
      alert(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {patient.data?.first_name} {patient.data?.last_name}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setTab('datos')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'datos' ? 'border-teal-500 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Datos Personales
          </button>
          <button
            onClick={() => setTab('historial')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'historial' ? 'border-teal-500 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Historial de Consultas
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'datos' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                  <input type="text" value={form.first_name} onChange={e => setField('first_name', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label>
                  <input type="text" value={form.last_name} onChange={e => setField('last_name', e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">DNI</label>
                  <input type="text" value={form.dni} onChange={e => setField('dni', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de Nacimiento</label>
                  <input type="date" value={form.date_of_birth} onChange={e => setField('date_of_birth', e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setField('email', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Telefono</label>
                  <input type="text" value={form.phone} onChange={e => setField('phone', e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Obra Social</label>
                  <select value={form.network_id} onChange={e => setField('network_id', e.target.value)} className={inputClass}>
                    <option value="">--</option>
                    {networksList.map((n: any) => (
                      <option key={n.id} value={n.id}>{n.data?.name || getRecordDisplayName(n)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sexo</label>
                  <select value={form.sex} onChange={e => setField('sex', e.target.value)} className={inputClass}>
                    <option value="">--</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Direccion</label>
                  <input type="text" value={form.address} onChange={e => setField('address', e.target.value)} placeholder="Ej: Av. Corrientes 1234" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ciudad</label>
                  <input type="text" value={form.city} onChange={e => setField('city', e.target.value)} placeholder="Ej: Buenos Aires" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Historia Clinica</label>
                <textarea value={form.medical_record} onChange={e => setField('medical_record', e.target.value)} rows={3} className={inputClass} placeholder="Antecedentes, condiciones, etc." />
              </div>
              <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving}
                  className="px-5 py-2 rounded-lg text-sm font-medium bg-teal-500 text-white hover:bg-teal-600 transition-colors disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          )}

          {tab === 'historial' && (
            <div>
              {loadingHistorial ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-sm text-gray-500">Cargando historial...</span>
                </div>
              ) : historial.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">Sin consultas anteriores</p>
              ) : (
                <div className="space-y-3">
                  {historial.map(t => {
                    const estado = field(t, 'status') || 'pendiente';
                    const badge = estadoBadge[estado] || estadoBadge.pendiente;
                    const doc = doctorsLookup[field(t, 'doctor_id')];
                    return (
                      <div key={t.id} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500">
                            {field(t, 'date')?.split('T')[0] || '-'}
                            {field(t, 'time') && <span className="ml-1">{field(t, 'time')}</span>}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
                          {doc && <span className="text-xs text-gray-400">{getRecordDisplayName(doc)}</span>}
                        </div>
                        {field(t, 'consultation_notes') && (
                          <p className="text-sm text-gray-700 mt-1">{field(t, 'consultation_notes')}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
