// Front-end do quiz: conversa com o Flask (/api/*) e cuida das animações.
// Toda a regra (sorteio, correção, pontuação) fica no Python; aqui é só apresentação.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const FEEDBACK_DELAY = 1500; // ms até avançar automaticamente
  const RING_LEN = 150.8;      // circunferência do anel do cronômetro (r=24)
  const HIT_MSGS = ['Exato! Mandou bem.', 'Isso aí! Acertou em cheio.', 'Perfeito! Você domina.', 'Boa! Ponto garantido.'];
  const MISS_MSGS = ['Quase! Veja a resposta certa.', 'Essa passou. Anote o termo!', 'Errou, mas aprendeu algo novo.'];
  const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  let gameId = null;
  let question = null;
  let timeLeft = 0;
  let timerId = null;     // UM único intervalo; sempre limpo antes de criar outro
  let advanceId = null;   // timeout do avanço automático
  let locked = true;      // bloqueia cliques duplicados / respostas fora de hora
  let answered = false;   // indica se a pergunta atual já foi respondida
  let advancing = false;  // evita avanços simultâneos
  let epoch = 0;          // invalida respostas de rede de perguntas/partidas antigas
  let autoSpeak = false;
  let shownScore = 0;

  // ---------- util ----------
  const pad = (n) => String(n).padStart(2, '0');
  const anim = (el, kf, opt) => el.animate(kf, { fill: 'both', ...opt });

  async function api(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro de comunicação');
    return data;
  }

  function speak(text) {
    if (!canSpeak) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.9;
    speechSynthesis.speak(u);
  }

  function stopTimers() {
    clearInterval(timerId); timerId = null;
    clearTimeout(advanceId); advanceId = null;
  }

  // ---------- transição entre telas ----------
  async function showScreen(name) {
    const current = document.querySelector('.screen.active');
    const next = $('screen-' + name);
    if (current === next) return;
    if (current) {
      await anim(current, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.03)' }], { duration: 250 }).finished;
      current.classList.remove('active');
      current.getAnimations().forEach((a) => a.cancel());
    }
    next.classList.add('active');
    anim(next, [{ opacity: 0, transform: 'translateY(20px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.2,.8,.2,1)' });
    window.scrollTo(0, 0);
  }

  // ---------- contador animado ----------
  function countTo(el, from, to, ms) {
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function setScore(score, gained) {
    countTo($('hud-score'), shownScore, score, 600);
    shownScore = score;
    if (gained) {
      const box = document.querySelector('.score-box');
      box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
      const g = $('gain');
      g.textContent = '+' + gained;
      anim(g, [{ opacity: 0, transform: 'translateY(6px) scale(.7)' }, { opacity: 1, transform: 'translateY(-24px) scale(1)', offset: .4 }, { opacity: 0, transform: 'translateY(-44px)' }], { duration: 1100 });
    }
  }

  // ---------- cronômetro ----------
  function renderTimer() {
    const t = $('timer');
    $('timer-num').textContent = timeLeft;
    $('timer-ring').style.strokeDashoffset = RING_LEN * (1 - timeLeft / question.time);
    t.classList.toggle('urgent', timeLeft <= 5 && timeLeft > 0);
    t.classList.toggle('warn', timeLeft > 5 && timeLeft <= 10);
  }

  function startTimer() {
    clearInterval(timerId);
    const myEpoch = epoch;
    timerId = setInterval(() => {
      if (myEpoch !== epoch) return clearInterval(timerId);
      timeLeft -= 1;
      renderTimer();
      anim($('timer-num'), [{ transform: 'translateY(-6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 200 });
      if (timeLeft <= 0) {
        clearInterval(timerId);
        if (!answered) {
          submit(null); // tempo esgotado sem resposta
        } else {
          advance(myEpoch); // tempo esgotado após ter respondido
        }
      }
    }, 1000);
  }

  // ---------- pergunta ----------
  function renderQuestion(q) {
    question = q;
    epoch += 1;
    locked = false;
    answered = false;
    advancing = false;
    timeLeft = q.time;

    $('hud-count').textContent = `${pad(q.number)}/${pad(q.total)}`;
    $('bar-fill').style.width = `${((q.number - 1) / q.total) * 100}%`;
    $('q-cat').textContent = q.category;
    $('q-prompt').textContent = q.prompt;
    $('feedback').replaceChildren();

    // desliga a transição do anel para reiniciá-lo instantaneamente
    const ring = $('timer-ring');
    ring.style.transition = 'none'; ring.style.strokeDashoffset = 0;
    void ring.getBoundingClientRect(); ring.style.transition = '';
    renderTimer();

    const box = $('options');
    box.replaceChildren();
    q.options.forEach((label, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'opt';
      const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = 'ABCD'[i];
      const tx = document.createElement('span'); tx.textContent = label;
      b.append(ic, tx);
      b.addEventListener('click', () => submit(i));
      box.append(b);
      anim(b, [{ opacity: 0, transform: 'translateY(24px) scale(.95)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 150 + i * 90, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });

    anim($('question-area'), [{ opacity: 0, transform: 'translateX(70px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    startTimer();
  }

  async function submit(option) {
    if (locked || answered) return; // bloqueia resposta duplicada / após o tempo
    locked = true;
    answered = true;
    const myEpoch = epoch;
    document.querySelectorAll('.opt').forEach((b) => (b.disabled = true));
    try {
      const r = await api('/api/answer', { game: gameId, option });
      if (myEpoch !== epoch) return;
      showFeedback(r, option);
    } catch (e) {
      console.error(e);
    }
  }

  function showFeedback(r, chosen) {
    const opts = [...document.querySelectorAll('.opt')];
    opts.forEach((b, i) => {
      b.classList.remove('correct', 'wrong', 'dim');
      if (i === r.correct_index) {
        b.classList.add('correct'); b.firstChild.textContent = '✓';
        anim(b, [{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], { duration: 450 });
      } else if (i === chosen) {
        b.classList.add('wrong'); b.firstChild.textContent = '✕';
        anim(b, [{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 500 });
      } else {
        b.classList.add('dim');
      }
    });

    setScore(r.score, r.gained);
    $('bar-fill').style.width = `${(question.number / question.total) * 100}%`;

    const pick = (arr) => arr[(question.number - 1) % arr.length];
    const fb = document.createElement('div');
    fb.className = 'fb ' + (r.correct ? 'ok' : 'no');
    const left = document.createElement('div');
    const msg = document.createElement('strong'); msg.className = 'msg';
    msg.textContent = r.timed_out ? '⏱ Tempo esgotado!' : r.correct ? pick(HIT_MSGS) + ' +' + r.gained + ' pontos' : pick(MISS_MSGS);
    const sub = document.createElement('div'); sub.className = 'sub';
    sub.append(`${r.prompt} = `);
    const strong = document.createElement('strong'); strong.textContent = r.answer; strong.style.color = '#fff';
    sub.append(strong);
    left.append(msg, sub);
    fb.append(left);

    const actions = document.createElement('div');
    actions.className = 'fb-actions';

    if (canSpeak) {
      const sp = document.createElement('button');
      sp.type = 'button'; sp.className = 'speak'; sp.textContent = '🔊 Ouvir pronúncia';
      sp.addEventListener('click', () => speak(r.answer));
      actions.append(sp);
    }

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn-next';
    nextBtn.textContent = 'Próxima ➔';
    const myEpoch = epoch;
    nextBtn.addEventListener('click', () => {
      nextBtn.disabled = true;
      clearInterval(timerId);
      advance(myEpoch);
    });
    actions.append(nextBtn);

    fb.append(actions);
    $('feedback').replaceChildren(fb);
    anim(fb, [{ opacity: 0, transform: 'translateY(14px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 300 });
    if (autoSpeak) speak(r.answer);
  }

  async function advance(myEpoch) {
    if (myEpoch !== epoch || advancing) return;
    advancing = true;
    clearInterval(timerId);
    clearTimeout(advanceId);
    if (canSpeak) speechSynthesis.cancel();
    try {
      const r = await api('/api/next', { game: gameId });
      if (myEpoch !== epoch) return;
      if (r.finished) return showResults(r.summary);
      // saída para a esquerda, depois nova pergunta entra pela direita
      await anim($('question-area'), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-70px)' }], { duration: 220 }).finished;
      if (myEpoch !== epoch) return;
      renderQuestion(r.question);
    } catch (e) {
      console.error(e);
    } finally {
      advancing = false;
    }
  }

  // ---------- resultados ----------
  function showResults(s) {
    epoch += 1; stopTimers();
    $('r-title').textContent = s.title;
    $('r-score').textContent = '0';
    $('r-max').textContent = `de ${s.max_score} pontos`;
    $('r-hits').textContent = s.hits;
    $('r-miss').textContent = s.misses;
    $('r-pct').textContent = s.percent + '%';
    $('r-time').textContent = `${pad(Math.floor(s.elapsed_seconds / 60))}:${pad(s.elapsed_seconds % 60)}`;
    const wrap = document.querySelector('.ring-wrap');
    wrap.className = 'ring-wrap ' + s.tier;
    const ring = $('r-ring');
    ring.style.transition = 'none'; ring.style.strokeDashoffset = 565.49;
    void ring.getBoundingClientRect(); ring.style.transition = '';

    showScreen('results').then(() => {
      ring.style.strokeDashoffset = 565.49 * (1 - s.percent / 100);
      countTo($('r-score'), 0, s.score, 1600);
      document.querySelectorAll('#screen-results .stat').forEach((el, i) =>
        anim(el, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 300 + i * 100 }));
      if (s.percent >= 70) confetti(s.percent >= 90);
    });
  }

  // ---------- confetes (canvas próprio, sem bibliotecas) ----------
  let confettiRaf = null;
  function confetti(big) {
    const cv = $('confetti'), ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    const colors = ['#8B5CF6', '#3B82F6', '#22D3EE', '#EC4899', '#22C55E', '#FACC15'];
    const parts = [];
    const burst = (n, x, angle) => {
      for (let i = 0; i < n; i++) {
        const a = angle + (Math.random() - .5) * 1.2, v = 6 + Math.random() * 9;
        parts.push({ x, y: innerHeight * .6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 4 + Math.random() * 5, c: colors[(Math.random() * colors.length) | 0], rot: Math.random() * 6, life: 1 });
      }
    };
    burst(big ? 140 : 100, innerWidth / 2, -Math.PI / 2);
    const end = performance.now() + (big ? 2500 : 0);
    cancelAnimationFrame(confettiRaf);
    const frame = (now) => {
      if (now < end) { burst(4, 0, -Math.PI / 3); burst(4, innerWidth, -2 * Math.PI / 3); }
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of parts) {
        p.vy += .25; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.rot += .15; p.life -= .006;
        ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0 || parts[i].y > innerHeight + 40) parts.splice(i, 1);
      if (parts.length || now < end) confettiRaf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    };
    confettiRaf = requestAnimationFrame(frame);
  }
  function stopConfetti() {
    cancelAnimationFrame(confettiRaf);
    const cv = $('confetti'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
  }

  // ---------- fluxo ----------
  let starting = false;
  async function startGame() {
    if (starting) return;
    starting = true;
    stopTimers(); stopConfetti(); epoch += 1; locked = true; answered = false; advancing = false;
    if (canSpeak) speechSynthesis.cancel();
    try {
      const r = await api('/api/start');
      gameId = r.game;
      shownScore = 0;
      $('hud-score').textContent = '0';
      await showScreen('quiz');
      renderQuestion(r.question);
    } catch (e) {
      alert('Não foi possível iniciar o jogo: ' + e.message);
    } finally {
      starting = false;
    }
  }

  function goHome() {
    stopTimers(); stopConfetti(); epoch += 1; locked = true; answered = false; advancing = false; gameId = null;
    if (canSpeak) speechSynthesis.cancel();
    showScreen('home');
  }

  $('btn-start').addEventListener('click', startGame);
  $('btn-again').addEventListener('click', startGame);   // reinício completo: nova partida no servidor
  $('btn-home').addEventListener('click', goHome);

  const voice = $('btn-voice');
  if (!canSpeak) voice.hidden = true;
  voice.addEventListener('click', () => {
    autoSpeak = !autoSpeak;
    voice.setAttribute('aria-pressed', autoSpeak);
    voice.textContent = autoSpeak ? '🔊' : '🔇';
    if (!autoSpeak && canSpeak) speechSynthesis.cancel();
  });

  // entrada da Home
  anim(document.querySelector('#screen-home'), [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' });
})();
