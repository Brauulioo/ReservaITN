-- =============================================================================
-- V014 · Días no disponibles para reservar
-- 1. Fines de semana: sábado y domingo no se reserva.
-- 2. Períodos no disponibles por días completos (00:00 a 23:59), definidos por Subdirección:
--    vacaciones, recesos, eventos. Se pueden repetir cada año durante N años.
-- 3. La base rechaza cualquier reserva en esos días, venga de la web, la app o la importación.
--    Las órdenes de mantención sí se permiten: es justo cuando conviene hacerlas.
-- =============================================================================
CREATE TABLE institucion.periodo_no_disponible (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motivo        text NOT NULL CHECK (length(trim(motivo)) >= 3),
  desde         date NOT NULL,
  hasta         date NOT NULL,
  sede_id       uuid REFERENCES institucion.sede (id), -- nulo = todas las sedes
  repetir_anios smallint NOT NULL DEFAULT 0 CHECK (repetir_anios BETWEEN 0 AND 30), -- años extra en que se repite
  activo        boolean NOT NULL DEFAULT true,
  creado_por    uuid REFERENCES seguridad.usuario (id),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CHECK (hasta >= desde),
  CHECK (hasta - desde <= 366) -- un período dura como máximo un año
);
CREATE INDEX ON institucion.periodo_no_disponible (desde, hasta) WHERE activo;

CREATE TRIGGER auditar
  AFTER INSERT OR UPDATE OR DELETE ON institucion.periodo_no_disponible
  FOR EACH ROW EXECUTE FUNCTION auditoria.fn_auditar();

-- Motivo por el que un día no está disponible en una sede, o NULL si se puede reservar.
CREATE FUNCTION institucion.motivo_no_disponible(p_sede uuid, p_fecha date) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT motivo FROM (
    SELECT 1 AS orden, 'Fin de semana' AS motivo
     WHERE extract(isodow FROM p_fecha) IN (6, 7)
    UNION ALL
    SELECT 2, d.motivo
      FROM institucion.dia_no_habil d
     WHERE d.fecha = p_fecha AND (d.sede_id IS NULL OR d.sede_id = p_sede)
    UNION ALL
    SELECT 3, p.motivo
      FROM institucion.periodo_no_disponible p
      CROSS JOIN LATERAL generate_series(0, p.repetir_anios) AS k
     WHERE p.activo
       AND (p.sede_id IS NULL OR p.sede_id = p_sede)
       AND p_fecha BETWEEN (p.desde + make_interval(years => k))::date AND (p.hasta + make_interval(years => k))::date
  ) x
  ORDER BY orden
  LIMIT 1;
$$;

-- Días disponibles de una sede (o de todas, con p_sede NULL) entre dos fechas, ambas incluidas.
CREATE FUNCTION institucion.dias_disponibles(p_sede uuid, p_desde date, p_hasta date) RETURNS SETOF date
LANGUAGE sql STABLE AS $$
  SELECT d::date
    FROM generate_series(p_desde, p_hasta, interval '1 day') d
   WHERE institucion.motivo_no_disponible(p_sede, d::date) IS NULL;
$$;

-- La base rechaza una reserva en un día no disponible (salvo la mantención)
CREATE FUNCTION reservas.fn_validar_dia_disponible() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_sede   uuid;
  v_fecha  date := (NEW.inicio AT TIME ZONE 'America/Santiago')::date;
  v_motivo text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.inicio = OLD.inicio AND NEW.espacio_id = OLD.espacio_id THEN
    RETURN NEW;
  END IF;
  IF (SELECT origen FROM reservas.solicitud WHERE id = NEW.solicitud_id) = 'MANTENCION' THEN
    RETURN NEW;
  END IF;
  SELECT e.sede_id INTO v_sede
    FROM institucion.espacio es JOIN institucion.edificio e ON e.id = es.edificio_id
   WHERE es.id = NEW.espacio_id;
  v_motivo := institucion.motivo_no_disponible(v_sede, v_fecha);
  IF v_motivo IS NOT NULL THEN
    RAISE EXCEPTION 'Día no disponible para reservas: el % (%)', to_char(v_fecha, 'DD-MM-YYYY'), v_motivo
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER reserva_en_dia_disponible
  BEFORE INSERT OR UPDATE OF inicio, espacio_id ON reservas.reserva
  FOR EACH ROW EXECUTE FUNCTION reservas.fn_validar_dia_disponible();

-- Permiso para administrar el calendario institucional
INSERT INTO seguridad.permiso (codigo, modulo, descripcion) VALUES
  ('calendario:gestionar', 'institucion', 'Definir días y períodos no disponibles para reservar')
ON CONFLICT (codigo) DO NOTHING;
INSERT INTO seguridad.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM seguridad.rol r, seguridad.permiso p
 WHERE r.codigo = 'SUBDIRECCION' AND p.codigo = 'calendario:gestionar'
ON CONFLICT DO NOTHING;

-- Vacaciones de verano de los estudiantes: 25 de diciembre al 1 de marzo, cada año
INSERT INTO institucion.periodo_no_disponible (motivo, desde, hasta, repetir_anios)
SELECT 'Vacaciones de verano', DATE '2026-12-25', DATE '2027-03-01', 10
 WHERE NOT EXISTS (SELECT 1 FROM institucion.periodo_no_disponible WHERE motivo = 'Vacaciones de verano');
