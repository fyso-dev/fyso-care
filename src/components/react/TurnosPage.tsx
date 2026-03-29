import { useState, useEffect } from 'react';
import { apiList, apiCreate, apiGetAvailableSlots } from '../../lib/api-client';

type Step = 'doctor' | 'date' | 'slot' | 'datos' | 'confirmar';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY_HEADERS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

// Flexible slot helpers — Fyso scheduling API may return Spanish or English field names
function slotTime(s: any): string { return s.hora || s.time || ''; }
function slotDate(s: any): string { return (s.fecha || s.date || '').split('T')[0]; }

const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent";

export default function TurnosPage() {
  const [step, setStep] = useState<Step>('doctor');

  // Step 1: doctors
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);

  // Step 2: date
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState('');

  // Step 3: slots
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);

  // Step 4: patient data
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Step 5: confirmation
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  useEffect(() => {
    loadDoctors();
  }, []);

  async function loadDoctors() {
    setLoadingDoctors(true);
    try {
      const { data } = await apiList('doctors');
      const online = data.filter((d: any) =>
        d.data?.online === true && d.data?.enabled !== false
      );
      setDoctors(online);
    } catch (err) {
      console.error('Error loading doctors:', err);
    } finally {
      setLoadingDoctors(false);
    }
  }

  function selectDoctor(doc: any) {
    setSelectedDoctor(doc);
    setSelectedDate('');
    setSelectedSlot(null);
    setSlots([]);
    setStep('date');
  }

  function selectDate(dateStr: string) {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setSlots([]);
    loadSlots(dateStr);
    setStep('slot');
  }

  async function loadSlots(dateStr: string) {
    if (!selectedDoctor) return;
    setLoadingSlots(true);
    try {
      const data = await apiGetAvailableSlots(selectedDoctor.id, dateStr);
      setSlots(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading slots:', err);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  function selectSlot(slot: any) {
    setSelectedSlot(slot);
    setStep('datos');
  }

  async function handleConfirm() {
    setFormError('');
    if (!firstName.trim() || !dni.trim() || !phone.trim()) {
      setFormError('Nombre, DNI y telefono son obligatorios');
      return;
    }
    setSubmitting(true);
    setConfirmError('');
    try {
      // Try to create patient first
      let patientId: string | null = null;
      try {
        const raw = await apiCreate('patients', {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          dni: dni.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
        });
        patientId = raw?.id || raw?.data?.id || null;
      } catch {
        // Patient creation failed — proceed without patient_id
      }

      const appointmentData: Record<string, any> = {
        doctor_id: selectedDoctor.id,
        date: selectedDate,
        time: slotTime(selectedSlot),
        status: 'pendiente',
      };
      if (patientId) appointmentData.patient_id = patientId;
      if (notes.trim()) appointmentData.appointment_notes = notes.trim();

      await apiCreate('appointments', appointmentData);
      setConfirmed(true);
      setStep('confirmar');
    } catch (err: any) {
      setConfirmError(err.message || 'Error al reservar el turno. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setStep('doctor');
    setSelectedDoctor(null);
    setSelectedDate('');
    setSelectedSlot(null);
    setSlots([]);
    setFirstName('');
    setLastName('');
    setDni('');
    setPhone('');
    setEmail('');
    setNotes('');
    setConfirmed(false);
    setConfirmError('');
    setFormError('');
  }

  const todayStr = toLocalDate(today);
  const calDays = getCalendarDays(calYear, calMonth);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reservar Turno</h1>
          <p className="text-gray-500">Selecciona profesional, fecha y horario</p>
        </div>

        {/* Progress */}
        {step !== 'confirmar' && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {(['doctor', 'date', 'slot', 'datos'] as Step[]).map((s, i) => {
              const steps = ['doctor', 'date', 'slot', 'datos'];
              const current = steps.indexOf(step);
              const idx = steps.indexOf(s);
              const done = idx < current;
              const active = idx === current;
              return (
                <div key={s} className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${done ? 'bg-teal-500 text-white' : active ? 'bg-teal-500 text-white ring-4 ring-teal-100' : 'bg-gray-200 text-gray-400'}`}>
                    {done ? '✓' : i + 1}
                  </div>
                  {i < 3 && <div className={`w-8 h-0.5 mx-1 ${idx < current ? 'bg-teal-400' : 'bg-gray-200'}`} />}
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {/* Step 1: Select doctor */}
          {step === 'doctor' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Selecciona un profesional</h2>
              {loadingDoctors ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : doctors.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No hay profesionales disponibles para turnos online en este momento.</p>
              ) : (
                <div className="grid gap-3">
                  {doctors.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => selectDoctor(doc)}
                      className="text-left p-4 rounded-xl border-2 border-gray-100 hover:border-teal-400 hover:bg-teal-50/30 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 group-hover:text-teal-700">{doc.data?.name}</p>
                          {doc.data?.specialty && (
                            <p className="text-sm text-gray-500 mt-0.5">{doc.data.specialty}</p>
                          )}
                          {doc.data?.nota_publica && (
                            <p className="text-xs text-gray-400 mt-1">{doc.data.nota_publica}</p>
                          )}
                        </div>
                        <svg className="w-5 h-5 text-gray-300 group-hover:text-teal-500 shrink-0 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select date */}
          {step === 'date' && selectedDoctor && (
            <div>
              <button onClick={() => setStep('doctor')} className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 mb-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Volver
              </button>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Selecciona una fecha</h2>
              <p className="text-sm text-gray-500 mb-4">con <span className="font-medium text-gray-700">{selectedDoctor.data?.name}</span></p>

              {/* Calendar */}
              <div className="select-none">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => {
                      if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                      else setCalMonth(m => m - 1);
                    }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-sm font-semibold text-gray-900">{MONTH_NAMES[calMonth]} {calYear}</span>
                  <button
                    onClick={() => {
                      if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                      else setCalMonth(m => m + 1);
                    }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {DAY_HEADERS.map(d => (
                    <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {calDays.map((day, i) => {
                    if (!day) return <div key={`e-${i}`} />;
                    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isPast = dateStr <= todayStr;
                    const isSelected = dateStr === selectedDate;
                    return (
                      <button
                        key={dateStr}
                        disabled={isPast}
                        onClick={() => selectDate(dateStr)}
                        className={`aspect-square w-full flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                          isPast
                            ? 'text-gray-200 cursor-not-allowed'
                            : isSelected
                              ? 'bg-teal-500 text-white'
                              : 'text-gray-700 hover:bg-teal-50 hover:text-teal-700'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Select slot */}
          {step === 'slot' && selectedDoctor && selectedDate && (
            <div>
              <button onClick={() => setStep('date')} className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 mb-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Volver
              </button>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Selecciona un horario</h2>
              <p className="text-sm text-gray-500 mb-4">
                {selectedDoctor.data?.name} · {selectedDate.split('-').reverse().join('/')}
              </p>
              {loadingSlots ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">No hay turnos disponibles para este dia.</p>
                  <button onClick={() => setStep('date')} className="px-4 py-2 rounded-lg bg-teal-50 text-teal-700 text-sm font-medium hover:bg-teal-100 transition-colors">
                    Elegir otro dia
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((slot, i) => (
                    <button
                      key={i}
                      onClick={() => selectSlot(slot)}
                      className="py-2.5 px-2 rounded-xl border-2 border-gray-100 text-sm font-medium text-gray-700 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 transition-all"
                    >
                      {slotTime(slot)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Patient data */}
          {step === 'datos' && selectedSlot && (
            <div>
              <button onClick={() => setStep('slot')} className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 mb-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Volver
              </button>

              {/* Resumen turno */}
              <div className="rounded-xl bg-teal-50 border border-teal-200 p-4 mb-5">
                <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">Tu turno seleccionado</p>
                <p className="font-semibold text-gray-900">{selectedDoctor.data?.name}</p>
                <p className="text-sm text-gray-600">
                  {selectedDate.split('-').reverse().join('/')} a las {slotTime(selectedSlot)}
                </p>
              </div>

              <h2 className="text-lg font-semibold text-gray-900 mb-4">Tus datos</h2>
              {formError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{formError}</div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                    <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className={inputClass} placeholder="Maria" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label>
                    <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className={inputClass} placeholder="Garcia" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">DNI *</label>
                    <input type="text" value={dni} onChange={e => setDni(e.target.value)} className={inputClass} placeholder="12345678" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Telefono *</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="1123456789" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email (opcional)</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="maria@email.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notas adicionales (opcional)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputClass} placeholder="Ej: Primera consulta, soy derivado por..." />
                </div>

                {confirmError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{confirmError}</div>
                )}

                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-teal-500 text-white font-semibold text-sm hover:bg-teal-600 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Confirmando...' : 'Confirmar turno'}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Confirmation */}
          {step === 'confirmar' && confirmed && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Turno confirmado</h2>
              <p className="text-gray-500 mb-6">Te esperamos en el consultorio.</p>

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-left mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Resumen</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Profesional</span>
                    <span className="font-medium text-gray-900">{selectedDoctor?.data?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Fecha</span>
                    <span className="font-medium text-gray-900">{selectedDate.split('-').reverse().join('/')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Hora</span>
                    <span className="font-medium text-gray-900">{selectedSlot && slotTime(selectedSlot)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Paciente</span>
                    <span className="font-medium text-gray-900">{firstName} {lastName}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-6">
                Si necesitas cancelar o reprogramar tu turno, comunicate con el consultorio.
              </p>

              <button onClick={restart} className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Reservar otro turno
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
