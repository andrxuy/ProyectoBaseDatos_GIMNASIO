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
// RUTAS PARA RECEPCIONISTA (CREAR REGISTROS)
// ============================================

// 20) Recepcionista - Crear cliente
app.post('/api/recepcionista/clientes', authenticate, authorize('administrador', 'recepcionista'), async (req, res) => {
  try {
    const { nombre, cedula, telefono, email } = req.body;
    
    if (!nombre || !cedula) {
      return res.status(400).json({ error: 'Nombre y cédula son obligatorios' });
    }
    
    // Insertar cliente directamente
    const query = `
      INSERT INTO cliente (nombre, cedula, telefono, email, fecha_registro) 
      VALUES ($1, $2, $3, $4, CURRENT_DATE) 
      RETURNING id_cliente, nombre, cedula, telefono, email, fecha_registro
    `;
    
    const result = await pool.query(query, [nombre, cedula, telefono || null, email || null]);
    
    res.json({ 
      success: true, 
      mensaje: 'Cliente creado exitosamente',
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('❌ Error creando cliente:', error);
    
    if (error.code === '23505' || error.message.includes('unique')) {
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
// RUTAS PARA ÍNDICES, VISTAS, TRIGGERS Y FUNCIONES REALES
// ============================================

// 24) Buscar cliente por cédula usando índice (todos pueden usar)
app.get('/api/buscar-cliente-cedula/:cedula', authenticate, async (req, res) => {
  try {
    const { cedula } = req.params;
    
    const result = await pool.query(`
      SELECT 
        c.id_cliente,
        c.nombre,
        c.cedula,
        c.telefono,
        c.email,
        c.fecha_registro,
        (SELECT estado FROM inscripcion_membresia WHERE id_cliente = c.id_cliente AND estado = 'Activa' LIMIT 1) as estado_membresia,
        (SELECT COUNT(*) FROM rutina WHERE id_cliente = c.id_cliente) as total_rutinas
      FROM cliente c
      WHERE c.cedula = $1
      LIMIT 1
    `, [cedula]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json({ 
      success: true, 
      data: result.rows[0],
      mensaje: 'Cliente encontrado usando índice de cédula'
    });
  } catch (error) {
    console.error('❌ Error buscando cliente por cédula:', error);
    res.status(500).json({ error: error.message });
  }
});

// 25) Ver auditoría de cambios (solo admin)
app.get('/api/auditoria', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const { limite = 100, tabla, fecha_desde, fecha_hasta } = req.query;
    
    let query = `
      SELECT 
        id_auditoria,
        tabla_nombre,
        operacion,
        registro_id,
        datos_old,
        datos_new,
        usuario,
        fecha
      FROM auditoria 
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (tabla) {
      query += ` AND tabla_nombre = $${paramCount}`;
      params.push(tabla);
      paramCount++;
    }
    
    if (fecha_desde) {
      query += ` AND fecha >= $${paramCount}`;
      params.push(fecha_desde);
      paramCount++;
    }
    
    if (fecha_hasta) {
      query += ` AND fecha <= $${paramCount}`;
      params.push(fecha_hasta);
      paramCount++;
    }
    
    query += ` ORDER BY fecha DESC LIMIT $${paramCount}`;
    params.push(parseInt(limite));
    
    const result = await pool.query(query, params);
    
    res.json({ 
      success: true, 
      data: result.rows,
      total: result.rows.length,
      mensaje: 'Registros de auditoría'
    });
  } catch (error) {
    console.error('❌ Error obteniendo auditoría:', error);
    res.status(500).json({ error: error.message });
  }
});

// 26) Ejecutar función específica (solo admin) - MODIFICADA
app.post('/api/ejecutar-funcion/:nombre', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const { nombre } = req.params;
    const { parametros } = req.body;
    
    // Validar funciones permitidas (solo pago ahora)
    const funcionesPermitidas = [
      'registrar_pago_simple'
    ];
    
    if (!funcionesPermitidas.includes(nombre)) {
      return res.status(400).json({ error: 'Función no permitida. Solo se permite: registrar_pago_simple' });
    }
    
    let query = '';
    let result;
    
    switch (nombre) {
      case 'registrar_pago_simple':
        if (!parametros || !parametros.id_factura || !parametros.monto) {
          return res.status(400).json({ error: 'Parámetros faltantes: id_factura, monto' });
        }
        query = 'SELECT registrar_pago_simple($1, $2, $3) as resultado';
        const dbResult = await pool.query(query, [
          parseInt(parametros.id_factura),
          parseFloat(parametros.monto),
          parametros.metodo || 'Efectivo'
        ]);
        
        const funcionResult = dbResult.rows[0].resultado;
        
        if (funcionResult.success) {
          return res.json({ 
            success: true, 
            mensaje: '✅ Pago registrado exitosamente',
            data: funcionResult 
          });
        } else {
          return res.status(400).json({ error: funcionResult.message });
        }
        
      default:
        return res.status(400).json({ error: 'Función no implementada' });
    }
  } catch (error) {
    console.error(`❌ Error ejecutando función ${req.params.nombre}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS CRUD COMPLETAS PARA ADMINISTRADOR
// ============================================

// 27) Admin - Obtener cualquier tabla (CRUD completo)
app.get('/api/admin/tablas/:tabla', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const { tabla } = req.params;
    const { buscar, campo, limite = 100 } = req.query;
    
    // Todas las tablas permitidas
    let query = `SELECT * FROM ${tabla}`;
    const params = [];
    
    if (buscar && campo) {
      query += ` WHERE ${campo}::text ILIKE $1`;
      params.push(`%${buscar}%`);
    }
    
    query += ` ORDER BY 1 LIMIT $${params.length + 1}`;
    params.push(parseInt(limite));
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(`❌ Error obteniendo tabla ${req.params.tabla}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 28) Admin - Crear registro en cualquier tabla
app.post('/api/admin/tablas/:tabla', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const { tabla } = req.params;
    const datos = req.body;
    
    // Quitar id si viene (se generará automáticamente)
    delete datos.id;
    delete datos.id_cliente;
    delete datos.id_membresia;
    delete datos.id_entrenador;
    delete datos.id_nutricionista;
    delete datos.id_ejercicio;
    delete datos.id_rutina;
    delete datos.id_inscripcionM;
    delete datos.id_factura;
    delete datos.id_pago;
    delete datos.id_evaluacion;
    delete datos.id_dieta;
    delete datos.id_rutina_ejercicio;
    delete datos.id_auditoria;
    delete datos.id_auth;
    
    const campos = Object.keys(datos).filter(k => datos[k] !== undefined && datos[k] !== '');
    const valores = campos.map(k => datos[k]);
    
    if (campos.length === 0) {
      return res.status(400).json({ error: 'No hay datos para insertar' });
    }
    
    const placeholders = valores.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${tabla} (${campos.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    
    const result = await pool.query(query, valores);
    
    res.json({ 
      success: true, 
      mensaje: 'Registro creado exitosamente',
      data: result.rows[0] 
    });
  } catch (error) {
    console.error(`❌ Error creando registro en ${req.params.tabla}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 29) Admin - Actualizar registro en cualquier tabla
app.put('/api/admin/tablas/:tabla/:id', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const { tabla, id } = req.params;
    const datos = req.body;
    
    // Quitar campos que no deben actualizarse
    delete datos.id;
    
    const campos = Object.keys(datos).filter(k => datos[k] !== undefined);
    const valores = campos.map(k => datos[k]);
    
    if (campos.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }
    
    // Determinar columna ID según tabla
    let idColumn = 'id';
    switch (tabla) {
      case 'cliente': idColumn = 'id_cliente'; break;
      case 'membresia': idColumn = 'id_membresia'; break;
      case 'entrenador': idColumn = 'id_entrenador'; break;
      case 'nutricionista': idColumn = 'id_nutricionista'; break;
      case 'ejercicio': idColumn = 'id_ejercicio'; break;
      case 'rutina': idColumn = 'id_rutina'; break;
      case 'inscripcion_membresia': idColumn = 'id_inscripcionM'; break;
      case 'factura': idColumn = 'id_factura'; break;
      case 'pago': idColumn = 'id_pago'; break;
      case 'evaluacion_nutricional': idColumn = 'id_evaluacion'; break;
      case 'dieta': idColumn = 'id_dieta'; break;
      case 'rutina_ejercicio': idColumn = 'id_rutina_ejercicio'; break;
      case 'auditoria': idColumn = 'id_auditoria'; break;
      case 'cliente_auth': idColumn = 'id_auth'; break;
      default: idColumn = 'id';
    }
    
    const updates = campos.map((key, i) => `${key} = $${i + 1}`).join(', ');
    valores.push(id);
    
    const query = `UPDATE ${tabla} SET ${updates} WHERE ${idColumn} = $${valores.length} RETURNING *`;
    const result = await pool.query(query, valores);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    
    res.json({ 
      success: true, 
      mensaje: 'Registro actualizado exitosamente',
      data: result.rows[0] 
    });
  } catch (error) {
    console.error(`❌ Error actualizando registro en ${req.params.tabla}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 30) Admin - Eliminar registro en cualquier tabla
app.delete('/api/admin/tablas/:tabla/:id', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const { tabla, id } = req.params;
    
    // Determinar columna ID según tabla
    let idColumn = 'id';
    switch (tabla) {
      case 'cliente': idColumn = 'id_cliente'; break;
      case 'membresia': idColumn = 'id_membresia'; break;
      case 'entrenador': idColumn = 'id_entrenador'; break;
      case 'nutricionista': idColumn = 'id_nutricionista'; break;
      case 'ejercicio': idColumn = 'id_ejercicio'; break;
      case 'rutina': idColumn = 'id_rutina'; break;
      case 'inscripcion_membresia': idColumn = 'id_inscripcionM'; break;
      case 'factura': idColumn = 'id_factura'; break;
      case 'pago': idColumn = 'id_pago'; break;
      case 'evaluacion_nutricional': idColumn = 'id_evaluacion'; break;
      case 'dieta': idColumn = 'id_dieta'; break;
      case 'rutina_ejercicio': idColumn = 'id_rutina_ejercicio'; break;
      case 'auditoria': idColumn = 'id_auditoria'; break;
      case 'cliente_auth': idColumn = 'id_auth'; break;
      default: idColumn = 'id';
    }
    
    const query = `DELETE FROM ${tabla} WHERE ${idColumn} = $1 RETURNING *`;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    
    res.json({ 
      success: true, 
      mensaje: 'Registro eliminado exitosamente',
      data: result.rows[0] 
    });
  } catch (error) {
    console.error(`❌ Error eliminando registro de ${req.params.tabla}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 31) Admin - Obtener lista de tablas disponibles
app.get('/api/admin/tablas-disponibles', authenticate, authorize('administrador'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    res.json(result.rows.map(row => row.table_name));
  } catch (error) {
    console.error('❌ Error obteniendo tablas:', error);
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
    mensaje: 'Backend Gimnasio Ortiz-Oto API - CRUD COMPLETO',
    estado: '✅ En línea',
    funciones_reales: {
      buscar_cliente: 'GET /api/buscar-cliente-cedula/:cedula',
      auditoria: 'GET /api/auditoria (solo admin)',
      ejecutar_funciones: 'POST /api/ejecutar-funcion/:nombre (solo admin)',
      crud_admin: 'GET/POST/PUT/DELETE /api/admin/tablas/:tabla'
    },
    permisos: {
      administrador: 'CRUD completo en todas las tablas + auditoría + ejecutar funciones',
      recepcionista: 'Crear clientes, inscripciones, facturas, pagos',
      entrenador: 'Ver clientes, crear rutinas, ver ejercicios',
      nutricionista: 'Ver evaluaciones, crear dietas'
    }
  });
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
  console.log(`🔧 ADMINISTRADOR: CRUD completo habilitado en todas las tablas`);
  console.log(`🔍 ÍNDICES REALES: Búsqueda por cédula disponible`);
  console.log(`📊 AUDITORÍA: Sistema de auditoría activo`);
  console.log(`⚡ FUNCIONES: Ejecutar funciones de PostgreSQL desde frontend`);
});
