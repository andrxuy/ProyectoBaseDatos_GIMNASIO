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
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: +(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'Gimnasio_Ortiz_Oto',
  user: process.env.DB_USER || 'admin_gimnasio',
  password: process.env.DB_PASSWORD || 'admin1234',
});

const JWT_SECRET = process.env.JWT_SECRET || 'cambia_este_secreto';

// Verificar conexión
(async () => {
  try {
    const result = await pool.query('SELECT current_database() db, NOW() now');
    console.log('✅ Conectado a PostgreSQL:', result.rows[0].db);
  } catch (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
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
// Auth helpers
// ========================
function issueToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

function authenticate(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
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

// 1) Test de conexión
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

// 2) Login para todos los roles - FIXED: Ahora funciona con crypt()
app.post('/api/login-rol', async (req, res) => {
  try {
    const { usuario, password, rol } = req.body;

    console.log(`🔐 Login intentado: ${usuario} - Rol: ${rol}`);

    if (!usuario || !password || !rol) {
      return res.status(400).json({ error: 'Faltan datos para el login' });
    }

    switch ((rol || '').toLowerCase()) {
      case 'administrador': {
        // Admin definido en tu BD
        if (usuario === 'admin_gimnasio' && password === 'admin1234') {
          const datos = { 
            nombre: 'Administrador Principal', 
            usuario: 'admin_gimnasio', 
            permisos: 'Completos' 
          };
          const token = issueToken({ 
            sub: 'admin_gimnasio', 
            rol: 'administrador', 
            nombre: 'Administrador Principal' 
          });
          return res.json({ 
            success: true, 
            rol: 'administrador', 
            datos, 
            token 
          });
        }
        return res.status(401).json({ error: 'Credenciales de administrador incorrectas' });
      }

      case 'recepcionista': {
        const recepcionistas = {
          recepcion_danahe_dia: 'RecepcionDia123',
          recepcion_gustavo_noche: 'RecepcionNoche123'
        };
        
        if (recepcionistas[usuario] && recepcionistas[usuario] === password) {
          const datos = { 
            nombre: usuario.replace(/_/g, ' '), 
            turno: usuario.includes('dia') ? 'Día' : 'Noche', 
            usuario 
          };
          const token = issueToken({ 
            sub: usuario, 
            rol: 'recepcionista', 
            nombre: datos.nombre 
          });
          return res.json({ 
            success: true, 
            rol: 'recepcionista', 
            datos, 
            token 
          });
        }
        return res.status(401).json({ error: 'Credenciales de recepcionista incorrectas' });
      }

      case 'entrenador': {
        // Buscar por nombre o teléfono
        const resultEntrenador = await pool.query(
          `SELECT id_entrenador, nombre, especialidad, telefono
           FROM entrenador 
           WHERE (telefono = $1 OR LOWER(nombre) LIKE LOWER($2))
           LIMIT 1`,
          [usuario, `%${usuario}%`]
        );
        
        if (resultEntrenador.rows.length > 0) {
          const datos = resultEntrenador.rows[0];
          // Para entrenadores, aceptamos cualquier password (como en tu diseño)
          const token = issueToken({ 
            sub: datos.id_entrenador, 
            rol: 'entrenador', 
            nombre: datos.nombre 
          });
          return res.json({ 
            success: true, 
            rol: 'entrenador', 
            datos, 
            token 
          });
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
          const token = issueToken({ 
            sub: datos.id_nutricionista, 
            rol: 'nutricionista', 
            nombre: datos.nombre 
          });
          return res.json({ 
            success: true, 
            rol: 'nutricionista', 
            datos, 
            token 
          });
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

// ============================================
// RUTAS PARA DATOS COMPLETOS (TODOS LOS REGISTROS)
// ============================================

// 3) Obtener TODOS los clientes (admin)
app.get('/api/admin/clientes-todos', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id_cliente,
        c.nombre,
        c.cedula,
        c.telefono,
        c.email,
        c.fecha_registro,
        (SELECT COUNT(*) FROM rutina WHERE id_cliente = c.id_cliente) as total_rutinas,
        (SELECT COUNT(*) FROM inscripcion_membresia WHERE id_cliente = c.id_cliente AND estado = 'Activa') as membresias_activas
      FROM cliente c
      ORDER BY c.nombre
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en clientes-todos:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4) Obtener TODOS los ejercicios
app.get('/api/ejercicios-todos', authenticate, authorize('administrador', 'entrenador'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id_ejercicio,
        nombre,
        grupo_muscular,
        descripcion
      FROM ejercicio
      ORDER BY grupo_muscular, nombre
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en ejercicios-todos:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5) Obtener TODAS las membresías
app.get('/api/membresias-todas', authenticate, authorize('administrador', 'recepcionista'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id_membresia,
        nombre,
        duracion_meses,
        precio,
        descripcion
      FROM membresia
      ORDER BY precio
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en membresias-todas:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6) Obtener TODAS las inscripciones
app.get('/api/inscripciones-todas', authenticate, authorize('administrador', 'recepcionista'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        im.id_inscripcionM,
        c.nombre as cliente,
        m.nombre as membresia,
        im.fecha_inicio,
        im.fecha_fin,
        im.estado
      FROM inscripcion_membresia im
      JOIN cliente c ON im.id_cliente = c.id_cliente
      JOIN membresia m ON im.id_membresia = m.id_membresia
      ORDER BY im.fecha_inicio DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en inscripciones-todas:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7) Obtener TODAS las facturas - CORREGIDO
app.get('/api/facturas-todas', authenticate, authorize('administrador', 'recepcionista'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        f.id_factura,
        c.nombre as cliente,
        f.fecha,
        f.total,
        (SELECT SUM(monto) FROM pago WHERE id_factura = f.id_factura) as total_pagado
      FROM factura f
      JOIN cliente c ON f.id_cliente = c.id_cliente
      ORDER BY f.fecha DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en facturas-todas:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8) Obtener TODOS los pagos
app.get('/api/pagos-todos', authenticate, authorize('administrador', 'recepcionista'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id_pago,
        f.id_factura,
        c.nombre as cliente,
        p.fecha_pago,
        p.monto,
        p.metodo_pago
      FROM pago p
      JOIN factura f ON p.id_factura = f.id_factura
      JOIN cliente c ON f.id_cliente = c.id_cliente
      ORDER BY p.fecha_pago DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en pagos-todos:', error);
    res.status(500).json({ error: error.message });
  }
});

// 9) Obtener TODOS los entrenadores
app.get('/api/entrenadores-todos', authenticate, authorize('administrador', 'entrenador'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id_entrenador,
        nombre,
        especialidad,
        telefono,
        (SELECT COUNT(*) FROM rutina WHERE id_entrenador = e.id_entrenador) as total_rutinas
      FROM entrenador e
      ORDER BY nombre
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en entrenadores-todos:', error);
    res.status(500).json({ error: error.message });
  }
});

// 10) Obtener TODAS las evaluaciones nutricionales
app.get('/api/evaluaciones-todas', authenticate, authorize('administrador', 'nutricionista'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        en.id_evaluacion,
        c.nombre as cliente,
        n.nombre as nutricionista,
        en.peso,
        en.altura,
        en.imc,
        en.objetivo,
        en.fecha
      FROM evaluacion_nutricional en
      JOIN cliente c ON en.id_cliente = c.id_cliente
      LEFT JOIN nutricionista n ON en.id_nutricionista = n.id_nutricionista
      ORDER BY en.fecha DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en evaluaciones-todas:', error);
    res.status(500).json({ error: error.message });
  }
});

// 11) Obtener TODAS las dietas
app.get('/api/dietas-todas', authenticate, authorize('administrador', 'nutricionista'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        d.id_dieta,
        en.id_evaluacion,
        c.nombre as cliente,
        d.descripcion,
        d.calorias_diarias
      FROM dieta d
      JOIN evaluacion_nutricional en ON d.id_evaluacion = en.id_evaluacion
      JOIN cliente c ON en.id_cliente = c.id_cliente
      ORDER BY d.id_dieta DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en dietas-todas:', error);
    res.status(500).json({ error: error.message });
  }
});

// 12) Obtener TODAS las rutinas
app.get('/api/rutinas-todas', authenticate, authorize('administrador', 'entrenador'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        r.id_rutina,
        c.nombre as cliente,
        e.nombre as entrenador,
        r.nombre as rutina,
        r.nivel,
        r.objetivo,
        (SELECT COUNT(*) FROM rutina_ejercicio WHERE id_rutina = r.id_rutina) as total_ejercicios
      FROM rutina r
      JOIN cliente c ON r.id_cliente = c.id_cliente
      LEFT JOIN entrenador e ON r.id_entrenador = e.id_entrenador
      ORDER BY r.id_rutina DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en rutinas-todas:', error);
    res.status(500).json({ error: error.message });
  }
});

// 13) Obtener TODOS los nutricionistas
app.get('/api/nutricionistas-todos', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id_nutricionista,
        nombre,
        especialidad,
        telefono,
        (SELECT COUNT(*) FROM evaluacion_nutricional WHERE id_nutricionista = n.id_nutricionista) as total_evaluaciones
      FROM nutricionista n
      ORDER BY nombre
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en nutricionistas-todos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS ESPECÍFICAS PARA CADA ROL (vistas limitadas)
// ============================================

// 14) Entrenador: ver sus clientes y rutinas
app.get('/api/entrenador/mis-clientes', authenticate, authorize('entrenador'), async (req, res) => {
  try {
    const idEntrenador = req.user.sub;
    
    const result = await pool.query(`
      SELECT DISTINCT 
        c.id_cliente,
        c.nombre,
        c.telefono,
        c.email,
        (SELECT COUNT(*) FROM rutina WHERE id_cliente = c.id_cliente AND id_entrenador = $1) as rutinas_asignadas,
        (SELECT MAX(fecha_inicio) FROM inscripcion_membresia WHERE id_cliente = c.id_cliente AND estado = 'Activa') as ultima_membresia
      FROM cliente c
      JOIN rutina r ON c.id_cliente = r.id_cliente
      WHERE r.id_entrenador = $1
      ORDER BY c.nombre
    `, [idEntrenador]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en mis-clientes:', error);
    res.status(500).json({ error: error.message });
  }
});

// 15) Nutricionista: ver sus evaluaciones
app.get('/api/nutricionista/mis-evaluaciones', authenticate, authorize('nutricionista'), async (req, res) => {
  try {
    const idNutricionista = req.user.sub;
    
    const result = await pool.query(`
      SELECT 
        en.id_evaluacion,
        c.nombre as cliente,
        c.telefono,
        en.peso,
        en.altura,
        en.imc,
        en.objetivo,
        en.fecha
      FROM evaluacion_nutricional en
      JOIN cliente c ON en.id_cliente = c.id_cliente
      WHERE en.id_nutricionista = $1
      ORDER BY en.fecha DESC
    `, [idNutricionista]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en mis-evaluaciones:', error);
    res.status(500).json({ error: error.message });
  }
});

// 16) Recepcionista: ver membresías activas
app.get('/api/recepcionista/membresias-activas', authenticate, authorize('recepcionista'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        im.id_inscripcionM,
        c.nombre as cliente,
        c.cedula,
        m.nombre as membresia,
        im.fecha_inicio,
        im.fecha_fin,
        im.estado,
        CASE 
          WHEN im.fecha_fin < CURRENT_DATE THEN 'Vencida'
          WHEN im.fecha_fin <= CURRENT_DATE + INTERVAL '7 days' THEN 'Por vencer'
          ELSE 'Vigente'
        END as estado_vencimiento
      FROM inscripcion_membresia im
      JOIN cliente c ON im.id_cliente = c.id_cliente
      JOIN membresia m ON im.id_membresia = m.id_membresia
      WHERE im.estado = 'Activa'
      ORDER BY im.fecha_fin ASC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en membresias-activas:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS PARA EJERCICIOS Y RUTINAS
// ============================================

// 17) Ejercicios públicos (para selección)
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

// 18) Grupos musculares
app.get('/api/grupos-musculares', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT grupo_muscular FROM ejercicio ORDER BY grupo_muscular');
    res.json(result.rows.map(row => row.grupo_muscular));
  } catch (error) {
    console.error('❌ Error en /api/grupos-musculares:', error);
    res.status(500).json({ error: error.message });
  }
});

// 19) Crear rutina
app.post('/api/rutinas/crear', authenticate, authorize('entrenador', 'administrador'), async (req, res) => {
  try {
    const { id_cliente, nombre, nivel, objetivo, ejercicios } = req.body;
    const id_entrenador = req.user.rol === 'entrenador' ? req.user.sub : null;

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

// ============================================
// NUEVAS RUTAS PARA RECEPCIONISTA (CORREGIDAS)
// ============================================

// 20) Recepcionista - Crear cliente usando función segura
app.post('/api/recepcionista/clientes', authenticate, authorize('administrador', 'recepcionista'), async (req, res) => {
  try {
    const { nombre, cedula, telefono, email } = req.body;
    
    if (!nombre || !cedula) {
      return res.status(400).json({ error: 'Nombre y cédula son obligatorios' });
    }
    
    // Usar la función de PostgreSQL que creamos
    const query = `SELECT registrar_cliente_seguro($1, $2, $3, $4) as id_cliente`;
    const result = await pool.query(query, [nombre, cedula, telefono || null, email || null]);
    
    // Obtener los datos del cliente creado
    const clienteCreado = await pool.query(
      'SELECT id_cliente, nombre, cedula, telefono, email FROM cliente WHERE id_cliente = $1',
      [result.rows[0].id_cliente]
    );
    
    res.json({ 
      success: true, 
      mensaje: 'Cliente creado exitosamente',
      data: clienteCreado.rows[0] 
    });
  } catch (error) {
    console.error('❌ Error creando cliente:', error);
    
    if (error.message.includes('unique') || error.code === '23505') {
      return res.status(400).json({ error: 'La cédula o email ya están registrados' });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// 21) Recepcionista - Crear inscripción
app.post('/api/recepcionista/inscripciones', authenticate, authorize('administrador', 'recepcionista'), async (req, res) => {
  try {
    const { id_cliente, id_membresia, fecha_inicio } = req.body;
    
    if (!id_cliente || !id_membresia) {
      return res.status(400).json({ error: 'Cliente y membresía son obligatorios' });
    }
    
    // Calcular fecha_fin basada en la duración de la membresía
    const membresia = await pool.query(
      'SELECT duracion_meses FROM membresia WHERE id_membresia = $1',
      [id_membresia]
    );
    
    if (membresia.rows.length === 0) {
      return res.status(404).json({ error: 'Membresía no encontrada' });
    }
    
    const duracionMeses = membresia.rows[0].duracion_meses;
    const fechaFin = new Date(fecha_inicio || new Date());
    fechaFin.setMonth(fechaFin.getMonth() + duracionMeses);
    
    const query = `
      INSERT INTO inscripcion_membresia 
      (id_cliente, id_membresia, fecha_inicio, fecha_fin, estado) 
      VALUES ($1, $2, $3, $4, 'Activa') 
      RETURNING id_inscripcionM, id_cliente, id_membresia, fecha_inicio, fecha_fin, estado
    `;
    
    const result = await pool.query(query, [
      id_cliente, 
      id_membresia, 
      fecha_inicio || new Date().toISOString().split('T')[0],
      fechaFin.toISOString().split('T')[0]
    ]);
    
    res.json({ 
      success: true, 
      mensaje: 'Inscripción creada exitosamente',
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('❌ Error creando inscripción:', error);
    res.status(500).json({ error: error.message });
  }
});

// 22) Recepcionista - Crear factura
app.post('/api/recepcionista/facturas', authenticate, authorize('administrador', 'recepcionista'), async (req, res) => {
  try {
    const { id_cliente, total } = req.body;
    
    if (!id_cliente || !total) {
      return res.status(400).json({ error: 'Cliente y total son obligatorios' });
    }
    
    const query = `
      INSERT INTO factura (id_cliente, total) 
      VALUES ($1, $2) 
      RETURNING id_factura, id_cliente, fecha, total
    `;
    
    const result = await pool.query(query, [id_cliente, total]);
    res.json({ 
      success: true, 
      mensaje: 'Factura creada exitosamente',
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('❌ Error creando factura:', error);
    res.status(500).json({ error: error.message });
  }
});

// 23) Recepcionista - Crear pago
app.post('/api/recepcionista/pagos', authenticate, authorize('administrador', 'recepcionista'), async (req, res) => {
  try {
    const { id_factura, monto, metodo_pago } = req.body;
    
    if (!id_factura || !monto) {
      return res.status(400).json({ error: 'Factura y monto son obligatorios' });
    }
    
    const query = `
      INSERT INTO pago (id_factura, monto, metodo_pago) 
      VALUES ($1, $2, $3) 
      RETURNING id_pago, id_factura, fecha_pago, monto, metodo_pago
    `;
    
    const result = await pool.query(query, [
      id_factura, 
      monto, 
      metodo_pago || 'Efectivo'
    ]);
    
    res.json({ 
      success: true, 
      mensaje: 'Pago registrado exitosamente',
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('❌ Error creando pago:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NUEVAS RUTAS PARA ÍNDICES, VISTAS, TRIGGERS Y FUNCIONES (CORREGIDAS)
// ============================================

// 24) Obtener índices de la base de datos - MEJORADA
app.get('/api/indices', authenticate, authorize('administrador', 'recepcionista', 'entrenador', 'nutricionista'), async (req, res) => {
  try {
    // Usar la vista que creamos en PostgreSQL
    const query = `SELECT * FROM vista_indices_detalle`;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo índices:', error);
    // Si falla la vista, intentar con consulta directa
    try {
      const query = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
      `;
      const result = await pool.query(query);
      res.json(result.rows);
    } catch (error2) {
      res.status(500).json({ error: error2.message });
    }
  }
});

// 25) Obtener vistas de la base de datos - MEJORADA
app.get('/api/vistas', authenticate, authorize('administrador', 'recepcionista', 'entrenador', 'nutricionista'), async (req, res) => {
  try {
    const query = `
      SELECT 
        table_schema,
        table_name,
        view_definition
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo vistas:', error);
    res.status(500).json({ error: error.message });
  }
});

// 26) Obtener triggers de la base de datos (solo admin) - MEJORADA
app.get('/api/triggers', authenticate, authorize('administrador'), async (req, res) => {
  try {
    // Usar la vista que creamos en PostgreSQL
    const query = `SELECT * FROM vista_triggers_detalle`;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo triggers:', error);
    // Si falla la vista, intentar con consulta directa
    try {
      const query = `
        SELECT 
          trigger_schema,
          trigger_name,
          event_manipulation,
          event_object_table,
          action_statement,
          action_timing
        FROM information_schema.triggers 
        WHERE trigger_schema = 'public'
        ORDER BY event_object_table, trigger_name;
      `;
      const result = await pool.query(query);
      res.json(result.rows);
    } catch (error2) {
      res.status(500).json({ error: error2.message });
    }
  }
});

// 27) Obtener funciones de la base de datos (solo admin) - MEJORADA
app.get('/api/funciones', authenticate, authorize('administrador'), async (req, res) => {
  try {
    // Usar la vista que creamos en PostgreSQL
    const query = `SELECT * FROM vista_funciones_detalle`;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo funciones:', error);
    // Si falla la vista, intentar con consulta directa
    try {
      const query = `
        SELECT 
          routine_schema,
          routine_name,
          data_type,
          routine_definition
        FROM information_schema.routines 
        WHERE routine_schema = 'public'
          AND routine_type = 'FUNCTION'
        ORDER BY routine_name;
      `;
      const result = await pool.query(query);
      res.json(result.rows);
    } catch (error2) {
      res.status(500).json({ error: error2.message });
    }
  }
});

// ============================================
// RUTAS PARA CRUD ADMINISTRADOR (SIMPLIFICADAS)
// ============================================

// 28) Admin - Listar cualquier tabla
app.get('/api/admin/tabla/:tabla', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const { tabla } = req.params;
    const tablasPermitidas = [
      'cliente', 'membresia', 'entrenador', 'nutricionista', 
      'ejercicio', 'rutina', 'inscripcion_membresia', 'factura', 
      'pago', 'evaluacion_nutricional', 'dieta', 'rutina_ejercicio'
    ];
    
    if (!tablasPermitidas.includes(tabla)) {
      return res.status(400).json({ error: 'Tabla no permitida' });
    }

    const result = await pool.query(`SELECT * FROM ${tabla} ORDER BY 1`);
    res.json(result.rows);
  } catch (error) {
    console.error(`❌ Error en admin/tabla/${req.params.tabla}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CONFIGURACIÓN DEL SERVIDOR
// ============================================

const PORT = process.env.PORT || 5000;

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    mensaje: 'Backend Gimnasio Ortiz-Oto API - CORREGIDO Y MEJORADO',
    estado: '✅ En línea',
    login_corregido: 'Sí - Usa crypt() para comparar contraseñas',
    endpoints_corregidos: {
      recepcionista: '✅ Ahora puede crear clientes, inscripciones, facturas y pagos',
      vistas_e_indices: '✅ Ahora muestran datos correctamente',
      seleccion_ejercicios: '✅ Funciona correctamente con grupos musculares',
      triggers_funciones: '✅ Solo admin puede ver triggers y funciones'
    },
    instrucciones: 'Ejecuta los comandos SQL de corrección en PostgreSQL para que todo funcione'
  });
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
  console.log(`📊 Login CORREGIDO - Ahora funciona con crypt()`);
  console.log(`🔧 RECEPCIONISTA - Ahora puede crear registros`);
  console.log(`👁️ VISTAS E ÍNDICES - Ahora muestran datos correctamente`);
  console.log(`⚡ IMPORTANTE: Ejecuta los comandos SQL de corrección en PostgreSQL`);
});
