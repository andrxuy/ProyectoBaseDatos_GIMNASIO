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

-- 1. TABLA CLIENTE
CREATE TABLE cliente (
    id_cliente SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    cedula VARCHAR(20) NOT NULL UNIQUE,
    telefono VARCHAR(20),
    email VARCHAR(150) UNIQUE,
    fecha_registro DATE DEFAULT CURRENT_DATE
);

-- 2. TABLA MEMBRESÍA
CREATE TABLE membresia (
    id_membresia SERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    duracion_meses INT NOT NULL CHECK (duracion_meses > 0),
    precio DECIMAL(10,2) NOT NULL CHECK (precio >= 0),
    descripcion VARCHAR(500)
);

-- 3. TABLA INSCRIPCIÓN MEMBRESÍA
CREATE TABLE inscripcion_membresia (
    id_inscripcionM SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_membresia INT NOT NULL,
    fecha_inicio DATE DEFAULT CURRENT_DATE,
    fecha_fin DATE,
    estado VARCHAR(20) DEFAULT 'Activa' CHECK (estado IN ('Activa', 'Expirada', 'Cancelada')),
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    FOREIGN KEY (id_membresia) REFERENCES membresia(id_membresia)
);

-- 4. TABLA ENTRENADOR
CREATE TABLE entrenador (
    id_entrenador SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    especialidad VARCHAR(50) CHECK (especialidad IN (
        'Fuerza y Acondicionamiento',
        'Pérdida de Peso',
        'Hipertrofia Muscular',
        'Rehabilitación y Prevención',
        'Salud y Bienestar General'
    )),
    telefono VARCHAR(20)
);

-- 5. TABLA RUTINA
CREATE TABLE rutina (
    id_rutina SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    nivel VARCHAR(20) DEFAULT 'Principiante' CHECK (nivel IN ('Principiante', 'Intermedio', 'Avanzado')),
    objetivo VARCHAR(200),
    id_cliente INT NOT NULL,
    id_entrenador INT,
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    FOREIGN KEY (id_entrenador) REFERENCES entrenador(id_entrenador)
);

-- 6. TABLA EJERCICIO
CREATE TABLE ejercicio (
    id_ejercicio SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    grupo_muscular VARCHAR(50) CHECK (grupo_muscular IN (
        'Pecho', 'Espalda', 'Hombros', 'Piernas', 
        'Brazos', 'Abdomen', 'Cardio', 'Full Body'
    )),
    descripcion VARCHAR(500)
);

-- 7. TABLA RUTINA_EJERCICIO
CREATE TABLE rutina_ejercicio (
    id_rutina_ejercicio SERIAL PRIMARY KEY,
    id_rutina INT NOT NULL,
    id_ejercicio INT NOT NULL,
    series INT CHECK (series > 0),
    repeticiones VARCHAR(20),
    descanso INT CHECK (descanso >= 0),
    FOREIGN KEY (id_rutina) REFERENCES rutina(id_rutina) ON DELETE CASCADE,
    FOREIGN KEY (id_ejercicio) REFERENCES ejercicio(id_ejercicio)
);

-- 8. TABLA NUTRICIONISTA
CREATE TABLE nutricionista (
    id_nutricionista SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    especialidad VARCHAR(50) CHECK (especialidad IN (
        'Fuerza y Acondicionamiento',
        'Pérdida de Peso',
        'Hipertrofia Muscular',
        'Rehabilitación y Prevención',
        'Salud y Bienestar General'
    )),
    telefono VARCHAR(20)
);

-- 9. TABLA EVALUACIÓN NUTRICIONAL
CREATE TABLE evaluacion_nutricional (
    id_evaluacion SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_nutricionista INT,
    peso DECIMAL(5,2) CHECK (peso > 0 AND peso < 300),
    altura DECIMAL(4,2) CHECK (altura > 0.5 AND altura < 2.5),
    imc DECIMAL(5,2),
    objetivo VARCHAR(200),
    recomendaciones VARCHAR(1000),
    fecha DATE DEFAULT CURRENT_DATE,
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    FOREIGN KEY (id_nutricionista) REFERENCES nutricionista(id_nutricionista)
);

-- 10. TABLA DIETA
CREATE TABLE dieta (
    id_dieta SERIAL PRIMARY KEY,
    id_evaluacion INT NOT NULL,
    descripcion VARCHAR(1000),
    calorias_diarias INT CHECK (calorias_diarias > 0),
    FOREIGN KEY (id_evaluacion) REFERENCES evaluacion_nutricional(id_evaluacion)
);

-- 11. TABLA FACTURA
CREATE TABLE factura (
    id_factura SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(12,2) CHECK (total >= 0),
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente)
);

-- 12. TABLA PAGO
CREATE TABLE pago (
    id_pago SERIAL PRIMARY KEY,
    id_factura INT NOT NULL,
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    monto DECIMAL(12,2) CHECK (monto > 0),
    metodo_pago VARCHAR(20) DEFAULT 'Efectivo' CHECK (metodo_pago IN (
        'Efectivo',
        'Tarjeta Débito',
        'Tarjeta Crédito',
        'Transferencia Bancaria',
        'Débito Automático'
    )),
    FOREIGN KEY (id_factura) REFERENCES factura(id_factura)
);

----------------------------
-- DATOS DE LOS EJERCICIOS--
----------------------------

-- Insertar ejercicios con grupos musculares
INSERT INTO ejercicio (nombre, grupo_muscular, descripcion) VALUES
-- PECHO
('Press de banca con barra', 'Pecho', 'Ejercicio básico para desarrollo de pectorales'),
('Press de banca con mancuernas', 'Pecho', 'Permite mayor rango de movimiento que con barra'),
('Aperturas con mancuernas', 'Pecho', 'Aislamiento de pectorales para definición'),
('Flexiones', 'Pecho', 'Ejercicio con peso corporal para pecho y tríceps'),
('Press inclinado', 'Pecho', 'Enfocado en porción superior del pectoral'),

-- ESPALDA
('Dominadas', 'Espalda', 'Ejercicio fundamental para espalda ancha'),
('Remo con barra', 'Espalda', 'Para desarrollo de espesor en espalda'),
('Peso muerto', 'Espalda', 'Ejercicio compuesto para espalda baja y piernas'),
('Jalón al pecho', 'Espalda', 'Para amplitud de espalda en máquina'),
('Remo con mancuerna', 'Espalda', 'Ejercicio unilateral para equilibrio muscular'),

-- HOMBROS
('Press militar', 'Hombros', 'Ejercicio básico para desarrollo de hombros'),
('Elevaciones laterales', 'Hombros', 'Para desarrollo de deltoides laterales'),
('Face Pull', 'Hombros', 'Para salud articular y rotadores externos'),
('Press Arnold', 'Hombros', 'Variación con rotación para mayor activación'),
('Encogimientos de hombros', 'Hombros', 'Para desarrollo de trapecio superior'),

-- PIERNAS
('Sentadillas', 'Piernas', 'Ejercicio fundamental para desarrollo de piernas'),
('Prensa de piernas', 'Piernas', 'Para fuerza en piernas con soporte de espalda'),
('Extensiones de cuádriceps', 'Piernas', 'Aislamiento para parte frontal del muslo'),
('Curl femoral', 'Piernas', 'Para isquiotibiales (parte posterior del muslo)'),
('Peso muerto rumano', 'Piernas', 'Para femoral, glúteos y espalda baja'),

-- BRAZOS
('Curl de bíceps con barra', 'Brazos', 'Ejercicio básico para desarrollo de bíceps'),
('Fondos en paralelas', 'Brazos', 'Para tríceps y porción inferior del pecho'),
('Extensión de tríceps en polea', 'Brazos', 'Aislamiento para tríceps con tensión constante'),
('Curl martillo', 'Brazos', 'Para braquial y antebrazo, con agarre neutral'),
('Press francés', 'Brazos', 'Para cabeza larga del tríceps'),

-- ABDOMEN
('Crunch', 'Abdomen', 'Para recto abdominal (six-pack)'),
('Plancha', 'Abdomen', 'Para core completo y estabilidad'),
('Elevaciones de piernas', 'Abdomen', 'Para abdominales inferiores'),
('Russian Twist', 'Abdomen', 'Para oblicuos y rotación del core'),

-- CARDIO
('Correr en cinta', 'Cardio', 'Cardiovascular de impacto para resistencia'),
('Bicicleta estática', 'Cardio', 'Cardio de bajo impacto para piernas'),
('Elíptica', 'Cardio', 'Cardio completo de bajo impacto'),

-- FULL BODY
('Burpees', 'Full Body', 'Ejercicio completo de fuerza y cardio'),
('Clean and Press', 'Full Body', 'Ejercicio olímpico completo'),
('Thruster', 'Full Body', 'Combinación de sentadilla y press');
