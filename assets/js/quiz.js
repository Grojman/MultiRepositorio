window.App = window.App || {};

App.Quiz = (function () {
  const U = App.Utils;

  function validate(data) {
    if (!data || !Array.isArray(data.questions) || data.questions.length === 0) return false;
    return data.questions.every((q) => q && typeof q.question === 'string'
      && Array.isArray(q.answers) && q.answers.length > 0
      && Array.isArray(q.correct) && q.correct.length > 0);
  }

  function render(body, url) {
    body.appendChild(U.el('div', { class: 'viewer-loading', text: 'Cargando test…' }));
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((data) => { body.innerHTML = ''; renderQuiz(body, data); })
      .catch((err) => {
        body.innerHTML = '';
        body.appendChild(U.el('div', { class: 'viewer-error' },
          'No se pudo interpretar el archivo como test: ' + err.message));
      });
  }

  function renderQuiz(body, data) {
    if (!validate(data)) {
      body.appendChild(U.el('div', { class: 'viewer-error' },
        'Este archivo JSON no tiene el formato de test esperado (se espera { "questions": [ { "question": "...", "answers": [...], "correct": [...] } ] }).'));
      return;
    }

    const state = {
      index: 0,
      finished: false,
      answers: data.questions.map(() => new Set()),
      groupName: U.uid('qgrp'),
    };
    const wrap = U.el('div', { class: 'quiz' });
    body.appendChild(wrap);

    function draw() {
      wrap.innerHTML = '';
      if (state.finished) drawResults(wrap, data, state, draw);
      else drawQuestion(wrap, data, state, draw);
    }
    draw();
  }

  function drawQuestion(wrap, data, state, redraw) {
    const q = data.questions[state.index];
    const multiple = q.multiple != null ? !!q.multiple : q.correct.length > 1;

    const header = U.el('div', { class: 'quiz-header' }, [
      U.el('span', { class: 'quiz-title', text: data.title || 'Test' }),
      U.el('span', { class: 'quiz-progress', text: `Pregunta ${state.index + 1} de ${data.questions.length}` }),
    ]);
    const qText = U.el('div', { class: 'quiz-question', text: q.question });
    const answersWrap = U.el('div', { class: 'quiz-answers' });

    q.answers.forEach((answer, i) => {
      const id = U.uid('ans');
      const input = U.el('input', { type: multiple ? 'checkbox' : 'radio', name: state.groupName, id });
      input.checked = state.answers[state.index].has(i);
      input.addEventListener('change', () => {
        const set = state.answers[state.index];
        if (multiple) {
          if (input.checked) set.add(i); else set.delete(i);
        } else {
          set.clear();
          if (input.checked) set.add(i);
        }
      });
      const label = U.el('label', { class: 'quiz-answer', for: id }, [input, U.el('span', { text: answer })]);
      answersWrap.appendChild(label);
    });

    const nav = U.el('div', { class: 'quiz-nav' });
    const prevBtn = U.el('button', { class: 'quiz-btn', text: 'Anterior' });
    prevBtn.disabled = state.index === 0;
    prevBtn.addEventListener('click', () => { state.index--; redraw(); });

    const isLast = state.index === data.questions.length - 1;
    const nextBtn = U.el('button', { class: 'quiz-btn quiz-btn--primary', text: isLast ? 'Finalizar test' : 'Siguiente' });
    nextBtn.addEventListener('click', () => {
      if (isLast) state.finished = true; else state.index++;
      redraw();
    });
    nav.append(prevBtn, nextBtn);

    wrap.append(header, qText, answersWrap, nav);
  }

  function drawResults(wrap, data, state, redraw) {
    let score = 0;
    const review = data.questions.map((q, i) => {
      const selected = state.answers[i];
      const correct = new Set(q.correct);
      const isCorrect = selected.size === correct.size && [...selected].every((v) => correct.has(v));
      if (isCorrect) score++;
      return { q, selected, correct, isCorrect };
    });
    const pct = Math.round((score / data.questions.length) * 100);

    const header = U.el('div', { class: 'quiz-results-header' }, [
      U.el('div', { class: 'quiz-score', text: `${score} / ${data.questions.length}` }),
      U.el('div', { class: 'quiz-score-pct', text: `${pct}%` }),
    ]);

    const list = U.el('div', { class: 'quiz-review' });
    review.forEach((r, i) => {
      const item = U.el('div', { class: 'quiz-review-item ' + (r.isCorrect ? 'ok' : 'bad') });
      item.appendChild(U.el('div', { class: 'quiz-review-q', text: `${i + 1}. ${r.q.question}` }));
      r.q.answers.forEach((a, ai) => {
        const cls = ['quiz-review-ans'];
        if (r.correct.has(ai)) cls.push('is-correct');
        if (r.selected.has(ai) && !r.correct.has(ai)) cls.push('is-wrong-selected');
        item.appendChild(U.el('div', { class: cls.join(' '), text: a }));
      });
      list.appendChild(item);
    });

    const retryBtn = U.el('button', { class: 'quiz-btn quiz-btn--primary', text: 'Repetir test' });
    retryBtn.addEventListener('click', () => {
      state.index = 0;
      state.finished = false;
      state.answers = data.questions.map(() => new Set());
      redraw();
    });

    wrap.append(header, list, retryBtn);
  }

  return { render };
})();
