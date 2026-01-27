import { useState } from "react";
import axios from "axios";

// URL de tu backend
const API_URL = "http://localhost:5000/api";

function App() {
  const [vista, setVista] = useState(""); // "", "login", "registro", "dashboard", "seleccion-ejercicios"
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [usuarioLogueado, setUsuarioLogueado] = useState(null);
  const [rolActual, setRolActual] = useState("");

  // Estados del formulario de registro
  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  // Estados para dashboard
  const [datosDashboard, setDatosDashboard] = useState(null);

  // Función para probar conexión con el backend
  const probarConexion = async () => {
    setCargando(true);
    try {
      const response = await axios.get(`${API_URL}/test`);
      alert(`✅ ${response.data.conexion}\nBase de datos: ${response.data.base_datos}\nHora: ${new Date(response.data.hora_servidor).toLocaleTimeString()}`);
    } catch (error) {
      alert(`❌ Error: ${error.message}\n\nAsegúrate que el backend esté corriendo en http://localhost:5000`);
    } finally {
      setCargando(false);
    }
  };

  // Función para cargar grupos musculares
  const cargarGruposMusculares = async () => {
    try {
      const response = await axios.get(`${API_URL}/grupos-musculares`);
      setGruposDisponibles(response.data);
    } catch (error) {
      console.error("Error cargando grupos:", error);
    }
  };

  // Función para cargar ejercicios según grupos
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

  // Función para toggle de grupo muscular
  const toggleGrupoMuscular = (grupo) => {
    if (gruposSeleccionados.includes(grupo)) {
      setGruposSeleccionados(gruposSeleccionados.filter(g => g !== grupo));
    } else {
      setGruposSeleccionados([...gruposSeleccionados, grupo]);
    }
  };

  // Función para toggle de ejercicio
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

  // Función para registrar cliente
  const registrarCliente = async () => {
    if (!nombre || !cedula || !telefono || !email || !password) {
      alert("Por favor, complete todos los campos");
      return;
    }

    setCargando(true);

    try {
      const response = await axios.post(`${API_URL}/registrar`, {
        nombre,
        cedula,
        telefono,
        email,
        password,
      });

      alert(`✅ ${response.data.mensaje}\nID Cliente: ${response.data.id_cliente}\nNombre: ${response.data.nombre}`);

      // Limpiar formulario
      setNombre("");
      setCedula("");
      setTelefono("");
      setEmail("");
      setPassword("");
      setVista("login");
      
    } catch (error) {
      console.error("Error en registro:", error);
      alert(`❌ Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setCargando(false);
    }
  };

  // Función para hacer login
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
      
      alert(`✅ Bienvenido ${response.data.datos.nombre || loginEmail}\nRol: ${response.data.rol}`);
      
      // Cargar grupos musculares si es cliente
      if (response.data.rol === 'cliente') {
        cargarGruposMusculares();
      }
      
      // Ir a dashboard
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

  // Función para cargar dashboard
  const cargarDashboard = async () => {
    try {
      let id = usuarioLogueado.id_cliente || usuarioLogueado.id_entrenador || usuarioLogueado.id_nutricionista || 1;
      
      const response = await axios.get(`${API_URL}/dashboard/${rolActual}/${id}`);
      setDatosDashboard(response.data);
    } catch (error) {
      console.error("Error cargando dashboard:", error);
    }
  };

  // Función para crear rutina
  const crearRutina = async () => {
    if (!nombreRutina || ejerciciosSeleccionados.length === 0) {
      alert("Por favor, complete el nombre y seleccione ejercicios");
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/rutinas/crear`, {
        id_cliente: usuarioLogueado.id_cliente,
        nombre: nombreRutina,
        nivel: nivelRutina,
        objetivo: objetivoRutina,
        ejercicios: ejerciciosSeleccionados
      });

      alert(`✅ ${response.data.mensaje}\nID Rutina: ${response.data.id_rutina}`);
      
      // Limpiar
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

  // Función para ejecutar procedimiento almacenado
  const ejecutarMantenimiento = async () => {
    if (rolActual !== 'administrador') {
      alert("Solo administradores pueden ejecutar mantenimiento");
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/procedimientos/mantenimiento`);
      alert(`✅ ${response.data.mensaje}\n\nTu trigger trg_actualizar_estado_membresia funcionó.`);
    } catch (error) {
      alert(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
  };

  // Función para ver auditoría
  const verAuditoria = async () => {
    try {
      const response = await axios.get(`${API_URL}/auditoria/clientes-completos`);
      alert(`📊 Auditoría - ${response.data.total_registros} registros\n\nConsulta JOIN ejecutada correctamente.`);
    } catch (error) {
      alert(`❌ Error en auditoría: ${error.message}`);
    }
  };

  // Función para cerrar sesión
  const cerrarSesion = () => {
    setUsuarioLogueado(null);
    setRolActual("");
    setVista("");
    setDatosDashboard(null);
    setEjerciciosSeleccionados([]);
    setGruposSeleccionados([]);
    alert("Sesión cerrada correctamente");
  };

  // Renderizar dashboard según rol
  const renderDashboard = () => {
    return (
      <div style={styles.dashboard}>
        <h2>Panel de {rolActual.charAt(0).toUpperCase() + rolActual.slice(1)}</h2>
        <p style={styles.bienvenida}>Bienvenido, <strong>{usuarioLogueado?.nombre || usuarioLogueado}</strong></p>
        
        {rolActual === 'cliente' && datosDashboard && (
          <div style={styles.infoCliente}>
            <p><strong>Membresía:</strong> {datosDashboard.membresia?.nombre || 'Sin membresía'}</p>
            <p><strong>Estado:</strong> {datosDashboard.membresia?.estado || 'N/A'}</p>
            <p><strong>Rutinas activas:</strong> {datosDashboard.rutinas?.length || 0}</p>
          </div>
        )}
        
        {rolActual === 'administrador' && datosDashboard && (
          <div style={styles.infoAdmin}>
            <p><strong>Total clientes:</strong> {datosDashboard.estadisticas?.total_clientes}</p>
            <p><strong>Membresías activas:</strong> {datosDashboard.estadisticas?.membresias_activas}</p>
            <p><strong>Ingresos del mes:</strong> ${datosDashboard.estadisticas?.ingresos_mes}</p>
          </div>
        )}
        
        <div style={styles.botonesDashboard}>
          {rolActual === 'cliente' && (
            <>
              <button
                style={styles.btnDashboard}
                onClick={() => setVista("seleccion-ejercicios")}
              >
                🏋️ Crear Nueva Rutina
              </button>
              <button
                style={styles.btnDashboard}
                onClick={verAuditoria}
              >
                📊 Ver Mi Información (JOIN)
              </button>
            </>
          )}
          
          {rolActual === 'administrador' && (
            <>
              <button
                style={styles.btnDashboard}
                onClick={ejecutarMantenimiento}
              >
                ⚙️ Ejecutar Mantenimiento (Procedimiento)
              </button>
              <button
                style={styles.btnDashboard}
                onClick={verAuditoria}
              >
                📈 Ver Auditoría Completa
              </button>
            </>
          )}
          
          {rolActual === 'entrenador' && (
            <button
              style={styles.btnDashboard}
              onClick={verAuditoria}
            >
              👥 Ver Mis Clientes (JOIN)
            </button>
          )}
          
          <button
            style={styles.btnDashboard}
            onClick={cerrarSesion}
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      </div>
    );
  };

  // Renderizar selección de ejercicios
  const renderSeleccionEjercicios = () => {
    return (
      <div style={styles.seleccionContainer}>
        <h2>Crear Nueva Rutina</h2>
        
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
                </div>
              ))}
            </div>
            
            <div style={styles.resumenSeleccion}>
              <h3>Ejercicios Seleccionados: {ejerciciosSeleccionados.length}</h3>
              {ejerciciosSeleccionados.map((ej, index) => (
                <div key={index} style={styles.ejercicioItem}>
                  <span>{ej.nombre}</span>
                  <span>({ej.grupo})</span>
                </div>
              ))}
            </div>
            
            <div style={styles.botonesAccion}>
              <button
                style={styles.btnCrear}
                onClick={crearRutina}
                disabled={ejerciciosSeleccionados.length === 0 || !nombreRutina}
              >
                ✅ Crear Rutina (Triggers activos)
              </button>
              <button
                style={styles.btnVolver}
                onClick={() => setVista("dashboard")}
              >
                ↩️ Volver
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
              style={styles.btnRegistro}
              onClick={() => setVista("registro")}
              disabled={cargando}
            >
              Registrarse
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
              <option value="Administrador">Administrador</option>
              <option value="Recepcionista">Recepcionista</option>
              <option value="Entrenador">Entrenador</option>
              <option value="Nutricionista">Nutricionista</option>
              <option value="Cliente">Cliente</option>
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

        {vista === "registro" && (
          <div style={styles.formulario}>
            <h2>Únete al gimnasio</h2>

            <input
              style={styles.input}
              placeholder="Nombre completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={cargando}
            />

            <input
              style={styles.input}
              placeholder="Cédula (10 dígitos)"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              disabled={cargando}
            />

            <input
              style={styles.input}
              placeholder="Teléfono (10 dígitos)"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              disabled={cargando}
            />

            <input
              style={styles.input}
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={cargando}
            />

            <input
              style={styles.input}
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={cargando}
            />

            <button
              style={styles.btnRegistro}
              onClick={registrarCliente}
              disabled={cargando}
            >
              {cargando ? "Registrando..." : "Crear cuenta"}
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

// ESTILOS IDÉNTICOS A LOS ORIGINALES - Solo agregué los nuevos necesarios
const styles = {
  fondo: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundImage:
      "url('https://images.unsplash.com/photo-1583454110551-21f2fa2afe61')",
    backgroundSize: "cover",
    backgroundPosition: "center",
  },
  cardPrincipal: {
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: "40px",
    borderRadius: "15px",
    width: "400px",
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    maxHeight: "80vh",
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
  btnRegistro: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#a19b80",
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
  },
  input: {
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
  },
  link: {
    marginTop: "10px",
    color: "#4c3c31e6",
    cursor: "pointer",
  },
  // NUEVOS ESTILOS (manteniendo el mismo diseño)
  dashboard: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  bienvenida: {
    color: "#2c3e50",
    fontSize: "16px",
  },
  infoCliente: {
    backgroundColor: "#f8f9fa",
    padding: "15px",
    borderRadius: "8px",
    textAlign: "left",
  },
  infoAdmin: {
    backgroundColor: "#e8f4f8",
    padding: "15px",
    borderRadius: "8px",
    textAlign: "left",
  },
  botonesDashboard: {
    display: "flex",
    flexDirection: "column",
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
    maxHeight: "200px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
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
    flex: 1,
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