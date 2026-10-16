"use strict";

// Elementos de la interfaz.
const chat = document.getElementById("chat");
const registro = document.getElementById("registro");
const botones = document.getElementById("botones-opciones");
const formulario = document.getElementById("formulario");
const campo = document.getElementById("campo-entrada");
const etiquetaEntrada = document.getElementById("etiqueta-entrada");
const errorEntrada = document.getElementById("error-entrada");
const textoOpciones = document.getElementById("texto-opciones");
const estadoConversacion = document.getElementById("estado-conversacion");

// Datos mantenidos solamente en memoria.
const datos = {
  nombre: "",
  dias: [],
  horarios: [],
  plan: "",
  precio: 0,
  clases: 0,
  activa: true
};

let arbol = {};
let nodoActual = null;

// Carga el árbol de conversación desde el archivo JSON.
async function iniciar() {
  try {
    const respuesta = await fetch("arbol_decision.json");

    if (!respuesta.ok) {
      throw new Error("No se pudo cargar el archivo JSON.");
    }

    const contenido = await respuesta.json();

    if (!Array.isArray(contenido.nodos)) {
      throw new Error("El árbol de conversación no es válido.");
    }

    arbol = Object.fromEntries(
      contenido.nodos.map(nodo => [nodo.id, nodo])
    );

    // Comprueba que cada opción apunte a un nodo existente.
    for (const nodo of contenido.nodos) {
      if (!nodo.id || !nodo.texto || !Array.isArray(nodo.opciones)) {
        throw new Error("Hay un nodo incompleto.");
      }

      for (const opcion of nodo.opciones) {
        if (!opcion.texto || !arbol[opcion.siguiente]) {
          throw new Error("Hay una opción con destino inválido.");
        }
      }
    }

    if (!arbol[contenido.inicio]) {
      throw new Error("No existe el nodo inicial.");
    }

    mostrarNodo(contenido.inicio);
  } catch (error) {
    const mensaje = document.getElementById("mensaje-error").dataset.text;

    chat.replaceChildren();
    agregarMensaje(mensaje);

    estadoConversacion.textContent = mensaje;
    textoOpciones.textContent = mensaje;
    botones.replaceChildren();
    formulario.hidden = true;
  }
}

// Muestra un mensaje en el chat usando texto seguro.
function agregarMensaje(texto) {
  const contenedor = document.createElement("div");
  contenedor.className = "bienvenida";

  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.textContent = "P";
  avatar.setAttribute("aria-hidden", "true");

  const burbuja = document.createElement("div");
  burbuja.className = "burbuja";

  String(texto).split("\n").forEach(linea => {
    const parrafo = document.createElement("p");
    parrafo.textContent = linea;
    burbuja.appendChild(parrafo);
  });

  contenedor.append(avatar, burbuja);
  chat.appendChild(contenedor);
  chat.scrollTop = chat.scrollHeight;
}

// Registra las acciones realizadas.
function registrar(evento) {
  const vacio = registro.querySelector(".vacio");
  if (vacio) vacio.remove();

  const entrada = document.createElement("div");
  entrada.className = "evento";

  const hora = document.createElement("time");
  hora.textContent = new Date().toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const descripcion = document.createElement("div");
  descripcion.textContent = evento;

  entrada.append(hora, descripcion);
  registro.prepend(entrada);
}

// Actualiza los datos visibles de la reserva.
function actualizarResumen() {
  document.getElementById("resumen-nombre").textContent =
    datos.nombre || "Sin registrar";

  document.getElementById("resumen-dias").textContent =
    datos.dias.length ? datos.dias.join(", ") : "Sin elegir";

  document.getElementById("resumen-horario").textContent =
    datos.horarios.length ? datos.horarios.join(", ") : "Sin elegir";

  document.getElementById("resumen-plan").textContent =
    datos.plan || "Sin elegir";

  document.getElementById("resumen-precio").textContent =
    formatearPrecio(datos.precio);
}

// Presenta los precios en pesos argentinos.
function formatearPrecio(valor) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(valor);
}

// Muestra un nodo del árbol y crea sus botones.
function mostrarNodo(id) {
  const nodo = arbol[id];
  if (!nodo) return;

  nodoActual = nodo;

  estadoConversacion.textContent = datos.activa
    ? "Conversación activa"
    : "Conversación finalizada";

  agregarMensaje(nodo.texto);

  textoOpciones.textContent = nodo.ayuda || "";
  formulario.hidden = !nodo.entrada;
  errorEntrada.textContent = "";

  if (nodo.entrada) {
    etiquetaEntrada.textContent = nodo.entrada.etiqueta;
    campo.type = nodo.entrada.tipo || "text";
    campo.autocomplete = nodo.entrada.autocomplete || "off";
    campo.placeholder = nodo.entrada.placeholder || "";
    campo.maxLength = nodo.entrada.maxLength || 80;
    campo.value = "";
  }

  botones.replaceChildren();

  nodo.opciones.forEach(opcion => {
    const boton = document.createElement("button");

    boton.type = "button";
    boton.className = "boton";
    boton.textContent = opcion.texto;

    if (opcion.estilo === "principal") {
      boton.classList.add("boton-principal");
    }

    boton.addEventListener("click", () => ejecutarOpcion(opcion));
    botones.appendChild(boton);
  });

  actualizarResumen();
}

// Procesa una selección del usuario.
function ejecutarOpcion(opcion) {
  const accion = opcion.accion || "";

  // Después de terminar, solo se permite volver a empezar.
  if (!datos.activa && accion !== "reiniciar") return;

  if (accion === "guardar_nombre") {
    if (!validarNombre()) return;

    datos.nombre = campo.value.trim().replace(/\s+/g, " ");
    registrar("Cliente registrado: " + datos.nombre);

  } else if (accion.startsWith("dia:")) {
    alternar(datos.dias, accion.slice(4));
    registrar(
      "Días seleccionados: " +
      (datos.dias.join(", ") || "ninguno")
    );

  } else if (accion.startsWith("horario:")) {
    alternar(datos.horarios, accion.slice(8));
    registrar(
      "Horarios seleccionados: " +
      (datos.horarios.join(", ") || "ninguno")
    );

  } else if (accion.startsWith("plan:")) {
    const partes = accion.split(":");

    datos.clases = Number(partes[1]);
    datos.plan = partes[2];
    datos.precio = Number(partes[3]);

    // No se permite contratar un plan incompatible con los días.
    if (datos.dias.length !== datos.clases) {
      registrar("Plan seleccionado pendiente de corregir los días.");
      mostrarNodo("validar_dias_plan");
      return;
    }

    registrar(
      "Plan elegido: " + datos.plan +
      " — " + formatearPrecio(datos.precio) + " por mes"
    );

  } else if (accion === "continuar_dias") {
    // Si ya existe un plan, exige exactamente esa cantidad de días.
    if (datos.clases > 0 && datos.dias.length !== datos.clases) {
      mostrarNodo("validar_dias_plan");
      return;
    }

    // No permite continuar sin seleccionar al menos un día.
    if (datos.dias.length === 0) {
      mostrarNodo("validar_dias_vacios");
      return;
    }

  } else if (accion === "continuar_horarios") {
    if (datos.horarios.length === 0) {
      mostrarNodo("validar_horarios_vacios");
      return;
    }

  } else if (accion === "confirmar") {
    agregarMensaje(construirResumen());
    registrar("Se consultó el resumen de la reserva.");
    return;

  } else if (accion === "limpiar_dias") {
    datos.dias = [];
    registrar("Se quitaron los días seleccionados.");

  } else if (accion === "limpiar_horarios") {
    datos.horarios = [];
    registrar("Se quitaron los horarios seleccionados.");

  } else if (accion === "limpiar_plan") {
    datos.plan = "";
    datos.clases = 0;
    datos.precio = 0;
    registrar("Se quitó el plan seleccionado.");

  } else if (accion === "terminar") {
    datos.activa = false;
    registrar("Conversación finalizada por decisión del usuario.");

  } else if (accion === "reiniciar") {
    reiniciar();
    return;
  }

  mostrarNodo(opcion.siguiente);
}

// Agrega o quita una selección sin duplicarla.
function alternar(lista, valor) {
  const indice = lista.indexOf(valor);

  if (indice === -1) {
    lista.push(valor);
  } else {
    lista.splice(indice, 1);
  }

  actualizarResumen();
}

// Valida que el usuario ingrese nombre y apellido.
function validarNombre() {
  const nombre = campo.value.trim().replace(/\s+/g, " ");
  const partes = nombre.split(" ");

  const formatoValido =
    /^[\p{L}\p{M}]+(?:[ '-][\p{L}\p{M}]+)*$/u;

  if (
    partes.length < 2 ||
    partes.some(parte => !formatoValido.test(parte))
  ) {
    errorEntrada.textContent =
      "Ingresá nombre y apellido usando letras, sin números.";

    campo.focus();
    return false;
  }

  return true;
}

// Procesa el formulario de ingreso del nombre.
formulario.addEventListener("submit", evento => {
  evento.preventDefault();

  if (!nodoActual || !nodoActual.entrada) return;

  const opcionGuardar = nodoActual.opciones.find(
    opcion => opcion.accion === "guardar_nombre"
  );

  if (opcionGuardar) {
    ejecutarOpcion(opcionGuardar);
  }
});

// Crea el resumen actual de la reserva.
function construirResumen() {
  return [
    "Resumen de tu reserva:",
    "Cliente: " + (datos.nombre || "Sin registrar"),
    "Días: " + (datos.dias.join(", ") || "Sin elegir"),
    "Horarios: " + (datos.horarios.join(", ") || "Sin elegir"),
    "Plan: " + (datos.plan || "Sin elegir"),
    "Precio mensual: " + formatearPrecio(datos.precio),
    "Revisá el panel de resumen y corregí cualquier elección si hace falta."
  ].join("\n");
}

// Reinicia los datos solo si el usuario lo solicita.
function reiniciar() {
  datos.nombre = "";
  datos.dias = [];
  datos.horarios = [];
  datos.plan = "";
  datos.precio = 0;
  datos.clases = 0;
  datos.activa = true;

  chat.replaceChildren();
  registro.replaceChildren();

  const vacio = document.createElement("p");
  vacio.className = "vacio";
  vacio.textContent =
    "Tus elecciones aparecerán acá a medida que avances.";

  registro.appendChild(vacio);

  registrar("Se inició una nueva conversación.");
  actualizarResumen();
  mostrarNodo("menu_principal");
}

// Inicia la aplicación.
iniciar();