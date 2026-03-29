import type { EntityConfig } from './entity-config';

export const patientsConfig: EntityConfig = {
  name: 'patients',
  displayName: 'Paciente',
  displayNamePlural: 'Pacientes',
  displayField: 'last_name',
  fields: [
    { key: 'first_name', label: 'Nombre', type: 'text', required: true, showInTable: true },
    { key: 'last_name', label: 'Apellido', type: 'text', showInTable: true },
    { key: 'dni', label: 'DNI', type: 'text', showInTable: true },
    { key: 'email', label: 'Email', type: 'email', showInTable: true },
    { key: 'phone', label: 'Telefono', type: 'text', showInTable: true },
    { key: 'date_of_birth', label: 'Fecha de Nacimiento', type: 'date' },
    { key: 'sex', label: 'Sexo', type: 'select', options: ['Masculino', 'Femenino', 'Otro'] },
    { key: 'address', label: 'Direccion', type: 'text' },
    { key: 'city', label: 'Ciudad', type: 'text' },
    { key: 'network_id', label: 'Obra Social', type: 'relationship', relation: { entity: 'networks', displayField: 'name' }, showInTable: true },
    { key: 'medical_record', label: 'Historia Clinica', type: 'longText' },
    { key: 'warnings', label: 'Alertas', type: 'longText' },
    { key: 'contact_details', label: 'Contacto Extra', type: 'longText' },
    { key: 'prof_cabecera', label: 'Profesional Cabecera', type: 'text' },
  ],
};

export const doctorsConfig: EntityConfig = {
  name: 'doctors',
  displayName: 'Profesional',
  displayNamePlural: 'Profesionales',
  displayField: 'name',
  fields: [
    { key: 'name', label: 'Nombre completo', type: 'text', required: true, showInTable: true },
    { key: 'specialty', label: 'Especialidad', type: 'text', showInTable: true },
    { key: 'email', label: 'Email', type: 'email', showInTable: true },
    { key: 'enabled', label: 'Habilitado', type: 'boolean', showInTable: true },
    { key: 'online', label: 'Turnos Online', type: 'boolean', showInTable: true },
    { key: 'dias_turnos', label: 'Dias adelante', type: 'number' },
    { key: 'nota_publica', label: 'Nota Publica', type: 'longText' },
  ],
};

export const networksConfig: EntityConfig = {
  name: 'networks',
  displayName: 'Obra Social',
  displayNamePlural: 'Obras Sociales',
  displayField: 'name',
  fields: [
    { key: 'name', label: 'Nombre', type: 'text', required: true, showInTable: true },
  ],
};

export const servicesConfig: EntityConfig = {
  name: 'services',
  displayName: 'Servicio',
  displayNamePlural: 'Servicios',
  displayField: 'name',
  fields: [
    { key: 'name', label: 'Nombre', type: 'text', required: true, showInTable: true },
  ],
};

export const specialtiesConfig: EntityConfig = {
  name: 'specialties',
  displayName: 'Especialidad',
  displayNamePlural: 'Especialidades',
  displayField: 'name',
  fields: [
    { key: 'name', label: 'Nombre', type: 'text', required: true, showInTable: true },
  ],
};

export const turnosConfig: EntityConfig = {
  name: 'appointments',
  displayName: 'Turno',
  displayNamePlural: 'Turnos',
  displayField: 'appointment_date',
  fields: [
    { key: 'appointment_date', label: 'Fecha y Hora', type: 'date', required: true, showInTable: true },
    { key: 'patient_id', label: 'Paciente', type: 'relationship', relation: { entity: 'patients', displayField: 'last_name' }, required: true, showInTable: true },
    { key: 'doctor_id', label: 'Profesional', type: 'relationship', relation: { entity: 'doctors', displayField: 'name' }, required: true, showInTable: true },
    { key: 'service_id', label: 'Servicio', type: 'relationship', relation: { entity: 'services', displayField: 'name' }, showInTable: true },
    { key: 'network_id', label: 'Obra Social', type: 'relationship', relation: { entity: 'networks', displayField: 'name' }, showInTable: true },
    { key: 'status', label: 'Estado', type: 'select', options: ['pendiente', 'confirmado', 'en_sala', 'atendido', 'cancelado', 'ausente', 'bloqueado'], showInTable: true },
    { key: 'appointment_notes', label: 'Notas Turno', type: 'longText', showInTable: false },
    { key: 'consultation_notes', label: 'Notas Consulta', type: 'longText', showInTable: false },
    { key: 'overtime', label: 'Sobreturno', type: 'boolean', showInTable: false },
  ],
};
