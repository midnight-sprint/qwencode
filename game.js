/* ============================================================
   ПЕПЕЛ ЛЖИ — boot, menu, intro logic
   Ванильный JS, никаких зависимостей.
   ============================================================ */

(() => {
  'use strict';

  // ---------- КОНСТАНТЫ ----------
  const STORAGE_KEY = 'ashoflies.save.v1';
  const SETTINGS_KEY = 'ashoflies.settings.v1';
  const CODE_PREFIX = 'NOIR';

  // ---------- УТИЛИТЫ ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- СОСТОЯНИЕ ----------
  const state = {
    soundOn: true,
    audioCtx: null,
    skipIntro: false,
    introDone: false,
  };

  // ---------- ЗВУК (через WebAudio, без файлов) ----------
  function ensureAudio() {
    if (!state.audioCtx && state.soundOn) {
      try {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { /* нет аудио — ок */ }
    }
    return state.audioCtx;
  }

  /** Короткий «механический» щелчок (зажигалка / клавиша машинки). */
  function playClick(freq = 220, dur = 0.04, vol = 0.05) {
    if (!state.soundOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;

    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(t);
    noise.stop(t + dur);
  }

  // ---------- ЭКРАНЫ ----------
  function showScreen(id) {
    $$('.screen').forEach((s) => s.classList.remove('is-active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('is-active');
  }

  // ---------- BOOT-ПОСЛЕДОВАТЕЛЬНОСТЬ ----------
  async function runBootSequence() {
    const lines = $$('.boot-line');
    for (let i = 0; i < lines.length; i++) {
      await wait(i === 0 ? 350 : 280);
      lines[i].classList.add('is-typed');
      playClick(180 + i * 40, 0.05, 0.04);
    }
    await wait(700);
    showScreen('screen-menu');
  }

  // ---------- ПЕЧАТНАЯ МАШИНКА ----------
  /**
   * Печатает массив абзацев в контейнер.
   * Возвращает функцию-прерыватель, чтобы пропустить.
   */
  function typewriter(container, paragraphs, opts = {}) {
    const speed = opts.speed ?? 28;       // ms на символ
    const punctPause = opts.punctPause ?? 180;
    const paraPause = opts.paraPause ?? 480;
    let cancelled = false;
    let onDone = opts.onDone || (() => {});

    container.innerHTML = '';
    const caret = document.createElement('span');
    caret.className = 'caret';

    (async () => {
      for (let pi = 0; pi < paragraphs.length; pi++) {
        if (cancelled) break;
        const para = paragraphs[pi];
        const p = document.createElement('p');
        container.appendChild(p);
        p.appendChild(caret);

        for (let i = 0; i < para.length; i++) {
          if (cancelled) break;
          const ch = para[i];
          // вставляем символ перед каретом
          p.insertBefore(document.createTextNode(ch), caret);
          if (i % 3 === 0) playClick(220 + Math.random() * 120, 0.025, 0.025);
          let delay = speed;
          if (',;:'.includes(ch)) delay += punctPause / 2;
          if ('.!?'.includes(ch)) delay += punctPause;
          await wait(delay);
        }
        if (!cancelled) await wait(paraPause);
      }

      if (cancelled) {
        // мгновенно дорисовать всё
        container.innerHTML = '';
        paragraphs.forEach((para) => {
          const p = document.createElement('p');
          p.textContent = para;
          container.appendChild(p);
        });
      }
      // оставим мигающий курсор в конце
      const last = container.lastElementChild;
      if (last) last.appendChild(caret);
      onDone();
    })();

    return () => { cancelled = true; };
  }

  // ---------- ВСТУПЛЕНИЕ ----------
  const introText = [
    'Лос-Анджелес. Октябрь сорок седьмого. Дождь, которого здесь не должно быть.',
    'Ты — Джеймс Коркоран. Тридцать четыре года, один значок, две войны за плечами.',
    'В семь утра тебя разбудил телефон. На том конце — голос капитана Брэдли. Он говорит спокойно. Слишком спокойно.',
    '«Дело простое, Джим. Ограбление. Закрой к среде — и выпьем за твою премию.»',
    'Простых дел не бывает. У убитого в кармане — спички из «Пантеона». А у тебя — сорок восемь часов и слишком много того, что можно потерять.',
  ];

  let cancelTypewriter = null;

  function startIntro() {
    showScreen('screen-intro');
    const target = $('#intro-text');
    const skipBtn = $('#btn-skip');
    const beginBtn = $('#btn-begin');
    skipBtn.classList.remove('is-hidden');
    beginBtn.classList.add('is-hidden');

    cancelTypewriter = typewriter(target, introText, {
      onDone: () => {
        state.introDone = true;
        skipBtn.classList.add('is-hidden');
        beginBtn.classList.remove('is-hidden');
      },
    });
  }

  function skipIntro() {
    if (cancelTypewriter) cancelTypewriter();
  }

  // ---------- СОХРАНЕНИЯ ----------
  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function saveGame(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }

  /** NOIR-XXXX-XXXX — 8 hex-символов, разбитых на две группы. */
  function generateCode(seed) {
    const chars = '0123456789ABCDEF';
    let code = '';
    for (let i = 0; i < 8; i++) {
      const n = (seed * (i + 1) * 9301 + 49297) % 233280;
      code += chars[Math.floor((n / 233280) * chars.length)];
    }
    return `${CODE_PREFIX}-${code.slice(0, 4)}-${code.slice(4)}`;
  }

  function isValidCode(code) {
    return /^NOIR-[0-9A-F]{4}-[0-9A-F]{4}$/i.test(code.trim());
  }

  function refreshContinueButton() {
    const save = loadSave();
    const btn = $('#btn-continue');
    const hint = $('#continue-hint');
    if (save) {
      btn.disabled = false;
      const date = new Date(save.timestamp || Date.now());
      hint.textContent = `Дело №${save.caseId || '47-08'} · ${date.toLocaleDateString('ru-RU')}`;
    } else {
      btn.disabled = true;
      hint.textContent = 'Нет сохранений';
    }
  }

  // ---------- НАСТРОЙКИ ----------
  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) Object.assign(state, JSON.parse(raw));
    } catch {}
    updateSoundUI();
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ soundOn: state.soundOn })); } catch {}
  }
  function updateSoundUI() {
    $('#sound-icon').textContent = state.soundOn ? '🔊' : '🔇';
    $('#sound-label').textContent = state.soundOn ? 'Звук: вкл' : 'Звук: выкл';
  }

  // ---------- МОДАЛКА КОДА ----------
  function openCodeModal() {
    const modal = $('#modal-load');
    modal.classList.add('is-active');
    modal.setAttribute('aria-hidden', 'false');
    const input = $('#code-input');
    $('#code-error').textContent = '';
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }
  function closeCodeModal() {
    const modal = $('#modal-load');
    modal.classList.remove('is-active');
    modal.setAttribute('aria-hidden', 'true');
  }
  function applyCode() {
    const code = $('#code-input').value.trim().toUpperCase();
    const err = $('#code-error');
    if (!code) { err.textContent = 'Введи код, детектив.'; return; }
    if (!isValidCode(code)) { err.textContent = 'Не похоже на код дела. Формат: NOIR-XXXX-XXXX.'; return; }
    // На этом этапе просто открываем дело-заглушку.
    closeCodeModal();
    saveGame({ caseId: '47-08', code, timestamp: Date.now(), step: 'precinct' });
    refreshContinueButton();
    showScreen('screen-stub');
    playClick(140, 0.08, 0.06);
  }

  // ---------- НОВАЯ ИГРА / ПРОДОЛЖЕНИЕ ----------
  function newGame() {
    saveGame({
      caseId: '47-08',
      code: generateCode(Date.now() % 100000),
      timestamp: Date.now(),
      step: 'intro',
    });
    refreshContinueButton();
    startIntro();
  }

  function continueGame() {
    const save = loadSave();
    if (!save) return;
    // На этом этапе — в любую первую сцену.
    showScreen('screen-stub');
  }

  function enterPrecinct() {
    const save = loadSave() || {};
    save.step = 'precinct';
    save.timestamp = Date.now();
    saveGame(save);
    refreshContinueButton();
    showScreen('screen-stub');
    playClick(160, 0.06, 0.05);
  }

  // ---------- РОУТЕР ДЕЙСТВИЙ ----------
  function handleAction(action) {
    playClick(260, 0.03, 0.04);
    switch (action) {
      case 'new-game':       newGame(); break;
      case 'continue':       continueGame(); break;
      case 'load-code':      openCodeModal(); break;
      case 'about':          showScreen('screen-about'); break;
      case 'back-to-menu':   showScreen('screen-menu'); refreshContinueButton(); break;
      case 'close-modal':    closeCodeModal(); break;
      case 'apply-code':     applyCode(); break;
      case 'toggle-sound':
        state.soundOn = !state.soundOn;
        if (state.soundOn) ensureAudio();
        updateSoundUI();
        saveSettings();
        break;
    }
  }

  // ---------- ИНИЦИАЛИЗАЦИЯ ----------
  function init() {
    loadSettings();
    refreshContinueButton();

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) handleAction(btn.dataset.action);
    });

    $('#btn-skip').addEventListener('click', () => {
      playClick(260, 0.03, 0.04);
      skipIntro();
    });
    $('#btn-begin').addEventListener('click', () => {
      playClick(260, 0.03, 0.04);
      enterPrecinct();
    });

    // Закрытие модалки по клику на фон
    $('#modal-load').addEventListener('click', (e) => {
      if (e.target.id === 'modal-load') closeCodeModal();
    });
    // Enter в инпуте кода = применить
    $('#code-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyCode();
      if (e.key === 'Escape') closeCodeModal();
    });

    // Запускаем boot
    runBootSequence();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
