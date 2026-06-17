CREATE TABLE "tipos_de_terreno"(
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" TEXT NULL,
    "color_hex" VARCHAR(7) NOT NULL,
    "modificador_ataque" DECIMAL(4, 2) NULL DEFAULT 0.9,
    "modificador_defensa" DECIMAL(4, 2) NULL DEFAULT 0.9
);
ALTER TABLE
    "tipos_de_terreno" ADD PRIMARY KEY("id");
ALTER TABLE
    "tipos_de_terreno" ADD CONSTRAINT "tipos_de_terreno_nombre_unique" UNIQUE("nombre");

CREATE TABLE "paises"(
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "color_hex" VARCHAR(7) NOT NULL,
    "economia" SMALLINT NOT NULL,
    "tecnologia" SMALLINT NOT NULL,
    "agresividad" SMALLINT NOT NULL,
    "tropas" INTEGER NOT NULL,
    "resistencia_terreno_id" INTEGER NULL
);
ALTER TABLE
    "paises" ADD PRIMARY KEY("id");

CREATE TABLE "partidas"(
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NULL,
    "estado" VARCHAR(20) NULL DEFAULT 'lobby',
    "fecha_creacion" TIMESTAMP(0) WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    "pais_ganador_id" INTEGER NULL,
    "turno_actual" INTEGER NOT NULL
);
ALTER TABLE
    "partidas" ADD PRIMARY KEY("id");

CREATE TABLE "paises_partidas"(
    "id" SERIAL NOT NULL,
    "pais_id" INTEGER NOT NULL,
    "partida_id" INTEGER NOT NULL,
    "tropas_actuales" INTEGER NOT NULL,
    "eliminado" BOOLEAN NULL DEFAULT FALSE
);
ALTER TABLE
    "paises_partidas" ADD CONSTRAINT "paises_partidas_partida_id_pais_id_unique" UNIQUE("partida_id", "pais_id");
ALTER TABLE
    "paises_partidas" ADD PRIMARY KEY("id");

CREATE TABLE "territorios"(
    "id" SERIAL NOT NULL,
    "partida_id" INTEGER NULL,
    "nombre" VARCHAR(100) NULL,
    "coord_x" SMALLINT NOT NULL,
    "coord_y" SMALLINT NOT NULL,
    "tipo_terreno_id" INTEGER NULL,
    "pais_duenio_id" INTEGER NULL
);
ALTER TABLE
    "territorios" ADD CONSTRAINT "territorios_partida_id_coord_x_coord_y_unique" UNIQUE("partida_id", "coord_x", "coord_y");
ALTER TABLE
    "territorios" ADD PRIMARY KEY("id");

CREATE TABLE "movimientos"(
    "id" SERIAL NOT NULL,
    "tipo_movimiento" INTEGER NOT NULL,
    "territorio_id" INTEGER NULL,
    "pais_atacante_id" INTEGER NOT NULL,
    "pais_defensor_id" INTEGER NULL,
    "total_atacante" SMALLINT NOT NULL,
    "total_defensor" SMALLINT NOT NULL,
    "ganador_atacante" BOOLEAN NOT NULL
);
ALTER TABLE
    "movimientos" ADD PRIMARY KEY("id");

CREATE TABLE "turnos"(
    "id" SERIAL NOT NULL,
    "partida_id" INTEGER NOT NULL,
    "numero_turno" SMALLINT NOT NULL,
    "pais_activo_id" INTEGER NULL,
    "tipo_accion" VARCHAR(30) NULL,
    "combate_id" INTEGER NULL
);
ALTER TABLE
    "turnos" ADD PRIMARY KEY("id");

CREATE TABLE "tropas"(
    "id" SERIAL NOT NULL,
    "id_tipo_tropa" INTEGER NOT NULL
);
ALTER TABLE
    "tropas" ADD PRIMARY KEY("id");
ALTER TABLE
    "tropas" ADD CONSTRAINT "tropas_id_tipo_tropa_unique" UNIQUE("id_tipo_tropa");

CREATE TABLE "tropas_estacionadas"(
    "id_territorio" INTEGER NOT NULL,
    "id_tropa" INTEGER NOT NULL
);

CREATE TABLE "tipos_de_tropas"(
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "descripcion" TEXT NULL,
    "dado_min" INTEGER NULL,
    "dado_max" INTEGER NULL
);
ALTER TABLE
    "tipos_de_tropas" ADD PRIMARY KEY("id");
ALTER TABLE
    "tipos_de_tropas" ADD CONSTRAINT "tipos_de_tropas_tipo_unique" UNIQUE("tipo");

CREATE TABLE "tipos_de_movimiento"(
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(255) NOT NULL
);
ALTER TABLE
    "tipos_de_movimiento" ADD PRIMARY KEY("id");

ALTER TABLE
    "partidas" ADD CONSTRAINT "partidas_pais_ganador_id_foreign" FOREIGN KEY("pais_ganador_id") REFERENCES "paises"("id");
ALTER TABLE
    "paises_partidas" ADD CONSTRAINT "paises_partidas_partida_id_foreign" FOREIGN KEY("partida_id") REFERENCES "partidas"("id");
ALTER TABLE
    "turnos" ADD CONSTRAINT "turnos_partida_id_foreign" FOREIGN KEY("partida_id") REFERENCES "partidas"("id");
ALTER TABLE
    "territorios" ADD CONSTRAINT "territorios_tipo_terreno_id_foreign" FOREIGN KEY("tipo_terreno_id") REFERENCES "tipos_de_terreno"("id");
ALTER TABLE
    "tropas_estacionadas" ADD CONSTRAINT "tropas_estacionadas_id_tropa_foreign" FOREIGN KEY("id_tropa") REFERENCES "tropas"("id");
ALTER TABLE
    "tropas" ADD CONSTRAINT "tropas_id_tipo_tropa_foreign" FOREIGN KEY("id_tipo_tropa") REFERENCES "tipos_de_tropas"("id");
ALTER TABLE
    "turnos" ADD CONSTRAINT "turnos_pais_activo_id_foreign" FOREIGN KEY("pais_activo_id") REFERENCES "paises"("id");
ALTER TABLE
    "territorios" ADD CONSTRAINT "territorios_pais_duenio_id_foreign" FOREIGN KEY("pais_duenio_id") REFERENCES "paises"("id");
ALTER TABLE
    "territorios" ADD CONSTRAINT "territorios_partida_id_foreign" FOREIGN KEY("partida_id") REFERENCES "partidas"("id");
ALTER TABLE
    "movimientos" ADD CONSTRAINT "movimientos_tipo_movimiento_foreign" FOREIGN KEY("tipo_movimiento") REFERENCES "tipos_de_movimiento"("id");
ALTER TABLE
    "movimientos" ADD CONSTRAINT "movimientos_territorio_id_foreign" FOREIGN KEY("territorio_id") REFERENCES "territorios"("id");
ALTER TABLE
    "tropas_estacionadas" ADD CONSTRAINT "tropas_estacionadas_id_territorio_foreign" FOREIGN KEY("id_territorio") REFERENCES "territorios"("id");
ALTER TABLE
    "movimientos" ADD CONSTRAINT "movimientos_pais_defensor_id_foreign" FOREIGN KEY("pais_defensor_id") REFERENCES "paises"("id");
ALTER TABLE
    "movimientos" ADD CONSTRAINT "movimientos_pais_atacante_id_foreign" FOREIGN KEY("pais_atacante_id") REFERENCES "paises"("id");
ALTER TABLE
    "turnos" ADD CONSTRAINT "turnos_combate_id_foreign" FOREIGN KEY("combate_id") REFERENCES "movimientos"("id");
ALTER TABLE
    "paises" ADD CONSTRAINT "paises_resistencia_terreno_id_foreign" FOREIGN KEY("resistencia_terreno_id") REFERENCES "tipos_de_terreno"("id");
ALTER TABLE
    "paises_partidas" ADD CONSTRAINT "paises_partidas_pais_id_foreign" FOREIGN KEY("pais_id") REFERENCES "paises"("id");

CREATE TABLE "fronteras"(
    "id_territorio_origen" INTEGER NOT NULL,
    "id_territorio_destino" INTEGER NOT NULL
);
ALTER TABLE
    "fronteras" ADD CONSTRAINT "fronteras_origen_destino_unique" UNIQUE("id_territorio_origen", "id_territorio_destino");
ALTER TABLE
    "fronteras" ADD CONSTRAINT "fronteras_id_territorio_origen_foreign" FOREIGN KEY("id_territorio_origen") REFERENCES "territorios"("id");
ALTER TABLE
    "fronteras" ADD CONSTRAINT "fronteras_id_territorio_destino_foreign" FOREIGN KEY("id_territorio_destino") REFERENCES "territorios"("id");
