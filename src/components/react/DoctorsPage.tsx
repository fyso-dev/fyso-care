import { useState, useEffect, useCallback } from 'react';
import { doctorsConfig } from '../../lib/entities';
import { apiList, apiDelete } from '../../lib/api-client';
import CrudForm from './CrudForm';
import DeleteConfirm from './DeleteConfirm';
import DoctorScheduleEditor from './DoctorScheduleEditor';

export default function DoctorsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editRecord, setEditRecord] = useState<any>(null);
  const [deleteRecord, setDeleteRecord] = useState<any>(null);
  const [scheduleRecord, setScheduleRecord] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: docs } = await apiList('doctors');
      setRecords(docs);
    } catch (err) {
      console.error('Error loading doctors:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = search
    ? records.filter(r => {
        const q = search.toLowerCase();
        return Object.values(r.data || {}).some(v =>
          v != null && String(v).toLowerCase().includes(q)
        );
      })
    : records;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profesionales</h1>
          <p className="text-sm text-gray-500">{records.length} registros</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 sm:w-56 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <button
            onClick={() => { setEditRecord(null); setMode('create'); }}
            className="px-4 py-2 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 transition-colors whitespace-nowrap"
          >
            + Nuevo
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Habilitado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Online</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Especialidad</th>
                <th className="w-32 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No hay profesionales</td>
                </tr>
              )}
              {filtered.map(rec => {
                const d = rec.data || {};
                const name = d.name || 'Sin nombre';

                return (
                  <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.email || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${d.enabled !== false ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {d.enabled !== false ? 'Si' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${d.online ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                        {d.online ? 'Si' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{d.specialty || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setScheduleRecord(rec)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                          title="Horarios"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                        <button
                          onClick={() => { setEditRecord(rec); setMode('edit'); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button
                          onClick={() => setDeleteRecord(rec)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {(mode === 'create' || mode === 'edit') && (
        <CrudForm
          config={doctorsConfig}
          record={mode === 'edit' ? editRecord : null}
          lookups={{}}
          onClose={() => setMode('list')}
          onSaved={() => { setMode('list'); loadData(); }}
        />
      )}

      {deleteRecord && (
        <DeleteConfirm
          entityName="doctors"
          record={deleteRecord}
          onClose={() => setDeleteRecord(null)}
          onDeleted={() => { setDeleteRecord(null); loadData(); }}
        />
      )}

      {scheduleRecord && (
        <DoctorScheduleEditor
          doctor={scheduleRecord}
          onClose={() => setScheduleRecord(null)}
          onSaved={() => { setScheduleRecord(null); loadData(); }}
        />
      )}
    </div>
  );
}
