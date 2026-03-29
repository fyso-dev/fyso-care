import { useState, useEffect, useRef } from 'react';
import { apiList, apiUpdate, apiCreate, apiDelete, apiSearch, apiGetAvailableSlots, buildLookup, getRecordDisplayName, field } from '../../lib/api-client';
import { getUser } from '../../lib/auth';
import PatientModal from './PatientModal';
import AtenderModal from './AtenderModal';

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const DAY_HEADERS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeDate(val: string | null): string {
  if (!val) return '';
  return val.split('T')[0];
}

function normalizeRecord(rec: any): any {
  if (rec?.data && rec?.id) return rec;
  const { id, entityId, name, createdAt, updatedAt, ...fields } = rec || {};
  return { id, data: fields };
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

function calcAge(birthDate: string | null): string {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age}a`;
}

const estadoBadge: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pendiente: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-400', label: 'Pendiente' },
  confirmado: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-400', label: 'Confirmado' },
  en_sala: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', dot: 'bg-purple-400', label: 'En sala' },
  atendido: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', dot: 'bg-green-400', label: 'Atendido' },
  cancelado: { bg: 'bg-red-50 border-red-200', text: 'text-red-600', dot: 'bg-red-400', label: 'Cancelado' },
  ausente: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-500', dot: 'bg-gray-400', label: 'Ausente' },
  bloqueado: { bg: 'bg-gray-100 border-gray-300', text: 'text-gray-600', dot: 'bg-gray-500', label: 'Bloqueado' },
};

const STATUS_FLOW = ['pendiente', 'confirmado', 'en_sala', 'atendido'];

const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent";

// Slots from Fyso scheduling API: may use fecha/hora or date/time depending on API version
interface Slot { fecha?: string; hora?: string; date?: string; time?: string; duracion?: number; duration?: number; profesional_id?: string; doctor_id?: string; }
function slotDate(s: Slot): string { return s.fecha || s.date || ''; }
function slotTime(s: Slot): string { return s.hora || s.time || ''; }
function slotDuration(s: Slot): number { return s.duracion || s.duration || 0; }
function slotDoctorId(s: Slot): string { return s.profesional_id || s.doctor_id || ''; }

// --- Patient Search (server-side via Fyso search) ---
function PatientSearch({ value, onSelect, onClear, networksLookup }: {
  value: { id: string; display: string } | null;
  onSelect: (patient: any) => void;
  onClear: () => void;
  networksLookup: Record<string, any>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDni, setNewDni] = useState('');
  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [createError, setCreateError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setShowCreate(false); }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleQueryChange(q: string) {
    setQuery(q);
    setShowCreate(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setOpen(true);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiSearch('patients', q, 8);
        setResults(res);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
  }

  async function handleCreate() {
    if (!newDni || !newFirst || !newPhone) { setCreateError('DNI, nombre y telefono son obligatorios'); return; }
    setCreating(true); setCreateError('');
    try {
      const raw = await apiCreate('patients', { dni: newDni, first_name: newFirst, last_name: newLast, phone: newPhone });
      const rec = raw?.data && raw?.id ? raw : { id: raw?.id || raw?.data?.id, data: { dni: newDni, first_name: newFirst, last_name: newLast, phone: newPhone, ...raw?.data } };
      onSelect(rec);
      setQuery(''); setOpen(false); setShowCreate(false);
      setNewDni(''); setNewFirst(''); setNewLast(''); setNewPhone('');
    } catch (err: any) {
      setCreateError(err.message || 'Error al crear paciente');
    } finally { setCreating(false); }
  }

  if (value) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Paciente *</label>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-teal-300 bg-teal-50 text-sm">
          <span className="flex-1 font-medium text-teal-800">{value.display}</span>
          <button type="button" onClick={onClear} className="text-gray-400 hover:text-red-500 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium text-gray-600 mb-1">Paciente *</label>
      <input
        type="text"
        value={query}
        onChange={e => handleQueryChange(e.target.value)}
        onFocus={() => { if (query.length >= 2) setOpen(true); }}
        placeholder="Buscar por nombre, apellido o DNI..."
        className={inputClass}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-64 overflow-y-auto">
          {searching && (
            <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
              <div className="w-3 h-3 border border-teal-500 border-t-transparent rounded-full animate-spin" /> Buscando...
            </div>
          )}
          {!searching && results.map(p => {
            const network = networksLookup[p.data?.network_id];
            return (
              <button key={p.id} type="button"
                onClick={() => { onSelect(p); setQuery(''); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                <span className="font-medium text-gray-900">{p.data?.first_name} {p.data?.last_name}</span>
                {p.data?.dni && <span className="text-gray-500"> - DNI {p.data.dni}</span>}
                {network && <p className="text-xs text-gray-400">{network.data?.name || getRecordDisplayName(network)}</p>}
              </button>
            );
          })}
          {!searching && query.length >= 2 && results.length === 0 && !showCreate && (
            <div className="p-3">
              <p className="text-xs text-gray-400 mb-2">Sin resultados para "{query}"</p>
              <button type="button" onClick={() => { setShowCreate(true); setNewFirst(query); }}
                className="text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline">
                + Crear paciente nuevo
              </button>
            </div>
          )}
          {!searching && results.length > 0 && !showCreate && (
            <button type="button" onClick={() => setShowCreate(true)}
              className="w-full text-left px-3 py-2 text-xs font-medium text-teal-600 hover:bg-teal-50 border-t border-gray-100">
              + Crear paciente nuevo
            </button>
          )}
          {showCreate && (
            <div className="p-3 border-t border-gray-100 space-y-2">
              <p className="text-xs font-semibold text-gray-700">Nuevo paciente</p>
              {createError && <p className="text-xs text-red-600">{createError}</p>}
              <input type="text" value={newDni} onChange={e => setNewDni(e.target.value)} placeholder="DNI *" className={inputClass} />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={newFirst} onChange={e => setNewFirst(e.target.value)} placeholder="Nombre *" className={inputClass} />
                <input type="text" value={newLast} onChange={e => setNewLast(e.target.value)} placeholder="Apellido" className={inputClass} />
              </div>
              <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Telefono *" className={inputClass} />
              <div className="flex gap-2">
                <button type="button" onClick={handleCreate} disabled={creating}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-500 text-white hover:bg-teal-600 disabled:opacity-50">
                  {creating ? 'Creando...' : 'Crear y seleccionar'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Edit Turno Modal ---
function EditTurnoModal({ turno, onClose, onSaved, onDeleted, patientsLookup, servicesLookup, networksLookup }: {
  turno: any;
  onClose: () => void;
  onSaved: (turnoId: string, data: Record<string, any>) => void;
  onDeleted: (turnoId: string) => void;
  patientsLookup: Record<string, any>;
  servicesLookup: Record<string, any>;
  networksLookup: Record<string, any>;
}) {
  const currentPatient = patientsLookup[field(turno, 'patient_id')];
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; display: string } | null>(
    currentPatient ? { id: currentPatient.id, display: getRecordDisplayName(currentPatient) } : null
  );
  const [servicio, setServicio] = useState(field(turno, 'service_id') || '');
  const [obraSocial, setObraSocial] = useState(field(turno, 'network_id') || '');
  const [notas, setNotas] = useState(field(turno, 'appointment_notes') || '');
  const [estado, setEstado] = useState(field(turno, 'status') || 'pendiente');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const servicesList = Object.values(servicesLookup);
  const networksList = Object.values(networksLookup);

  function handleSelectPatient(p: any) {
    const name = `${p.data?.first_name || ''} ${p.data?.last_name || ''}`.trim();
    setSelectedPatient({ id: p.id, display: name || 'Paciente' });
    if (p.data?.network_id) setObraSocial(p.data.network_id);
  }

  async function handleSave() {
    if (!selectedPatient) return;
    setSaving(true);
    try {
      const data: Record<string, any> = {
        patient_id: selectedPatient.id,
        service_id: servicio || null,
        network_id: obraSocial || null,
        appointment_notes: notas || null,
        status: estado,
      };
      await apiUpdate('appointments', turno.id, data);
      onSaved(turno.id, data);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiDelete('appointments', turno.id);
      onDeleted(turno.id);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Editar Turno</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="font-medium text-gray-900">{field(turno, 'appointment_date')?.split('T')[0]}</span>
            <span>{field(turno, 'appointment_date')?.split('T')[1]?.slice(0, 5)}</span>
          </div>

          <PatientSearch
            value={selectedPatient}
            onSelect={handleSelectPatient}
            onClear={() => { setSelectedPatient(null); setObraSocial(''); }}
            networksLookup={networksLookup}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Servicio</label>
              <select value={servicio} onChange={e => setServicio(e.target.value)} className={inputClass}>
                <option value="">--</option>
                {servicesList.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.data?.name || getRecordDisplayName(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Obra Social</label>
              <select value={obraSocial} onChange={e => setObraSocial(e.target.value)} className={inputClass}>
                <option value="">--</option>
                {networksList.map((n: any) => (
                  <option key={n.id} value={n.id}>{n.data?.name || getRecordDisplayName(n)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
            <select value={estado} onChange={e => setEstado(e.target.value)} className={inputClass}>
              {['pendiente', 'confirmado', 'en_sala', 'atendido', 'cancelado', 'ausente', 'bloqueado'].map(e => (
                <option key={e} value={e}>{estadoBadge[e]?.label || e}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas (recepcion)</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className={inputClass} placeholder="Notas internas..." />
          </div>

          <div className="flex items-center justify-between pt-2">
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
                Eliminar turno
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">Confirmar?</span>
                <button onClick={handleDelete} disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                  {deleting ? '...' : 'Si, eliminar'}
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100">
                  No
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !selectedPatient}
                className="px-5 py-2 rounded-lg text-sm font-medium bg-teal-500 text-white hover:bg-teal-600 transition-colors disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Agenda() {
  const today = toLocalDate(new Date());

  const [turnos, setTurnos] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patientsLookup, setPatientsLookup] = useState<Record<string, any>>({});
  const [doctorsLookup, setDoctorsLookup] = useState<Record<string, any>>({});
  const [servicesLookup, setServicesLookup] = useState<Record<string, any>>({});
  const [networksLookup, setNetworksLookup] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Doctor mode
  const [doctorMode, setDoctorMode] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  // Booking state
  const [bookingSlot, setBookingSlot] = useState<Slot | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; display: string } | null>(null);
  const [bookingServicio, setBookingServicio] = useState('');
  const [bookingObraSocial, setBookingObraSocial] = useState('');
  const [bookingNotas, setBookingNotas] = useState('');
  const [bookingSaving, setBookingSaving] = useState(false);

  // Modals
  const [editingTurno, setEditingTurno] = useState<any>(null);
  const [viewingPatient, setViewingPatient] = useState<any>(null);
  const [atenderTurno, setAtenderTurno] = useState<any>(null);

  // Load entities once
  useEffect(() => {
    async function load() {
      try {
        const [turnosRes, docRes, patRes, svcRes, netRes] = await Promise.all([
          apiList('appointments'),
          apiList('doctors'),
          apiList('patients'),
          apiList('services'),
          apiList('networks'),
        ]);
        setTurnos(turnosRes.data);
        const enabledDocs = docRes.data.filter((d: any) => d.data?.enabled !== false);
        setDoctors(enabledDocs);
        setPatientsLookup(buildLookup(patRes.data));
        setDoctorsLookup(buildLookup(docRes.data));
        setServicesLookup(buildLookup(svcRes.data));
        setNetworksLookup(buildLookup(netRes.data));

        // Detect doctor mode
        const user = getUser();
        let defaultDoc = enabledDocs.length > 0 ? enabledDocs[0].id : '';
        if (user?.email) {
          const myDoc = enabledDocs.find((d: any) => d.data?.email?.toLowerCase() === user.email.toLowerCase());
          if (myDoc) {
            setDoctorMode(true);
            defaultDoc = myDoc.id;
          }
        }
        if (defaultDoc) setSelectedDoctor(defaultDoc);
      } catch (err) {
        console.error('Error loading agenda:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Load slots when doctor or date changes
  useEffect(() => {
    if (!selectedDoctor || !selectedDate) { setAvailableSlots([]); return; }
    let cancelled = false;
    setSlotsLoading(true);
    apiGetAvailableSlots(selectedDoctor, selectedDate, selectedDate).then(slots => {
      if (!cancelled) setAvailableSlots(slots);
    }).catch(() => {
      if (!cancelled) setAvailableSlots([]);
    }).finally(() => {
      if (!cancelled) setSlotsLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedDoctor, selectedDate]);

  function openBooking(slot: Slot) {
    setBookingSlot(slot);
    setSelectedPatient(null);
    setBookingServicio('');
    setBookingObraSocial('');
    setBookingNotas('');
  }

  function closeBooking() {
    setBookingSlot(null);
    setSelectedPatient(null);
  }

  function handleSelectPatient(p: any) {
    const name = `${p.data?.first_name || ''} ${p.data?.last_name || ''}`.trim();
    setSelectedPatient({ id: p.id, display: name || 'Paciente' });
    if (p.data?.network_id) setBookingObraSocial(p.data.network_id);
  }

  async function handleQuickBook(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingSlot || !selectedPatient) return;
    setBookingSaving(true);
    try {
      const turnoData: Record<string, any> = {
        doctor_id: slotDoctorId(bookingSlot),
        patient_id: selectedPatient.id,
        appointment_date: `${slotDate(bookingSlot).split('T')[0]}T${slotTime(bookingSlot).slice(0, 5)}:00`,
        status: 'confirmado',
      };
      if (bookingServicio) turnoData.service_id = bookingServicio;
      if (bookingObraSocial) turnoData.network_id = bookingObraSocial;
      if (bookingNotas) turnoData.appointment_notes = bookingNotas;

      const rawTurno = await apiCreate('appointments', turnoData);
      const newTurno = normalizeRecord(rawTurno);
      setTurnos(prev => [...prev, newTurno]);
      setAvailableSlots(prev => prev.filter(s => !(slotTime(s) === slotTime(bookingSlot) && slotDoctorId(s) === slotDoctorId(bookingSlot))));
      closeBooking();
    } catch (err: any) {
      alert(err.message || 'Error al crear turno');
    } finally {
      setBookingSaving(false);
    }
  }

  function prevMonth() { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }
  function nextMonth() { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }

  function selectDay(day: number) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    closeBooking();
  }

  async function updateEstado(turnoId: string, estado: string) {
    setUpdating(turnoId);
    try {
      await apiUpdate('appointments', turnoId, { status: estado });
      setTurnos(prev => prev.map(t => t.id === turnoId ? { ...t, data: { ...t.data, status: estado } } : t));
    } catch (err) {
      console.error('Error updating turno:', err);
    } finally {
      setUpdating(null);
    }
  }

  function handleTurnoEdited(turnoId: string, data: Record<string, any>) {
    setTurnos(prev => prev.map(t => t.id === turnoId ? { ...t, data: { ...t.data, ...data } } : t));
  }

  function handleTurnoDeleted(turnoId: string) {
    setTurnos(prev => prev.filter(t => t.id !== turnoId));
  }

  async function handleBlockSlot(slot: Slot) {
    setUpdating('blocking');
    try {
      const turnoData: Record<string, any> = {
        doctor_id: slotDoctorId(slot),
        appointment_date: `${slotDate(slot).split('T')[0]}T${slotTime(slot).slice(0, 5)}:00`,
        status: 'bloqueado',
      };
      const rawTurno = await apiCreate('appointments', turnoData);
      const newTurno = normalizeRecord(rawTurno);
      setTurnos(prev => [...prev, newTurno]);
      setAvailableSlots(prev => prev.filter(s => !(slotTime(s) === slotTime(slot) && slotDoctorId(s) === slotDoctorId(slot))));
    } catch (err: any) {
      alert(err.message || 'Error al bloquear turno');
    } finally {
      setUpdating(null);
    }
  }

  async function handleUnblock(turnoId: string) {
    setUpdating(turnoId);
    try {
      await apiDelete('appointments', turnoId);
      setTurnos(prev => prev.filter(t => t.id !== turnoId));
    } catch (err: any) {
      alert(err.message || 'Error al desbloquear');
    } finally {
      setUpdating(null);
    }
  }

  function handlePatientUpdated(updated: any) {
    setPatientsLookup(prev => ({ ...prev, [updated.id]: updated }));
  }

  // Turnos count per date for calendar dots
  const turnosByDate: Record<string, number> = {};
  for (const t of turnos) {
    const f = normalizeDate(field(t, 'appointment_date'));
    if (f && (!selectedDoctor || field(t, 'doctor_id') === selectedDoctor)) {
      turnosByDate[f] = (turnosByDate[f] || 0) + 1;
    }
  }

  // Turnos for selected date + doctor
  const turnosDelDia = turnos
    .filter(t => normalizeDate(field(t, 'appointment_date')) === selectedDate)
    .filter(t => !selectedDoctor || field(t, 'doctor_id') === selectedDoctor)
    .sort((a, b) => (field(a, 'appointment_date')?.split('T')[1]?.slice(0, 5) || '').localeCompare(field(b, 'appointment_date')?.split('T')[1]?.slice(0, 5) || ''));

  const bookedHoras = new Set(turnosDelDia.map(t => field(t, 'appointment_date')?.split('T')[1]?.slice(0, 5)));
  const freeSlots = availableSlots.filter(s => !bookedHoras.has(slotTime(s)));

  const calendarDays = getCalendarDays(calYear, calMonth);
  const selectedDay = parseInt(selectedDate.split('-')[2], 10);
  const selMonth = parseInt(selectedDate.split('-')[1], 10) - 1;
  const selYear = parseInt(selectedDate.split('-')[0], 10);

  // Day summary stats
  const atendidosHoy = turnosDelDia.filter(t => field(t, 'status') === 'atendido').length;
  const pendientesHoy = turnosDelDia.filter(t => ['pendiente', 'confirmado', 'en_sala'].includes(field(t, 'status'))).length;
  const canceladosHoy = turnosDelDia.filter(t => ['cancelado', 'ausente'].includes(field(t, 'status'))).length;

  // Services list for booking form
  const servicesList = Object.values(servicesLookup);
  const networksList = Object.values(networksLookup);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      {/* Left column: Calendar + Doctor selector */}
      <div className="lg:w-72 shrink-0 space-y-4">
        {/* Mobile: compact date bar + toggle calendar */}
        <div className="lg:hidden bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <button onClick={() => {
              const d = new Date(selectedDate + 'T12:00:00');
              d.setDate(d.getDate() - 1);
              setSelectedDate(toLocalDate(d));
            }} className="p-1.5 rounded-lg hover:bg-gray-100">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => setCalOpen(!calOpen)} className="text-sm font-semibold text-gray-900 px-3 py-1 rounded-lg hover:bg-gray-100">
              {DAY_NAMES[new Date(selectedDate + 'T12:00:00').getDay()]} {parseInt(selectedDate.split('-')[2])} {MONTH_SHORT[parseInt(selectedDate.split('-')[1]) - 1]}
              <svg className={`w-3 h-3 inline ml-1 transition-transform ${calOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            <button onClick={() => {
              const d = new Date(selectedDate + 'T12:00:00');
              d.setDate(d.getDate() + 1);
              setSelectedDate(toLocalDate(d));
            }} className="p-1.5 rounded-lg hover:bg-gray-100">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            {selectedDate !== today && (
              <button onClick={() => setSelectedDate(today)} className="text-xs text-teal-600 font-medium px-2 py-1 rounded hover:bg-teal-50">Hoy</button>
            )}
          </div>
          {calOpen && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-xs font-semibold text-gray-900">{MONTH_NAMES[calMonth]} {calYear}</span>
                <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0">
                {DAY_HEADERS.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-gray-400 py-0.5">{d}</div>
                ))}
                {calendarDays.map((day, i) => {
                  if (day === null) return <div key={`e${i}`} />;
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isSelected = day === selectedDay && calMonth === selMonth && calYear === selYear;
                  const isToday = dateStr === today;
                  const count = turnosByDate[dateStr] || 0;
                  return (
                    <button key={day} onClick={() => { selectDay(day); setCalOpen(false); }}
                      className={`relative flex flex-col items-center justify-center py-1 rounded text-xs transition-colors ${
                        isSelected ? 'bg-teal-500 text-white font-semibold'
                        : isToday ? 'bg-teal-50 text-teal-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                      }`}>
                      {day}
                      {count > 0 && <span className={`absolute bottom-0 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-teal-500'}`} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Desktop: full mini calendar */}
        <div className="hidden lg:block bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-semibold text-gray-900">{MONTH_NAMES[calMonth]} {calYear}</span>
            <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0">
            {DAY_HEADERS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />;
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = day === selectedDay && calMonth === selMonth && calYear === selYear;
              const isToday = dateStr === today;
              const count = turnosByDate[dateStr] || 0;
              return (
                <button key={day} onClick={() => selectDay(day)}
                  className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg text-sm transition-colors ${
                    isSelected ? 'bg-teal-500 text-white font-semibold'
                    : isToday ? 'bg-teal-50 text-teal-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                  }`}>
                  {day}
                  {count > 0 && <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-teal-500'}`} />}
                </button>
              );
            })}
          </div>
          <button onClick={() => { setCalMonth(new Date().getMonth()); setCalYear(new Date().getFullYear()); setSelectedDate(today); }}
            className="mt-3 w-full py-1.5 rounded-lg text-xs font-medium text-teal-600 hover:bg-teal-50 transition-colors">
            Ir a hoy
          </button>
        </div>

        {/* Doctor selector - always visible */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Profesional</p>
          {doctorMode && (
            <p className="text-xs text-teal-600 mb-2">Mi agenda</p>
          )}
          <div className="space-y-1">
            {doctors.map(doc => (
              <button key={doc.id} onClick={() => setSelectedDoctor(doc.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedDoctor === doc.id ? 'bg-teal-500/10 text-teal-700 border border-teal-300' : 'text-gray-700 hover:bg-gray-100'
                }`}>
                {doc.data?.name}
              </button>
            ))}
          </div>
        </div>

        {/* Day summary */}
        {turnosDelDia.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Resumen del dia</p>
            <div className="space-y-1.5 text-sm">
              {pendientesHoy > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Pendientes</span>
                  <span className="font-semibold text-yellow-600">{pendientesHoy}</span>
                </div>
              )}
              {atendidosHoy > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Atendidos</span>
                  <span className="font-semibold text-green-600">{atendidosHoy}</span>
                </div>
              )}
              {canceladosHoy > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Cancelados / Ausentes</span>
                  <span className="font-semibold text-red-600">{canceladosHoy}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                <span className="text-gray-700 font-medium">Total</span>
                <span className="font-bold text-gray-900">{turnosDelDia.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right column: Day timeline */}
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {DAY_NAMES[new Date(selectedDate + 'T12:00:00').getDay()]} {parseInt(selectedDate.split('-')[2])} {MONTH_SHORT[parseInt(selectedDate.split('-')[1]) - 1]}
            {selectedDoctor && doctorsLookup[selectedDoctor] && (
              <span className="text-gray-500 font-normal text-base ml-2">
                - {doctorsLookup[selectedDoctor]?.data?.name}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-3">
            {turnosDelDia.length > 0 && (
              <button onClick={() => window.print()} title="Imprimir listado del dia"
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              </button>
            )}
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Confirmado</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" /> Disponible</span>
            </div>
          </div>
        </div>

        {!selectedDoctor ? (
          <div className="text-center py-12"><p className="text-gray-400 text-sm">Selecciona un profesional para ver los horarios</p></div>
        ) : slotsLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-2 text-sm text-gray-500">Cargando horarios...</span>
          </div>
        ) : turnosDelDia.length === 0 && freeSlots.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-gray-400 text-sm">No atiende este dia</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[
              ...turnosDelDia.map(t => ({ type: 'booked' as const, hora: field(t, 'appointment_date')?.split('T')[1]?.slice(0, 5) || '', turno: t })),
              ...freeSlots.map(s => ({ type: 'free' as const, hora: slotTime(s), slot: s })),
            ]
              .sort((a, b) => a.hora.localeCompare(b.hora))
              .map((item, idx) => {
                if (item.type === 'booked') {
                  const turno = item.turno;
                  const estado = field(turno, 'status') || 'pendiente';
                  const badge = estadoBadge[estado] || estadoBadge.pendiente;
                  const patient = patientsLookup[field(turno, 'patient_id')];
                  const service = servicesLookup[field(turno, 'service_id')];
                  const network = networksLookup[field(turno, 'network_id')] || (patient ? networksLookup[patient.data?.network_id] : null);
                  const isUpdating = updating === turno.id;
                  const canAtender = ['pendiente', 'confirmado', 'en_sala'].includes(estado);

                  // Blocked slot - special rendering
                  if (estado === 'bloqueado') {
                    return (
                      <div key={`b-${turno.id}`} className="flex items-stretch rounded-xl border border-gray-300 bg-gray-100 overflow-hidden">
                        <div className="w-20 shrink-0 flex flex-col items-center justify-center bg-white/50 border-r border-gray-300 py-3">
                          <span className="text-sm font-bold text-gray-500">{item.hora}</span>
                        </div>
                        <div className="flex-1 px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            <span className="text-sm font-medium text-gray-600">Bloqueado</span>
                            {field(turno, 'appointment_notes') && (
                              <span className="text-xs text-gray-400">- {field(turno, 'appointment_notes')}</span>
                            )}
                          </div>
                          <button onClick={() => handleUnblock(turno.id)} disabled={updating === turno.id}
                            className="px-3 py-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors disabled:opacity-50">
                            {updating === turno.id ? '...' : 'Desbloquear'}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={`b-${turno.id}`} className={`flex items-stretch rounded-xl border ${badge.bg} overflow-hidden`}>
                      <div className="w-20 shrink-0 flex flex-col items-center justify-center bg-white/50 border-r border-inherit py-3">
                        <span className="text-sm font-bold text-gray-900">{item.hora}</span>
                      </div>
                      <div className="flex-1 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                          <button
                            onClick={() => patient && setViewingPatient(patient)}
                            className={`text-sm font-medium ${patient ? 'text-teal-700 hover:underline cursor-pointer' : 'text-gray-900'}`}
                          >
                            {patient ? getRecordDisplayName(patient) : '-'}
                            {patient?.data?.date_of_birth && (
                              <span className="text-gray-500 font-normal ml-1">({calcAge(patient.data.date_of_birth)})</span>
                            )}
                          </button>
                          <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {network && <span>{network.data?.name || getRecordDisplayName(network)}</span>}
                          {service && <span>{network ? ' · ' : ''}{service.data?.name || getRecordDisplayName(service)}</span>}
                        </div>
                        {/* Notas flag - just an indicator */}
                        {field(turno, 'appointment_notes') && (
                          <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs" title={field(turno, 'appointment_notes')}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                            Nota
                          </span>
                        )}
                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {/* Status flow buttons */}
                          {estado !== 'atendido' && estado !== 'cancelado' && estado !== 'ausente' && (
                            <>
                              {estado === 'pendiente' && (
                                <button onClick={() => updateEstado(turno.id, 'confirmado')} disabled={isUpdating}
                                  className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors disabled:opacity-50">
                                  {isUpdating ? '...' : 'Confirmar'}
                                </button>
                              )}
                              {(estado === 'pendiente' || estado === 'confirmado') && (
                                <button onClick={() => updateEstado(turno.id, 'en_sala')} disabled={isUpdating}
                                  className="px-3 py-1 rounded-lg text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors disabled:opacity-50">
                                  {isUpdating ? '...' : 'En sala'}
                                </button>
                              )}
                              {estado === 'en_sala' && (
                                <button onClick={() => updateEstado(turno.id, 'atendido')} disabled={isUpdating}
                                  className="px-3 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50">
                                  {isUpdating ? '...' : 'Atendido'}
                                </button>
                              )}
                              <button onClick={() => updateEstado(turno.id, 'cancelado')} disabled={isUpdating}
                                className="px-3 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50">
                                {isUpdating ? '...' : 'Cancelar'}
                              </button>
                              <button onClick={() => updateEstado(turno.id, 'ausente')} disabled={isUpdating}
                                className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50">
                                {isUpdating ? '...' : 'Ausente'}
                              </button>
                            </>
                          )}
                          {/* Atender button */}
                          {canAtender && (
                            <button onClick={() => setAtenderTurno(turno)}
                              className="px-3 py-1 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors">
                              Atender
                            </button>
                          )}
                          {/* Edit button */}
                          <button onClick={() => setEditingTurno(turno)}
                            className="px-3 py-1 rounded-lg text-xs font-medium bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
                            Editar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Free slot
                const slot = item.slot!;
                const isOpen = bookingSlot != null && slotTime(bookingSlot) === slotTime(slot);
                return (
                  <div key={`f-${idx}`} className="relative group">
                    <button
                      onClick={() => isOpen ? closeBooking() : openBooking(slot)}
                      className={`w-full flex items-stretch rounded-xl border transition-colors overflow-hidden ${
                        isOpen ? 'border-teal-400 bg-teal-50' : 'border-dashed border-gray-300 hover:border-teal-400 hover:bg-teal-50/50'
                      }`}>
                      <div className="w-20 shrink-0 flex flex-col items-center justify-center py-3">
                        <span className="text-sm font-bold text-gray-500">{slotTime(slot)}</span>
                        {slotDuration(slot) > 0 && <span className="text-xs text-gray-400">{slotDuration(slot)} min</span>}
                      </div>
                      <div className="flex-1 px-4 py-3 flex items-center">
                        <span className="w-2 h-2 rounded-full bg-gray-300 mr-2" />
                        <span className="text-sm text-gray-400">Disponible</span>
                        <svg className="w-4 h-4 ml-auto text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </div>
                    </button>
                    {!isOpen && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleBlockSlot(slot); }}
                        disabled={updating === 'blocking'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                        title="Bloquear horario"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </button>
                    )}

                    {isOpen && (
                      <form onSubmit={handleQuickBook} className="mt-1 mb-2 p-4 bg-white rounded-xl border border-teal-300 shadow-sm space-y-3">
                        <p className="text-sm font-semibold text-gray-900">Reservar turno - {slotTime(slot)}hs</p>

                        <PatientSearch
                          value={selectedPatient}
                          onSelect={handleSelectPatient}
                          onClear={() => { setSelectedPatient(null); setBookingObraSocial(''); }}
                          networksLookup={networksLookup}
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Servicio</label>
                            <select value={bookingServicio} onChange={e => setBookingServicio(e.target.value)} className={inputClass}>
                              <option value="">--</option>
                              {servicesList.map((s: any) => (
                                <option key={s.id} value={s.id}>{s.data?.name || getRecordDisplayName(s)}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Obra Social</label>
                            <select value={bookingObraSocial} onChange={e => setBookingObraSocial(e.target.value)} className={inputClass}>
                              <option value="">--</option>
                              {networksList.map((n: any) => (
                                <option key={n.id} value={n.id}>{n.data?.name || getRecordDisplayName(n)}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                          <input type="text" value={bookingNotas} onChange={e => setBookingNotas(e.target.value)} placeholder="Motivo de consulta..." className={inputClass} />
                        </div>

                        <div className="flex gap-2">
                          <button type="submit" disabled={bookingSaving || !selectedPatient}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-500 text-white hover:bg-teal-600 transition-colors disabled:opacity-50">
                            {bookingSaving ? 'Guardando...' : 'Confirmar turno'}
                          </button>
                          <button type="button" onClick={closeBooking}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors">
                            Cancelar
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Edit Turno Modal */}
      {editingTurno && (
        <EditTurnoModal
          turno={editingTurno}
          onClose={() => setEditingTurno(null)}
          onSaved={handleTurnoEdited}
          onDeleted={handleTurnoDeleted}
          patientsLookup={patientsLookup}
          servicesLookup={servicesLookup}
          networksLookup={networksLookup}
        />
      )}

      {/* Patient Modal */}
      {viewingPatient && (
        <PatientModal
          patient={viewingPatient}
          onClose={() => setViewingPatient(null)}
          onPatientUpdated={handlePatientUpdated}
          networksLookup={networksLookup}
          doctorsLookup={doctorsLookup}
        />
      )}

      {/* Atender Modal */}
      {atenderTurno && (
        <AtenderModal
          turno={atenderTurno}
          patient={patientsLookup[field(atenderTurno, 'patient_id')]}
          network={networksLookup[field(atenderTurno, 'network_id')] || networksLookup[patientsLookup[field(atenderTurno, 'patient_id')]?.data?.network_id]}
          doctorsLookup={doctorsLookup}
          onClose={() => setAtenderTurno(null)}
          onTurnoUpdated={handleTurnoEdited}
        />
      )}
    </div>
  );
}
