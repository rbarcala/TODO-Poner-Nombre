CREATE TABLE "tipos_de_terreno"(
    "id" SERIAL NOT NULL PRIMARY KEY,
    "nombre" VARCHAR(50) NOT NULL UNIQUE,
    "descripcion" TEXT NULL,
    "color_hex" VARCHAR(7) NOT NULL,
    "modificador_ataque" DECIMAL(4, 2) NULL DEFAULT 0.9,
    "modificador_defensa" DECIMAL(4, 2) NULL DEFAULT 0.9
);

CREATE TABLE "paises"(
    "id" SERIAL NOT NULL PRIMARY KEY,
    "nombre" VARCHAR(100) NOT NULL,
    "color_hex" VARCHAR(7) NOT NULL,
    "economia" SMALLINT NOT NULL,
    "tecnologia" SMALLINT NOT NULL,
    "agresividad" SMALLINT NOT NULL,
    "tropas" INTEGER NOT NULL,
    "resistencia_terreno_id" INTEGER NULL REFERENCES "tipos_de_terreno"("id")
);

CREATE TABLE "partidas"(
    "id" SERIAL NOT NULL PRIMARY KEY,
    "nombre" VARCHAR(100) NULL,
    "estado" VARCHAR(20) NULL DEFAULT 'lobby',
    "fecha_creacion" TIMESTAMP(0) WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    "pais_ganador_id" INTEGER NULL REFERENCES "paises"("id"),
    "turno_actual" INTEGER NOT NULL
);

CREATE TABLE "paises_partidas"(
    "id" SERIAL NOT NULL PRIMARY KEY,
    "pais_id" INTEGER NOT NULL REFERENCES "paises"("id"),
    "partida_id" INTEGER NOT NULL REFERENCES "partidas"("id"),
    "tropas_actuales" INTEGER NOT NULL,
    "eliminado" BOOLEAN NULL DEFAULT FALSE,
    UNIQUE("partida_id", "pais_id")
);

CREATE TABLE "territorios"(
    "id" SERIAL NOT NULL PRIMARY KEY,
    "partida_id" INTEGER NULL REFERENCES "partidas"("id"),
    "nombre" VARCHAR(100) NULL,
    "coord_x" SMALLINT NOT NULL,
    "coord_y" SMALLINT NOT NULL,
    "tipo_terreno_id" INTEGER NULL REFERENCES "tipos_de_terreno"("id"),
    "pais_duenio_id" INTEGER NULL REFERENCES "paises"("id"),
    UNIQUE("partida_id", "coord_x", "coord_y")
);

CREATE TABLE "tipos_de_movimiento"(
    "id" SERIAL NOT NULL PRIMARY KEY,
    "tipo" VARCHAR(255) NOT NULL
);

CREATE TABLE "movimientos"(
    "id" SERIAL NOT NULL PRIMARY KEY,
    "tipo_movimiento" INTEGER NOT NULL REFERENCES "tipos_de_movimiento"("id"),
    "territorio_id" INTEGER NULL REFERENCES "territorios"("id"),
    "pais_atacante_id" INTEGER NOT NULL REFERENCES "paises"("id"),
    "pais_defensor_id" INTEGER NULL REFERENCES "paises"("id"),
    "total_atacante" SMALLINT NOT NULL,
    "total_defensor" SMALLINT NOT NULL,
    "ganador_atacante" BOOLEAN NOT NULL
);

CREATE TABLE "turnos"(
    "id" SERIAL NOT NULL PRIMARY KEY,
    "partida_id" INTEGER NOT NULL REFERENCES "partidas"("id"),
    "numero_turno" SMALLINT NOT NULL,
    "pais_activo_id" INTEGER NULL REFERENCES "paises"("id"),
    "tipo_accion" VARCHAR(30) NULL,
    "combate_id" INTEGER NULL REFERENCES "movimientos"("id")
);

CREATE TABLE "tipos_de_tropas"(
    "id" SERIAL NOT NULL PRIMARY KEY,
    "tipo" VARCHAR(50) NOT NULL UNIQUE,
    "descripcion" TEXT NULL,
    "dado_min" INTEGER NULL,
    "dado_max" INTEGER NULL
);

CREATE TABLE "tropas"(
    "id" SERIAL NOT NULL PRIMARY KEY,
    "id_tipo_tropa" INTEGER NOT NULL UNIQUE REFERENCES "tipos_de_tropas"("id")
);

CREATE TABLE "tropas_estacionadas"(
    "id_territorio" INTEGER NOT NULL REFERENCES "territorios"("id"),
    "id_tropa" INTEGER NOT NULL REFERENCES "tropas"("id")
);

CREATE TABLE "fronteras"(
    "id_territorio_origen" INTEGER NOT NULL REFERENCES "territorios"("id"),
    "id_territorio_destino" INTEGER NOT NULL REFERENCES "territorios"("id"),
    UNIQUE("id_territorio_origen", "id_territorio_destino")
);