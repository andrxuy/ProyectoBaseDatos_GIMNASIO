import { useState, useEffect } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

function App() {
  const [vista, setVista] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [usuarioLogueado, setUsuarioLogueado] = useState(null);
  const [rolActual, setRolActual] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");

  // Estados del login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginRol, setLoginRol] = useState("");

  // Estados para selección de ejercicios
  const [gruposDisponibles, setGruposDisponibles] = useState([]);
  const [gruposSeleccionados, setGruposSeleccionados] = useState([]);
  const [ejerciciosFiltrados, setEjerciciosFiltrados] = useState([]);
  const [ejerciciosSeleccionados, setEjerciciosSeleccionados] = useState([]);
  const [mostrarEjercicios, setMostrarEjercicios] = useState(false);

  // Estados para crear rutina
  const [nombreRutina, setNombreRutina] = useState("");
  const [nivelRutina, setNivelRutina] = useState("Principiante");
  const [objetivoRutina, setObjetivoRutina] = useState("");

  // Estados para tablas
  const [datosTabla, setDatosTabla] = useState([]);
  const [tituloTabla, setTituloTabla] = useState("");
  const [columnasTabla, setColumnasTabla] = useState([]);

  // Estados específicos de Entrenador
  const [clientesEntrenador, setClientesEntrenador] = useState([]);
  const [clienteSeleccionadoParaRutina, setClienteSeleccionadoParaRutina] = useState("");

  // Estados para CRUD (Administrador)
  const [modoCRUD, setModoCRUD] = useState("listar"); // 'listar', 'crear', 'editar'
  const [tablaActualCRUD, setTablaActualCRUD] = useState("");
  const [formDataCRUD, setFormDataCRUD] = useState({});
  const [idEditando, setIdEditando] = useState(null);

  // Estados para índices y vistas
  const [indices, setIndices] = useState([]);
  const [vistasDB, setVistasDB] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [funciones, setFunciones] = useState([]);

  // Estados para Recepcionista
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: "",
    cedula: "",
    telefono: "",
    email: ""
  });
  const [membresiasDisponibles, setMembresiasDisponibles] = useState([]);
  const [inscripcionData, setInscripcionData] = useState({
    id_cliente: "",
    id_membresia: "",
    fecha_inicio: new Date().toISOString().split('T')[0]
  });

  // Configurar headers de axios
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  // Cargar grupos musculares cuando se entra a selección de ejercicios
  useEffect(() => {
    if (vista === "seleccion-ejercicios") {
      cargarGruposMusculares();
    }
  }, [vista]);

  // ==================== UTILIDADES DE ORDEN POR ID ====================
  const getIdKey = (row) => {
    if (!row || typeof row !== "object") return null;
    const keys = Object.keys(row);

    const idLike = keys.find((k) => /^id_/.test(k));
    if (idLike) return idLike;

    const idSuffix = keys.find((k) => /_id$/.test(k));
    if (idSuffix) return idSuffix;

    if (keys.includes("id")) return "id";

    return null;
  };

  const sortById = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return arr;
    const idKey = getIdKey(arr[0]);
    if (!idKey) return arr;

    return [...arr].sort((a, b) => {
      const av = a[idKey];
      const bv = b[idKey];

      const an = Number(av);
      const bn = Number(bv);
      const aIsNum = !isNaN(an);
      const bIsNum = !isNaN(bn);

      if (aIsNum && bIsNum) return an - bn;

      return String(av).localeCompare(String(bv), "es", {
        sensitivity: "base",
        numeric: true,
      });
    });
  };

  // ==================== FUNCIONES BÁSICAS ====================
  const probarConexion = async () => {
    setCargando(true);
    try {
      const response = await axios.get(`${API_URL}/test`);
      alert(`✅ ${response.data.conexion}\nBase de datos: ${response.data.base_datos}`);
    } catch (error) {
      alert(`❌ Error: ${error.message}\n\nAsegúrate que el backend esté corriendo en http://localhost:5000`);
    } finally {
      setCargando(false);
    }
  };

  const hacerLogin = async () => {
    if (!loginEmail || !loginPassword || !loginRol) {
      alert("Por favor, complete todos los campos del login");
      return;
    }

    setCargando(true);
    try {
      const response = await axios.post(`${API_URL}/login-rol`, {
        usuario: loginEmail,
        password: loginPassword,
        rol: loginRol
      });

      setUsuarioLogueado(response.data.datos);
      setRolActual(response.data.rol);

      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        setToken(response.data.token);
      }

      alert(`✅ Bienvenido ${response.data.datos?.nombre || loginEmail}\nRol: ${response.data.rol}`);
      setVista("dashboard");

      // Limpiar formulario
      setLoginEmail("");
      setLoginPassword("");
      setLoginRol("");

    } catch (error) {
      console.error("Error en login:", error);
      alert(`❌ Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setCargando(false);
    }
  };

  // ==================== FUNCIONES PARA TABLAS ====================
  const cargarGruposMusculares = async () => {
    try {
      const response = await axios.get(`${API_URL}/grupos-musculares`);
      setGruposDisponibles(response.data);
    } catch (error) {
      console.error("Error cargando grupos:", error);
    }
  };

  const cargarEjerciciosPorGrupos = async () => {
    if (gruposSeleccionados.length === 0) {
      setEjerciciosFiltrados([]);
      return;
    }

    try {
      const gruposParam = gruposSeleccionados.join(',');
      const response = await axios.get(`${API_URL}/ejercicios?grupos=${gruposParam}`);
      setEjerciciosFiltrados(sortById(response.data));
      setMostrarEjercicios(true);
    } catch (error) {
      console.error("Error cargando ejercicios:", error);
      alert("Error al cargar ejercicios");
    }
  };

  // ==================== FUNCIONES PARA CADA ROL ====================

  // Admin: cargar todas las tablas
  const adminCargarTabla = async (tipo) => {
    try {
      const endpoints = {
        clientes: "/admin/clientes-todos",
        ejercicios: "/ejercicios-todos",
        membresias: "/membresias-todas",
        inscripciones: "/inscripciones-todas",
        facturas: "/facturas-todas",
        pagos: "/pagos-todos",
        entrenadores: "/entrenadores-todos",
        evaluaciones: "/evaluaciones-todas",
        dietas: "/dietas-todas",
        rutinas: "/rutinas-todas"
      };

      const endpoint = endpoints[tipo];
      if (!endpoint) return;

      const response = await axios.get(`${API_URL}${endpoint}`);
      const ordenados = sortById(response.data);
      setDatosTabla(ordenados);
      setTituloTabla(`Administrador - ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);

      if (ordenados.length > 0) {
        const primeraFila = ordenados[0];
        setColumnasTabla(Object.keys(primeraFila));
      }
    } catch (error) {
      alert(`❌ Error cargando ${tipo}: ${error.response?.data?.error || error.message}`);
    }
  };

  // ==================== FUNCIONES CRUD PARA ADMINISTRADOR ====================
  const adminIniciarCRUD = async (tabla) => {
    setTablaActualCRUD(tabla);
    setModoCRUD("listar");
    setFormDataCRUD({});
    setIdEditando(null);
    
    try {
      const response = await axios.get(`${API_URL}/admin/tabla/${tabla}`);
      setDatosTabla(sortById(response.data));
      setTituloTabla(`Administrar ${tabla}`);
      
      if (response.data.length > 0) {
        setColumnasTabla(Object.keys(response.data[0]));
      }
    } catch (error) {
      alert(`❌ Error cargando ${tabla}: ${error.response?.data?.error || error.message}`);
    }
  };

  // ==================== FUNCIONES PARA ÍNDICES, VISTAS, TRIGGERS Y FUNCIONES ====================
  const cargarIndices = async () => {
    try {
      const response = await axios.get(`${API_URL}/indices`);
      console.log('Índices recibidos:', response.data);
      setDatosTabla(response.data);
      setTituloTabla("Índices de la Base de Datos");
      
      if (response.data.length > 0) {
        setColumnasTabla(Object.keys(response.data[0]));
      } else {
        setColumnasTabla([]);
      }
    } catch (error) {
      alert(`❌ Error cargando índices: ${error.response?.data?.error || error.message}`);
    }
  };

  const cargarVistas = async () => {
    try {
      const response = await axios.get(`${API_URL}/vistas`);
      console.log('Vistas recibidas:', response.data);
      setDatosTabla(response.data);
      setTituloTabla("Vistas de la Base de Datos");
      
      if (response.data.length > 0) {
        setColumnasTabla(Object.keys(response.data[0]));
      } else {
        setColumnasTabla([]);
      }
    } catch (error) {
      alert(`❌ Error cargando vistas: ${error.response?.data?.error || error.message}`);
    }
  };

  const cargarTriggers = async () => {
    try {
      const response = await axios.get(`${API_URL}/triggers`);
      console.log('Triggers recibidos:', response.data);
      setDatosTabla(response.data);
      setTituloTabla("Triggers de la Base de Datos");
      
      if (response.data.length > 0) {
        setColumnasTabla(Object.keys(response.data[0]));
      } else {
        setColumnasTabla([]);
      }
    } catch (error) {
      alert(`❌ Error cargando triggers: ${error.response?.data?.error || error.message}`);
    }
  };

  const cargarFunciones = async () => {
    try {
      const response = await axios.get(`${API_URL}/funciones`);
      console.log('Funciones recibidas:', response.data);
      setDatosTabla(response.data);
      setTituloTabla("Funciones de la Base de Datos");
      
      if (response.data.length > 0) {
        setColumnasTabla(Object.keys(response.data[0]));
      } else {
        setColumnasTabla([]);
      }
    } catch (error) {
      alert(`❌ Error cargando funciones: ${error.response?.data?.error || error.message}`);
    }
  };

  // ==================== FUNCIONES PARA RECEPCIONISTA ====================
  const recepcionistaCargarMembresias = async () => {
    try {
      const response = await axios.get(`${API_URL}/membresias-todas`);
      setMembresiasDisponibles(response.data);
    } catch (error) {
      alert(`❌ Error cargando membresías: ${error.response?.data?.error || error.message}`);
    }
  };

  const recepcionistaCrearCliente = async () => {
    if (!nuevoCliente.nombre || !nuevoCliente.cedula) {
      alert("Nombre y cédula son obligatorios");
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/recepcionista/clientes`, nuevoCliente);
      alert(`✅ Cliente creado exitosamente\nID: ${response.data.data.id_cliente}\nNombre: ${response.data.data.nombre}`);
      setNuevoCliente({ nombre: "", cedula: "", telefono: "", email: "" });
      
      // Recargar clientes
      adminCargarTabla("clientes");
    } catch (error) {
      console.error('❌ Error creando cliente:', error);
      alert(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
  };

  const recepcionistaCrearInscripcion = async () => {
    if (!inscripcionData.id_cliente || !inscripcionData.id_membresia) {
      alert("Seleccione cliente y membresía");
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/recepcionista/inscripciones`, inscripcionData);
      alert(`✅ Inscripción creada exitosamente\nID: ${response.data.data.id_inscripcionM}`);
      setInscripcionData({
        id_cliente: "",
        id_membresia: "",
        fecha_inicio: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('❌ Error creando inscripción:', error);
      alert(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
  };

  const recepcionistaCrearFactura = async (idCliente, monto) => {
    try {
      const response = await axios.post(`${API_URL}/recepcionista/facturas`, {
        id_cliente: idCliente,
        total: monto
      });
      alert(`✅ Factura creada exitosamente\nID: ${response.data.data.id_factura}`);
      return response.data.data.id_factura;
    } catch (error) {
      alert(`❌ Error creando factura: ${error.response?.data?.error || error.message}`);
      return null;
    }
  };

  const recepcionistaRegistrarPago = async (idFactura, monto, metodo) => {
    try {
      const response = await axios.post(`${API_URL}/recepcionista/pagos`, {
        id_factura: idFactura,
        monto: monto,
        metodo_pago: metodo
      });
      alert(`✅ Pago registrado exitosamente\nID Pago: ${response.data.data.id_pago}`);
    } catch (error) {
      alert(`❌ Error registrando pago: ${error.response?.data?.error || error.message}`);
    }
  };

  // ==================== FUNCIONES PARA EJERCICIOS ====================
  const toggleGrupoMuscular = (grupo) => {
    if (gruposSeleccionados.includes(grupo)) {
      setGruposSeleccionados(gruposSeleccionados.filter(g => g !== grupo));
    } else {
      setGruposSeleccionados([...gruposSeleccionados, grupo]);
    }
  };

  const toggleEjercicio = (ejercicio) => {
    const existe = ejerciciosSeleccionados.find(e => e.id_ejercicio === ejercicio.id_ejercicio);
    if (existe) {
      setEjerciciosSeleccionados(ejerciciosSeleccionados.filter(e => e.id_ejercicio !== ejercicio.id_ejercicio));
    } else {
      setEjerciciosSeleccionados([...ejerciciosSeleccionados, {
        id_ejercicio: ejercicio.id_ejercicio,
        nombre: ejercicio.nombre,
        grupo: ejercicio.grupo_muscular,
        series: 3,
        repeticiones: "10-12",
        descanso: 60
      }]);
    }
  };

  const crearRutina = async () => {
    if (!nombreRutina || ejerciciosSeleccionados.length === 0) {
      alert("Por favor, complete el nombre y seleccione ejercicios");
      return;
    }

    if (rolActual === 'entrenador' && !clienteSeleccionadoParaRutina) {
      alert("Selecciona un cliente para asignar la rutina");
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/rutinas/crear`, {
        id_cliente: rolActual === 'entrenador' ? Number(clienteSeleccionadoParaRutina) : usuarioLogueado?.id_cliente,
        nombre: nombreRutina,
        nivel: nivelRutina,
        objetivo: objetivoRutina,
        ejercicios: ejerciciosSeleccionados
      });

      alert(`✅ ${response.data.mensaje}\nID Rutina: ${response.data.id_rutina}`);

      setNombreRutina("");
      setObjetivoRutina("");
      setEjerciciosSeleccionados([]);
      setGruposSeleccionados([]);
      setMostrarEjercicios(false);
      setVista("dashboard");

    } catch (error) {
      console.error("Error creando rutina:", error);
      alert(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
  };

  // ==================== FUNCIONES ESPECÍFICAS POR ROL ====================
  const entrenadorVerClientes = async () => {
    try {
      const response = await axios.get(`${API_URL}/entrenador/mis-clientes`);
      const ordenados = sortById(response.data);
      setDatosTabla(ordenados);
      setTituloTabla("Mis Clientes Asignados");

      if (ordenados.length > 0) {
        const primeraFila = ordenados[0];
        setColumnasTabla(Object.keys(primeraFila));
        setClientesEntrenador(ordenados);
      }
    } catch (error) {
      alert(`❌ Error cargando mis clientes: ${error.response?.data?.error || error.message}`);
    }
  };

  const nutricionistaVerEvaluaciones = async () => {
    try {
      const response = await axios.get(`${API_URL}/nutricionista/mis-evaluaciones`);
      const ordenados = sortById(response.data);
      setDatosTabla(ordenados);
      setTituloTabla("Mis Evaluaciones Nutricionales");

      if (ordenados.length > 0) {
        const primeraFila = ordenados[0];
        setColumnasTabla(Object.keys(primeraFila));
      }
    } catch (error) {
      alert(`❌ Error cargando mis evaluaciones: ${error.response?.data?.error || error.message}`);
    }
  };

  const recepcionistaVerMembresias = async () => {
    try {
      const response = await axios.get(`${API_URL}/recepcionista/membresias-activas`);
      const ordenados = sortById(response.data);
      setDatosTabla(ordenados);
      setTituloTabla("Membresías Activas");

      if (ordenados.length > 0) {
        const primeraFila = ordenados[0];
        setColumnasTabla(Object.keys(primeraFila));
      }
    } catch (error) {
      alert(`❌ Error cargando membresías activas: ${error.response?.data?.error || error.message}`);
    }
  };

  // ==================== FUNCIONES AUXILIARES ====================
  const cerrarSesion = () => {
    setUsuarioLogueado(null);
    setRolActual("");
    setVista("");
    setDatosTabla([]);
    setTituloTabla("");
    setColumnasTabla([]);
    setEjerciciosSeleccionados([]);
    setGruposSeleccionados([]);
    localStorage.removeItem("token");
    setToken("");
    alert("Sesión cerrada correctamente");
  };

  // ==================== RENDERIZADO ====================

  // Renderizar tabla bonita
  const renderTabla = () => {
    if (datosTabla.length === 0 || columnasTabla.length === 0) {
      return <p style={{ color: '#666', fontStyle: 'italic' }}>No hay datos para mostrar</p>;
    }

    return (
      <div style={styles.tablaContainer}>
        <h3 style={styles.tablaTitulo}>{tituloTabla} ({datosTabla.length} registros)</h3>
        <div style={styles.tablaWrapper}>
          <table style={styles.tabla}>
            <thead>
              <tr>
                {columnasTabla.map((columna, index) => (
                  <th key={index} style={styles.th}>
                    {columna.replace(/_/g, ' ').toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datosTabla.map((fila, rowIndex) => {
                return (
                  <tr key={rowIndex} style={rowIndex % 2 === 0 ? styles.filaPar : styles.filaImpar}>
                    {columnasTabla.map((columna, colIndex) => (
                      <td key={colIndex} style={styles.td}>
                        {typeof fila[columna] === 'object' ? 
                         JSON.stringify(fila[columna]) : 
                         String(fila[columna] || '')}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Renderizar panel de recepcionista
  const renderPanelRecepcionista = () => {
    return (
      <div style={styles.panelRecepcionista}>
        <h3>Panel de Recepción</h3>
        
        <div style={styles.seccionRecepcion}>
          <h4>📝 Registrar Nuevo Cliente</h4>
          <div style={styles.formGroup}>
            <input
              style={styles.input}
              placeholder="Nombre completo"
              value={nuevoCliente.nombre}
              onChange={(e) => setNuevoCliente({...nuevoCliente, nombre: e.target.value})}
            />
            <input
              style={styles.input}
              placeholder="Cédula"
              value={nuevoCliente.cedula}
              onChange={(e) => setNuevoCliente({...nuevoCliente, cedula: e.target.value})}
            />
            <input
              style={styles.input}
              placeholder="Teléfono"
              value={nuevoCliente.telefono}
              onChange={(e) => setNuevoCliente({...nuevoCliente, telefono: e.target.value})}
            />
            <input
              style={styles.input}
              placeholder="Email"
              type="email"
              value={nuevoCliente.email}
              onChange={(e) => setNuevoCliente({...nuevoCliente, email: e.target.value})}
            />
            <button style={styles.btnAccion} onClick={recepcionistaCrearCliente}>
              Registrar Cliente
            </button>
          </div>
        </div>

        <div style={styles.seccionRecepcion}>
          <h4>🎟️ Crear Inscripción a Membresía</h4>
          <div style={styles.formGroup}>
            <input
              style={styles.input}
              placeholder="ID Cliente"
              type="number"
              value={inscripcionData.id_cliente}
              onChange={(e) => setInscripcionData({...inscripcionData, id_cliente: e.target.value})}
            />
            <select
              style={styles.input}
              value={inscripcionData.id_membresia}
              onChange={(e) => setInscripcionData({...inscripcionData, id_membresia: e.target.value})}
            >
              <option value="">Seleccionar membresía</option>
              {membresiasDisponibles.map(m => (
                <option key={m.id_membresia} value={m.id_membresia}>
                  {m.nombre} - ${m.precio}
                </option>
              ))}
            </select>
            <input
              style={styles.input}
              type="date"
              value={inscripcionData.fecha_inicio}
              onChange={(e) => setInscripcionData({...inscripcionData, fecha_inicio: e.target.value})}
            />
            <button style={styles.btnAccion} onClick={recepcionistaCrearInscripcion}>
              Crear Inscripción
            </button>
          </div>
        </div>

        <div style={styles.seccionRecepcion}>
          <h4>💸 Generar Factura y Pago</h4>
          <div style={styles.formGroup}>
            <input
              style={styles.input}
              placeholder="ID Cliente"
              type="number"
              id="facturaCliente"
            />
            <input
              style={styles.input}
              placeholder="Monto"
              type="number"
              step="0.01"
              id="facturaMonto"
            />
            <select style={styles.input} id="facturaMetodo">
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta Débito">Tarjeta Débito</option>
              <option value="Tarjeta Crédito">Tarjeta Crédito</option>
              <option value="Transferencia Bancaria">Transferencia Bancaria</option>
              <option value="Débito Automático">Débito Automático</option>
            </select>
            <button style={styles.btnAccion} onClick={async () => {
              const idCliente = document.getElementById('facturaCliente').value;
              const monto = document.getElementById('facturaMonto').value;
              const metodo = document.getElementById('facturaMetodo').value;
              
              if (!idCliente || !monto) {
                alert("Complete todos los campos");
                return;
              }
              
              const idFactura = await recepcionistaCrearFactura(idCliente, monto);
              if (idFactura) {
                await recepcionistaRegistrarPago(idFactura, monto, metodo);
              }
            }}>
              Generar Factura y Pago
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Renderizar dashboard según rol
  const renderDashboard = () => {
    return (
      <div style={styles.dashboard}>
        <h2>Panel de {rolActual.charAt(0).toUpperCase() + rolActual.slice(1)}</h2>
        <p style={styles.bienvenida}>Bienvenido, <strong>{usuarioLogueado?.nombre || usuarioLogueado}</strong></p>

        {/* Botones según rol */}
        <div style={styles.botonesDashboard}>
          {/* Administrador */}
          {rolActual === 'administrador' && (
            <>
              <button style={styles.btnDashboard} onClick={() => adminIniciarCRUD("clientes")}>👥 Gestionar Clientes</button>
              <button style={styles.btnDashboard} onClick={() => adminIniciarCRUD("membresias")}>🎟️ Gestionar Membresías</button>
              <button style={styles.btnDashboard} onClick={() => adminIniciarCRUD("entrenadores")}>🏅 Gestionar Entrenadores</button>
              <button style={styles.btnDashboard} onClick={() => adminIniciarCRUD("nutricionistas")}>🥗 Gestionar Nutricionistas</button>
              <button style={styles.btnDashboard} onClick={() => adminIniciarCRUD("ejercicios")}>🏋️ Gestionar Ejercicios</button>
              <button style={styles.btnDashboard} onClick={() => adminIniciarCRUD("rutinas")}>📋 Gestionar Rutinas</button>
              <button style={styles.btnDashboard} onClick={() => adminCargarTabla("inscripciones")}>📝 Ver Inscripciones</button>
              <button style={styles.btnDashboard} onClick={() => adminCargarTabla("facturas")}>💸 Ver Facturas</button>
              <button style={styles.btnDashboard} onClick={() => adminCargarTabla("pagos")}>💰 Ver Pagos</button>
              <button style={styles.btnDashboard} onClick={() => adminCargarTabla("evaluaciones")}>🧪 Ver Evaluaciones</button>
              <button style={styles.btnDashboard} onClick={() => adminCargarTabla("dietas")}>🍽️ Ver Dietas</button>
              
              {/* Índices, Vistas, Triggers y Funciones */}
              <button style={styles.btnDashboard} onClick={cargarIndices}>📊 Ver Índices</button>
              <button style={styles.btnDashboard} onClick={cargarVistas}>👁️ Ver Vistas</button>
              <button style={styles.btnDashboard} onClick={cargarTriggers}>⚡ Ver Triggers</button>
              <button style={styles.btnDashboard} onClick={cargarFunciones}>🔧 Ver Funciones</button>
            </>
          )}

          {/* Recepcionista */}
          {rolActual === 'recepcionista' && (
            <>
              <button style={styles.btnDashboard} onClick={() => {
                adminCargarTabla("clientes");
                recepcionistaCargarMembresias();
              }}>👥 Ver Clientes</button>
              <button style={styles.btnDashboard} onClick={() => recepcionistaVerMembresias()}>🎟️ Ver Membresías Activas</button>
              <button style={styles.btnDashboard} onClick={() => adminCargarTabla("inscripciones")}>📝 Ver Inscripciones</button>
              <button style={styles.btnDashboard} onClick={() => adminCargarTabla("facturas")}>💸 Ver Facturas</button>
              <button style={styles.btnDashboard} onClick={() => adminCargarTabla("pagos")}>💰 Ver Pagos</button>
              
              {/* Índices y Vistas para recepcionista */}
              <button style={styles.btnDashboard} onClick={cargarIndices}>📊 Ver Índices</button>
              <button style={styles.btnDashboard} onClick={cargarVistas}>👁️ Ver Vistas</button>
            </>
          )}

          {/* Entrenador */}
          {rolActual === 'entrenador' && (
            <>
              <button style={styles.btnDashboard} onClick={entrenadorVerClientes}>👥 Ver Mis Clientes</button>
              <button style={styles.btnDashboard} onClick={() => adminCargarTabla("ejercicios")}>🏋️ Ver Ejercicios</button>
              <button style={styles.btnDashboard} onClick={() => adminCargarTabla("rutinas")}>📋 Ver Todas las Rutinas</button>
              <button
                style={styles.btnDashboard}
                onClick={async () => {
                  await entrenadorVerClientes();
                  await cargarGruposMusculares();
                  setVista("seleccion-ejercicios");
                }}
              >
                ➕ Crear Nueva Rutina
              </button>
              
              {/* Índices y Vistas para entrenador */}
              <button style={styles.btnDashboard} onClick={cargarIndices}>📊 Ver Índices</button>
              <button style={styles.btnDashboard} onClick={cargarVistas}>👁️ Ver Vistas</button>
            </>
          )}

          {/* Nutricionista */}
          {rolActual === 'nutricionista' && (
            <>
              <button style={styles.btnDashboard} onClick={nutricionistaVerEvaluaciones}>🧪 Ver Mis Evaluaciones</button>
              <button style={styles.btnDashboard} onClick={() => adminCargarTabla("dietas")}>🥗 Ver Todas las Dietas</button>
              <button style={styles.btnDashboard} onClick={() => adminCargarTabla("evaluaciones")}>📊 Ver Todas las Evaluaciones</button>
              
              {/* Índices y Vistas para nutricionista */}
              <button style={styles.btnDashboard} onClick={cargarIndices}>📊 Ver Índices</button>
              <button style={styles.btnDashboard} onClick={cargarVistas}>👁️ Ver Vistas</button>
            </>
          )}

          <button style={styles.btnCerrarSesion} onClick={cerrarSesion}>🚪 Cerrar Sesión</button>
        </div>

        {/* Panel de Recepcionista */}
        {rolActual === 'recepcionista' && renderPanelRecepcionista()}

        {/* Mostrar tabla si hay datos */}
        {tituloTabla && renderTabla()}
      </div>
    );
  };

  // Renderizar selección de ejercicios
  const renderSeleccionEjercicios = () => {
    return (
      <div style={styles.seleccionContainer}>
        <h2>Crear Nueva Rutina</h2>

        {/* Si es entrenador, seleccionar cliente */}
        {rolActual === 'entrenador' && clientesEntrenador.length > 0 && (
          <div style={styles.formRutina}>
            <label style={styles.label}>Selecciona cliente:</label>
            <select
              style={styles.input}
              value={clienteSeleccionadoParaRutina}
              onChange={(e) => setClienteSeleccionadoParaRutina(e.target.value)}
            >
              <option value="">Selecciona cliente</option>
              {clientesEntrenador.map(c => (
                <option key={c.id_cliente} value={c.id_cliente}>
                  #{c.id_cliente} - {c.nombre} ({c.email})
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={styles.formRutina}>
          <input
            style={styles.input}
            placeholder="Nombre de la rutina"
            value={nombreRutina}
            onChange={(e) => setNombreRutina(e.target.value)}
          />

          <select
            style={styles.input}
            value={nivelRutina}
            onChange={(e) => setNivelRutina(e.target.value)}
          >
            <option value="Principiante">Principiante</option>
            <option value="Intermedio">Intermedio</option>
            <option value="Avanzado">Avanzado</option>
          </select>

          <input
            style={styles.input}
            placeholder="Objetivo (ej: Ganar masa muscular)"
            value={objetivoRutina}
            onChange={(e) => setObjetivoRutina(e.target.value)}
          />
        </div>

        <h3>Selecciona Grupos Musculares (puedes elegir varios):</h3>
        <div style={styles.gruposContainer}>
          {gruposDisponibles.map(grupo => (
            <button
              key={grupo}
              style={{
                ...styles.btnGrupo,
                backgroundColor: gruposSeleccionados.includes(grupo) ? '#2c3e50' : '#ecf0f1',
                color: gruposSeleccionados.includes(grupo) ? 'white' : '#2c3e50'
              }}
              onClick={() => toggleGrupoMuscular(grupo)}
            >
              {grupo} {gruposSeleccionados.includes(grupo) ? '✓' : ''}
            </button>
          ))}
        </div>

        <button
          style={styles.btnCargarEjercicios}
          onClick={cargarEjerciciosPorGrupos}
          disabled={gruposSeleccionados.length === 0}
        >
          {gruposSeleccionados.length === 0
            ? 'Selecciona grupos primero'
            : `Ver Ejercicios (${gruposSeleccionados.length} grupos)`}
        </button>

        {mostrarEjercicios && ejerciciosFiltrados.length > 0 && (
          <>
            <h3>Ejercicios Disponibles ({ejerciciosFiltrados.length}):</h3>
            <div style={styles.ejerciciosLista}>
              {ejerciciosFiltrados.map(ejercicio => (
                <div
                  key={ejercicio.id_ejercicio}
                  style={{
                    ...styles.cardEjercicio,
                    borderColor: ejerciciosSeleccionados.find(e => e.id_ejercicio === ejercicio.id_ejercicio)
                      ? '#2ecc71' : '#ddd'
                  }}
                  onClick={() => toggleEjercicio(ejercicio)}
                >
                  <h4>{ejercicio.nombre}</h4>
                  <p><strong>Grupo:</strong> {ejercicio.grupo_muscular}</p>
                  <p>{ejercicio.descripcion}</p>
                  {ejerciciosSeleccionados.find(e => e.id_ejercicio === ejercicio.id_ejercicio) && (
                    <div style={{backgroundColor: '#2ecc71', color: 'white', padding: '5px', borderRadius: '4px', marginTop: '5px'}}>
                      ✓ Seleccionado
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={styles.resumenSeleccion}>
              <h3>Ejercicios Seleccionados: {ejerciciosSeleccionados.length}</h3>
              {ejerciciosSeleccionados.map((ej, index) => (
                <div key={index} style={styles.ejercicioItem}>
                  <span><strong>{ej.nombre}</strong></span>
                  <span>({ej.grupo})</span>
                  <span>Series: {ej.series}</span>
                  <span>Reps: {ej.repeticiones}</span>
                  <span>Descanso: {ej.descanso}s</span>
                </div>
              ))}
            </div>

            <div style={styles.botonesAccion}>
              <button
                style={styles.btnCrear}
                onClick={crearRutina}
                disabled={ejerciciosSeleccionados.length === 0 || !nombreRutina || (rolActual === 'entrenador' && !clienteSeleccionadoParaRutina)}
              >
                ✅ Crear Rutina
              </button>
              <button
                style={styles.btnVolver}
                onClick={() => setVista("dashboard")}
              >
                ↩️ Volver al Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={styles.fondo}>
      <div style={styles.cardPrincipal}>
        <h1 style={styles.titulo}>Gimnasio Ortiz-Oto</h1>
        <p style={styles.eslogan}>
          Disciplina, constancia y resultados reales
        </p>

        {vista === "" && (
          <div style={styles.botonesInicio}>
            <button
              style={styles.btnLogin}
              onClick={() => setVista("login")}
              disabled={cargando}
            >
              Iniciar sesión
            </button>
            <button
              style={styles.btnTest}
              onClick={probarConexion}
              disabled={cargando}
            >
              {cargando ? "Probando conexión..." : "Probar conexión BD"}
            </button>
          </div>
        )}

        {vista === "login" && (
          <div style={styles.formulario}>
            <h2>Bienvenido de nuevo</h2>

            <input
              style={styles.input}
              placeholder="Email o usuario"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              disabled={cargando}
            />

            <input
              style={styles.input}
              type="password"
              placeholder="Contraseña"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              disabled={cargando}
            />

            <select
              style={styles.input}
              value={loginRol}
              onChange={(e) => setLoginRol(e.target.value)}
              disabled={cargando}
            >
              <option value="">Seleccione su rol</option>
              <option value="administrador">Administrador</option>
              <option value="recepcionista">Recepcionista</option>
              <option value="entrenador">Entrenador</option>
              <option value="nutricionista">Nutricionista</option>
            </select>

            <button
              style={styles.btnLogin}
              onClick={hacerLogin}
              disabled={cargando}
            >
              {cargando ? "Ingresando..." : "Ingresar"}
            </button>

            <p
              style={styles.link}
              onClick={() => setVista("")}
            >
              ← Volver
            </p>
          </div>
        )}

        {vista === "dashboard" && renderDashboard()}
        {vista === "seleccion-ejercicios" && renderSeleccionEjercicios()}
      </div>
    </div>
  );
}

// ESTILOS
const styles = {
  fondo: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundImage: "url('https://images.unsplash.com/photo-1583454110551-21f2fa2afe61')",
    backgroundSize: "cover",
    backgroundPosition: "center",
  },
  cardPrincipal: {
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: "40px",
    borderRadius: "15px",
    width: "90%",
    maxWidth: "1200px",
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  titulo: {
    color: "#2c3e50",
    marginBottom: "10px",
  },
  eslogan: {
    color: "#7f8c8d",
    marginBottom: "20px",
  },
  botonesInicio: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  btnLogin: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#000000bf",
    color: "white",
    fontSize: "16px",
    cursor: "pointer",
  },
  btnTest: {
    padding: "10px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#3498db",
    color: "white",
    fontSize: "14px",
    cursor: "pointer",
    marginTop: "5px",
  },
  formulario: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxWidth: "400px",
    margin: "0 auto",
  },
  input: {
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    width: "100%",
  },
  link: {
    marginTop: "10px",
    color: "#4c3c31e6",
    cursor: "pointer",
  },
  dashboard: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  bienvenida: {
    color: "#2c3e50",
    fontSize: "16px",
  },
  botonesDashboard: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "10px",
    marginTop: "10px",
  },
  btnDashboard: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#000000bf",
    color: "white",
    fontSize: "14px",
    cursor: "pointer",
    textAlign: "center",
  },
  btnCerrarSesion: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#e74c3c",
    color: "white",
    fontSize: "14px",
    cursor: "pointer",
    textAlign: "center",
    gridColumn: "1 / -1",
  },
  tablaContainer: {
    marginTop: "20px",
    backgroundColor: "white",
    borderRadius: "10px",
    padding: "15px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  },
  tablaTitulo: {
    color: "#2c3e50",
    marginBottom: "15px",
    textAlign: "left",
    borderBottom: "2px solid #3498db",
    paddingBottom: "8px",
  },
  tablaWrapper: {
    overflowX: "auto",
    maxHeight: "400px",
    overflowY: "auto",
  },
  tabla: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  th: {
    backgroundColor: "#2c3e50",
    color: "white",
    padding: "10px",
    textAlign: "left",
    position: "sticky",
    top: "0",
    zIndex: "10",
    border: "1px solid #34495e",
  },
  td: {
    padding: "10px",
    border: "1px solid #ddd",
    textAlign: "left",
    verticalAlign: "top",
  },
  filaPar: {
    backgroundColor: "#f8f9fa",
  },
  filaImpar: {
    backgroundColor: "white",
  },
  panelRecepcionista: {
    backgroundColor: "#f8f9fa",
    padding: "20px",
    borderRadius: "8px",
    marginTop: "20px",
  },
  seccionRecepcion: {
    marginBottom: "30px",
    padding: "15px",
    backgroundColor: "white",
    borderRadius: "6px",
    boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  label: {
    textAlign: "left",
    fontWeight: "bold",
    color: "#2c3e50",
  },
  btnAccion: {
    padding: "10px 20px",
    backgroundColor: "#3498db",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginTop: "10px",
  },
  seleccionContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    textAlign: "left",
  },
  formRutina: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  gruposContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    justifyContent: "center",
  },
  btnGrupo: {
    padding: "8px 12px",
    borderRadius: "20px",
    border: "1px solid #ccc",
    cursor: "pointer",
    fontSize: "12px",
  },
  btnCargarEjercicios: {
    padding: "10px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#3498db",
    color: "white",
    cursor: "pointer",
  },
  ejerciciosLista: {
    maxHeight: "300px",
    overflowY: "auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "10px",
  },
  cardEjercicio: {
    border: "2px solid",
    borderRadius: "8px",
    padding: "10px",
    cursor: "pointer",
    backgroundColor: "white",
  },
  resumenSeleccion: {
    backgroundColor: "#f8f9fa",
    padding: "10px",
    borderRadius: "8px",
    maxHeight: "150px",
    overflowY: "auto",
  },
  ejercicioItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "5px 0",
    borderBottom: "1px solid #eee",
    fontSize: "14px",
  },
  botonesAccion: {
    display: "flex",
    gap: "10px",
  },
  btnCrear: {
    flex: "1",
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#27ae60",
    color: "white",
    cursor: "pointer",
  },
  btnVolver: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#a19b80",
    color: "white",
    cursor: "pointer",
  },
};

export default App;
