-- =============================================================================
-- Reservas de DEMOSTRACIÓN para probar web, app y dashboard. Nunca en producción.
-- Crea, una sola vez, reservas de lunes a viernes desde 4 semanas atrás hasta 4 semanas
-- adelante (relativo al día en que se carga): aprobadas, algunas pendientes y algunas
-- canceladas por Subdirección con su motivo. Cada reserva pasa por las mismas reglas que
-- las reales (anti-choques, transiciones, auditoría); si una choca, se omite.
-- Como en el ITN, la mayoría de las clases viene de la planificación importada (aprobación
-- automática y sin liberación por falta de check-in); el resto son solicitudes de docentes.
-- =============================================================================
DO $$
DECLARE
  ya_cargado boolean;
  sub uuid;
  solicitantes uuid[];
  espacios uuid[];
  tipos uuid[];
  descripciones text[] := ARRAY[
    'Clase de Programación I', 'Laboratorio de Redes', 'Taller de Base de Datos', 'Ayudantía de Matemática',
    'Clase de Anatomía', 'Práctica de Enfermería', 'Reunión de coordinación académica', 'Charla de empleabilidad',
    'Tutoría de Sistemas Operativos', 'Evaluación de Inglés Técnico', 'Clase de Ética profesional', 'Taller de Software'];
  bloques time[][] := ARRAY[
    ARRAY['08:30'::time, '10:00'::time], ARRAY['10:15'::time, '11:45'::time], ARRAY['12:00'::time, '13:30'::time],
    ARRAY['14:30'::time, '16:00'::time], ARRAY['16:15'::time, '17:45'::time], ARRAY['19:00'::time, '20:30'::time]];
  dia date;
  e int; b int; h int;
  ini timestamptz; fin timestamptz;
  quien uuid;
  s_id uuid; r_id uuid;
  creadas int := 0;
  operaciones uuid;
  imp uuid;
  planificada boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM reservas.solicitud WHERE descripcion = 'Reunión de coordinación académica · demo')
    INTO ya_cargado;
  IF ya_cargado THEN
    RAISE NOTICE 'Reservas de demostración ya cargadas';
    RETURN;
  END IF;

  SELECT u.id INTO sub FROM seguridad.usuario u JOIN seguridad.persona p ON p.id = u.persona_id
   WHERE p.email = 'subdireccion@itn.cl';
  SELECT array_agg(u.id ORDER BY p.email) INTO solicitantes FROM seguridad.usuario u
    JOIN seguridad.persona p ON p.id = u.persona_id
   WHERE p.email IN ('docente@itn.cl', 'dir.inf@itn.cl', 'academica@itn.cl', 'dir.enf@itn.cl', 'subdireccion@itn.cl');
  SELECT array_agg(id ORDER BY codigo) INTO espacios FROM institucion.espacio
   WHERE codigo IN ('A-101', 'A-102', 'A-201', 'LAB-INF1', 'LAB-ENF', 'N-101', 'AUD-1', 'EST-1') AND activo;
  SELECT array_agg(id ORDER BY codigo) INTO tipos FROM reservas.tipo_actividad WHERE codigo IN ('CLASE', 'REUNION', 'EVENTO');
  SELECT u.id INTO operaciones FROM seguridad.usuario u JOIN seguridad.persona p ON p.id = u.persona_id
   WHERE p.email = 'operaciones@itn.cl';
  IF sub IS NULL OR solicitantes IS NULL OR espacios IS NULL OR tipos IS NULL THEN
    RAISE NOTICE 'Faltan datos base de demostración (D001); no se cargan reservas';
    RETURN;
  END IF;

  -- Marca de carga única (también sirve de ejemplo de reunión)
  INSERT INTO reservas.solicitud (solicitante_usuario_id, tipo_actividad_id, descripcion, asistentes)
  VALUES (sub, tipos[2], 'Reunión de coordinación académica · demo', 12);

  -- Carga de la planificación semestral de demostración (R9)
  INSERT INTO reservas.importacion (archivo_nombre, periodo_id, usuario_id, total_filas, creado_en)
  SELECT 'planificacion-2026-2-demo.xlsx', id, operaciones, 0, now() - interval '30 days'
    FROM academico.periodo_academico WHERE codigo = '2026-2'
  RETURNING id INTO imp;

  FOR dia IN SELECT d::date FROM generate_series(
      date_trunc('week', now() AT TIME ZONE 'America/Santiago')::date - 28,
      date_trunc('week', now() AT TIME ZONE 'America/Santiago')::date + 32, interval '1 day') d
  LOOP
    CONTINUE WHEN institucion.motivo_no_disponible(NULL, dia) IS NOT NULL; -- solo días hábiles (V014)
    FOR e IN 1 .. array_length(espacios, 1) LOOP
      FOR b IN 1 .. array_length(bloques, 1) LOOP
        h := abs(hashtext(dia::text || '|' || e || '|' || b)) % 100;
        CONTINUE WHEN h >= 42; -- ocupación cercana al 40 %
        ini := (dia + bloques[b][1]) AT TIME ZONE 'America/Santiago';
        fin := (dia + bloques[b][2]) AT TIME ZONE 'America/Santiago';
        quien := solicitantes[1 + h % array_length(solicitantes, 1)];
        -- ~3 de cada 4 son clases de la planificación importada
        planificada := imp IS NOT NULL AND h % 4 <> 0 AND h % 9 <> 0 AND h % 13 <> 0;
        BEGIN
          PERFORM set_config('app.usuario_id', CASE WHEN planificada THEN operaciones ELSE quien END::text, true);
          INSERT INTO reservas.solicitud (solicitante_usuario_id, tipo_actividad_id, descripcion, asistentes, creado_en,
                                          origen, importacion_id)
          VALUES (quien, tipos[CASE WHEN planificada THEN 1 WHEN h % 9 = 0 THEN 2 WHEN h % 13 = 0 THEN 3 ELSE 1 END],
                  descripciones[1 + h % array_length(descripciones, 1)], 8 + h % 30,
                  CASE WHEN planificada THEN now() - interval '30 days' ELSE least(now(), ini - interval '3 days') END,
                  CASE WHEN planificada THEN 'PLANIFICACION' ELSE 'SOLICITUD' END::reservas.origen,
                  CASE WHEN planificada THEN imp END)
          RETURNING id INTO s_id;
          INSERT INTO reservas.reserva (solicitud_id, espacio_id, inicio, fin, estado, expira_en)
          VALUES (s_id, espacios[e], ini, fin, 'PENDIENTE', greatest(now() + interval '2 days', least(ini, now() + interval '5 days')))
          RETURNING id INTO r_id;
          -- Solicitudes futuras: ~1 de cada 3 queda pendiente para probar Aprobaciones
          IF NOT planificada AND ini > now() AND h % 3 = 1 THEN
            NULL;
          ELSE
            -- La planificación se aprueba sola (N4); las solicitudes, Subdirección
            PERFORM set_config('app.usuario_id', CASE WHEN planificada THEN operaciones ELSE sub END::text, true);
            INSERT INTO reservas.aprobacion (solicitud_id, decision, decidido_por_usuario_id, decidido_en, comentario)
            VALUES (s_id, 'APROBADA', CASE WHEN planificada THEN NULL ELSE sub END,
                    CASE WHEN planificada THEN now() - interval '30 days' ELSE least(now(), ini - interval '2 days') END, NULL);
            -- ~1 de cada 25 aprobadas, cancelada por Subdirección con motivo (R5)
            IF h % 25 = 3 THEN
              UPDATE reservas.reserva SET estado = 'CANCELADA' WHERE id = r_id;
              INSERT INTO reservas.cancelacion (reserva_id, usuario_id, motivo)
              VALUES (r_id, sub, 'La sala se usará para una actividad institucional');
            END IF;
          END IF;
          creadas := creadas + 1;
        EXCEPTION WHEN exclusion_violation OR check_violation OR unique_violation THEN
          NULL; -- choque o regla: se omite esta reserva, como haría la API
        END;
      END LOOP;
    END LOOP;
  END LOOP;
  UPDATE reservas.importacion SET total_filas = (SELECT count(*) FROM reservas.solicitud WHERE importacion_id = imp)
   WHERE id = imp;
  RAISE NOTICE 'Reservas de demostración creadas: %', creadas;
END $$;
