import { useState, useEffect } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

function App() {
  const [vista, setVista] = useState("");
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
  const [nombreRutina, setNombreRutina] = useState("");
  const [nivelRutina, setNivelRutina] = useState("Principiante");
  const [objetivoRutina, setObjetivoRutina] = useState("");
  const [clientesEntrenador, setClientesEntrenador] = useState([]);
  const [clienteSeleccionadoParaRutina, setClienteSeleccionadoParaRutina] = useState("");

  // Estados para tablas
  const [datosTabla, setDatosTabla] = useState([]);
  const [tituloTabla, setTituloTabla] = useState("");
  const [columnasTabla, setColumnasTabla] = useState([]);

  // Estados para CRUD Administrador
  const [tablasDisponibles, setTablasDisponibles] = useState([]);
  const [tablaSeleccionada, setTablaSeleccionada] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [campoBusqueda, setCampoBusqueda] = useState("");
  const [modoEdicion, setModoEdicion] = useState(null); // null, 'crear', 'editar'
  const [registroEditando, setRegistroEditando] = useState({});

  // Estados para Recepcionista
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: "", cedula: "", telefono: "", email: ""
  });
  const [membresiasDisponibles, setMembresiasDisponibles] = useState([]);
  const [inscripcionData, setInscripcionData] = useState({
    id_cliente: "", id_membresia: "", fecha_inicio: new Date().toISOString().split('T')[0]
  });

  // Estados para Búsqueda por índice
  const [cedulaBuscar, setCedulaBuscar] = useState("");
  const [resultadoBusqueda, setResultadoBusqueda] = useState(null);

  // Estados para Auditoría
  const [auditoriaData, setAuditoriaData] = useState([]);
  const [filtroAuditoria, setFiltroAuditoria] = useState({
    tabla: "", fecha_desde: "", fecha_hasta: ""
  });

  // Estados para Ejecutar Funciones
  const [funcionSeleccionada, setFuncionSeleccionada] = useState("");
  const [parametrosFuncion, setParametrosFuncion] = useState({});

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
      setEjerciciosFiltrados(response.data);
      setMostrarEjercicios(true);
    } catch (error) {
      console.error("Error cargando ejercicios:", error);
      alert("Error al cargar ejercicios");
    }
  };

  // ==================== FUNCIONES PARA ÍNDICES REALES ====================
  const buscarClientePorCedula = async () => {
    if (!cedulaBuscar.trim()) {
      alert("Ingrese una cédula para buscar");
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/buscar-cliente-cedula/${cedulaBuscar}`);
      setResultadoBusqueda(response.data.data);
      alert(`✅ Cliente encontrado: ${response.data.data.nombre}`);
    } catch (error) {
      console.error("Error buscando cliente:", error);
      setResultadoBusqueda(null);
      alert(`❌ ${error.response?.data?.error || "Cliente no encontrado"}`);
    }
  };

  // ==================== FUNCIONES PARA AUDITORÍA ====================
  const cargarAuditoria = async () => {
    try {
      const params = new URLSearchParams();
      if (filtroAuditoria.tabla) params.append('tabla', filtroAuditoria.tabla);
      if (filtroAuditoria.fecha_desde) params.append('fecha_desde', filtroAuditoria.fecha_desde);
      if (filtroAuditoria.fecha_hasta) params.append('fecha_hasta', filtroAuditoria.fecha_hasta);
      
      const response = await axios.get(`${API_URL}/auditoria?${params.toString()}`);
      setAuditoriaData(response.data.data);
      setDatosTabla(response.data.data);
      setTituloTabla("Registros de Auditoría");
      setColumnasTabla(['id_auditoria', 'tabla_nombre', 'operacion', 'registro_id', 'usuario', 'fecha']);
    } catch (error) {
      console.error("Error cargando auditoría:", error);
      alert(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
  };

  // ==================== FUNCIONES PARA EJECUTAR FUNCIONES ====================
  const ejecutarFuncion = async () => {
    if (!funcionSeleccionada) {
      alert("Seleccione una función para ejecutar");
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/ejecutar-funcion/${funcionSeleccionada}`,
        { parametros: parametrosFuncion }
      );
      
      alert(`✅ ${response.data.mensaje}`);
      
      // Limpiar después de ejecutar
      setFuncionSeleccionada("");
      setParametrosFuncion({});
      
    } catch (error) {
      console.error("Error ejecutando función:", error);
      alert(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
  };

  // ==================== CRUD COMPLETO PARA ADMINISTRADOR ====================
  const cargarTablasDisponibles = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/tablas-disponibles`);
      setTablasDisponibles(response.data);
    } catch (error) {
      console.error("Error cargando tablas:", error);
    }
  };

  const cargarTablaCRUD = async (tabla) => {
    setTablaSeleccionada(tabla);
    setModoEdicion(null);
    setRegistroEditando({});
    
    try {
      const params = new URLSearchParams();
      if (filtroBusqueda && campoBusqueda) {
        params.append('buscar', filtroBusqueda);
        params.append('campo', campoBusqueda);
      }
      params.append('limite', 100);
      
      const response = await axios.get(`${API_URL}/admin/tablas/${tabla}?${params.toString()}`);
      setDatosTabla(response.data);
      setTituloTabla(`Tabla: ${tabla} (${response.data.length} registros)`);
      
      if (response.data.length > 0) {
        setColumnasTabla(Object.keys(response.data[0]));
      } else {
        setColumnasTabla([]);
      }
    } catch (error) {
      console.error(`Error cargando tabla ${tabla}:`, error);
      alert(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
  };

  const iniciarCrearRegistro = () => {
    setModoEdicion('crear');
    setRegistroEditando({});
  };

  const iniciarEditarRegistro = (registro) => {
    setModoEdicion('editar');
    setRegistroEditando({...registro});
  };

  const guardarRegistro = async () => {
    try {
      if (modoEdicion === 'crear') {
        const response = await axios.post(
          `${API_URL}/admin/tablas/${tablaSeleccionada}`,
          registroEditando
        );
        alert(`✅ ${response.data.mensaje}`);
      } else if (modoEdicion === 'editar') {
        // Obtener el ID del registro
        const idKey = Object.keys(registroEditando).find(k => 
          k.includes('id_') || k === 'id'
        ) || 'id';
        const id = registroEditando[idKey];
        
        const response = await axios.put(
          `${API_URL}/admin/tablas/${tablaSeleccionada}/${id}`,
          registroEditando
        );
        alert(`✅ ${response.data.mensaje}`);
      }
      
      // Recargar tabla
      cargarTablaCRUD(tablaSeleccionada);
      setModoEdicion(null);
      setRegistroEditando({});
      
    } catch (error) {
      console.error("Error guardando registro:", error);
      alert(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
  };

  const eliminarRegistro = async (registro) => {
    if (!window.confirm(`¿Está seguro de eliminar este registro?`)) return;
    
    try {
      // Obtener el ID del registro
      const idKey = Object.keys(registro).find(k => 
        k.includes('id_') || k === 'id'
      ) || 'id';
      const id = registro[idKey];
      
      const response = await axios.delete(
        `${API_URL}/admin/tablas/${tablaSeleccionada}/${id}`
      );
      
      alert(`✅ ${response.data.mensaje}`);
      cargarTablaCRUD(tablaSeleccionada);
      
    } catch (error) {
      console.error("Error eliminando registro:", error);
      alert(`❌ Error: ${error.response?.data?.error || error.message}`);
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

  // ==================== FUNCIONES ESPECÍFICAS POR ROL ====================
  const entrenadorVerClientes = async () => {
    try {
      const response = await axios.get(`${API_URL}/entrenador/mis-clientes`);
      setDatosTabla(response.data);
      setTituloTabla("Mis Clientes Asignados");
      setClientesEntrenador(response.data);
      if (response.data.length > 0) {
        setColumnasTabla(Object.keys(response.data[0]));
      }
    } catch (error) {
      alert(`❌ Error cargando mis clientes: ${error.response?.data?.error || error.message}`);
    }
  };

  const nutricionistaVerEvaluaciones = async () => {
    try {
      const response = await axios.get(`${API_URL}/nutricionista/mis-evaluaciones`);
      setDatosTabla(response.data);
      setTituloTabla("Mis Evaluaciones Nutricionales");
      if (response.data.length > 0) {
        setColumnasTabla(Object.keys(response.data[0]));
      }
    } catch (error) {
      alert(`❌ Error cargando mis evaluaciones: ${error.response?.data?.error || error.message}`);
    }
  };

  const recepcionistaVerMembresias = async () => {
    try {
      const response = await axios.get(`${API_URL}/recepcionista/membresias-activas`);
      setDatosTabla(response.data);
      setTituloTabla("Membresías Activas");
      if (response.data.length > 0) {
        setColumnasTabla(Object.keys(response.data[0]));
      }
    } catch (error) {
      alert(`❌ Error cargando membresías activas: ${error.response?.data?.error || error.message}`);
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

  // ==================== FUNCIONES AUXILIARES ====================
  const cerrarSesion = () => {
    setUsuarioLogueado(null);
    setRolActual("");
    setVista("");
    setDatosTabla([]);
    setTituloTabla("");
    setColumnasTabla([]);
    localStorage.removeItem("token");
    setToken("");
    alert("Sesión cerrada correctamente");
  };

  // ==================== RENDERIZADO ====================

  // Renderizar tabla
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
                {rolActual === 'administrador' && tablaSeleccionada && (
                  <th style={styles.th}>ACCIONES</th>
                )}
              </tr>
            </thead>
            <tbody>
              {datosTabla.map((fila, rowIndex) => (
                <tr key={rowIndex} style={rowIndex % 2 === 0 ? styles.filaPar : styles.filaImpar}>
                  {columnasTabla.map((columna, colIndex) => (
                    <td key={colIndex} style={styles.td}>
                      {typeof fila[columna] === 'object' ? 
                       JSON.stringify(fila[columna]) : 
                       String(fila[columna] || '')}
                    </td>
                  ))}
                  {rolActual === 'administrador' && tablaSeleccionada && (
                    <td style={styles.td}>
                      <button 
                        style={styles.btnAccionEditar}
                        onClick={() => iniciarEditarRegistro(fila)}
                      >
                        ✏️ Editar
                      </button>
                      <button 
                        style={styles.btnAccionEliminar}
                        onClick={() => eliminarRegistro(fila)}
                      >
                        🗑️ Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Renderizar formulario CRUD
  const renderFormularioCRUD = () => {
    return (
      <div style={styles.formularioCRUD}>
        <h3>{modoEdicion === 'crear' ? 'Crear Nuevo Registro' : 'Editar Registro'}</h3>
        <div style={styles.formGroup}>
          {columnasTabla
            .filter(col => !col.includes('id_') && col !== 'id' && col !== 'fecha' && col !== 'fecha_registro' && col !== 'fecha_pago')
            .map((columna, index) => (
              <div key={index} style={styles.inputGroup}>
                <label style={styles.label}>{columna.replace(/_/g, ' ').toUpperCase()}:</label>
                <input
                  style={styles.input}
                  value={registroEditando[columna] || ''}
                  onChange={(e) => setRegistroEditando({
                    ...registroEditando,
                    [columna]: e.target.value
                  })}
                  placeholder={`Ingrese ${columna}`}
                />
              </div>
            ))}
        </div>
        <div style={styles.botonesForm}>
          <button style={styles.btnGuardar} onClick={guardarRegistro}>
            {modoEdicion === 'crear' ? 'Crear Registro' : 'Actualizar Registro'}
          </button>
          <button style={styles.btnCancelar} onClick={() => setModoEdicion(null)}>
            Cancelar
          </button>
        </div>
      </div>
    );
  };

  // Renderizar panel de búsqueda por índice
  const renderBusquedaPorIndice = () => {
    return (
      <div style={styles.panelBusqueda}>
        <h3>🔍 Buscar Cliente por Cédula (Usando Índice)</h3>
        <div style={styles.formGroup}>
          <input
            style={styles.input}
            placeholder="Ingrese cédula del cliente"
            value={cedulaBuscar}
            onChange={(e) => setCedulaBuscar(e.target.value)}
          />
          <button style={styles.btnAccion} onClick={buscarClientePorCedula}>
            Buscar
          </button>
        </div>
        
        {resultadoBusqueda && (
          <div style={styles.resultadoBusqueda}>
            <h4>✅ Cliente Encontrado:</h4>
            <div style={styles.cardCliente}>
              <p><strong>Nombre:</strong> {resultadoBusqueda.nombre}</p>
              <p><strong>Cédula:</strong> {resultadoBusqueda.cedula}</p>
              <p><strong>Teléfono:</strong> {resultadoBusqueda.telefono}</p>
              <p><strong>Email:</strong> {resultadoBusqueda.email}</p>
              <p><strong>Fecha Registro:</strong> {resultadoBusqueda.fecha_registro}</p>
              <p><strong>Estado Membresía:</strong> {resultadoBusqueda.estado_membresia || 'No activa'}</p>
              <p><strong>Total Rutinas:</strong> {resultadoBusqueda.total_rutinas}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Renderizar panel de auditoría
  const renderPanelAuditoria = () => {
    return (
      <div style={styles.panelAuditoria}>
        <h3>📊 Auditoría del Sistema</h3>
        <div style={styles.filtrosAuditoria}>
          <input
            style={styles.input}
            placeholder="Tabla (ej: cliente)"
            value={filtroAuditoria.tabla}
            onChange={(e) => setFiltroAuditoria({...filtroAuditoria, tabla: e.target.value})}
          />
          <input
            style={styles.input}
            type="date"
            placeholder="Fecha desde"
            value={filtroAuditoria.fecha_desde}
            onChange={(e) => setFiltroAuditoria({...filtroAuditoria, fecha_desde: e.target.value})}
          />
          <input
            style={styles.input}
            type="date"
            placeholder="Fecha hasta"
            value={filtroAuditoria.fecha_hasta}
            onChange={(e) => setFiltroAuditoria({...filtroAuditoria, fecha_hasta: e.target.value})}
          />
          <button style={styles.btnAccion} onClick={cargarAuditoria}>
            Cargar Auditoría
          </button>
        </div>
      </div>
    );
  };

  // Renderizar panel de funciones
  const renderPanelFunciones = () => {
    return (
      <div style={styles.panelFunciones}>
        <h3>⚡ Ejecutar Funciones de PostgreSQL</h3>
        <div style={styles.formGroup}>
          <select
            style={styles.input}
            value={funcionSeleccionada}
            onChange={(e) => setFuncionSeleccionada(e.target.value)}
          >
            <option value="">Seleccionar función</option>
            <option value="mantenimiento_automatico">Mantenimiento Automático</option>
            <option value="registrar_pago">Registrar Pago</option>
          </select>
          
          {funcionSeleccionada === 'registrar_pago' && (
            <>
              <input
                style={styles.input}
                placeholder="ID Factura"
                value={parametrosFuncion.id_factura || ''}
                onChange={(e) => setParametrosFuncion({...parametrosFuncion, id_factura: e.target.value})}
              />
              <input
                style={styles.input}
                placeholder="Monto"
                type="number"
                step="0.01"
                value={parametrosFuncion.monto || ''}
                onChange={(e) => setParametrosFuncion({...parametrosFuncion, monto: e.target.value})}
              />
              <input
                style={styles.input}
                placeholder="Método (opcional)"
                value={parametrosFuncion.metodo || ''}
                onChange={(e) => setParametrosFuncion({...parametrosFuncion, metodo: e.target.value})}
              />
            </>
          )}
          
          <button style={styles.btnAccion} onClick={ejecutarFuncion}>
            Ejecutar Función
          </button>
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
          {/* Administrador - CRUD COMPLETO */}
          {rolActual === 'administrador' && (
            <>
              <button style={styles.btnDashboard} onClick={cargarTablasDisponibles}>
                📋 Ver Tablas Disponibles
              </button>
              <button style={styles.btnDashboard} onClick={() => cargarAuditoria()}>
                📊 Ver Auditoría
              </button>
              <button style={styles.btnDashboard} onClick={() => {
                setTituloTabla("Buscar por Índice");
                setDatosTabla([]);
              }}>
                🔍 Búsqueda por Índice
              </button>
              <button style={styles.btnDashboard} onClick={() => {
                setTituloTabla("Ejecutar Funciones");
                setDatosTabla([]);
              }}>
                ⚡ Ejecutar Funciones
              </button>
            </>
          )}

          {/* Recepcionista */}
          {rolActual === 'recepcionista' && (
            <>
              <button style={styles.btnDashboard} onClick={() => recepcionistaVerMembresias()}>
                🎟️ Ver Membresías Activas
              </button>
              <button style={styles.btnDashboard} onClick={() => {
                setTituloTabla("Registrar Cliente");
                setDatosTabla([]);
              }}>
                📝 Registrar Cliente
              </button>
              <button style={styles.btnDashboard} onClick={() => {
                setTituloTabla("Crear Inscripción");
                setDatosTabla([]);
                recepcionistaCargarMembresias();
              }}>
                📋 Crear Inscripción
              </button>
              <button style={styles.btnDashboard} onClick={() => buscarClientePorCedula()}>
                🔍 Buscar por Cédula
              </button>
            </>
          )}

          {/* Entrenador */}
          {rolActual === 'entrenador' && (
            <>
              <button style={styles.btnDashboard} onClick={entrenadorVerClientes}>
                👥 Ver Mis Clientes
              </button>
              <button style={styles.btnDashboard} onClick={() => {
                setTituloTabla("Ver Ejercicios");
                axios.get(`${API_URL}/ejercicios-todos`).then(res => {
                  setDatosTabla(res.data);
                  if (res.data.length > 0) setColumnasTabla(Object.keys(res.data[0]));
                });
              }}>
                🏋️ Ver Ejercicios
              </button>
              <button style={styles.btnDashboard} onClick={() => {
                setTituloTabla("Ver Rutinas");
                axios.get(`${API_URL}/rutinas-todas`).then(res => {
                  setDatosTabla(res.data);
                  if (res.data.length > 0) setColumnasTabla(Object.keys(res.data[0]));
                });
              }}>
                📋 Ver Todas las Rutinas
              </button>
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
            </>
          )}

          {/* Nutricionista */}
          {rolActual === 'nutricionista' && (
            <>
              <button style={styles.btnDashboard} onClick={nutricionistaVerEvaluaciones}>
                🧪 Ver Mis Evaluaciones
              </button>
              <button style={styles.btnDashboard} onClick={() => {
                setTituloTabla("Ver Dietas");
                axios.get(`${API_URL}/dietas-todas`).then(res => {
                  setDatosTabla(res.data);
                  if (res.data.length > 0) setColumnasTabla(Object.keys(res.data[0]));
                });
              }}>
                🥗 Ver Todas las Dietas
              </button>
              <button style={styles.btnDashboard} onClick={() => buscarClientePorCedula()}>
                🔍 Buscar Cliente
              </button>
            </>
          )}

          <button style={styles.btnCerrarSesion} onClick={cerrarSesion}>🚪 Cerrar Sesión</button>
        </div>

        {/* Panel de Administrador - Tablas CRUD */}
        {rolActual === 'administrador' && tablasDisponibles.length > 0 && (
          <div style={styles.panelCRUD}>
            <h3>📁 CRUD Completo - Seleccionar Tabla</h3>
            <div style={styles.tablasContainer}>
              {tablasDisponibles.map(tabla => (
                <button
                  key={tabla}
                  style={styles.btnTabla}
                  onClick={() => cargarTablaCRUD(tabla)}
                >
                  {tabla}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filtros para búsqueda en tablas (Admin) */}
        {rolActual === 'administrador' && tablaSeleccionada && (
          <div style={styles.filtrosBusqueda}>
            <input
              style={styles.input}
              placeholder="Texto a buscar"
              value={filtroBusqueda}
              onChange={(e) => setFiltroBusqueda(e.target.value)}
            />
            <input
              style={styles.input}
              placeholder="Campo donde buscar"
              value={campoBusqueda}
              onChange={(e) => setCampoBusqueda(e.target.value)}
            />
            <button style={styles.btnAccion} onClick={() => cargarTablaCRUD(tablaSeleccionada)}>
              🔍 Buscar
            </button>
            <button style={styles.btnAccion} onClick={() => {
              setFiltroBusqueda("");
              setCampoBusqueda("");
              cargarTablaCRUD(tablaSeleccionada);
            }}>
              🔄 Limpiar
            </button>
            <button style={styles.btnCrearNuevo} onClick={iniciarCrearRegistro}>
              ➕ Crear Nuevo
            </button>
          </div>
        )}

        {/* Panel de Búsqueda por Índice */}
        {(tituloTabla === "Buscar por Índice" || rolActual === 'recepcionista') && renderBusquedaPorIndice()}

        {/* Panel de Auditoría (solo admin) */}
        {rolActual === 'administrador' && tituloTabla !== "Buscar por Índice" && renderPanelAuditoria()}

        {/* Panel de Funciones (solo admin) */}
        {rolActual === 'administrador' && tituloTabla === "Ejecutar Funciones" && renderPanelFunciones()}

        {/* Panel de Recepcionista - Registrar Cliente */}
        {rolActual === 'recepcionista' && tituloTabla === "Registrar Cliente" && (
          <div style={styles.panelRecepcionista}>
            <h3>📝 Registrar Nuevo Cliente</h3>
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
        )}

        {/* Panel de Recepcionista - Crear Inscripción */}
        {rolActual === 'recepcionista' && tituloTabla === "Crear Inscripción" && (
          <div style={styles.panelRecepcionista}>
            <h3>🎟️ Crear Inscripción a Membresía</h3>
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
        )}

        {/* Formulario CRUD para Administrador */}
        {rolActual === 'administrador' && modoEdicion && renderFormularioCRUD()}

        {/* Mostrar tabla si hay datos */}
        {tituloTabla && datosTabla.length > 0 && renderTabla()}
      </div>
    );
  };

  // Renderizar selección de ejercicios (igual que antes)
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

// ESTILOS (actualizados)
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
  btnAccionEditar: {
    padding: "5px 10px",
    backgroundColor: "#f39c12",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    marginRight: "5px",
  },
  btnAccionEliminar: {
    padding: "5px 10px",
    backgroundColor: "#e74c3c",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  panelCRUD: {
    backgroundColor: "#f8f9fa",
    padding: "20px",
    borderRadius: "8px",
    marginTop: "20px",
  },
  tablasContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: "10px",
    marginTop: "10px",
  },
  btnTabla: {
    padding: "10px",
    backgroundColor: "#3498db",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
  },
  filtrosBusqueda: {
    display: "flex",
    gap: "10px",
    marginTop: "20px",
    alignItems: "center",
  },
  btnAccion: {
    padding: "10px 20px",
    backgroundColor: "#3498db",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  btnCrearNuevo: {
    padding: "10px 20px",
    backgroundColor: "#27ae60",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginLeft: "auto",
  },
  formularioCRUD: {
    backgroundColor: "#f8f9fa",
    padding: "20px",
    borderRadius: "8px",
    marginTop: "20px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  inputGroup: {
    marginBottom: "15px",
  },
  label: {
    display: "block",
    marginBottom: "5px",
    fontWeight: "bold",
    color: "#2c3e50",
    textAlign: "left",
  },
  botonesForm: {
    display: "flex",
    gap: "10px",
    marginTop: "20px",
  },
  btnGuardar: {
    padding: "10px 20px",
    backgroundColor: "#27ae60",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  btnCancelar: {
    padding: "10px 20px",
    backgroundColor: "#95a5a6",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  panelBusqueda: {
    backgroundColor: "#f8f9fa",
    padding: "20px",
    borderRadius: "8px",
    marginTop: "20px",
  },
  resultadoBusqueda: {
    marginTop: "20px",
    padding: "15px",
    backgroundColor: "white",
    borderRadius: "8px",
    boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
  },
  cardCliente: {
    textAlign: "left",
  },
  panelAuditoria: {
    backgroundColor: "#f8f9fa",
    padding: "20px",
    borderRadius: "8px",
    marginTop: "20px",
  },
  filtrosAuditoria: {
    display: "flex",
    gap: "10px",
    marginTop: "10px",
  },
  panelFunciones: {
    backgroundColor: "#f8f9fa",
    padding: "20px",
    borderRadius: "8px",
    marginTop: "20px",
  },
  panelRecepcionista: {
    backgroundColor: "#f8f9fa",
    padding: "20px",
    borderRadius: "8px",
    marginTop: "20px",
  },
  // Estilos para selección de ejercicios (mantener igual)
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
