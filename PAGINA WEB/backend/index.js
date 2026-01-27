/* eslint-disable no-console */
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// ========================
// Middleware
// ========================
app.use(cors());
app.use(express.json());

// ========================
// Configuración PostgreSQL
// ========================
// Por defecto: admin_gimnasio/admin1234 (según tu SQL)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: +(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'Gimnasio_Ortiz_Oto',
  user: process.env.DB_USER || 'admin_gimnasio',
  password: process.env.DB_PASSWORD || 'admin1234',
  // ssl: { rejectUnauthorized: false } // si usas cloud con SSL
});

const JWT_SECRET = process.env.JWT_SECRET || 'cambia_este_secreto';

// (Opcional) Diagnóstico de variables de entorno (sin exponer la contraseña):
(function diagEnv() {
  const dbg = {
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: process.env.DB_PORT || '5432',
    DB_NAME: process.env.DB_NAME || 'Gimnasio_Ortiz_Oto',
    DB_USER: process.env.DB_USER || 'admin_gimnasio',
    DB_PASSWORD_len: (process.env.DB_PASSWORD || 'admin1234').length
  };
  console.log('🔎 ENV (parcial, sin password):', dbg);
})();

// Verificar conexión a la base de datos
(async () => {
  try {
    const result = await pool.query('SELECT current_database() db, NOW() now');
    console.log('✅ Conectado a PostgreSQL:', result.rows[0].db);
  } catch (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
    console.error('🧭 Intentando con:', {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || '5432',
      database: process.env.DB_NAME || 'Gimnasio_Ortiz_Oto',
      user: process.env.DB_USER || 'admin_gimnasio'
      // password oculto por seguridad
    });
  }
})();

// Helper: ejecutar transacción segura
async function withTransaction(workFn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await workFn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (rb) { console.error('⚠️ Error en ROLLBACK:', rb.message); }
    throw err;
  } finally {
    client.release();
  }
}

// ========================
// Auth helpers (JWT + RBAC)
// ========================
function issueToken(payload) {
  // payload: { sub, rol, nombre, ... }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

function authenticate(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { sub, rol, nombre, ... }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function authorize(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user || !rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }
    next();
  };
}

// ============================================
// RUTAS PÚBLICAS
// ============================================

// 1) Test de conexión básica
app.get('/api/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as hora_servidor, version() as version');
    res.json({
      conexion: '✅ Backend conectado correctamente',
      base_datos: '📊 PostgreSQL operativa',
      version: result.rows[0].version,
      hora_servidor: result.rows[0].hora_servidor
    });
  } catch (error) {
    console.error('Error en test:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2) Registrar nuevo cliente (función SQL si existe; si no, manual con trigger de hashing)
app.post('/api/registrar', async (req, res) => {
  try {
    const { nombre, cedula, telefono, email, password } = req.body;

    console.log('📝 Registrando cliente:', { nombre, email });

    if (!nombre || !cedula || !email || !password) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // Intentar función registrar_cliente
    try {
      const result = await pool.query(
        'SELECT registrar_cliente($1, $2, $3, $4, $5) as id_cliente',
        [nombre, cedula, telefono || '', email, password]
      );
      return res.json({
        success: true,
        mensaje: 'Cliente registrado exitosamente (función)',
        id_cliente: result.rows[0].id_cliente,
        nombre
      });
    } catch (funcError) {
      console.log('⚠️ Función registrar_cliente no disponible, usando registro manual...');
      // Registro manual con transacción (el trigger encripta el password_hash)
      const data = await withTransaction(async (client) => {
        const clienteResult = await client.query(
          `INSERT INTO cliente (nombre, cedula, telefono, email, fecha_registro)
           VALUES ($1, $2, $3, $4, CURRENT_DATE)
           RETURNING id_cliente`,
          [nombre, cedula, telefono || null, email]
        );
        const idCliente = clienteResult.rows[0].id_cliente;

        await client.query(
          `INSERT INTO cliente_auth (id_cliente, email, password_hash, estado)
           VALUES ($1, $2, $3, 'Activo')`,
          [idCliente, email, password]
        );

        return { idCliente };
      });

      return res.json({
        success: true,
        mensaje: 'Cliente registrado manualmente (con trigger de encriptación)',
        id_cliente: data.idCliente,
        nombre
      });
    }
  } catch (error) {
    console.error('❌ Error en registro:', error.message);
    if (error.code === '23505' || /unique|duplicate/i.test(error.message)) {
      return res.status(400).json({ error: 'El email o cédula ya están registrados' });
    }
    return res.status(500).json({ error: 'Error en el servidor: ' + error.message });
  }
});

// 3) Login para todos los roles (emite JWT)
app.post('/api/login-rol', async (req, res) => {
  try {
    const { usuario, password, rol } = req.body;

    console.log(`🔐 Login intentado: ${usuario} - Rol: ${rol}`);

    if (!usuario || !password || !rol) {
      return res.status(400).json({ error: 'Faltan datos para el login' });
    }

    switch ((rol || '').toLowerCase()) {
      case 'cliente': {
        // Primero función login_cliente; si no, fallback con crypt()
        try {
          const result = await pool.query('SELECT * FROM login_cliente($1, $2)', [usuario, password]);
          if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
          }
          const datos = result.rows[0];
          const token = issueToken({ sub: datos.id_cliente, rol: 'cliente', nombre: datos.nombre, email: datos.email });
          return res.json({ success: true, rol: 'cliente', datos, token });
        } catch (funcError) {
          const result = await pool.query(
            `SELECT c.id_cliente, c.nombre, c.email, ca.estado
             FROM cliente c
             INNER JOIN cliente_auth ca ON c.id_cliente = ca.id_cliente
             WHERE ca.email = $1 
               AND ca.estado = 'Activo'
               AND ca.password_hash = crypt($2, ca.password_hash)`,
            [usuario, password]
          );
          if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
          }
          const datos = result.rows[0];
          const token = issueToken({ sub: datos.id_cliente, rol: 'cliente', nombre: datos.nombre, email: datos.email });
          return res.json({ success: true, rol: 'cliente', datos, token });
        }
      }

      case 'administrador': {
        // Según tu diseño, admin es un usuario del sistema, no de la tabla cliente_auth
        if (usuario === 'admin_gimnasio' && password === 'admin1234') {
          const datos = { nombre: 'Administrador Principal', usuario: 'admin_gimnasio', permisos: 'Completos' };
          const token = issueToken({ sub: 'admin_gimnasio', rol: 'administrador', nombre: 'Administrador Principal' });
          return res.json({ success: true, rol: 'administrador', datos, token });
        }
        return res.status(401).json({ error: 'Credenciales de administrador incorrectas' });
      }

      case 'recepcionista': {
        const recepcionistas = {
          recepcion_danahe_dia: 'RecepcionDia123',
          recepcion_gustavo_noche: 'RecepcionNoche123'
        };
        if (recepcionistas[usuario] && recepcionistas[usuario] === password) {
          const datos = { nombre: usuario.replace(/_/g, ' '), turno: usuario.includes('dia') ? 'Día' : 'Noche', usuario };
          const token = issueToken({ sub: usuario, rol: 'recepcionista', nombre: datos.nombre });
          return res.json({ success: true, rol: 'recepcionista', datos, token });
        }
        return res.status(401).json({ error: 'Credenciales de recepcionista incorrectas' });
      }

      case 'entrenador': {
        const resultEntrenador = await pool.query(
          `SELECT id_entrenador, nombre, especialidad, telefono
           FROM entrenador 
           WHERE (telefono = $1 OR LOWER(nombre) LIKE LOWER($2))
           LIMIT 1`,
          [usuario, `%${usuario}%`]
        );
        if (resultEntrenador.rows.length > 0) {
          const datos = resultEntrenador.rows[0];
          // Nota: sin password real (como en tu diseño)
          const token = issueToken({ sub: datos.id_entrenador, rol: 'entrenador', nombre: datos.nombre });
          return res.json({ success: true, rol: 'entrenador', datos, token });
        }
        return res.status(401).json({ error: 'Entrenador no encontrado' });
      }

      case 'nutricionista': {
        const resultNutri = await pool.query(
          `SELECT id_nutricionista, nombre, especialidad, telefono
           FROM nutricionista 
           WHERE (telefono = $1 OR LOWER(nombre) LIKE LOWER($2))
           LIMIT 1`,
          [usuario, `%${usuario}%`]
        );
        if (resultNutri.rows.length > 0) {
          const datos = resultNutri.rows[0];
          const token = issueToken({ sub: datos.id_nutricionista, rol: 'nutricionista', nombre: datos.nombre });
          return res.json({ success: true, rol: 'nutricionista', datos, token });
        }
        return res.status(401).json({ error: 'Nutricionista no encontrado' });
      }

      default:
        return res.status(400).json({ error: 'Rol no válido' });
    }
  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4) Obtener ejercicios (público)
app.get('/api/ejercicios', async (req, res) => {
  try {
    const { grupos } = req.query;
    let query = 'SELECT id_ejercicio, nombre, grupo_muscular, descripcion FROM ejercicio';

    if (grupos && grupos !== '' && grupos !== 'undefined') {
      const gruposArray = String(grupos).split(',').map(s => s.trim()).filter(Boolean);
      const result = await pool.query(`${query} WHERE grupo_muscular = ANY($1) ORDER BY grupo_muscular, nombre`, [gruposArray]);
      return res.json(result.rows);
    }

    const result = await pool.query(`${query} ORDER BY grupo_muscular, nombre`);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en /api/ejercicios:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5) Grupos musculares (público)
app.get('/api/grupos-musculares', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT grupo_muscular FROM ejercicio ORDER BY grupo_muscular');
    res.json(result.rows.map(row => row.grupo_muscular));
  } catch (error) {
    console.error('❌ Error en /api/grupos-musculares:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6) Crear rutina (solo entrenador o admin; id_entrenador del token si es entrenador)
app.post('/api/rutinas/crear', authenticate, authorize('entrenador', 'administrador'), async (req, res) => {
  try {
    const { id_cliente, nombre, nivel, objetivo, ejercicios } = req.body;
    const id_entrenador = req.user.rol === 'entrenador' ? req.user.sub : (req.body.id_entrenador || null);

    console.log(`🏋️ Creando rutina para cliente ${id_cliente}: ${nombre} por ${req.user.rol} (${req.user.sub})`);

    if (!id_cliente || !nombre || !Array.isArray(ejercicios) || ejercicios.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos para crear rutina' });
    }

    const clienteCheck = await pool.query('SELECT id_cliente FROM cliente WHERE id_cliente = $1', [id_cliente]);
    if (clienteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const data = await withTransaction(async (client) => {
      const rutinasActuales = await client.query(
        'SELECT COUNT(*)::int as count FROM rutina WHERE id_cliente = $1',
        [id_cliente]
      );
      if (rutinasActuales.rows[0].count >= 3) {
        throw new Error('El cliente ya tiene el máximo de 3 rutinas asignadas');
      }

      const insertRutinaSql = id_entrenador
        ? `INSERT INTO rutina (nombre, nivel, objetivo, id_cliente, id_entrenador)
           VALUES ($1, $2, $3, $4, $5) RETURNING id_rutina`
        : `INSERT INTO rutina (nombre, nivel, objetivo, id_cliente)
           VALUES ($1, $2, $3, $4) RETURNING id_rutina`;

      const insertRutinaParams = id_entrenador
        ? [nombre, nivel || 'Principiante', objetivo || '', id_cliente, id_entrenador]
        : [nombre, nivel || 'Principiante', objetivo || '', id_cliente];

      const resultRutina = await client.query(insertRutinaSql, insertRutinaParams);
      const idRutina = resultRutina.rows[0].id_rutina;

      for (const ejercicio of ejercicios) {
        await client.query(
          `INSERT INTO rutina_ejercicio 
           (id_rutina, id_ejercicio, series, repeticiones, descanso)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            idRutina,
            ejercicio.id_ejercicio,
            ejercicio.series || 3,
            ejercicio.repeticiones || '10-12',
            ejercicio.descanso || 60
          ]
        );
      }

      return { idRutina };
    });

    res.json({ success: true, mensaje: '✅ Rutina creada exitosamente', id_rutina: data.idRutina });
  } catch (error) {
    console.error('❌ Error creando rutina:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// 7) Dashboard (rutas separadas)
// ===========================

// a) General por rol (sin id) — evita /:id?
app.get('/api/dashboard/:rol', async (req, res) => {
  try {
    const { rol } = req.params;

    console.log(`📊 Dashboard solicitado - Rol: ${rol} (general)`);

    switch ((rol || '').toLowerCase()) {
      case 'cliente':
        return res.status(400).json({ error: 'ID de cliente requerido' });

      case 'administrador': {
        const [estadisticas, ultimasFacturas] = await Promise.all([
          pool.query(`
            SELECT 
              (SELECT COUNT(*) FROM cliente)::int AS total_clientes,
              (SELECT COUNT(*) FROM inscripcion_membresia WHERE estado = 'Activa')::int AS membresias_activas,
              (
                SELECT COALESCE(SUM(total), 0) 
                FROM factura 
                WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE)
              )::numeric AS ingresos_mes
          `),
          pool.query(`
            SELECT f.*, c.nombre AS cliente
            FROM factura f
            JOIN cliente c ON f.id_cliente = c.id_cliente
            ORDER BY f.fecha DESC 
            LIMIT 5
          `)
        ]);

        return res.json({
          estadisticas: estadisticas.rows[0] || {},
          ultimas_facturas: ultimasFacturas.rows || []
        });
      }

      case 'entrenador': {
        const total = await pool.query('SELECT COUNT(*)::int AS count FROM entrenador');
        return res.json({
          mensaje: 'Entrenador - muestra general',
          total_entrenadores: total.rows[0].count
        });
      }

      default:
        return res.json({
          mensaje: `Dashboard para rol: ${rol}`,
          rol,
          timestamp: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error('❌ Error en dashboard (general):', error);
    res.status(500).json({ error: error.message });
  }
});

// b) Por rol + id
app.get('/api/dashboard/:rol/:id', async (req, res) => {
  try {
    const { rol, id } = req.params;

    console.log(`📊 Dashboard solicitado - Rol: ${rol}, ID: ${id}`);

    switch ((rol || '').toLowerCase()) {
      case 'cliente': {
        if (!id) return res.status(400).json({ error: 'ID de cliente requerido' });
        const [cliente, rutinas, membresia] = await Promise.all([
          pool.query('SELECT * FROM cliente WHERE id_cliente = $1', [id]),
          pool.query('SELECT * FROM rutina WHERE id_cliente = $1', [id]),
          pool.query(`
            SELECT m.nombre, im.fecha_inicio, im.fecha_fin, im.estado
            FROM inscripcion_membresia im
            JOIN membresia m ON im.id_membresia = m.id_membresia
            WHERE im.id_cliente = $1 AND im.estado = 'Activa'
            ORDER BY im.fecha_inicio DESC
            LIMIT 1
          `, [id])
        ]);
        return res.json({
          cliente: cliente.rows[0] || {},
          rutinas: rutinas.rows || [],
          membresia: membresia.rows[0] || {}
        });
      }

      case 'entrenador': {
        const clientesEntrenador = await pool.query(
          `SELECT DISTINCT c.* 
           FROM cliente c
           JOIN rutina r ON c.id_cliente = r.id_cliente
           WHERE r.id_entrenador = $1
           ORDER BY c.nombre`,
          [id]
        );
        return res.json({ clientes: clientesEntrenador.rows || [] });
      }

      default:
        return res.json({
          mensaje: `Dashboard para rol: ${rol} con id ${id}`,
          rol,
          id,
          timestamp: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error('❌ Error en dashboard (con id):', error);
    res.status(500).json({ error: error.message });
  }
});

// ======================================================
// 8) Endpoints por ROL con permisos (para el front)
// ======================================================

// ---------- ADMINISTRADOR: lectura total de todo ----------
app.get('/api/admin/clientes', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM cliente ORDER BY id_cliente`);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/admin/clientes', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/clientes/:id', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const { id } = req.params;
    const [cliente, membresias, rutinas, facturas, pagos, evaluaciones, dietas] = await Promise.all([
      pool.query(`SELECT * FROM cliente WHERE id_cliente = $1`, [id]),
      pool.query(`
        SELECT im.*, m.nombre AS membresia
        FROM inscripcion_membresia im
        JOIN membresia m ON im.id_membresia = m.id_membresia
        WHERE im.id_cliente = $1
        ORDER BY im.fecha_inicio DESC
      `, [id]),
      pool.query(`
        SELECT r.*, e.nombre AS entrenador
        FROM rutina r
        LEFT JOIN entrenador e ON r.id_entrenador = e.id_entrenador
        WHERE r.id_cliente = $1
        ORDER BY r.id_rutina DESC
      `, [id]),
      pool.query(`SELECT * FROM factura WHERE id_cliente = $1 ORDER BY fecha DESC`, [id]),
      pool.query(`
        SELECT p.*
        FROM pago p
        JOIN factura f ON p.id_factura = f.id_factura
        WHERE f.id_cliente = $1
        ORDER BY p.fecha_pago DESC
      `, [id]),
      pool.query(`
        SELECT en.*, n.nombre AS nutricionista
        FROM evaluacion_nutricional en
        LEFT JOIN nutricionista n ON en.id_nutricionista = n.id_nutricionista
        WHERE en.id_cliente = $1
        ORDER BY en.fecha DESC
      `, [id]),
      pool.query(`
        SELECT d.*, en.id_cliente
        FROM dieta d
        JOIN evaluacion_nutricional en ON d.id_evaluacion = en.id_evaluacion
        WHERE en.id_cliente = $1
        ORDER BY d.id_dieta DESC
      `, [id]),
    ]);

    const rutinasDetalle = [];
    for (const r of rutinas.rows) {
      const ejercicios = await pool.query(
        `
        SELECT re.*, e.nombre as ejercicio, e.grupo_muscular, e.descripcion
        FROM rutina_ejercicio re
        JOIN ejercicio e ON re.id_ejercicio = e.id_ejercicio
        WHERE re.id_rutina = $1
        ORDER BY re.id_rutina_ejercicio
        `, [r.id_rutina]
      );
      rutinasDetalle.push({ ...r, ejercicios: ejercicios.rows });
    }

    res.json({
      cliente: cliente.rows[0] || null,
      membresias: membresias.rows,
      rutinas: rutinasDetalle,
      facturas: facturas.rows,
      pagos: pagos.rows,
      evaluaciones: evaluaciones.rows,
      dietas: dietas.rows
    });
  } catch (err) {
    console.error('❌ /api/admin/clientes/:id', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/ejercicios', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ejercicio ORDER BY grupo_muscular, nombre`);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/admin/ejercicios', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/dietas', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, en.id_cliente, c.nombre AS cliente
      FROM dieta d
      JOIN evaluacion_nutricional en ON d.id_evaluacion = en.id_evaluacion
      JOIN cliente c ON en.id_cliente = c.id_cliente
      ORDER BY d.id_dieta DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/admin/dietas', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/evaluaciones', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT en.*, c.nombre AS cliente, n.nombre AS nutricionista
      FROM evaluacion_nutricional en
      JOIN cliente c ON en.id_cliente = c.id_cliente
      LEFT JOIN nutricionista n ON en.id_nutricionista = n.id_nutricionista
      ORDER BY en.fecha DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/admin/evaluaciones', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/membresias', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM membresia ORDER BY id_membresia`);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/admin/membresias', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/inscripciones', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT im.*, c.nombre AS cliente, m.nombre AS membresia
      FROM inscripcion_membresia im
      JOIN cliente c ON im.id_cliente = c.id_cliente
      JOIN membresia m ON im.id_membresia = m.id_membresia
      ORDER BY im.id_inscripcionM DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/admin/inscripciones', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/facturas', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*, c.nombre AS cliente
      FROM factura f
      JOIN cliente c ON f.id_cliente = c.id_cliente
      ORDER BY f.fecha DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/admin/facturas', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/pagos', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, f.id_cliente, c.nombre AS cliente
      FROM pago p
      JOIN factura f ON p.id_factura = f.id_factura
      JOIN cliente c ON f.id_cliente = c.id_cliente
      ORDER BY p.fecha_pago DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/admin/pagos', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/entrenadores', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM entrenador ORDER BY id_entrenador`);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/admin/entrenadores', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/nutricionistas', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM nutricionista ORDER BY id_nutricionista`);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/admin/nutricionistas', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- ENTRENADOR ----------
app.get('/api/entrenador/clientes', authenticate, authorize('entrenador', 'administrador'), async (req, res) => {
  try {
    const idEntrenador = req.user.rol === 'entrenador' ? req.user.sub : (req.query.id_entrenador || null);
    const result = await pool.query(
      `
      SELECT DISTINCT c.* 
      FROM cliente c
      JOIN rutina r ON c.id_cliente = r.id_cliente
      ${idEntrenador ? 'WHERE r.id_entrenador = $1' : ''}
      ORDER BY c.nombre
      `,
      idEntrenador ? [idEntrenador] : []
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/entrenador/clientes', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/entrenador/rutinas', authenticate, authorize('entrenador', 'administrador'), async (req, res) => {
  try {
    const idEntrenador = req.user.rol === 'entrenador' ? req.user.sub : (req.query.id_entrenador || null);
    const result = await pool.query(
      `
      SELECT r.*, c.nombre AS cliente
      FROM rutina r
      JOIN cliente c ON r.id_cliente = c.id_cliente
      ${idEntrenador ? 'WHERE r.id_entrenador = $1' : ''}
      ORDER BY r.id_rutina DESC
      `,
      idEntrenador ? [idEntrenador] : []
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/entrenador/rutinas', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/entrenador/rutinas/:id', authenticate, authorize('entrenador', 'administrador'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, nivel, objetivo } = req.body;
    const idEntrenador = req.user.rol === 'entrenador' ? req.user.sub : null;

    const sql = `
      UPDATE rutina
      SET nombre = COALESCE($2, nombre),
          nivel = COALESCE($3, nivel),
          objetivo = COALESCE($4, objetivo)
      WHERE id_rutina = $1
      ${idEntrenador ? 'AND id_entrenador = $5' : ''}
      RETURNING *`;
    const params = idEntrenador ? [id, nombre, nivel, objetivo, idEntrenador] : [id, nombre, nivel, objetivo];

    const result = await pool.query(sql, params);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Rutina no encontrada o no autorizada' });
    res.json({ success: true, rutina: result.rows[0] });
  } catch (err) {
    console.error('❌ PUT /api/entrenador/rutinas/:id', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/entrenador/rutinas/:id/ejercicios', authenticate, authorize('entrenador', 'administrador'), async (req, res) => {
  try {
    const { id } = req.params; // id_rutina
    const { id_ejercicio, series = 3, repeticiones = '10-12', descanso = 60 } = req.body;
    const idEntrenador = req.user.rol === 'entrenador' ? req.user.sub : null;

    // Verificar propiedad de la rutina
    const check = await pool.query(
      `SELECT 1 FROM rutina WHERE id_rutina = $1 ${idEntrenador ? 'AND id_entrenador = $2' : ''}`,
      idEntrenador ? [id, idEntrenador] : [id]
    );
    if (check.rowCount === 0) return res.status(404).json({ error: 'Rutina no encontrada o no autorizada' });

    const result = await pool.query(
      `INSERT INTO rutina_ejercicio (id_rutina, id_ejercicio, series, repeticiones, descanso)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, id_ejercicio, series, repeticiones, descanso]
    );
    res.json({ success: true, rutina_ejercicio: result.rows[0] });
  } catch (err) {
    console.error('❌ POST /api/entrenador/rutinas/:id/ejercicios', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/entrenador/rutinas/:id', authenticate, authorize('entrenador', 'administrador'), async (req, res) => {
  try {
    const { id } = req.params;
    const idEntrenador = req.user.rol === 'entrenador' ? req.user.sub : null;

    const sql = `DELETE FROM rutina WHERE id_rutina = $1 ${idEntrenador ? 'AND id_entrenador = $2' : ''}`;
    const params = idEntrenador ? [id, idEntrenador] : [id];
    const result = await pool.query(sql, params);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Rutina no encontrada o no autorizada' });
    res.json({ success: true, mensaje: 'Rutina eliminada' });
  } catch (err) {
    console.error('❌ DELETE /api/entrenador/rutinas/:id', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- NUTRICIONISTA ----------
app.get('/api/nutri/evaluaciones', authenticate, authorize('nutricionista', 'administrador'), async (req, res) => {
  try {
    const idNutri = req.user.rol === 'nutricionista' ? req.user.sub : (req.query.id_nutricionista || null);
    const result = await pool.query(
      `
      SELECT en.*, c.nombre AS cliente
      FROM evaluacion_nutricional en
      JOIN cliente c ON en.id_cliente = c.id_cliente
      ${idNutri ? 'WHERE en.id_nutricionista = $1' : ''}
      ORDER BY en.fecha DESC
      `,
      idNutri ? [idNutri] : []
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/nutri/evaluaciones', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/nutri/dietas', authenticate, authorize('nutricionista', 'administrador'), async (req, res) => {
  try {
    const idNutri = req.user.rol === 'nutricionista' ? req.user.sub : (req.query.id_nutricionista || null);
    const result = await pool.query(
      `
      SELECT d.*, en.id_cliente, c.nombre AS cliente
      FROM dieta d
      JOIN evaluacion_nutricional en ON d.id_evaluacion = en.id_evaluacion
      JOIN cliente c ON en.id_cliente = c.id_cliente
      ${idNutri ? 'WHERE en.id_nutricionista = $1' : ''}
      ORDER BY d.id_dieta DESC
      `,
      idNutri ? [idNutri] : []
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/nutri/dietas', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/nutri/evaluaciones', authenticate, authorize('nutricionista', 'administrador'), async (req, res) => {
  try {
    const { id_cliente, peso, altura, objetivo, recomendaciones } = req.body;
    const idNutri = req.user.rol === 'nutricionista' ? req.user.sub : (req.body.id_nutricionista || null);

    const result = await pool.query(
      `INSERT INTO evaluacion_nutricional (id_cliente, id_nutricionista, peso, altura, objetivo, recomendaciones)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id_cliente, idNutri, peso, altura, objetivo || null, recomendaciones || null]
    );
    res.json({ success: true, evaluacion: result.rows[0] });
  } catch (err) {
    console.error('❌ POST /api/nutri/evaluaciones', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/nutri/dietas', authenticate, authorize('nutricionista', 'administrador'), async (req, res) => {
  try {
    const { id_evaluacion, descripcion, calorias_diarias } = req.body;
    const result = await pool.query(
      `INSERT INTO dieta (id_evaluacion, descripcion, calorias_diarias)
       VALUES ($1, $2, $3) RETURNING *`,
      [id_evaluacion, descripcion || null, calorias_diarias]
    );
    res.json({ success: true, dieta: result.rows[0] });
  } catch (err) {
    console.error('❌ POST /api/nutri/dietas', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- RECEPCIONISTA ----------
app.post('/api/recepcion/inscripciones', authenticate, authorize('recepcionista', 'administrador'), async (req, res) => {
  try {
    const { id_cliente, id_membresia, fecha_inicio, fecha_fin, estado } = req.body;
    const result = await pool.query(
      `INSERT INTO inscripcion_membresia (id_cliente, id_membresia, fecha_inicio, fecha_fin, estado)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, COALESCE($5, 'Activa'))
       RETURNING *`,
      [id_cliente, id_membresia, fecha_inicio || null, fecha_fin || null, estado || null]
    );
    res.json({ success: true, inscripcion: result.rows[0] });
  } catch (err) {
    console.error('❌ POST /api/recepcion/inscripciones', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/recepcion/facturas', authenticate, authorize('recepcionista', 'administrador'), async (req, res) => {
  try {
    const { id_cliente, total, fecha } = req.body;
    const result = await pool.query(
      `INSERT INTO factura (id_cliente, total, fecha) VALUES ($1, $2, COALESCE($3, CURRENT_TIMESTAMP)) RETURNING *`,
      [id_cliente, total, fecha || null]
    );
    res.json({ success: true, factura: result.rows[0] });
  } catch (err) {
    console.error('❌ POST /api/recepcion/facturas', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/recepcion/pagos', authenticate, authorize('recepcionista', 'administrador'), async (req, res) => {
  try {
    const { id_factura, monto, metodo_pago, fecha_pago } = req.body;
    const result = await pool.query(
      `INSERT INTO pago (id_factura, monto, metodo_pago, fecha_pago)
       VALUES ($1, $2, COALESCE($3, 'Efectivo'), COALESCE($4, CURRENT_TIMESTAMP))
       RETURNING *`,
      [id_factura, monto, metodo_pago || null, fecha_pago || null]
    );
    res.json({ success: true, pago: result.rows[0] });
  } catch (err) {
    console.error('❌ POST /api/recepcion/pagos', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- CLIENTE ----------
app.get('/api/cliente/me', authenticate, authorize('cliente'), async (req, res) => {
  try {
    const idCliente = req.user.sub;
    const [cliente, membresias, rutinas, facturas, pagos, evaluaciones, dietas] = await Promise.all([
      pool.query(`SELECT id_cliente, nombre, telefono, email, fecha_registro FROM cliente WHERE id_cliente = $1`, [idCliente]),
      pool.query(`
        SELECT im.*, m.nombre AS membresia
        FROM inscripcion_membresia im
        JOIN membresia m ON im.id_membresia = m.id_membresia
        WHERE im.id_cliente = $1
        ORDER BY im.fecha_inicio DESC
      `, [idCliente]),
      pool.query(`SELECT id_rutina, nombre, nivel, objetivo FROM rutina WHERE id_cliente = $1`, [idCliente]),
      pool.query(`SELECT * FROM factura WHERE id_cliente = $1 ORDER BY fecha DESC`, [idCliente]),
      pool.query(`
        SELECT p.*
        FROM pago p
        JOIN factura f ON p.id_factura = f.id_factura
        WHERE f.id_cliente = $1
        ORDER BY p.fecha_pago DESC
      `, [idCliente]),
      pool.query(`
        SELECT en.*, n.nombre AS nutricionista
        FROM evaluacion_nutricional en
        LEFT JOIN nutricionista n ON en.id_nutricionista = n.id_nutricionista
        WHERE en.id_cliente = $1
        ORDER BY en.fecha DESC
      `, [idCliente]),
      pool.query(`
        SELECT d.*, en.id_cliente
        FROM dieta d
        JOIN evaluacion_nutricional en ON d.id_evaluacion = en.id_evaluacion
        WHERE en.id_cliente = $1
        ORDER BY d.id_dieta DESC
      `, [idCliente]),
    ]);

    res.json({
      cliente: cliente.rows[0] || null,
      membresias: membresias.rows,
      rutinas: rutinas.rows,
      facturas: facturas.rows,
      pagos: pagos.rows,
      evaluaciones: evaluaciones.rows,
      dietas: dietas.rows
    });
  } catch (err) {
    console.error('❌ GET /api/cliente/me', err);
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// 9) Auditoría (solo admin) y Tablas (público)
// ======================================================
app.get('/api/auditoria/clientes-completos', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id_cliente,
        c.nombre,
        c.cedula,
        c.email,
        m.nombre as membresia,
        im.estado,
        im.fecha_inicio,
        im.fecha_fin,
        COUNT(DISTINCT r.id_rutina) as total_rutinas
      FROM cliente c
      LEFT JOIN inscripcion_membresia im ON c.id_cliente = im.id_cliente
      LEFT JOIN membresia m ON im.id_membresia = m.id_membresia
      LEFT JOIN rutina r ON c.id_cliente = r.id_cliente
      GROUP BY c.id_cliente, c.nombre, c.cedula, c.email, m.nombre, im.estado, im.fecha_inicio, im.fecha_fin
      ORDER BY c.nombre
      LIMIT 20
    `);

    res.json({
      auditoria: 'Consulta JOIN múltiple ejecutada',
      total_registros: result.rowCount,
      datos: result.rows
    });
  } catch (error) {
    console.error('❌ Error en auditoría:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tablas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    res.json({ tablas: result.rows.map(r => r.table_name), total: result.rowCount });
  } catch (error) {
    console.error('❌ Error obteniendo tablas:', error);
    res.status(500).json({ error: error.message });
  }
});

// ======================================================
// 10) Procedimiento Mantenimiento (admin)
// ======================================================
app.post('/api/procedimientos/mantenimiento', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const procExists = await pool.query(
      `
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE specific_schema = 'public'
        AND routine_type = 'PROCEDURE'
        AND routine_name = 'mantenimiento_automatico'
      `
    );

    if (procExists.rows.length === 0) {
      return res.json({
        success: true,
        mensaje: '⚠️ Procedimiento no existe, pero simulación completada',
        nota: 'El procedimiento mantenimiento_automatico no está definido en la BD'
      });
    }

    await pool.query('CALL mantenimiento_automatico()');
    res.json({ success: true, mensaje: '✅ Procedimiento mantenimiento_automatico ejecutado' });
  } catch (error) {
    console.error('❌ Error ejecutando mantenimiento:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CONFIGURACIÓN DEL SERVIDOR
// ============================================

const PORT = process.env.PORT || 5000;

// Ruta raíz (documentación simple)
app.get('/', (req, res) => {
  res.json({
    mensaje: 'Backend Gimnasio Ortiz-Oto API',
    estado: '✅ En línea',
    auth: 'Enviar Authorization: Bearer <token> para endpoints protegidos',
    endpoints: {
      publicos: {
        test: 'GET /api/test',
        ejercicios: 'GET /api/ejercicios',
        grupos_musculares: 'GET /api/grupos-musculares',
        login: 'POST /api/login-rol',
        registrar: 'POST /api/registrar',
        tablas: 'GET /api/tablas'
      },
      cliente: {
        me: 'GET /api/cliente/me'
      },
      entrenador: {
        clientes: 'GET /api/entrenador/clientes',
        rutinas: 'GET /api/entrenador/rutinas',
        crear_rutina: 'POST /api/rutinas/crear',
        editar_rutina: 'PUT /api/entrenador/rutinas/:id',
        agregar_ejercicio: 'POST /api/entrenador/rutinas/:id/ejercicios',
        eliminar_rutina: 'DELETE /api/entrenador/rutinas/:id'
      },
      nutricionista: {
        evaluaciones: 'GET /api/nutri/evaluaciones',
        dietas: 'GET /api/nutri/dietas',
        crear_evaluacion: 'POST /api/nutri/evaluaciones',
        crear_dieta: 'POST /api/nutri/dietas'
      },
      recepcionista: {
        crear_inscripcion: 'POST /api/recepcion/inscripciones',
        crear_factura: 'POST /api/recepcion/facturas',
        crear_pago: 'POST /api/recepcion/pagos'
      },
      administrador: {
        clientes: 'GET /api/admin/clientes',
        cliente_detalle: 'GET /api/admin/clientes/:id',
        ejercicios: 'GET /api/admin/ejercicios',
        dietas: 'GET /api/admin/dietas',
        evaluaciones: 'GET /api/admin/evaluaciones',
        membresias: 'GET /api/admin/membresias',
        inscripciones: 'GET /api/admin/inscripciones',
        facturas: 'GET /api/admin/facturas',
        pagos: 'GET /api/admin/pagos',
        entrenadores: 'GET /api/admin/entrenadores',
        nutricionistas: 'GET /api/admin/nutricionistas',
        mantenimiento: 'POST /api/procedimientos/mantenimiento'
      },
      dashboard: {
        general: 'GET /api/dashboard/:rol',
        por_id: 'GET /api/dashboard/:rol/:id'
      }
    }
  });
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar servidor (como pediste)
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
  console.log(`📊 Accede a: http://localhost:${PORT}/ para ver las rutas`);
});
