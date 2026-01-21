-- Database: Proyecto_Gimnasio_Ortiz_Oto

-- DROP DATABASE IF EXISTS "Proyecto_Gimnasio_Ortiz_Oto";

CREATE DATABASE "Gimnasio_Ortiz_Oto"
    WITH
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'Spanish_Ecuador.1252'
    LC_CTYPE = 'Spanish_Ecuador.1252'
    LOCALE_PROVIDER = 'libc'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1

    IS_TEMPLATE = False;

/*TABLAS*/
CREATE TABLE cliente (
    id_cliente SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    cedula VARCHAR(20) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(150),
    fecha_registro DATE,
    UNIQUE (cedula),
    UNIQUE (email)
);

CREATE TABLE membresia (
    id_membresia SERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    duracion_meses INT NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    descripcion VARCHAR(500)
);

CREATE TABLE inscripcion_membresia (
    id_inscripcionM SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_membresia INT NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado VARCHAR(20),
    UNIQUE (id_cliente, id_membresia, fecha_inicio),
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    FOREIGN KEY (id_membresia) REFERENCES membresia(id_membresia)
);

CREATE TABLE entrenador (
    id_entrenador SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    especialidad VARCHAR(120),
    telefono VARCHAR(20)
);

CREATE TABLE rutina (
    id_rutina SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    nivel VARCHAR(20),
    objetivo VARCHAR(200),
    id_cliente INT NOT NULL,
    id_entrenador INT,
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    FOREIGN KEY (id_entrenador) REFERENCES entrenador(id_entrenador)
);

CREATE TABLE ejercicio (
    id_ejercicio SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    grupo_muscular VARCHAR(80) NOT NULL,
    descripcion VARCHAR(500),
    UNIQUE (nombre, grupo_muscular)
);

CREATE TABLE rutina_ejercicio (
    id_rutina INT NOT NULL,
    id_ejercicio INT NOT NULL,
    series INT,
    repeticiones INT,
    descanso INT,
    PRIMARY KEY (id_rutina, id_ejercicio),
    FOREIGN KEY (id_rutina) REFERENCES rutina(id_rutina),
    FOREIGN KEY (id_ejercicio) REFERENCES ejercicio(id_ejercicio)
);

CREATE TABLE nutricionista (
    id_nutricionista SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    especialidad VARCHAR(120),
    telefono VARCHAR(20)
);

CREATE TABLE evaluacion_nutricional (
    id_evaluacion SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_nutricionista INT,
    peso DECIMAL(5,2),
    altura DECIMAL(4,2),
    imc DECIMAL(5,2),
    objetivo VARCHAR(200),
    recomendaciones VARCHAR(1000),
    fecha DATE,
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    FOREIGN KEY (id_nutricionista) REFERENCES nutricionista(id_nutricionista)
);

CREATE TABLE dieta (
    id_dieta SERIAL PRIMARY KEY,
    id_evaluacion INT NOT NULL,
    descripcion VARCHAR(1000),
    calorias_diarias INT,
    FOREIGN KEY (id_evaluacion) REFERENCES evaluacion_nutricional(id_evaluacion)
);

CREATE TABLE factura (
    id_factura SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL,
    fecha TIMESTAMP,
    total DECIMAL(12,2),
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente)
);

CREATE TABLE pago (
    id_pago SERIAL PRIMARY KEY,
    id_factura INT NOT NULL,
    fecha_pago TIMESTAMP,
    monto DECIMAL(12,2),
    metodo_pago VARCHAR(20),
    FOREIGN KEY (id_factura) REFERENCES factura(id_factura)
);

