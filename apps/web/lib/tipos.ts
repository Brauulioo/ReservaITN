/**
 * Forma de las respuestas JSON de la API que usa la web. Las fechas llegan como texto ISO.
 * Si cambia un `select`/`include` en apps/api, actualizar aquí el tipo correspondiente.
 */
import type { EstadoReserva, Rol } from '@reservaitn/shared';

export interface Sede { id: string; nombre: string; direccion: string | null }
export interface Carrera { id: string; codigo: string; nombre: string }

export interface Sala {
  id: string; codigo: string; nombre: string; tipo: 'SALA' | 'LABORATORIO'; capacidad: number;
  equipamiento: string[]; activa: boolean; sedeId: string; sede: Sede;
  carreraExclusivaId: string | null; carreraExclusiva: Carrera | null;
}

export interface Ocupacion { id: string; salaId: string; inicio: string; fin: string; motivo: string; origen: string }

export interface ReservaPropia {
  id: string; inicio: string; fin: string; motivo: string; asistentes: number; estado: EstadoReserva;
  origen: string; creadaEn: string; sala: { codigo: string; nombre: string; sede: { nombre: string } };
}

export interface Pendiente {
  id: string; inicio: string; fin: string; motivo: string; asistentes: number; creadaEn: string;
  sala: { codigo: string; nombre: string; sede: { nombre: string } };
  solicitante: { nombre: string; rol: Rol };
}

export interface Evento {
  id: string; accion: string; estadoAnterior: EstadoReserva | null; estadoNuevo: EstadoReserva;
  comentario: string | null; creadoEn: string; actor: { nombre: string; rol: Rol };
}

export interface Notificacion { id: string; titulo: string; cuerpo: string; leida: boolean; creadaEn: string; reservaId: string | null }

export interface Usuario { id: string; rut: string; email: string; nombre: string; rol: Rol; activo: boolean; carreraId: string | null }
