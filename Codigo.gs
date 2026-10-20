/* ============================================================
   Rendimiento académico · registro de notas por grupo (Google Apps Script)
   Cambia CLAVE por la clave compartida de los docentes y del equipo.
   Después de cada cambio: Implementar > Administrar implementaciones > Versión nueva.
   El nombre va solo en la última columna (Nombre); el panel del equipo nunca lo muestra.
   ============================================================ */
var CLAVE = "cambia-esta-clave";
var HOJA = "Notas";
var ZONA = "America/Bogota";
var CABECERA = ["ID", "Grado", "Grupo", "Periodo", "Código", "Matemáticas", "Inglés", "Ciencias naturales", "Sociales", "Educación física", "Faltas", "Creado", "Nombre"];
var NOTAS = ["Matemáticas", "Inglés", "Ciencias naturales", "Sociales", "Educación física"];

/* Sin datos públicos: la página solo confirma que el servicio está activo. */
function doGet(e) {
  return salida({ ok: true, mensaje: "Registro de notas activo. Usa la página del proyecto." });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var p = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (String(p.clave || "") !== CLAVE) return salida({ ok: false, error: "Clave incorrecta." });
    var accion = String(p.accion || "");
    if (accion === "verificar") return salida({ ok: true, mensaje: "Clave correcta." });
    if (accion === "listar") return salida({ ok: true, datos: leerDatos() });
    if (accion === "nombres") return salida(nombres(p));
    if (accion === "guardar") return salida(guardar(p));
    if (accion === "borrar") return salida(borrar(p));
    return salida({ ok: false, error: "Acción no reconocida." });
  } catch (err) {
    return salida({ ok: false, error: "Error en el servidor: " + err.message });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function salida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function hoja() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var h = ss.getSheetByName(HOJA);
  if (!h) {
    h = ss.insertSheet(HOJA);
    h.getRange(1, 1, 1, CABECERA.length).setValues([CABECERA]).setFontWeight("bold");
    h.setFrozenRows(1);
  }
  if (h.getRange(1, CABECERA.length).getValue() === "") h.getRange(1, CABECERA.length).setValue("Nombre").setFontWeight("bold");
  return h;
}

function texto(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ZONA, "yyyy-MM-dd");
  return String(v == null ? "" : v).trim();
}

function numero(v) {
  var t = texto(v).replace(",", ".");
  if (t === "") return null;
  var n = Number(t);
  return isNaN(n) ? null : n;
}

function leerDatos() {
  var h = hoja();
  var ultima = h.getLastRow();
  if (ultima < 2) return [];
  var filas = h.getRange(2, 1, ultima - 1, CABECERA.length).getValues();
  return filas.filter(function (f) { return texto(f[0]) !== ""; }).map(function (f) {
    return {
      id: texto(f[0]), grado: numero(f[1]), grupo: texto(f[2]), periodo: texto(f[3]), codigo: texto(f[4]),
      mat: numero(f[5]), ing: numero(f[6]), cn: numero(f[7]), soc: numero(f[8]), ef: numero(f[9]), faltas: numero(f[10])
    };
  });
}

function validarFila(f) {
  var grado = Number(f.grado);
  if (!(grado >= 6 && grado <= 11) || Math.floor(grado) !== grado) return "El grado debe ser un número entre 6 y 11.";
  var grupo = texto(f.grupo);
  if (!grupo || grupo.length > 20) return "Escribe el grupo (máximo 20 caracteres).";
  var periodo = texto(f.periodo);
  if (!periodo || periodo.length > 12) return "Escribe el periodo (por ejemplo 2026-2).";
  var codigo = texto(f.codigo);
  if (!/^[A-Za-z0-9]{2,8}$/.test(codigo)) return "El código debe tener de 2 a 8 letras o números, sin espacios ni nombres.";
  if (texto(f.nombre).length > 60) return "El nombre no puede tener más de 60 caracteres (" + codigo + ").";
  for (var i = 0; i < NOTAS.length; i++) {
    var v = numero(f[["mat", "ing", "cn", "soc", "ef"][i]]);
    if (v === null || v < 0 || v > 5) return "La nota de " + NOTAS[i] + " debe estar entre 0 y 5 (" + codigo + ").";
  }
  var fal = numero(f.faltas);
  if (fal === null || fal < 0 || fal > 60 || Math.floor(fal) !== fal) return "Las faltas deben ser un número entero entre 0 y 60 (" + codigo + ").";
  return "";
}

function guardar(p) {
  var filas = p.filas || [];
  if (!filas.length) return { ok: false, error: "No hay filas para guardar." };
  for (var i = 0; i < filas.length; i++) {
    var err = validarFila(filas[i]);
    if (err) return { ok: false, error: err };
  }
  var h = hoja();
  var ultima = h.getLastRow();
  var existentes = {};
  if (ultima >= 2) {
    var datos = h.getRange(2, 1, ultima - 1, CABECERA.length).getValues();
    datos.forEach(function (f, i) {
      var clave = [numero(f[1]), texto(f[2]), texto(f[3]), texto(f[4])].join("|");
      existentes[clave] = { fila: i + 2, id: texto(f[0]), creado: texto(f[11]), nombre: texto(f[12]) };
    });
  }
  var nuevas = 0, actualizadas = 0, siguiente = siguienteId(h);
  filas.forEach(function (f) {
    var clave = [Number(f.grado), texto(f.grupo), texto(f.periodo), texto(f.codigo)].join("|");
    var previo = existentes[clave];
    var fila = [
      "", Number(f.grado), texto(f.grupo), texto(f.periodo), texto(f.codigo),
      numero(f.mat), numero(f.ing), numero(f.cn), numero(f.soc), numero(f.ef), numero(f.faltas),
      Utilities.formatDate(new Date(), ZONA, "yyyy-MM-dd HH:mm"),
      texto(f.nombre) || (previo ? previo.nombre : "")
    ];
    if (existentes[clave]) {
      fila[0] = existentes[clave].id;
      fila[11] = existentes[clave].creado;
      h.getRange(existentes[clave].fila, 1, 1, CABECERA.length).setValues([fila]);
      actualizadas++;
    } else {
      fila[0] = "R" + ("000" + siguiente).slice(-3);
      siguiente++;
      h.appendRow(fila);
      nuevas++;
    }
  });
  return { ok: true, nuevas: nuevas, actualizadas: actualizadas, mensaje: "Guardado: " + nuevas + " nuevas, " + actualizadas + " actualizadas." };
}

function nombres(p) {
  var h = hoja();
  var ultima = h.getLastRow(), out = [];
  if (ultima >= 2) {
    var g = Number(p.grado), gr = texto(p.grupo), per = texto(p.periodo);
    h.getRange(2, 1, ultima - 1, CABECERA.length).getValues().forEach(function (f) {
      if (numero(f[1]) === g && texto(f[2]) === gr && texto(f[3]) === per) out.push({ codigo: texto(f[4]), nombre: texto(f[12]) });
    });
  }
  return { ok: true, datos: out };
}

function siguienteId(h) {
  var ultima = h.getLastRow(), max = 0;
  if (ultima >= 2) {
    h.getRange(2, 1, ultima - 1, 1).getValues().forEach(function (f) {
      var n = parseInt(texto(f[0]).replace(/\D/g, ""), 10);
      if (n > max) max = n;
    });
  }
  return max + 1;
}

function borrar(p) {
  var h = hoja();
  var id = texto(p.id);
  var ultima = h.getLastRow();
  if (ultima >= 2) {
    var ids = h.getRange(2, 1, ultima - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (texto(ids[i][0]) === id) { h.deleteRow(i + 2); return { ok: true, mensaje: "Fila borrada." }; }
    }
  }
  return { ok: false, error: "No encuentro la fila " + id + "." };
}
