(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("js");

  /* Openings in the mixed-use building. Add a line per opening, e.g.
     "One-bedroom apartment, available December 1". Leave empty when nothing is open. */
  var OPENINGS = [];

  var list = $("#openingsList");
  if (list) OPENINGS.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; list.appendChild(li); });

  $$("img").forEach(function (i) {
    var miss = function () { i.style.background = "#C6DCE8"; };
    if (i.complete && !i.naturalWidth) miss(); else i.addEventListener("error", miss);
  });
  var yr = $("#yr");
  if (yr) yr.textContent = new Date().getFullYear();

  /* Header turns solid once you leave the photo */
  var bar = $(".bar"), hero = $(".hero");
  var onScroll = function () {
    var edge = hero ? hero.offsetHeight - 90 : 40;
    bar.classList.toggle("is-solid", window.scrollY > edge || !hero);
  };
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

  /* Chart: phones get a tighter view of the creek; the course line runs in when the chart comes into view */
  var map = $("#chartMap");
  var frame = function () { if (map) map.setAttribute("viewBox", window.innerWidth <= 640 ? "330 250 520 400" : "260 180 860 560"); };
  frame();
  window.addEventListener("resize", frame);
  var reveal = $("#trackReveal");
  if (reveal && !reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { reveal.classList.add("is-drawing"); io.disconnect(); }
      });
    }, { threshold: 0.45 });
    io.observe(map);
  }

  /* Tide clock. Predictions for NOAA station 8575512 ship with the page; /api/conditions adds live readings */
  var TZ = "America/New_York";
  var tzOffset = function (ms) {
    var f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    var p = {}; f.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - ms;
  };
  var nyMs = function (y, mo, d, h, mi) {
    var guess = Date.UTC(y, mo - 1, d, h, mi);
    return guess - tzOffset(guess - 5 * 3600e3);
  };
  var fmt = function (ms) {
    return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(ms));
  };
  var dayWord = function (ms) {
    var d = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
    var a = d.format(new Date(ms)), b = d.format(new Date());
    if (a === b) return "";
    var t = d.format(new Date(Date.now() + 864e5));
    return a === t ? " tomorrow" : "";
  };
  var parseEmbedded = function () {
    var el = $("#tideData"); if (!el) return [];
    return el.textContent.trim().split(",").map(function (s) {
      var y = 2000 + +s.slice(0, 2), mo = +s.slice(2, 4), d = +s.slice(4, 6), h = +s.slice(6, 8), mi = +s.slice(8, 10);
      return { t: nyMs(y, mo, d, h, mi), type: s.slice(10) };
    });
  };
  var parseApi = function (arr) {
    return (arr || []).map(function (p) {
      var m = /(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/.exec(p.t);
      return m ? { t: nyMs(+m[1], +m[2], +m[3], +m[4], +m[5]), type: p.type } : null;
    }).filter(Boolean);
  };
  var tides = parseEmbedded();
  var hand = $("#tideHand"), now = $("#tide-now"), next = $("#tideNext"), tideBox = $("#tide");
  var drawTide = function () {
    if (!hand) return;
    var t = Date.now(), prev = null, nxt = null;
    for (var i = 0; i < tides.length; i++) { if (tides[i].t > t) { nxt = tides[i]; prev = tides[i - 1] || null; break; } }
    if (!prev || !nxt) {
      tideBox.classList.add("is-off");
      now.textContent = "Tide times from NOAA";
      next.innerHTML = '<a class="link" href="https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8575512" target="_blank" rel="noopener">Today’s Annapolis tides</a>';
      return;
    }
    var p = (t - prev.t) / (nxt.t - prev.t);
    var deg = prev.type === "H" ? p * 180 : 180 + p * 180;
    hand.style.transform = "rotate(" + deg.toFixed(1) + "deg)";
    var mins = Math.round((nxt.t - t) / 60000), hrs = Math.floor(mins / 60), mm = mins % 60;
    var wait = (hrs ? hrs + " hr " : "") + mm + " min";
    now.textContent = prev.type === "L" ? "Rising tide" : "Falling tide";
    next.textContent = (nxt.type === "H" ? "High" : "Low") + " at " + fmt(nxt.t) + dayWord(nxt.t) + ", in " + wait;
    tideBox.setAttribute("aria-label", now.textContent + ". " + next.textContent);
  };
  drawTide();
  setInterval(drawTide, 60000);

  var setK = function (k, v) { var el = document.querySelector('[data-k="' + k + '"]'); if (el) el.textContent = v; };
  if (tideBox && window.location.protocol !== "file:") {
    fetch("api/conditions").then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
      var live = parseApi(d.hilo);
      if (live.length) {
        var cut = live[0].t;
        tides = tides.filter(function (x) { return x.t < cut - 3600e3; }).concat(live).concat(tides.filter(function (x) { return x.t > live[live.length - 1].t + 3600e3; }));
        drawTide();
      }
      var any = false;
      if (d.water != null) { setK("water", Math.round(d.water) + "°F"); any = true; }
      if (d.wind) { setK("wind", d.wind.dir + " " + Math.round(d.wind.kt) + " kt"); any = true; }
      if (d.level != null) { setK("level", d.level.toFixed(1) + " ft"); any = true; }
      if (any) $("#tideLive").hidden = false;
    }).catch(function () {});
  }

  /* Overnight dock ticket */
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
    else if (L < MIN) fit.textContent = "Our slips start at 25 feet. Call (410) 626-0051 about smaller boats.";
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
      var f = $("#inquiry"), n = +nights.value, l = Math.round(+loa.value);
      f.loa.value = l;
      if (!f.message.value) f.message.value = n + (n === 1 ? " night" : " nights") + " for a " + l + "-foot boat.";
    });
  }

  /* Request form */
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
      fetch("api/inquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw j; return j; }); })
        .then(function () {
          form.reset();
          fieldsFor("Annual slip");
          status.textContent = "Request sent. A Butler will be in touch.";
        })
        .catch(function () {
          var lines = ["Type: " + data.type, "Name: " + data.name, "Email: " + data.email];
          ["phone", "boat", "loa", "beam", "draft", "arrive", "depart", "message"].forEach(function (k) { if (data[k]) lines.push(k[0].toUpperCase() + k.slice(1) + ": " + data[k]); });
          var href = "mailto:info@butlersmarinaannapolis.com?subject=" + encodeURIComponent(data.type + " request") + "&body=" + encodeURIComponent(lines.join("\n"));
          status.innerHTML = "";
          status.append("The form couldn’t send just now. Email us at ");
          var a = document.createElement("a"); a.href = href; a.textContent = "info@butlersmarinaannapolis.com"; status.append(a);
          status.append(" or call (410) 626-0051.");
        })
        .then(function () { btn.disabled = false; });
    });
  }
})();
