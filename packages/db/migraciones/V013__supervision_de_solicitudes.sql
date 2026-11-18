-- =============================================================================
-- V013 · Supervisión: quienes deciden cualquier solicitud (Subdirección, control total)
-- reciben también el aviso de cada solicitud nueva, además de quien la regla designa.
-- Se define por permiso (reserva:aprobar_cualquiera), no por rol: el ITN puede dárselo a
-- otro rol sin programar.
-- =============================================================================
CREATE FUNCTION reservas.destinatarios_solicitud(p_solicitud uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE AS $$
  SELECT a FROM reservas.aprobadores_de(p_solicitud) a
  UNION
  SELECT u.id
    FROM seguridad.usuario u
   WHERE u.estado = 'ACTIVO'
     AND 'reserva:aprobar_cualquiera' IN (SELECT seguridad.permisos_de(u.id))
  EXCEPT
  SELECT s.solicitante_usuario_id FROM reservas.solicitud s WHERE s.id = p_solicitud;
$$;

COMMENT ON FUNCTION reservas.destinatarios_solicitud(uuid) IS
  'Aprobadores según la regla + usuarios con reserva:aprobar_cualquiera, sin el propio solicitante';
