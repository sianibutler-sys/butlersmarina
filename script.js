(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* Openings in the mixed-use building. One line per opening, e.g.
     "One-bedroom apartment, available December 1". Leave empty when nothing is open. */
  var OPENINGS = [];
  var RATE = 3, MIN = 25, MAX = 75;

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
  var bar = $(".bar"), hero = $(".hero");
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
  if ("IntersectionObserver" in window) {
    var links = {};
    $$("#nav a[href^='#']").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var a = links[e.target.id]; if (!a || !e.isIntersecting) return;
        $$("#nav a.is-here").forEach(function (x) { x.classList.remove("is-here"); });
        a.classList.add("is-here");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(links).forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });
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
  var fieldsFor = function (type) {
    $$("[data-for]", form).forEach(function (el) {
      el.hidden = !(el.dataset.for === "boat" ? /slip|Overnight/.test(type) : el.dataset.for === "dates" ? type === "Overnight stay" : true);
    });
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
    var today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    qArrive.min = today.toISOString().slice(0, 10);
    var show = function () {
      var v = qType.value, slip = /slip|Overnight/.test(v), night = v === "Overnight stay";
      $$("[data-show]", finder).forEach(function (el) {
        var k = el.dataset.show;
        el.hidden = !(k === "slip" ? slip : k === "dates" ? night : night);
      });
      $(".finder__go span", finder).textContent = night ? "Check availability" : v === "Annual slip" ? "Request a quote" : "Ask what’s open";
      qNote.textContent = "";
      est();
    };
    var est = function () {
      var L = Math.round(+qLoa.value || 0), N = clamp(Math.round(+qNights.value || 1), 1, 30);
      if (L && (L < MIN || L > MAX)) { qEst.textContent = "—"; qMath.textContent = L < MIN ? "Our slips start at 25 ft. Call us." : "Our slips top out at 75 ft."; return; }
      qEst.textContent = L ? "$" + (L * N * RATE).toLocaleString("en-US") : "—";
      qMath.textContent = "estimate at $" + RATE + " per foot per night";
    };
    qType.addEventListener("change", show);
    [qLoa, qNights].forEach(function (i) { i.addEventListener("input", est); });
    qNights.addEventListener("blur", function () { qNights.value = clamp(+qNights.value || 1, 1, 30); est(); });
    $$(".finder__step button", finder).forEach(function (b) {
      b.addEventListener("click", function () { qNights.value = clamp((+qNights.value || 1) + (+b.dataset.step), 1, 30); est(); });
    });
    finder.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = qType.value, L = Math.round(+qLoa.value || 0), N = clamp(+qNights.value || 1, 1, 30);
      if (/slip|Overnight/.test(v) && L && (L < MIN || L > MAX)) { qNote.textContent = "Our slips fit boats 25 to 75 ft. Call (410) 626-0051 and we’ll talk it through."; return; }
      setType(v);
      if (/slip|Overnight/.test(v) && L) form.loa.value = L;
      if (v === "Overnight stay") {
        if (qArrive.value) {
          form.arrive.value = qArrive.value;
          var d = new Date(qArrive.value + "T12:00:00"); d.setDate(d.getDate() + N);
          form.depart.value = d.toISOString().slice(0, 10);
        }
        if (!form.message.value) form.message.value = N + (N === 1 ? " night" : " nights") + (L ? " for a " + L + "-foot boat." : ".");
      }
      $("#contact").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      setTimeout(function () { form.name.focus({ preventScroll: true }); }, reduce ? 0 : 700);
    });
    show();
  }

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
      if (bad) { status.classList.add("is-err"); status.textContent = "Add your name and a working email so we can reply."; bad.focus(); return; }
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = typeof v === "string" ? v.trim() : v; });
      data.sms = form.sms.checked ? "yes" : "no";
      var btn = $(".inq__send", form);
      btn.disabled = true;
      status.textContent = "Sending…";
      fetch("api/inquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw j; return j; }); })
        .then(function () { form.reset(); fieldsFor("Annual slip"); status.textContent = "Request sent. We’ll be in touch soon."; })
        .catch(function () {
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
