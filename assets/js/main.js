(function () {
  'use strict';

  var EMAIL = 'call@buladmin.eu';

  // Работно време: ден от седмицата (0 = неделя) -> [отваря, затваря] в минути.
  var HOURS = {
    1: [480, 1080], 2: [480, 1080], 3: [480, 1080], 4: [480, 1080], 5: [480, 1080],
    6: [540, 840]
  };
  var APPOINTMENT_DAY = 6;
  var DAY_NAMES = ['неделя', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота'];
  var WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function sofiaNow() {
    var parts = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Sofia', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    return { day: WEEKDAYS[parts.weekday], minutes: Number(parts.hour) * 60 + Number(parts.minute) };
  }

  function clock(minutes) {
    var h = Math.floor(minutes / 60), m = minutes % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function opening(when, day) {
    var note = day === APPOINTMENT_DAY ? ', с предварително записан час' : '';
    return when + ' в ' + clock(HOURS[day][0]) + ' ч.' + note;
  }

  function nextOpening(now) {
    if (HOURS[now.day] && now.minutes < HOURS[now.day][0]) {
      return opening('днес', now.day);
    }
    for (var i = 1; i <= 7; i++) {
      var day = (now.day + i) % 7;
      if (HOURS[day]) {
        return opening(i === 1 ? 'утре' : (day === 2 ? 'във' : 'в') + ' ' + DAY_NAMES[day], day);
      }
    }
    return '';
  }

  function renderStatus() {
    var el = document.querySelector('[data-status]');
    var text = document.querySelector('[data-status-text]');
    if (!el || !text) return;

    var now = sofiaNow();
    var today = HOURS[now.day];
    var open = today && now.minutes >= today[0] && now.minutes < today[1];

    el.classList.remove('is-open', 'is-appointment');
    if (open && now.day === APPOINTMENT_DAY) {
      el.classList.add('is-appointment');
      text.textContent = 'Днес до ' + clock(today[1]) + ' ч., с предварително записан час';
    } else if (open) {
      el.classList.add('is-open');
      text.textContent = 'Работим в момента, до ' + clock(today[1]) + ' ч.';
    } else {
      text.textContent = 'В момента не работим. Отваряме ' + nextOpening(now);
    }
    el.hidden = false;

    document.querySelectorAll('[data-hours] [data-days]').forEach(function (row) {
      var isToday = row.getAttribute('data-days').split(',').indexOf(String(now.day)) !== -1;
      row.classList.toggle('is-today', isToday);
    });
  }

  function initNav() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.querySelector('[data-nav]');
    if (!toggle || !nav) return;

    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    }
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  function initHeader() {
    var header = document.querySelector('[data-header]');
    if (!header) return;
    function update() { header.classList.toggle('is-stuck', window.scrollY > 8); }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  function initReveal() {
    var targets = document.querySelectorAll('.section__head, .register__row, .steps li, .paper, .contact__info');
    if (!('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (el) {
      el.classList.add('reveal');
      observer.observe(el);
    });
  }

  // Примерният лист в началото минава през етапите на една преписка.
  function initSheet() {
    var steps = document.querySelectorAll('.sheet__steps li');
    if (!steps.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var active = 2;
    setInterval(function () {
      if (document.hidden) return;
      active = (active + 1) % steps.length;
      steps.forEach(function (step, i) {
        step.classList.toggle('is-done', i < active);
        step.classList.toggle('is-active', i === active);
      });
    }, 2200);
  }

  function initForm() {
    var form = document.querySelector('[data-form]');
    if (!form) return;

    function check(field) {
      var error = document.getElementById(field.id + '-error');
      var valid = field.value.trim() !== '';
      field.setAttribute('aria-invalid', String(!valid));
      if (error) {
        error.hidden = valid;
        if (valid) field.removeAttribute('aria-describedby');
        else field.setAttribute('aria-describedby', error.id);
      }
      return valid;
    }

    var required = form.querySelectorAll('[required]');
    required.forEach(function (field) {
      field.addEventListener('input', function () {
        if (field.getAttribute('aria-invalid') === 'true') check(field);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstInvalid = null;
      required.forEach(function (field) {
        if (!check(field) && !firstInvalid) firstInvalid = field;
      });
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }
      var data = new FormData(form);
      var lines = [String(data.get('message')).trim(), '', 'Име: ' + String(data.get('name')).trim()];
      var phone = String(data.get('reach')).trim();
      if (phone) lines.push('Телефон: ' + phone);
      window.location.href = 'mailto:' + EMAIL +
        '?subject=' + encodeURIComponent('Запитване: ' + data.get('service')) +
        '&body=' + encodeURIComponent(lines.join('\r\n'));
    });
  }

  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  renderStatus();
  setInterval(renderStatus, 60000);
  initNav();
  initHeader();
  initReveal();
  initSheet();
  initForm();
})();
