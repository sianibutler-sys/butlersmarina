(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  $$("img").forEach(function (i) { var miss = function () { i.classList.add("is-missing"); }; if (i.complete && !i.naturalWidth) miss(); else i.addEventListener("error", miss); });
  var yr = $("#yr");
  if (yr) yr.textContent = new Date().getFullYear();

  /* Header: solid once you leave the chart, and the mobile menu */
  var bar = $(".bar");
  var onScroll = function () { bar.classList.toggle("is-solid", window.scrollY > 40); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var menuBtn = $(".bar__menu"), nav = $("#nav");
  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      var open = menuBtn.getAttribute("aria-expanded") !== "true";
      menuBtn.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
      bar.classList.toggle("is-open", open);
    });
    $$("#nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        menuBtn.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
        bar.classList.remove("is-open");
      });
    });
  }

  /* Chart framing: wide screens see the whole harbor, phones zoom in on the creek */
  var map = $("#chartMap");
  var frame = function () {
    if (!map) return;
    map.setAttribute("viewBox", window.innerWidth <= 960 ? "355 300 310 250" : "150 130 900 660");
  };
  frame();
  window.addEventListener("resize", frame);

  /* The course line runs in once per visit */
  var chart = $(".chart"), skip = $(".chart__skip");
  var seen = false;
  try { seen = sessionStorage.getItem("bm-course") === "1"; } catch (e) {}
  if (chart && !reduce && !seen) {
    document.documentElement.classList.add("is-intro");
    chart.classList.add("is-intro");
    document.body.classList.add("is-intro");
    skip.hidden = false;
    var end = function () {
      document.body.classList.remove("is-intro");
      chart.classList.remove("is-intro");
      document.documentElement.classList.remove("is-intro");
      skip.hidden = true;
      try { sessionStorage.setItem("bm-course", "1"); } catch (e) {}
    };
    var t = setTimeout(end, 4800);
    skip.addEventListener("click", function () { clearTimeout(t); end(); });
    window.addEventListener("keydown", function k(ev) {
      if (ev.key === "Escape") { clearTimeout(t); end(); window.removeEventListener("keydown", k); }
    });
  }

  /* Live conditions from NOAA's Annapolis station */
  var cond = $("#conditions");
  var setK = function (k, v) { var el = document.querySelector('[data-k="' + k + '"]'); if (el) el.textContent = v; };
  var fmtTime = function (s) {
    var m = /(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/.exec(s || "");
    if (!m) return "";
    var h = +m[4], ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + m[5] + " " + ap;
  };
  var render = function (d) {
    if (!d || (d.level == null && d.water == null && !d.wind)) { hideNotes(); return; }
    var now = Date.now();
    var next = (d.hilo || []).filter(function (p) { return toMs(p.t) > now; })[0];
    if (d.level != null) {
      var dir = next ? (next.type === "H" ? "rising" : "falling") : "";
      setK("tide", d.level.toFixed(1) + " ft" + (dir ? ", " + dir : ""));
    } else setK("tide", "Unavailable");
    setK("next", next ? (next.type === "H" ? "High " : "Low ") + fmtTime(next.t) : "—");
    setK("water", d.water != null ? Math.round(d.water) + "°F" : "—");
    setK("wind", d.wind ? d.wind.dir + " " + Math.round(d.wind.kt) + " kt" : "—");
    setK("src", "NOAA station 8575512, Annapolis" + (d.time ? ". Updated " + fmtTime(d.time) : ""));
  };
  var toMs = function (s) {
    var m = /(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : 0;
  };
  var hideNotes = function () { var n = $(".notes"); if (n) n.hidden = true; };
  var noaa = function (q) {
    return fetch("https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=8575512&time_zone=lst_ldt&units=english&format=json&application=butlersmarina" + q)
      .then(function (r) { return r.json(); });
  };
  var direct = function () {
    return Promise.all([
      noaa("&product=water_level&date=latest&datum=MLLW"),
      noaa("&product=predictions&interval=hilo&datum=MLLW&date=today&range=48"),
      noaa("&product=water_temperature&date=latest"),
      noaa("&product=wind&date=latest")
    ].map(function (p) { return p.catch(function () { return null; }); })).then(function (r) {
      var wl = r[0] && r[0].data && r[0].data[0];
      var wt = r[2] && r[2].data && r[2].data[0];
      var wd = r[3] && r[3].data && r[3].data[0];
      return {
        level: wl ? parseFloat(wl.v) : null,
        time: wl ? wl.t : null,
        hilo: (r[1] && r[1].predictions || []).map(function (p) { return { t: p.t, type: p.type, v: parseFloat(p.v) }; }),
        water: wt ? parseFloat(wt.v) : null,
        wind: wd ? { dir: wd.dr, kt: parseFloat(wd.s) } : null
      };
    });
  };
  if (cond) {
    fetch("/api/conditions").then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .catch(direct).then(render)
      .catch(hideNotes);
  }

  /* Overnight calculator */
  var RATE = 3, MIN = 25, MAX = 75;
  var loa = $("#loa"), range = $("#loaRange"), nights = $("#nights");
  var fit = $("#fit"), sum = $("#sum"), math = $("#math"), boat = $(".gauge__boat"), go = $("#calcGo");
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var calc = function () {
    var L = Math.round(parseFloat(loa.value) || 0);
    var N = clamp(Math.round(parseFloat(nights.value) || 1), 1, 30);
    var ok = L >= MIN && L <= MAX;
    boat.style.width = clamp(L / 80 * 100, 4, 100) + "%";
    boat.classList.toggle("is-out", !ok);
    fit.classList.toggle("is-out", !ok);
    if (!L) fit.textContent = "Enter your boat’s length.";
    else if (L < MIN) fit.textContent = "Our slips start at 25 feet. Call (410) 626-0051 to ask about smaller boats.";
    else if (L > MAX) fit.textContent = "Our slips top out at 75 feet.";
    else fit.textContent = "A " + L + "-foot boat fits our slips.";
    math.textContent = (L || 0) + " ft × " + N + (N === 1 ? " night" : " nights") + " × $" + RATE;
    sum.textContent = ok ? "$" + (L * N * RATE).toLocaleString("en-US") : "—";
    go.setAttribute("aria-disabled", String(!ok));
  };
  if (loa) {
    loa.addEventListener("input", function () { range.value = clamp(+loa.value || 15, 15, 85); calc(); });
    range.addEventListener("input", function () { loa.value = range.value; calc(); });
    nights.addEventListener("input", calc);
    nights.addEventListener("blur", function () { nights.value = clamp(+nights.value || 1, 1, 30); calc(); });
    $$(".stepper button").forEach(function (b) {
      b.addEventListener("click", function () { nights.value = clamp((+nights.value || 1) + (+b.dataset.step), 1, 30); calc(); });
    });
    calc();
    go.addEventListener("click", function () {
      setType("Overnight stay");
      var f = $("#inquiry");
      f.loa.value = Math.round(+loa.value);
      var msg = f.message;
      if (!msg.value) msg.value = (+nights.value) + (+nights.value === 1 ? " night" : " nights") + " for a " + Math.round(+loa.value) + "-foot boat.";
    });
  }

  /* Inquiry form */
  var form = $("#inquiry"), status = $("#inqStatus");
  var fieldsFor = function (type) {
    $$("[data-for]", form).forEach(function (el) {
      var want = el.dataset.for === "boat" ? /slip|Overnight/.test(type) : el.dataset.for === "dates" ? type === "Overnight stay" : true;
      el.hidden = !want;
    });
  };
  var setType = function (type) {
    var r = $('input[name="type"][value="' + type + '"]', form);
    if (r) { r.checked = true; fieldsFor(type); }
  };
  if (form) {
    fieldsFor("Annual slip");
    $$('input[name="type"]', form).forEach(function (r) { r.addEventListener("change", function () { fieldsFor(r.value); }); });
    $$("a[data-type]").forEach(function (a) { a.addEventListener("click", function () { setType(a.dataset.type); }); });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      status.className = "inq__status";
      var bad = null;
      ["name", "email"].forEach(function (n) {
        var el = form[n];
        var ok = el.value.trim() && (n !== "email" || /.+@.+\..+/.test(el.value));
        el.setAttribute("aria-invalid", String(!ok));
        if (!ok && !bad) bad = el;
      });
      if (bad) {
        status.classList.add("is-err");
        status.textContent = "Add your name and a working email so we can reply.";
        bad.focus();
        return;
      }
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = typeof v === "string" ? v.trim() : v; });
      data.sms = form.sms.checked ? "yes" : "no";
      var btn = $(".inq__send", form);
      btn.disabled = true;
      status.textContent = "Sending…";
      fetch("/api/inquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw j; return j; }); })
        .then(function () {
          form.reset();
          fieldsFor("Annual slip");
          status.textContent = "Request sent. We’ll be in touch soon.";
        })
        .catch(function () {
          var lines = ["Type: " + data.type, "Name: " + data.name, "Email: " + data.email];
          ["phone", "boat", "loa", "beam", "draft", "arrive", "depart", "message"].forEach(function (k) { if (data[k]) lines.push(k[0].toUpperCase() + k.slice(1) + ": " + data[k]); });
          window.location.href = "mailto:info@butlersmarinaannapolis.com?subject=" + encodeURIComponent(data.type + " request") + "&body=" + encodeURIComponent(lines.join("\n"));
          status.textContent = "Your email app should open with the request filled in. If it doesn’t, call (410) 626-0051.";
        })
        .then(function () { btn.disabled = false; });
    });
  }
})();
