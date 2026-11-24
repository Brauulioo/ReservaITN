-- =============================================================================
-- V015 · Foto del daño: la imagen que adjunta Aseo al reportar queda en la base de datos.
-- La tabla reporte_danio_foto (V007) solo guardaba una "clave de almacenamiento" y el ITN no tiene
-- un servicio de archivos; las fotos se reducen en el celular (~300 KB), así que caben en la base y
-- se respaldan junto con el resto de los datos. La clave pasa a ser "db/<id>".
-- =============================================================================
ALTER TABLE mantencion.reporte_danio_foto ADD COLUMN contenido bytea;

ALTER TABLE mantencion.reporte_danio_foto
  ADD CONSTRAINT foto_contenido_coincide_con_tamano
  CHECK (contenido IS NULL OR octet_length(contenido) = tamano_bytes);
