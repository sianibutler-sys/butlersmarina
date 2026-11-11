(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* Openings in the mixed-use building. One line per opening, e.g.
     "One-bedroom apartment, available December 1". Leave empty when nothing is open. */
  var OPENINGS = [];
  var RATE = 4, MIN = 25, MAX = 75;
  var BOAT = /slip|Overnight|lift/;

  var list = $("#openingsList");
  if (list) OPENINGS.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; list.appendChild(li); });
  var yr = $("#yr"); if (yr) yr.textContent = new Date().getFullYear();

  /* Splash: the burgee goes up, then the page. Tap or any key skips it; CSS ends it on its own if this script never runs. */
  var root = document.documentElement, splash = $("#splash");
  if (splash && root.classList.contains("splash-on")) {
    var done = function () {
      root.classList.remove("splash-on");
      try { sessionStorage.setItem("bm-splash", "1"); } catch (e) {}
    };
    var skip = function () { splash.classList.add("is-leaving"); setTimeout(done, 520); window.removeEventListener("keydown", skip); };
    splash.addEventListener("click", skip);
    window.addEventListener("keydown", skip);
    splash.addEventListener("animationend", function (e) { if (e.animationName === "leave") done(); });
    setTimeout(done, 3200);
  }

  /* Header: clear over the photo, solid once you scroll; current section underlined */
  var bar = $(".bar"), hero = $(".hero, .phero, .contact--page");
  var onScroll = function () { bar.classList.toggle("is-solid", !hero || window.scrollY > 40); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var menuBtn = $(".bar__menu"), nav = $("#nav");
  var setMenu = function (open) {
    menuBtn.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    bar.classList.toggle("is-open", open);
  };
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () { setMenu(menuBtn.getAttribute("aria-expanded") !== "true"); });
    $$("#nav a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  }

  /* Dock map: pick a slip, switch between all slips and lift slips */
  $$("[data-dockmap]").forEach(function (dm) {
    var info = $(".dm__info", dm), on = null;
    var ask = document.createElement("a");
    ask.className = "dm__ask";
    var contactBase = ($(".dock-bar__main") || { getAttribute: function () { return "contact/"; } }).getAttribute("href").split("?")[0];
    function where(n) {
      if (n <= 4) return "Shore walk, closest to the building";
      if (n <= 14) return "Main pier, creek side";
      if (n <= 21) return "Out at the end of the pier";
      return "Main pier, shore side";
    }
    function pick(n) {
      on = n;
      $$(".dm__slip", dm).forEach(function (g) { g.classList.toggle("is-on", +g.dataset.slip === n); });
      var lift = !!$(".dm__slip.is-lift[data-slip='" + n + "']", dm);
      info.innerHTML = "<h3>Slip " + n + "</h3><p class=\"dm__where\">" + (lift ? "Lift slip. " : "") + where(n) + ".</p>";
      ask.textContent = "Ask about slip " + n;
      ask.href = contactBase + "?type=" + (lift ? "Boat+lift" : "Annual+slip") + "&slip=" + n;
      info.appendChild(ask);
    }
    $$(".dm__slip", dm).forEach(function (g) {
      g.addEventListener("click", function () { pick(+g.dataset.slip); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(+g.dataset.slip); } });
    });
    $$(".dm__view button", dm).forEach(function (b) {
      b.addEventListener("click", function () {
        var lifts = b.dataset.view === "lifts";
        dm.classList.toggle("dm--lifts", lifts);
        $$(".dm__view button", dm).forEach(function (o) { o.setAttribute("aria-checked", String(o === b)); });
      });
    });
  });

  /* Area map: filter places, pick one, draw the walk, zoom to fit */
  var am = $("[data-areamap]");
  if (am) {
    var AM = JSON.parse($("#amData").textContent), svg = $(".am__svg", am), VW = 1200, VH = 1077;
    var full = [0, 0, VW, VH], vb = full.slice(), anim = null, cat = "all", sel = null;
    var pins = $$(".am__pin", am), home = $(".am__home", am), routeEl = $(".am__route", am), card = $(".am__card", am);
    var items = $$(".am__item", am), groups = $$(".am__group", am);
    var origin = "409 Chester Avenue, Annapolis, MD 21403";
    var at = {}; AM.places.forEach(function (p) { at[p.i] = p; });
    function paint(v) {
      vb = v; svg.setAttribute("viewBox", v.map(function (n) { return n.toFixed(1); }).join(" "));
      var s = v[2] / (svg.clientWidth || VW); svg.style.setProperty("--s", s.toFixed(3));
      pins.forEach(function (g) { var p = at[g.dataset.i]; g.setAttribute("transform", "translate(" + p.x + " " + p.y + ") scale(" + s.toFixed(3) + ")"); });
      home.setAttribute("transform", "translate(" + AM.home[0] + " " + AM.home[1] + ") scale(" + s.toFixed(3) + ")");
    }
    function go(target) {
      if (anim) cancelAnimationFrame(anim);
      if (reduce) return paint(target);
      var from = vb.slice(), t0 = performance.now(), dur = 520;
      (function tick(now) {
        var k = Math.min(1, (now - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        paint(from.map(function (a, j) { return a + (target[j] - a) * e; }));
        if (k < 1) anim = requestAnimationFrame(tick);
      })(t0);
    }
    function fit(pts, minW) {
      var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
      var x0 = Math.min.apply(0, xs), x1 = Math.max.apply(0, xs), y0 = Math.min.apply(0, ys), y1 = Math.max.apply(0, ys);
      var w = Math.max(x1 - x0, minW || 300), h = Math.max(y1 - y0, (minW || 300) * VH / VW);
      w *= 1.35; h *= 1.35;
      if (w / h > VW / VH) h = w * VH / VW; else w = h * VW / VH;
      if (w >= VW) return full.slice();
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      var x = Math.min(Math.max(cx - w / 2, 0), VW - w), y = Math.min(Math.max(cy - h / 2, 0), VH - h);
      return [x, y, w, h];
    }
    function routePts(d) { var n = d.match(/-?\d+(\.\d+)?/g) || [], out = []; for (var j = 0; j + 1 < n.length; j += 2) out.push([+n[j], +n[j + 1]]); return out; }
    function showCat(c) {
      cat = c; am.classList.toggle("is-cat", c !== "all"); $(".am__list", am).scrollTop = 0;
      $$(".am__tabs button", am).forEach(function (b) { b.setAttribute("aria-checked", String(b.dataset.cat === c)); });
      pins.forEach(function (g) { g.classList.toggle("is-hidden", c !== "all" && at[g.dataset.i].cat !== c); });
      groups.forEach(function (g) { g.hidden = c !== "all" && g.dataset.cat !== c; });
      if (sel !== null && c !== "all" && at[sel].cat !== c) clear();
      var pts = AM.places.filter(function (p) { return c === "all" || p.cat === c; }).map(function (p) { return [p.x, p.y]; });
      pts.push(AM.home);
      go(c === "all" ? full.slice() : fit(pts, 260));
    }
    function clear() {
      sel = null; routeEl.setAttribute("d", "");
      pins.forEach(function (g) { g.classList.remove("is-on"); });
      items.forEach(function (b) { b.classList.remove("is-on"); });
      card.innerHTML = '<p class="am__hint">Pick a place to see the walk from Butler’s.</p>';
    }
    function pick(i, fromList) {
      var p = at[i]; sel = +i;
      routeEl.setAttribute("d", p.route);
      pins.forEach(function (g) { g.classList.toggle("is-on", +g.dataset.i === sel); });
      items.forEach(function (b) { b.classList.toggle("is-on", +b.dataset.i === sel); });
      var dir = "https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent(origin) + "&destination=" + p.q + "&travelmode=walking";
      card.innerHTML = "<h3>" + p.name + "</h3><p class=\"am__meta\">" + p.addr + "</p><p class=\"am__time\">" + p.mins + " min walk · " + p.mi + " mi</p>" +
        "<p class=\"am__links\"><a href=\"" + dir + "\" target=\"_blank\" rel=\"noopener\">Walking directions</a></p>";
      go(fit(routePts(p.route).concat([[p.x, p.y], AM.home]), 220));
      if (fromList && window.innerWidth <= 1020) svg.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    }
    $$(".am__tabs button", am).forEach(function (b) { b.addEventListener("click", function () { showCat(b.dataset.cat); }); });
    items.forEach(function (b) { b.addEventListener("click", function () { pick(b.dataset.i, true); }); });
    pins.forEach(function (g) {
      g.setAttribute("tabindex", "0"); g.setAttribute("role", "button"); g.setAttribute("aria-label", at[g.dataset.i].name.replace(/&#8217;/g, "’").replace(/&amp;/g, "&") + ", " + at[g.dataset.i].mins + " minute walk");
      g.addEventListener("click", function () { pick(g.dataset.i); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(g.dataset.i); } });
    });
    $("[data-zoom=home]", am).addEventListener("click", function () { clear(); showCat("all"); });
    paint(full);
    window.addEventListener("resize", function () { paint(vb); });
  }

  /* Card rail */
  var track = $("#railTrack");
  if (track) {
    var btns = $$(".rail__btn");
    var step = function () { var c = track.querySelector(".card"); return c ? c.getBoundingClientRect().width + 24 : 400; };
    var sync = function () {
      btns[0].disabled = track.scrollLeft < 8;
      btns[1].disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
    };
    btns.forEach(function (b) { b.addEventListener("click", function () { track.scrollBy({ left: step() * +b.dataset.dir, behavior: reduce ? "auto" : "smooth" }); }); });
    track.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  }

  /* Map: phones get a tighter view; the course line runs in when the map comes into view */
  var map = $("#chartMap");
  var frame = function () { if (map) map.setAttribute("viewBox", window.innerWidth <= 600 ? "330 250 520 400" : "260 180 860 560"); };
  frame(); window.addEventListener("resize", frame);
  var reveal = $("#trackReveal");
  if (reveal && !reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { reveal.classList.add("is-drawing"); io.disconnect(); } });
    }, { threshold: 0.45 });
    io.observe(map);
  }

  /* Tide line, from NOAA predictions for station 8575512 that ship with the page */
  var TZ = "America/New_York";
  var tzOffset = function (ms) {
    var f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    var p = {}; f.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - ms;
  };
  var nyMs = function (y, mo, d, h, mi) { var g = Date.UTC(y, mo - 1, d, h, mi); return g - tzOffset(g - 5 * 3600e3); };
  var fmt = function (ms) { return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(ms)); };
  var dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  var tides = (function () {
    var el = $("#tideData"); if (!el) return [];
    return el.textContent.trim().split(",").map(function (s) {
      return { t: nyMs(2000 + +s.slice(0, 2), +s.slice(2, 4), +s.slice(4, 6), +s.slice(6, 8), +s.slice(8, 10)), type: s.slice(10) };
    });
  })();
  var drawTide = function () {
    var nowEl = $("#tide-now"), nextEl = $("#tideNext"); if (!nowEl) return;
    var t = Date.now(), prev = null, nxt = null;
    for (var i = 0; i < tides.length; i++) { if (tides[i].t > t) { nxt = tides[i]; prev = tides[i - 1] || null; break; } }
    if (!prev || !nxt) { nowEl.textContent = "Annapolis tide"; nextEl.innerHTML = '<a class="link" href="https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8575512" target="_blank" rel="noopener">See NOAA predictions</a>'; return; }
    var tomorrow = dayFmt.format(new Date(nxt.t)) !== dayFmt.format(new Date());
    nowEl.textContent = (prev.type === "L" ? "Tide rising." : "Tide falling.");
    nextEl.textContent = (nxt.type === "H" ? "High" : "Low") + " at " + fmt(nxt.t) + (tomorrow ? " tomorrow" : "") + ", NOAA Annapolis.";
  };
  drawTide(); setInterval(drawTide, 60000);

  /* Request form */
  var form = $("#inquiry"), status = $("#inqStatus");
  var MSG = {
    "Annual slip": ["Anything else (optional)", ""],
    "Overnight stay": ["Anything else (optional)", ""],
    "Boat lift": ["Boat weight and the lift you need", "e.g. 14,000 lbs, boat lift"],
    "Residential lease": ["What you’re looking for", "Move-in timing, how long, any questions"],
    "Office lease": ["What you’re looking for", "Size of team, move-in timing, any questions"]
  };
  var fieldsFor = function (type) {
    if (!form) return;
    $$("[data-for]", form).forEach(function (el) {
      el.hidden = !(el.dataset.for === "boat" ? BOAT.test(type) : el.dataset.for === "dates" ? type === "Overnight stay" : true);
    });
    var m = MSG[type] || MSG["Annual slip"];
    $("#f-msg-label").textContent = m[0];
    form.message.placeholder = m[1];
    clearErrs();
  };

  /* Validation: the same rules run again on the server */
  var digits = function (v) { return String(v || "").replace(/\D/g, ""); };
  var todayISO = function () { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()); };
  var rules = function (d) {
    var e = {}, t = d.type, num = function (k) { return parseFloat(d[k]); };
    if (!MSG[t]) e.type = "Choose what you’re asking about.";
    if ((d.name || "").replace(/[^A-Za-zÀ-ÿ]/g, "").length < 2) e.name = "Add your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(d.email || "")) e.email = "Add an email we can reply to, like name@example.com.";
    var ph = digits(d.phone); if (ph.length === 11 && ph[0] === "1") ph = ph.slice(1);
    if (ph.length !== 10) e.phone = "Add a 10-digit phone number.";
    if (BOAT.test(t)) {
      var lo = t === "Boat lift" ? 8 : 25;
      if ((d.boat || "").trim().length < 2) e.boat = "Add the boat’s name or make.";
      if (!(num("loa") >= lo && num("loa") <= 75)) e.loa = t === "Boat lift" ? "Length in feet, up to 75." : "Our slips fit 25 to 75 ft.";
      if (!(num("beam") >= 3 && num("beam") <= 25)) e.beam = "Beam in feet.";
      if (!(num("draft") >= 0.5 && num("draft") <= 12)) e.draft = "Draft in feet.";
    }
    if (t === "Overnight stay") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.arrive || "") || d.arrive < todayISO()) e.arrive = "Pick an arrival date, today or later.";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.depart || "") || (d.arrive && d.depart <= d.arrive)) e.depart = "Pick a date after you arrive.";
    }
    var msg = (d.message || "").trim();
    if (t === "Boat lift" && msg.length < 4) e.message = "Add the boat’s weight so we can match a lift.";
    if (/lease/.test(t) && msg.length < 10) e.message = "Tell us a little about what you need.";
    return e;
  };
  var clearErrs = function () {
    if (!form) return;
    $$(".f__msg", form).forEach(function (m) { m.remove(); });
    $$("[aria-invalid]", form).forEach(function (el) { el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby"); });
  };
  var showErrs = function (errs) {
    clearErrs();
    var first = null;
    Object.keys(errs).forEach(function (k) {
      var el = form.elements[k]; if (!el || !el.closest) return;
      var wrap = el.closest(".f"); if (!wrap || wrap.hidden) return;
      var m = document.createElement("small"); m.className = "f__msg"; m.id = "err-" + k; m.textContent = errs[k];
      wrap.appendChild(m); el.setAttribute("aria-invalid", "true"); el.setAttribute("aria-describedby", m.id);
      if (!first) first = el;
    });
    return first;
  };
  var setType = function (type) {
    var r = $('input[name="type"][value="' + type + '"]', form);
    if (r) { r.checked = true; fieldsFor(type); }
  };

  /* Availability bar */
  var finder = $("#finder");
  if (finder) {
    var qType = $("#q-type"), qLoa = $("#q-loa"), qArrive = $("#q-arrive"), qNights = $("#q-nights");
    var qEst = $("#q-est"), qMath = $("#q-math"), qNote = $("#q-note");
    qArrive.min = todayISO();
    var show = function () {
      var v = qType.value, slip = BOAT.test(v), night = v === "Overnight stay";
      $$("[data-show]", finder).forEach(function (el) {
        var k = el.dataset.show;
        el.hidden = !(k === "slip" ? slip : k === "dates" ? night : night);
      });
      $(".finder__go span", finder).textContent = night ? "Check availability" : v === "Annual slip" ? "Request a quote" : v === "Boat lift" ? "Ask about a lift" : "Ask what’s open";
      qNote.textContent = "";
      est();
    };
    var est = function () {
      var L = Math.round(+qLoa.value || 0), N = clamp(Math.round(+qNights.value || 1), 1, 30);
      if (L && (L < MIN || L > MAX)) { qEst.textContent = "—"; qMath.textContent = L < MIN ? "Our slips start at 25 ft. Call us." : "Our slips top out at 75 ft."; return; }
      qEst.textContent = L ? "$" + (L * N * RATE).toLocaleString("en-US") : "—";
      qMath.textContent = "at $" + RATE + " per foot per night, electricity included";
    };
    qType.addEventListener("change", show);
    [qLoa, qNights].forEach(function (i) { i.addEventListener("input", est); });
    qNights.addEventListener("blur", function () { qNights.value = clamp(+qNights.value || 1, 1, 30); est(); });
    $$(".finder__step button", finder).forEach(function (b) {
      b.addEventListener("click", function () { qNights.value = clamp((+qNights.value || 1) + (+b.dataset.step), 1, 30); est(); });
    });
    finder.addEventListener("submit", function (e) {
      var v = qType.value, L = Math.round(+qLoa.value || 0);
      if (BOAT.test(v) && v !== "Boat lift" && L && (L < MIN || L > MAX)) { e.preventDefault(); qNote.textContent = "Our slips fit boats 25 to 75 ft. Call (410) 626-0051 and we’ll talk it through."; return; }
      if (v === "Overnight stay") {
        var A = $("#q-arrive").value, Nn = +$("#q-nights").value;
        if (A && A < todayISO()) { e.preventDefault(); qNote.textContent = "Pick an arrival date today or later."; $("#q-arrive").focus(); return; }
        if (!(Nn >= 1 && Nn <= 30)) { e.preventDefault(); qNote.textContent = "Nights should be between 1 and 30. For longer, ask about an annual slip."; return; }
      }
      qNote.textContent = "";
      /* send only what applies to this request */
      $$("[data-show]", finder).forEach(function (el) { $$("input", el).forEach(function (i) { i.disabled = el.hidden || !i.value; }); });
      setTimeout(function () { $$("input", finder).forEach(function (i) { i.disabled = false; }); }, 0);
    });
    show();
  }

  if (form) {
    fieldsFor("Annual slip");
    var qs = new URLSearchParams(location.search), t = qs.get("type");
    if (t) {
      setType(t);
      var L = Math.round(+qs.get("loa") || 0), N = clamp(Math.round(+qs.get("nights") || 0), 0, 30), A = qs.get("arrive") || "";
      if (L && BOAT.test(t)) form.loa.value = L;
      if (t === "Overnight stay" && /^\d{4}-\d{2}-\d{2}$/.test(A)) {
        form.arrive.value = A;
        if (N) { var d = new Date(A + "T12:00:00"); d.setDate(d.getDate() + N); form.depart.value = d.toISOString().slice(0, 10); }
      }
      if (t === "Overnight stay" && N) form.message.value = N + (N === 1 ? " night" : " nights") + (L ? " for a " + L + "-foot boat." : ".");
      if (t === "Boat lift") form.message.placeholder = "Boat weight, and the lift size you need";
      var SN = Math.round(+qs.get("slip") || 0);
      if (SN >= 1 && SN <= 29) form.message.value = "Asking about slip " + SN + ".";
      if (qs.has("loa") || qs.has("arrive")) form.name.focus({ preventScroll: true });
    }
    $$('input[name="type"]', form).forEach(function (r) { r.addEventListener("change", function () { fieldsFor(r.value); }); });
    form.arrive.min = form.depart.min = todayISO();
    form.arrive.addEventListener("change", function () { form.depart.min = form.arrive.value || todayISO(); });
    form.addEventListener("input", function (ev) {
      var el = ev.target; if (el.getAttribute("aria-invalid") !== "true") return;
      var m = $("#err-" + el.name); if (m) m.remove();
      el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby");
    });
    $$("a[data-type]").forEach(function (a) { a.addEventListener("click", function () { setType(a.dataset.type); }); });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      status.className = "inq__status";
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = typeof v === "string" ? v.trim() : v; });
      data.sms = form.sms.checked ? "yes" : "no";
      var errs = rules(data), n = Object.keys(errs).length;
      if (n) {
        var first = showErrs(errs);
        status.classList.add("is-err");
        status.textContent = n === 1 ? "One thing to fix before sending." : n + " things to fix before sending.";
        if (first) first.focus();
        return;
      }
      clearErrs();
      var btn = $(".inq__send", form);
      btn.disabled = true;
      status.textContent = "Sending…";
      fetch("/api/inquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { j.status = r.status; throw j; } return j; }); })
        .then(function () { form.reset(); fieldsFor("Annual slip"); status.textContent = "Request sent. We’ll be in touch soon."; })
        .catch(function (j) {
          if (j && j.status === 400 && j.fields) {
            var first = showErrs(j.fields); status.classList.add("is-err");
            status.textContent = "Check the highlighted fields."; if (first) first.focus(); return;
          }
          var lines = ["Type: " + data.type, "Name: " + data.name, "Email: " + data.email];
          ["phone", "boat", "loa", "beam", "draft", "arrive", "depart", "message"].forEach(function (k) { if (data[k]) lines.push(k[0].toUpperCase() + k.slice(1) + ": " + data[k]); });
          var href = "mailto:info@butlersmarinaannapolis.com?subject=" + encodeURIComponent(data.type + " request") + "&body=" + encodeURIComponent(lines.join("\n"));
          status.innerHTML = "";
          status.append("The form couldn’t send just now. Email ");
          var a = document.createElement("a"); a.href = href; a.textContent = "info@butlersmarinaannapolis.com"; status.append(a);
          status.append(" or call (410) 626-0051.");
        })
        .then(function () { btn.disabled = false; });
    });
  }
})();
