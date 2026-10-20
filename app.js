/* Rendimiento académico · datos simulados. Calcula todo desde window.RA_DATOS. */
(function () {
  "use strict";
  var D = window.RA_DATOS || [];
  var MATS = [
    { k: "mat", n: "Matemáticas" }, { k: "ing", n: "Inglés" }, { k: "cn", n: "Ciencias naturales" },
    { k: "soc", n: "Sociales" }, { k: "ef", n: "Educación física" }
  ];
  var PASAR = 3.0;
  function f2(x) { return x.toFixed(2).replace(".", ","); }
  function media(a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* Cálculos */
  var notas = []; D.forEach(function (r) { MATS.forEach(function (m) { notas.push(r[m.k]); }); });
  var total = media(notas);
  var sinEF = []; D.forEach(function (r) { MATS.forEach(function (m) { if (m.k !== "ef") sinEF.push(r[m.k]); }); });
  var prom = media(sinEF);
  var mat = D.map(function (r) { return r.mat; }), ing = D.map(function (r) { return r.ing; });
  var matProm = media(mat), ingProm = media(ing);
  var matBajo = D.filter(function (r) { return r.mat < PASAR; });
  var conFaltas = D.filter(function (r) { return r.faltas >= 4; });
  var conFaltasBajo = conFaltas.filter(function (r) { return r.mat < PASAR; });
  var sinFaltasMat = D.filter(function (r) { return r.faltas < 4; });
  var ingFranja = D.filter(function (r) { return r.ing >= PASAR && r.ing <= 3.2; });
  var cruce = matBajo.filter(function (r) { return r.ing >= PASAR && r.ing <= 3.2; });
  var xs = D.map(function (r) { return r.faltas; }), ys = mat;
  var mx = media(xs), my = media(ys), cov = 0, vx = 0, vy = 0;
  D.forEach(function (r, i) { cov += (xs[i] - mx) * (ys[i] - my); vx += Math.pow(xs[i] - mx, 2); vy += Math.pow(ys[i] - my, 2); });
  var r = cov / Math.sqrt(vx * vy);
  var stats = MATS.map(function (m) {
    var v = D.map(function (x) { return x[m.k]; });
    return { n: m.n, prom: media(v), bajo: v.filter(function (x) { return x < PASAR; }).length, min: Math.min.apply(null, v) };
  });

  /* Cifras clave */
  var kpis = [
    { l: "Promedio de todas las notas", v: f2(total), n: "140 notas", c: "" },
    { l: "Sin educación física", v: f2(prom), n: "El promedio sube con educación física", c: "" },
    { l: "Matemáticas", v: f2(matProm), n: matBajo.length + " estudiantes bajo 3,0", c: "alerta" },
    { l: "Inglés", v: f2(ingProm), n: ingFranja.length + " entre 3,0 y 3,2", c: "" }
  ];
  document.getElementById("kpis").innerHTML = kpis.map(function (k, i) {
    return '<div class="kpi" style="animation-delay:' + (i * 80) + 'ms"><div class="lbl">' + esc(k.l) + '</div><div class="val ' + k.c + '">' + k.v + '</div><div class="nota">' + esc(k.n) + "</div></div>";
  }).join("");

  /* Gráfico 1: promedio por materia con línea de 3,0 */
  (function () {
    var W = 900, H = 340, L = 60, R = 20, T = 20, B = 60, y0 = 2.0, y1 = 5.0;
    var sy = function (v) { return T + (H - T - B) * (1 - (v - y0) / (y1 - y0)); };
    var bw = (W - L - R) / stats.length, out = "";
    for (var g = 2; g <= 5; g += 0.5) {
      out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(g) + '" y2="' + sy(g) + '" stroke="#dcd7cc"/>';
      out += '<text class="eje" x="' + (L - 8) + '" y="' + (sy(g) + 4) + '" text-anchor="end">' + f2(g) + "</text>";
    }
    stats.forEach(function (s, i) {
      var cx = L + bw * i + bw / 2, top = sy(s.prom), base = sy(y0), bwid = bw * 0.5;
      out += '<rect class="barra" x="' + (cx - bwid / 2) + '" y="' + top + '" width="' + bwid + '" height="' + (base - top) + '" fill="' + (s.prom < PASAR ? "#9a4129" : "#2f6f5e") + '" opacity=".85"><title>' + esc(s.n) + ": promedio " + f2(s.prom) + "</title></rect>";
      out += '<text class="etiq" x="' + cx + '" y="' + (top - 8) + '" text-anchor="middle">' + f2(s.prom) + "</text>";
      out += '<text class="eje" x="' + cx + '" y="' + (H - 26) + '" text-anchor="middle">' + esc(s.n) + "</text>";
    });
    out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(PASAR) + '" y2="' + sy(PASAR) + '" stroke="#b5563b" stroke-width="2" stroke-dasharray="6 5"/>';
    document.getElementById("grafico-materias").innerHTML = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Promedio por materia">' + out + "</svg>";
  })();

  /* Gráfico 2: estudiantes bajo 3,0 por materia */
  (function () {
    var W = 900, H = 260, L = 60, R = 20, T = 20, B = 50;
    var max = Math.max.apply(null, stats.map(function (s) { return s.bajo; })) || 1;
    var bw = (W - L - R) / stats.length, out = "";
    stats.forEach(function (s, i) {
      var h = (H - T - B) * (s.bajo / max), x = L + bw * i + bw * 0.25, y = H - B - h, w = bw * 0.5;
      out += '<rect class="barra" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#9a4129" opacity=".85"><title>' + esc(s.n) + ": " + s.bajo + " bajo 3,0</title></rect>";
      out += '<text class="etiq" x="' + (x + w / 2) + '" y="' + (y - 8) + '" text-anchor="middle">' + s.bajo + "</text>";
      out += '<text class="eje" x="' + (x + w / 2) + '" y="' + (H - 22) + '" text-anchor="middle">' + esc(s.n) + "</text>";
    });
    document.getElementById("grafico-bajo").innerHTML = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Estudiantes bajo 3,0 por materia">' + out + "</svg>";
  })();

  /* Gráfico 3: faltas vs matemáticas (puntos sin identificar) */
  (function () {
    var W = 900, H = 380, L = 60, R = 20, T = 20, B = 50, x0 = 0, x1 = 9, y0 = 2, y1 = 5;
    var sx = function (v) { return L + (W - L - R) * (v - x0) / (x1 - x0); };
    var sy = function (v) { return T + (H - T - B) * (1 - (v - y0) / (y1 - y0)); };
    var out = "";
    for (var g = 2; g <= 5; g += 1) out += '<text class="eje" x="' + (L - 8) + '" y="' + (sy(g) + 4) + '" text-anchor="end">' + f2(g) + "</text><line x1=\"" + L + "\" x2=\"" + (W - R) + "\" y1=\"" + sy(g) + "\" y2=\"" + sy(g) + "\" stroke=\"#dcd7cc\"/>";
    for (var f = 0; f <= 8; f += 2) out += '<text class="eje" x="' + sx(f) + '" y="' + (H - 18) + '" text-anchor="middle">' + f + "</text>";
    out += '<text class="eje" x="' + (W / 2) + '" y="' + (H - 2) + '" text-anchor="middle">Faltas del periodo</text>';
    out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(PASAR) + '" y2="' + sy(PASAR) + '" stroke="#b5563b" stroke-width="2" stroke-dasharray="6 5"/>';
    D.forEach(function (d) {
      var bajo = d.mat < PASAR;
      out += '<circle class="punto" cx="' + sx(d.faltas) + '" cy="' + sy(d.mat) + '" r="6" fill="' + (bajo ? "#9a4129" : "#2f6f5e") + '" opacity=".85"><title>' + d.faltas + " faltas · matemáticas " + f2(d.mat) + "</title></circle>";
    });
    document.getElementById("grafico-faltas").innerHTML = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Faltas contra nota de matemáticas">' + out + "</svg>";
  })();

  /* Textos con cifras calculadas */
  document.getElementById("texto-materias").innerHTML =
    "Matemáticas promedia " + f2(matProm) + " y tiene <strong>" + matBajo.length + " estudiantes bajo 3,0</strong>. Educación física promedia " + f2(stats[4].prom) + " y nadie está bajo 3,0. El promedio del grupo tapa a quienes pierden.";
  document.getElementById("texto-faltas").innerHTML =
    "Los " + conFaltas.length + " estudiantes con 4 o más faltas promedian <strong>" + f2(media(conFaltas.map(function (x) { return x.mat; }))) + "</strong> en matemáticas. Los que tienen menos de 4 promedian " + f2(media(sinFaltasMat.map(function (x) { return x.mat; }))) + ". De los " + conFaltas.length + ", " + conFaltasBajo.length + " están bajo 3,0. La correlación es r = " + f2(r).replace(",", ",") + ": asociación fuerte, no causa.";
  document.getElementById("texto-cruce").innerHTML =
    "<p style=\"margin:0\">De los <strong>" + matBajo.length + "</strong> que pierden matemáticas, <strong>" + cruce.length + "</strong> también están entre 3,0 y 3,2 en inglés. Están en riesgo en las dos materias: en inglés no tienen margen.</p>" +
    "<p class=\"texto\" style=\"margin-top:10px\">El refuerzo, entonces, se piensa como dos talleres con listas distintas, no como una sola lista de personas.</p>";
})();
