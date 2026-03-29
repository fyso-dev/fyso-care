import { useState, useEffect } from 'react';
import { apiUpdate, apiList, field, getRecordDisplayName } from '../../lib/api-client';

const estadoBadge: Record<string, { bg: string; text: string; label: string }> = {
  pendiente: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Pendiente' },
  confirmado: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Confirmado' },
  en_sala: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'En sala' },
  atendido: { bg: 'bg-green-50', text: 'text-green-700', label: 'Atendido' },
  cancelado: { bg: 'bg-red-50', text: 'text-red-600', label: 'Cancelado' },
  ausente: { bg: 'bg-gray-50', text: 'text-gray-500', label: 'Ausente' },
};

interface AtenderModalProps {
  turno: any;
  patient: any;
  network: any;
  doctorsLookup: Record<string, any>;
  onClose: () => void;
  onTurnoUpdated: (turnoId: string, data: Record<string, any>) => void;
}

export default function AtenderModal({ turno, patient, network, doctorsLookup, onClose, onTurnoUpdated }: AtenderModalProps) {
  const [consultationNotes, setConsultationNotes] = useState(field(turno, 'consultation_notes') || '');
  const [saving, setSaving] = useState(false);
  const [historial, setHistorial] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const doctorId = field(turno, 'doctor_id');
  const doctor = doctorsLookup[doctorId];

  useEffect(() => {
    loadHistorial();
  }, []);

  async function loadHistorial() {
    if (!patient?.id) return;
    setLoadingHistorial(true);
    try {
      const res = await apiList('appointments', { limit: '200' });
      const patientTurnos = res.data
        .filter((t: any) =>
          field(t, 'patient_id') === patient.id &&
          field(t, 'doctor_id') === doctorId &&
          t.id !== turno.id
        )
        .sort((a: any, b: any) => {
          const fa = field(a, 'appointment_date') || '';
          const fb = field(b, 'appointment_date') || '';
          return fb.localeCompare(fa);
        })
        .slice(0, 10);
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
      const data: Record<string, any> = {
        consultation_notes: consultationNotes,
        status: 'atendido',
      };
      await apiUpdate('appointments', turno.id, data);
      onTurnoUpdated(turno.id, data);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Atender Paciente</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          {/* Patient info bar */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium text-gray-900">
              {patient ? `${patient.data?.first_name || ''} ${patient.data?.last_name || ''}`.trim() : '-'}
            </span>
            {patient?.data?.phone && (
              <span className="text-gray-500">Tel: {patient.data.phone}</span>
            )}
            {patient?.data?.email && (
              <span className="text-gray-500">{patient.data.email}</span>
            )}
            {network && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                {network.data?.name || getRecordDisplayName(network)}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Notas de recepcion (read-only) */}
          {field(turno, 'appointment_notes') && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs font-medium text-amber-700 mb-1">Notas de recepcion</p>
              <p className="text-sm text-amber-900">{field(turno, 'appointment_notes')}</p>
            </div>
          )}

          {/* Notas medicas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notas de la consulta</label>
            <textarea
              value={consultationNotes}
              onChange={e => setConsultationNotes(e.target.value)}
              rows={6}
              placeholder="Escribir notas de la consulta..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y"
            />
          </div>

          {/* Historial con este medico */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Historial con {doctor ? getRecordDisplayName(doctor) : 'este profesional'}
            </h3>
            {loadingHistorial ? (
              <div className="flex items-center py-4">
                <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                <span className="ml-2 text-xs text-gray-400">Cargando...</span>
              </div>
            ) : historial.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">Sin consultas anteriores con este profesional</p>
            ) : (
              <div className="space-y-3">
                {historial.map(t => {
                  const estado = field(t, 'status') || 'pendiente';
                  const badge = estadoBadge[estado] || estadoBadge.pendiente;
                  return (
                    <div key={t.id} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500">{field(t, 'appointment_date')?.split('T')[0] || '-'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar y Completar Cita'}
          </button>
        </div>
      </div>
    </div>
  );
}
