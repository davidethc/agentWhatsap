-- TK-39 · Defensa en profundidad sobre RLS (revisión de seguridad, datos de salud).
--
-- Antes: las políticas de update dejaban que el personal cambiara cualquier columna con un UPDATE
-- directo (p. ej. la etapa sin pasar por mover_etapa, sin motivo ni historial correcto), y anon
-- conservaba SELECT en public (frenado solo por RLS).
-- Ahora:
--   · Las funciones del panel pasan a security definer: ya exigen personal al empezar
--     (private.exigir_personal) y tienen search_path = ''. Así pueden escribir lo que el personal
--     ya no puede tocar directo. El actor de auditoría sigue saliendo de auth.uid() (el JWT).
--   · authenticated actualiza en pacientes solo los datos básicos y el consentimiento (lo que edita
--     la ficha, HU de ficha y plan §7); etapa, citas y conversaciones solo por funciones.
--   · anon: sin ningún privilegio de tabla en public, tampoco en tablas futuras.

-- ───────────────────────── Funciones del panel: security definer ─────────────────────────
alter function public.mover_etapa       security definer;
alter function public.marcar_asistencia security definer;
alter function public.crear_paciente    security definer;
alter function public.guardar_cita      security definer;
alter function public.cancelar_cita     security definer;

-- ───────────────────────── anon ─────────────────────────
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- ───────────────────────── authenticated ─────────────────────────
-- pacientes: alta con crear_paciente; etapa con mover_etapa / marcar_asistencia; el resto, la ficha.
revoke insert, update, delete, truncate on public.pacientes from authenticated;
grant update (nombre, cedula, fecha_nacimiento, correo, consentimiento_firmado_en)
  on public.pacientes to authenticated;

-- conversaciones y citas: solo por funciones (crear_paciente, guardar_cita, cancelar_cita, eli-evento).
revoke insert, update, delete, truncate on public.conversaciones from authenticated;
revoke insert, update, delete, truncate on public.citas          from authenticated;

-- datos_clinicos: la ficha los llena directo (el trigger exige consentimiento), sin cambiar de paciente.
revoke insert, update, delete, truncate on public.datos_clinicos from authenticated;
grant insert (paciente_id, alergias, enfermedades, embarazo, miedo) on public.datos_clinicos to authenticated;
grant update (alergias, enfermedades, embarazo, miedo)              on public.datos_clinicos to authenticated;

-- horario: solo apertura y cierre de cada día.
revoke insert, update, delete, truncate on public.horario from authenticated;
grant insert (dia_semana, abre, cierra) on public.horario to authenticated;
grant update (abre, cierra)             on public.horario to authenticated;

-- Solo lectura para el personal (las escriben funciones o triggers).
revoke insert, update, delete, truncate on public.mensajes, public.cambios_etapa, public.auditoria,
  public.errores_integracion, public.sync_calendario, public.personal from authenticated;

-- Las políticas de insert/update que quedan sin privilegio no hacen daño, pero se borran para no
-- confundir: lo que manda ahora es el GRANT.
drop policy if exists conversaciones_insert on public.conversaciones;
drop policy if exists conversaciones_update on public.conversaciones;
drop policy if exists citas_insert          on public.citas;
drop policy if exists citas_update          on public.citas;
drop policy if exists pacientes_insert      on public.pacientes;
