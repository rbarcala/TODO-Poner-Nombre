-- Insertamos los tipos de terreno completos respetando la estructura de tu tabla
INSERT INTO tipos_de_terreno (nombre, descripcion, color_hex, modificador_ataque, modificador_defensa) VALUES
('Llanura', 'Terreno abierto y plano, ideal para grandes batallas.', '#75AADB', 1.00, 1.00),
('Montaña', 'Terreno elevado que otorga ventaja defensiva.', '#6B4F4F', 0.80, 1.20),
('Costa', 'Zona de encuentro entre tierra y mar.', '#00D1FF', 0.90, 0.90),
('Urbano', 'Ciudades densas donde el combate es cercano y difícil.', '#555555', 0.70, 1.30),
('Selva', 'Vegetación densa que dificulta el movimiento.', '#2D5A27', 0.85, 1.10);

-- 2. Países
INSERT INTO paises (nombre, color_hex, economia, tecnologia, agresividad, resistencia_terreno_id) VALUES
('Argentina', '#75AADB', 2, 5, 7, 1),
('República Xeneize', '#004682', 6, 2, 4, 4),
('Nación Redonda', '#FF0000', 4, 5, 9, 2),
('Imperio Tux', '#000000', 8, 10, 1, 3),
('Uruguay', '#0038A8', 9, 7, 4, 3);