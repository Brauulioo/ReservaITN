-- =============================================================================
-- D003 · Cuentas de demostración con nombre propio.
-- D001 ya crea las cuentas con estos nombres y correos; este archivo renombra las que se hubieran
-- cargado antes con los correos genéricos (subdireccion@itn.cl, docente@itn.cl, ...), por ejemplo en la
-- base de la nube. Se identifica a cada persona por su documento (no cambia), así que conserva sus
-- roles y reservas. Es idempotente: sobre una base nueva no cambia nada.
-- Solo datos de demostración; nunca se ejecuta en producción real (ver MIGRAR_OPCIONES en render.yaml).
-- =============================================================================
UPDATE seguridad.persona p
   SET nombres = v.nombres, apellido_paterno = v.apellido, email = v.email
  FROM (VALUES
    ('11111111-1', 'Pedro',     'Fernández', 'pedro.fernandez@itn.cl'),
    ('22222222-2', 'Francisca', 'Urrutia',   'francisca.urrutia@itn.cl'),
    ('33333333-3', 'Camila',    'Rojas',     'camila.rojas@itn.cl'),
    ('44444444-4', 'Matías',    'Soto',      'matias.soto@itn.cl'),
    ('55555555-5', 'Andrea',    'Muñoz',     'andrea.munoz@itn.cl'),
    ('66666666-6', 'Sofía',     'Vargas',    'sofia.vargas@itn.cl'),
    ('77777777-7', 'Jorge',     'Araya',     'jorge.araya@itn.cl'),
    ('88888888-8', 'Rosa',      'Contreras', 'rosa.contreras@itn.cl'),
    ('99999999-9', 'Valentina', 'Pizarro',   'valentina.pizarro@itn.cl')
  ) AS v(documento, nombres, apellido, email)
 WHERE p.tipo_documento = 'RUT' AND p.numero_documento = v.documento
   AND (p.nombres, p.apellido_paterno, p.email) IS DISTINCT FROM (v.nombres, v.apellido, v.email)
   -- solo las cuentas de demostración: si alguien reutilizó el correo nuevo en otra persona, no se toca
   AND NOT EXISTS (SELECT 1 FROM seguridad.persona o WHERE o.email = v.email AND o.id <> p.id);
