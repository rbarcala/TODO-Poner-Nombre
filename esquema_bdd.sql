CREATE TABLE tipos_terreno (
    id                  SERIAL PRIMARY KEY,
    nombre              VARCHAR(50)  NOT NULL UNIQUE,
    descripcion         TEXT,
    color_hex           VARCHAR(7)   NOT NULL,
    modificador_ataque  DECIMAL(4,2) DEFAULT 0.9,
    modificador_defensa DECIMAL(4,2) DEFAULT 0.9
);

CREATE TABLE paises (
    id                    SERIAL PRIMARY KEY,
    nombre                VARCHAR(100) NOT NULL,
    color_hex             VARCHAR(7)   NOT NULL,
    economia              SMALLINT     NOT NULL,
    tecnologia            SMALLINT     NOT NULL,
    agresividad           SMALLINT     NOT NULL,
    tropas                INTEGER      NOT NULL,
    resistencia_terreno_id INTEGER REFERENCES tipos_terreno(id)
);

CREATE TABLE partidas (
    id               SERIAL PRIMARY KEY,
    nombre           VARCHAR(100),
    estado           VARCHAR(20)  DEFAULT 'lobby',
    fecha_creacion   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    pais_ganador_id  INTEGER REFERENCES paises(id)
);

CREATE TABLE paises_partidas (
    id              SERIAL PRIMARY KEY,
    pais_id         INTEGER NOT NULL REFERENCES paises(id),
    partida_id      INTEGER NOT NULL REFERENCES partidas(id),
    tropas_actuales INTEGER NOT NULL,
    eliminado       BOOLEAN DEFAULT FALSE,
    UNIQUE (partida_id, pais_id)
);

CREATE TABLE territorios (
    id              SERIAL PRIMARY KEY,
    partida_id      INTEGER  REFERENCES partidas(id),
    nombre          VARCHAR(100),
    coord_x         SMALLINT NOT NULL,
    coord_y         SMALLINT NOT NULL,
    tipo_terreno_id INTEGER  REFERENCES tipos_terreno(id),
    pais_duenio_id  INTEGER  REFERENCES paises(id),
    UNIQUE (partida_id, coord_x, coord_y)
);

CREATE TABLE combates (
    id                   SERIAL PRIMARY KEY,
    partida_id           INTEGER  REFERENCES partidas(id),
    territorio_id        INTEGER  REFERENCES territorios(id),
    numero_turno         INTEGER  NOT NULL,
    pais_atacante_id     INTEGER  NOT NULL REFERENCES paises(id),
    pais_defensor_id     INTEGER  REFERENCES paises(id),
    dados_atacante       SMALLINT NOT NULL,
    dados_defensor       SMALLINT,
    tirada_atacante      SMALLINT NOT NULL,
    tirada_defensor      SMALLINT,
    modificador_terreno  INTEGER  REFERENCES tipos_terreno(id),
    resistencia_atacante BOOLEAN  NOT NULL,
    resistencia_defensor BOOLEAN,
    total_atacante       SMALLINT NOT NULL,
    total_defensor       SMALLINT,
    ganador_atacante     BOOLEAN  NOT NULL
);

CREATE TABLE turnos (
    id             SERIAL PRIMARY KEY,
    partida_id     INTEGER     NOT NULL REFERENCES partidas(id),
    numero_turno   SMALLINT    NOT NULL,
    pais_activo_id INTEGER     REFERENCES paises(id),
    tipo_accion    VARCHAR(30),
    combate_id     INTEGER     REFERENCES combates(id)
);
