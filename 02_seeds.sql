-- Tipos de terreno
INSERT INTO tipos_de_terreno (nombre, descripcion, color_hex, modificador_ataque, modificador_defensa) VALUES
('Llanura', 'Terreno abierto y plano, ideal para grandes batallas.', '#50a85f', 1.00, 1.00),
('Montana', 'Terreno elevado que otorga ventaja defensiva.', '#6B4F4F', 0.80, 1.20),
('Costa', 'Zona de encuentro entre tierra y mar.', '#2a43ce', 0.90, 0.90),
('Urbano', 'Ciudades densas donde el combate es cercano y dificil.', '#696969', 0.70, 1.30),
('Selva', 'Vegetacion densa que dificulta el movimiento.', '#118f00', 0.85, 1.10)
ON CONFLICT (nombre) DO UPDATE SET
descripcion = EXCLUDED.descripcion,
color_hex = EXCLUDED.color_hex,
modificador_ataque = EXCLUDED.modificador_ataque,
modificador_defensa = EXCLUDED.modificador_defensa;

-- Paises
INSERT INTO paises (nombre, color_hex, economia, tecnologia, agresividad, resistencia_terreno_id)
SELECT nombre, color_hex, economia, tecnologia, agresividad, resistencia_terreno_id
FROM (VALUES
('Argentina', '#75AADB', 2, 5, 7, 1),
('Brasil', '#00A111', 5, 4, 6, 1),
('Republica Xeneize', '#004682', 6, 2, 4, 4),
('Nacion Redonda', '#FF0000', 4, 5, 9, 2),
('Imperio Tux', '#000000', 8, 10, 1, 3),
('Uruguay', '#0038A8', 9, 7, 4, 3)
) AS nuevos(nombre, color_hex, economia, tecnologia, agresividad, resistencia_terreno_id)
WHERE NOT EXISTS (
    SELECT 1 FROM paises WHERE paises.nombre = nuevos.nombre
);

-- Tipos de tropas
INSERT INTO tipos_de_tropas (tipo, descripcion, dado_min, dado_max) VALUES
('Infanteria', 'Tropa estandar versatil', 1, 6),
('Caballeria', 'Tropa rapida de asalto', 2, 6),
('Artilleria', 'Tropa de ataque pesado', 1, 8)
ON CONFLICT (tipo) DO UPDATE SET
descripcion = EXCLUDED.descripcion,
dado_min = EXCLUDED.dado_min,
dado_max = EXCLUDED.dado_max;
