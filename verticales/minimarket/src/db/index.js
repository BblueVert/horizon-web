import { config } from '../config.js';
import { crearSupabase } from './supabase.js';
import { crearMemoria } from './memoria.js';

export function crearDb(modo = config.db.modo) {
  return modo === 'supabase' ? crearSupabase() : crearMemoria();
}
