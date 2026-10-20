/* Rendimiento académico · registro y panel del equipo. Solo con clave. */
(function () {
  "use strict";
  var CFG = window.RN_CONFIG || {};
  var NOTAS = [{ k: "mat", n: "Matemáticas" }, { k: "ing", n: "Inglés" }, { k: "cn", n: "Ciencias naturales" }, { k: "soc", n: "Sociales" }, { k: "ef", n: "Educación física" }];
  var PASAR = 3.0;
  var $ = function (id) { return document.getElementById(id); };
  var clave = "", datos = [], filtros = { grado: "", periodo: "", grupo: "" };

  function f2(x) { return x == null || isNaN(x) ? "–" : x.toFixed(2).replace(".", ","); }
  function media(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function unicos(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function ic95(a, seed) {
    if (a.length < 2) return null;
    var r = rng(seed), B = 4000, n = a.length, m = [];
    for (var b = 0; b < B; b++) { var s = 0; for (var i = 0; i < n; i++) s += a[Math.floor(r() * n)]; m.push(s / n); }
    m.sort(function (x, y) { return x - y; });
    return [m[Math.floor(B * 0.025)], m[Math.floor(B * 0.975)]];
  }
  function correlacion(x, y) {
    if (x.length < 3) return null;
    var mx = media(x), my = media(y), c = 0, vx = 0, vy = 0;
    for (var i = 0; i < x.length; i++) { c += (x[i] - mx) * (y[i] - my); vx += Math.pow(x[i] - mx, 2); vy += Math.pow(y[i] - my, 2); }
    return vx && vy ? c / Math.sqrt(vx * vy) : null;
  }
  function msg(el, t, tipo) { el.textContent = t; el.className = "msg" + (tipo ? " " + tipo : ""); }

  /* ---------- Comunicación con la hoja ---------- */
  function enviar(accion, extra) {
    if (!CFG.REGISTRO) return Promise.resolve({ ok: false, error: "Falta REGISTRO en config.js." });
    var cuerpo = Object.assign({ accion: accion, clave: clave }, extra || {});
    return fetch(CFG.REGISTRO, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(cuerpo) })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, error: "No hubo respuesta del registro. Revisa la conexión." }; });
  }

  /* ---------- Acceso ---------- */
  function mostrar(vista) {
    $("acceso").hidden = vista !== "acceso";
    $("barra").hidden = vista === "acceso";
    $("vista-panel").hidden = vista !== "panel";
    $("vista-notas").hidden = vista !== "notas";
    $("titulo").textContent = vista === "acceso" ? "Entrar" : vista === "panel" ? "Panel del equipo" : "Ingresar notas";
    document.querySelectorAll("[data-vista]").forEach(function (b) { b.disabled = b.dataset.vista === vista; });
  }
  $("acc-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var c = $("clave").value.trim();
    if (!c) { msg($("acc-msg"), "Escribe la clave.", "error"); return; }
    $("acc-btn").disabled = true; msg($("acc-msg"), "Revisando…");
    clave = c;
    enviar("verificar").then(function (r) {
      $("acc-btn").disabled = false;
      if (r.ok) { $("clave").value = ""; msg($("acc-msg"), ""); cargarTodo(); }
      else { clave = ""; msg($("acc-msg"), r.error || "La clave no es correcta.", "error"); }
    });
  });
  $("salir").addEventListener("click", function () { clave = ""; datos = []; mostrar("acceso"); });
  document.querySelectorAll("[data-vista]").forEach(function (b) { b.addEventListener("click", function () { mostrar(b.dataset.vista); if (b.dataset.vista === "notas") prepararNotas(); }); });

  function cargarTodo(sinCambiarVista) {
    if (!sinCambiarVista) mostrar("panel");
    msg($("panel-msg"), "Cargando datos…");
    enviar("listar").then(function (r) {
      if (!r.ok) { msg($("panel-msg"), r.error || "No pude cargar los datos.", "error"); return; }
      datos = r.datos || [];
      msg($("panel-msg"), datos.length ? "" : "Todavía no hay notas registradas.");
      llenarFiltros();
      pintarPanel();
    });
  }

  /* ---------- Filtros del panel ---------- */
  function llenarFiltros() {
    var grados = unicos(datos.map(function (d) { return d.grado; })).sort(function (a, b) { return a - b; });
    var periodos = unicos(datos.map(function (d) { return d.periodo; })).sort();
    if (!filtros.grado && grados.length) filtros.grado = String(grados[grados.length - 1]);
    if (!filtros.periodo && periodos.length) filtros.periodo = periodos[periodos.length - 1];
    var delGrado = unicos(datos.filter(function (d) { return String(d.grado) === filtros.grado; }).map(function (d) { return d.periodo; })).sort();
    if (delGrado.length && delGrado.indexOf(filtros.periodo) < 0) filtros.periodo = delGrado[delGrado.length - 1];
    $("f-grado").innerHTML = grados.map(function (g) { return '<option value="' + g + '"' + (String(g) === filtros.grado ? " selected" : "") + ">" + g + "°</option>"; }).join("");
    $("f-periodo").innerHTML = periodos.map(function (p) { return '<option' + (p === filtros.periodo ? " selected" : "") + ">" + esc(p) + "</option>"; }).join("");
    var grupos = unicos(datos.filter(function (d) { return String(d.grado) === filtros.grado && d.periodo === filtros.periodo; }).map(function (d) { return d.grupo; })).sort();
    if (filtros.grupo && grupos.indexOf(filtros.grupo) < 0) filtros.grupo = "";
    if (!filtros.grupo && grupos.length) filtros.grupo = grupos[0];
    $("f-grupo").innerHTML = grupos.map(function (g) { return '<option' + (g === filtros.grupo ? " selected" : "") + ">" + esc(g) + "</option>"; }).join("");
  }
  ["f-grado", "f-periodo", "f-grupo"].forEach(function (id) {
    $(id).addEventListener("change", function () {
      if (id === "f-grado") filtros.grado = $(id).value;
      if (id === "f-periodo") filtros.periodo = $(id).value;
      if (id === "f-grupo") filtros.grupo = $(id).value;
      if (id !== "f-grupo") { filtros.grupo = ""; llenarFiltros(); }
      pintarPanel();
    });
  });

  /* ---------- Panel ---------- */
  function filasGrupo() {
    return datos.filter(function (d) { return String(d.grado) === filtros.grado && d.periodo === filtros.periodo && d.grupo === filtros.grupo; });
  }
  function pintarPanel() {
    var rs = filasGrupo();
    if (!rs.length) { $("kpis").innerHTML = ""; $("g-materias").innerHTML = $("g-distribucion").innerHTML = $("g-faltas").innerHTML = $("g-grupos").innerHTML = ""; $("tbody-panel").innerHTML = ""; $("r-texto").textContent = "No hay notas para este grupo y periodo."; return; }
    var todas = []; rs.forEach(function (d) { NOTAS.forEach(function (n) { if (d[n.k] != null) todas.push(d[n.k]); }); });
    var mat = rs.map(function (d) { return d.mat; }).filter(function (x) { return x != null; });
    var ing = rs.map(function (d) { return d.ing; }).filter(function (x) { return x != null; });
    var bajoMat = mat.filter(function (x) { return x < PASAR; }).length;
    var kpis = [
      { l: "Estudiantes", v: rs.length, c: "" },
      { l: "Promedio de todas las notas", v: f2(media(todas)), c: "" },
      { l: "Matemáticas", v: f2(media(mat)), c: "" },
      { l: "Inglés", v: f2(media(ing)), c: "" },
      { l: "Bajo 3,0 en matemáticas", v: bajoMat, c: bajoMat ? "alerta" : "" }
    ];
    $("kpis").innerHTML = kpis.map(function (k, i) { return '<div class="kpi" style="animation-delay:' + (i * 60) + 'ms"><div class="lbl">' + esc(k.l) + '</div><div class="val ' + k.c + '">' + esc(k.v) + "</div></div>"; }).join("");
    graficoMaterias(rs);
    graficoDistribucion(mat);
    graficoFaltas(rs);
    graficoGrupos();
    tablaPanel(rs);
  }

  function graficoMaterias(rs) {
    var W = 900, H = 360, L = 60, R = 20, T = 20, B = 60, y0 = 2, y1 = 5;
    var sy = function (v) { return T + (H - T - B) * (1 - (v - y0) / (y1 - y0)); };
    var bw = (W - L - R) / NOTAS.length, out = "";
    for (var g = 2; g <= 5; g += 0.5) out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(g) + '" y2="' + sy(g) + '" stroke="#264852"/><text class="eje" x="' + (L - 8) + '" y="' + (sy(g) + 4) + '" text-anchor="end">' + f2(g) + "</text>";
    NOTAS.forEach(function (n, i) {
      var v = rs.map(function (d) { return d[n.k]; }).filter(function (x) { return x != null; });
      var m = media(v), cx = L + bw * i + bw / 2, bwid = bw * 0.45;
      if (m == null) return;
      var ci = ic95(v, 20261020 + i);
      out += '<rect class="barra" x="' + (cx - bwid / 2) + '" y="' + sy(m) + '" width="' + bwid + '" height="' + (sy(y0) - sy(m)) + '" fill="' + (m < PASAR ? "#ef7a66" : "#55c2ab") + '" opacity=".85"><title>' + esc(n.n) + ": " + f2(m) + "</title></rect>";
      if (ci) out += '<line x1="' + cx + '" x2="' + cx + '" y1="' + sy(ci[0]) + '" y2="' + sy(ci[1]) + '" stroke="#eaf2ef" stroke-width="2"/><line x1="' + (cx - 8) + '" x2="' + (cx + 8) + '" y1="' + sy(ci[0]) + '" y2="' + sy(ci[0]) + '" stroke="#eaf2ef" stroke-width="2"/><line x1="' + (cx - 8) + '" x2="' + (cx + 8) + '" y1="' + sy(ci[1]) + '" y2="' + sy(ci[1]) + '" stroke="#eaf2ef" stroke-width="2"/>';
      out += '<text class="etiq" x="' + (cx + bwid / 2 + 6) + '" y="' + (sy(m) - 6) + '">' + f2(m) + "</text>";
      out += '<text class="eje" x="' + cx + '" y="' + (H - 26) + '" text-anchor="middle">' + esc(n.n) + "</text>";
    });
    out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(PASAR) + '" y2="' + sy(PASAR) + '" stroke="#f0bd5a" stroke-width="2" stroke-dasharray="6 5"/>';
    $("g-materias").innerHTML = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Promedio por materia">' + out + "</svg>";
  }

  function graficoDistribucion(mat) {
    var tramos = [["Menos de 3,0", 0, 3.0], ["3,0 a 3,4", 3.0, 3.5], ["3,5 a 3,9", 3.5, 4.0], ["4,0 a 4,4", 4.0, 4.5], ["4,5 o más", 4.5, 6]];
    var cuentas = tramos.map(function (t) { return mat.filter(function (x) { return x >= t[1] && x < t[2]; }).length; });
    var W = 900, H = 260, L = 60, R = 20, T = 20, B = 50, max = Math.max.apply(null, cuentas.concat([1]));
    var bw = (W - L - R) / tramos.length, out = "";
    tramos.forEach(function (t, i) {
      var h = (H - T - B) * cuentas[i] / max, x = L + bw * i + bw * 0.2, y = H - B - h, w = bw * 0.6;
      out += '<rect class="barra" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + (i === 0 ? "#ef7a66" : "#55c2ab") + '" opacity=".85"/>';
      out += '<text class="etiq" x="' + (x + w / 2) + '" y="' + (y - 8) + '" text-anchor="middle">' + cuentas[i] + "</text>";
      out += '<text class="eje" x="' + (x + w / 2) + '" y="' + (H - 20) + '" text-anchor="middle">' + t[0] + "</text>";
    });
    $("g-distribucion").innerHTML = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Distribución de matemáticas">' + out + "</svg>";
  }

  function graficoFaltas(rs) {
    var pts = rs.filter(function (d) { return d.mat != null && d.faltas != null; });
    var xs = pts.map(function (d) { return d.faltas; }), ys = pts.map(function (d) { return d.mat; });
    var r = correlacion(xs, ys);
    var fmax = Math.max.apply(null, xs.concat([8]));
    var W = 900, H = 340, L = 60, R = 20, T = 20, B = 50, y0 = 2, y1 = 5;
    var sx = function (v) { return L + (W - L - R) * v / fmax; }, sy = function (v) { return T + (H - T - B) * (1 - (v - y0) / (y1 - y0)); };
    var out = "";
    for (var g = 2; g <= 5; g++) out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(g) + '" y2="' + sy(g) + '" stroke="#264852"/><text class="eje" x="' + (L - 8) + '" y="' + (sy(g) + 4) + '" text-anchor="end">' + g + "</text>";
    out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(PASAR) + '" y2="' + sy(PASAR) + '" stroke="#f0bd5a" stroke-width="2" stroke-dasharray="6 5"/>';
    pts.forEach(function (d) { out += '<circle cx="' + sx(d.faltas) + '" cy="' + sy(d.mat) + '" r="6" fill="' + (d.mat < PASAR ? "#ef7a66" : "#55c2ab") + '" opacity=".85"><title>' + d.faltas + " faltas · matemáticas " + f2(d.mat) + "</title></circle>"; });
    out += '<text class="eje" x="' + (W / 2) + '" y="' + (H - 12) + '" text-anchor="middle">Faltas del periodo</text>';
    $("g-faltas").innerHTML = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Faltas y matemáticas">' + out + "</svg>";
    var conF = pts.filter(function (d) { return d.faltas >= 4; }), sinF = pts.filter(function (d) { return d.faltas < 4; });
    $("r-texto").textContent = (r == null ? "Con menos de 3 estudiantes no se calcula la correlación." : "Correlación r = " + f2(r) + " (" + (r < -0.5 ? "fuerte y negativa" : r < -0.3 ? "moderada y negativa" : "débil o nula") + "). Es una asociación, no una causa.") +
      (conF.length ? " Con 4 o más faltas: promedio de matemáticas " + f2(media(conF.map(function (d) { return d.mat; }))) + " (" + conF.length + " estudiantes)." : "") +
      (sinF.length ? " Con menos de 4: " + f2(media(sinF.map(function (d) { return d.mat; }))) + " (" + sinF.length + ")." : "");
  }

  function graficoGrupos() {
    var grupos = unicos(datos.filter(function (d) { return String(d.grado) === filtros.grado && d.periodo === filtros.periodo; }).map(function (d) { return d.grupo; })).sort();
    if (!grupos.length) { $("g-grupos").innerHTML = ""; return; }
    var vals = grupos.map(function (g) { return { g: g, m: media(datos.filter(function (d) { return String(d.grado) === filtros.grado && d.periodo === filtros.periodo && d.grupo === g; }).map(function (d) { return d.mat; }).filter(function (x) { return x != null; })) }; });
    var W = 900, H = 280, L = 60, R = 20, T = 20, B = 50, y0 = 2, y1 = 5;
    var sy = function (v) { return T + (H - T - B) * (1 - (v - y0) / (y1 - y0)); };
    var bw = (W - L - R) / vals.length, out = "";
    for (var g2 = 2; g2 <= 5; g2++) out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(g2) + '" y2="' + sy(g2) + '" stroke="#264852"/><text class="eje" x="' + (L - 8) + '" y="' + (sy(g2) + 4) + '" text-anchor="end">' + g2 + "</text>";
    vals.forEach(function (v, i) {
      if (v.m == null) return;
      var cx = L + bw * i + bw / 2, bwid = Math.min(120, bw * 0.5);
      out += '<rect class="barra" x="' + (cx - bwid / 2) + '" y="' + sy(v.m) + '" width="' + bwid + '" height="' + (sy(y0) - sy(v.m)) + '" fill="' + (v.g === filtros.grupo ? "#f0bd5a" : "#5f7d87") + '"><title>' + esc(v.g) + ": " + f2(v.m) + "</title></rect>";
      out += '<text class="etiq" x="' + cx + '" y="' + (sy(v.m) - 6) + '" text-anchor="middle">' + f2(v.m) + "</text>";
      out += '<text class="eje" x="' + cx + '" y="' + (H - 20) + '" text-anchor="middle">' + esc(v.g) + "</text>";
    });
    out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(PASAR) + '" y2="' + sy(PASAR) + '" stroke="#f0bd5a" stroke-width="2" stroke-dasharray="6 5"/>';
    $("g-grupos").innerHTML = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Matemáticas por grupo">' + out + "</svg>";
  }

  function tablaPanel(rs) {
    var filas = rs.slice().sort(function (a, b) { return a.codigo < b.codigo ? -1 : 1; });
    $("tbody-panel").innerHTML = filas.map(function (d) {
      var notas = NOTAS.map(function (n) { return d[n.k]; });
      var validas = notas.filter(function (x) { return x != null; });
      return "<tr><td>" + esc(d.codigo) + "</td>" + notas.map(function (x) { return '<td class="n">' + f2(x) + "</td>"; }).join("") +
        '<td class="n">' + f2(media(validas)) + '</td><td class="n">' + (d.faltas == null ? "–" : d.faltas) + "</td></tr>";
    }).join("");
  }

  /* ---------- Ingreso de notas ---------- */
  function prepararNotas() {
    var grados = [6, 7, 8, 9, 10, 11];
    $("n-grado").innerHTML = grados.map(function (g) { return '<option value="' + g + '">' + g + "°</option>"; }).join("");
    if (filtros.grado) $("n-grado").value = filtros.grado;
    if (!$("n-periodo").value) $("n-periodo").value = filtros.periodo || "";
    if (!$("n-grupo").value) $("n-grupo").value = filtros.grupo || "";
    cargarNotas();
  }
  function fila(d) {
    d = d || {};
    var celdas = ["mat", "ing", "cn", "soc", "ef"].map(function (k) { return '<td><input type="number" min="0" max="5" step="0.1" inputmode="decimal" data-k="' + k + '" value="' + (d[k] == null ? "" : d[k]) + '"/></td>'; }).join("");
    return '<tr' + (d.id ? ' data-id="' + esc(d.id) + '"' : "") + '><td><input type="text" data-k="nombre" maxlength="60" placeholder="Nombre (solo docentes)" value="' + esc(d.nombre || "") + '"/></td><td><input type="text" data-k="codigo" maxlength="8" value="' + esc(d.codigo || "") + '"/></td>' + celdas +
      '<td><input type="number" class="fal" min="0" max="60" step="1" data-k="faltas" value="' + (d.faltas == null ? "" : d.faltas) + '"/></td><td><button class="btn pequeno peligro" type="button">Quitar</button></td></tr>';
  }
  function cargarNotas() {
    var g = $("n-grado").value, p = $("n-periodo").value.trim(), gr = $("n-grupo").value.trim();
    var rs = datos.filter(function (d) { return String(d.grado) === g && d.periodo === p && d.grupo === gr; });
    $("tbody-notas").innerHTML = rs.length ? rs.map(fila).join("") : fila();
    msg($("n-msg"), rs.length ? rs.length + " estudiantes en este grupo. Puedes corregir y guardar." : "Grupo nuevo: agrega estudiantes y guarda.", "");
    if (!rs.length) return;
    enviar("nombres", { grado: g, grupo: gr, periodo: p }).then(function (r) {
      if (!r.ok) return;
      var mapa = {};
      (r.datos || []).forEach(function (x) { mapa[x.codigo] = x.nombre; });
      $("tbody-notas").innerHTML = rs.map(function (d) { d.nombre = mapa[d.codigo] || ""; return fila(d); }).join("");
    });
  }
  $("n-cargar").addEventListener("click", cargarNotas);
  ["n-grado", "n-grupo", "n-periodo"].forEach(function (id) { $(id).addEventListener("change", cargarNotas); });
  $("n-agregar").addEventListener("click", function () {
    var tb = $("tbody-notas");
    tb.insertAdjacentHTML("afterbegin", fila());
    var primera = tb.querySelector("tr input[data-k='nombre']");
    if (primera) primera.focus();
  });
  $("tbody-notas").addEventListener("click", function (e) {
    if (!e.target.matches("button")) return;
    var tr = e.target.closest("tr"), id = tr.dataset.id;
    if (!id) { tr.remove(); return; }
    if (!confirm("¿Quitar esta fila de la base de datos?")) return;
    enviar("borrar", { id: id }).then(function (r) {
      if (r.ok) { tr.remove(); cargarTodo(true); msg($("n-msg"), "Fila quitada.", "ok"); } else msg($("n-msg"), r.error || "No se pudo quitar.", "error");
    });
  });
  $("n-guardar").addEventListener("click", function () {
    var g = $("n-grado").value, gr = $("n-grupo").value.trim(), p = $("n-periodo").value.trim();
    if (!gr || !p) { msg($("n-msg"), "Escribe el grupo y el periodo.", "error"); return; }
    var filas = [], trs = $("tbody-notas").querySelectorAll("tr");
    for (var i = 0; i < trs.length; i++) {
      var inp = trs[i].querySelectorAll("input"), o = { grado: g, grupo: gr, periodo: p };
      inp.forEach(function (x) { o[x.dataset.k] = x.value.trim(); });
      if (!o.codigo && !o.nombre && !o.mat && !o.ing && !o.cn && !o.soc && !o.ef && !o.faltas) continue;
      filas.push(o);
    }
    if (!filas.length) { msg($("n-msg"), "No hay filas para guardar.", "error"); return; }
    for (var j = 0; j < filas.length; j++) {
      var f = filas[j];
      if (!/^[A-Za-z0-9]{2,8}$/.test(f.codigo || "")) { msg($("n-msg"), "Código no válido: \"" + (f.codigo || "") + "\". Usa solo letras o números, de 2 a 8. Nunca el nombre.", "error"); return; }
      for (var q = 0; q < 5; q++) { var nk = ["mat", "ing", "cn", "soc", "ef"][q], nv = Number(String(f[nk]).replace(",", ".")); if (f[nk] === "" || isNaN(nv) || nv < 0 || nv > 5) { msg($("n-msg"), "Nota fuera de rango (0 a 5) en " + f.codigo + ".", "error"); return; } }
    }
    $("n-guardar").disabled = true; msg($("n-msg"), "Guardando…");
    enviar("guardar", { filas: filas }).then(function (r) {
      $("n-guardar").disabled = false;
      if (r.ok) { msg($("n-msg"), r.mensaje, "ok"); cargarTodo(true); }
      else msg($("n-msg"), r.error || "No se pudo guardar.", "error");
    });
  });

  /* Arranque */
  $("titulo").textContent = "Entrar";
  mostrar("acceso");
  if (!CFG.REGISTRO) msg($("acc-msg"), "Falta REGISTRO en config.js: pega la dirección /exec (ver LEEME.txt).", "error");
})();

/* Carrusel del banner: cambia cada 6 s; se detiene si el usuario pide menos movimiento. */
(function () {
  var diapos = document.querySelectorAll(".diapo"), puntos = document.querySelectorAll(".punto");
  if (diapos.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var i = 0;
  setInterval(function () {
    diapos[i].classList.remove("activo"); puntos[i].classList.remove("activo");
    i = (i + 1) % diapos.length;
    diapos[i].classList.add("activo"); puntos[i].classList.add("activo");
  }, 6000);
})();

