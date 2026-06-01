const APP = {
  storageKey: "anatomy-quiz-pro-state-v1",
  authKey: "anatomy-quiz-pro-auth-v1",
  codeSalt: 23,
  codeCipher: [84, 85, 78, 93, 67, 84, 68, 90],
};

const state = {
  data: null,
  index: 0,
  inputs: {},
  results: {},
  submitted: {},
};

const app = document.querySelector("#app");
const fireworksCanvas = document.querySelector("#fireworks");

document.addEventListener("DOMContentLoaded", init);

async function init() {
  registerServiceWorker();
  if (!isAuthed()) {
    renderAuth();
    return;
  }
  await loadQuiz();
  renderQuiz();
}

function expectedCode() {
  return APP.codeCipher.map((n) => String.fromCharCode(n ^ APP.codeSalt)).join("");
}

function isAuthed() {
  return localStorage.getItem(APP.authKey) === "ok";
}

function renderAuth() {
  app.className = "auth-page";
  app.innerHTML = `
    <section class="auth-card">
      <div class="brand">
        <div class="brand-mark">解</div>
        <div>
          <h1>系统解剖学标本自测 Pro</h1>
          <p>班级资料访问验证</p>
        </div>
      </div>
      <form id="authForm" autocomplete="off">
        <label class="field-label" for="inviteCode">邀请码</label>
        <input id="inviteCode" class="auth-input" type="password" inputmode="text" autocomplete="one-time-code" autofocus>
        <p id="authError" class="error-text"></p>
        <button class="primary-btn" type="submit">进入自测</button>
      </form>
    </section>
  `;
  document.querySelector("#authForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = document.querySelector("#inviteCode").value.trim();
    if (normalize(value) === normalize(expectedCode())) {
      localStorage.setItem(APP.authKey, "ok");
      init();
    } else {
      document.querySelector("#authError").textContent = "邀请码不正确，请确认后再试。";
    }
  });
}

async function loadQuiz() {
  const response = await fetch("./answers.json", { cache: "no-cache" });
  state.data = await response.json();
  const saved = readState();
  state.index = clamp(saved.index ?? 0, 0, state.data.questions.length - 1);
  state.inputs = saved.inputs ?? {};
  state.results = saved.results ?? {};
  state.submitted = saved.submitted ?? {};
}

function renderQuiz() {
  const question = currentQuestion();
  app.className = "app-shell";
  app.innerHTML = `
    <header class="topbar">
      <div class="topbar-title">
        <h1>系统解剖学标本自测 Pro</h1>
        <p class="muted">全部题目顺序练习，进度自动保存</p>
      </div>
      <button id="logoutBtn" class="ghost-btn" type="button">退出登录</button>
    </header>
    <section class="layout">
      <div class="image-panel">
        <div class="question-stage" id="stage">
          <img src="${question.image}" alt="${question.title}" draggable="false">
          ${question.blanks.map(renderBlank).join("")}
        </div>
      </div>
      <aside class="side-panel">
        <div class="meta-row">
          <span>当前题目</span>
          <strong>${state.index + 1} / ${state.data.totalQuestions}</strong>
        </div>
        <h2 class="question-title">${question.title}</h2>
        <div class="meta-row">
          <span>已完成 ${completedCount()} / ${state.data.totalQuestions}</span>
          <span>${Math.round((completedCount() / state.data.totalQuestions) * 100)}%</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${(completedCount() / state.data.totalQuestions) * 100}%"></div></div>
        <div id="feedback" class="feedback">${feedbackHtml(question)}</div>
        <div class="action-grid">
          <button id="submitBtn" class="primary-btn" type="button">提交本题</button>
          <button id="prevBtn" class="secondary-btn" type="button">上一题</button>
          <button id="nextBtn" class="secondary-btn" type="button">下一题</button>
        </div>
        <button id="scoreBtn" class="secondary-btn score-link" type="button">${completedCount() === state.data.totalQuestions ? "查看最终成绩" : "完成后查看最终成绩"}</button>
      </aside>
    </section>
  `;
  bindQuizEvents();
}

function renderBlank(blank) {
  const value = escapeHtml((state.inputs[currentQuestion().id] ?? {})[blank.id] ?? "");
  const result = (state.results[currentQuestion().id] ?? {})[blank.id];
  const cls = result === true ? "correct" : result === false ? "wrong" : "";
  const edge = blank.x > 74 ? " edge-right" : blank.x < 8 ? " edge-left" : "";
  const fallbackWidth = `max(${blank.w}%, 48px)`;
  const fallbackX = blank.x > 74
    ? "left:calc(100vw - 86px);"
    : blank.x < 8
      ? "left:24px;"
      : `left:${blank.x}%;`;
  return `
    <input
      class="blank-input ${cls}${edge}"
      data-blank-id="${blank.id}"
      data-x="${blank.x}"
      data-y="${blank.y}"
      data-w="${blank.w}"
      data-h="${blank.h}"
      style="${fallbackX} top:${blank.y}%; width:${fallbackWidth}; height:${blank.h}%;"
      value="${value}"
      aria-label="答案输入框"
    >
  `;
}

function bindQuizEvents() {
  document.querySelector("#logoutBtn").addEventListener("click", () => {
    localStorage.removeItem(APP.authKey);
    renderAuth();
  });
  document.querySelectorAll(".blank-input").forEach((input) => {
    input.addEventListener("input", () => {
      const qid = currentQuestion().id;
      state.inputs[qid] = state.inputs[qid] ?? {};
      state.inputs[qid][input.dataset.blankId] = input.value;
      saveState();
    });
  });
  document.querySelector("#submitBtn").addEventListener("click", submitCurrent);
  document.querySelector("#prevBtn").addEventListener("click", () => goTo(state.index - 1));
  document.querySelector("#nextBtn").addEventListener("click", () => {
    if (state.index === state.data.questions.length - 1 && completedCount() === state.data.questions.length) {
      renderScore();
      return;
    }
    goTo(state.index + 1);
  });
  document.querySelector("#scoreBtn").addEventListener("click", renderScore);
  document.querySelector("#scoreBtn").disabled = completedCount() !== state.data.totalQuestions;
  document.querySelector("#prevBtn").disabled = state.index === 0;
  document.querySelector("#nextBtn").disabled = state.index === state.data.questions.length - 1 && completedCount() !== state.data.questions.length;
  primeBlankPositions();
  window.removeEventListener("resize", positionBlanks);
  window.addEventListener("resize", positionBlanks);
}

function primeBlankPositions() {
  const stage = document.querySelector("#stage");
  const image = stage?.querySelector("img");
  if (!stage || !image) return;
  if (image.complete && image.naturalWidth) {
    positionBlanks();
  } else {
    image.addEventListener("load", positionBlanks, { once: true });
  }
  requestAnimationFrame(positionBlanks);
  setTimeout(positionBlanks, 80);
  setTimeout(positionBlanks, 240);
}

function positionBlanks() {
  const stage = document.querySelector("#stage");
  const image = stage?.querySelector("img");
  if (!stage || !image) return;
  const rect = image.getBoundingClientRect();
  const rawStageWidth = rect.width || stage.clientWidth;
  const stageWidth = Math.min(rawStageWidth, Math.max(280, window.innerWidth - 28));
  const stageHeight = rect.height || stage.clientHeight;
  if (!stageWidth || !stageHeight) return;
  const margin = 24;
  document.querySelectorAll(".blank-input").forEach((input) => {
    const x = Number(input.dataset.x);
    const y = Number(input.dataset.y);
    const w = Number(input.dataset.w);
    const h = Number(input.dataset.h);
    const width = Math.max((stageWidth * w) / 100, 48);
    const height = Math.max((stageHeight * h) / 100, 28);
    const desiredLeft = (stageWidth * x) / 100;
    const desiredTop = (stageHeight * y) / 100;
    const left = clamp(desiredLeft, margin, Math.max(margin, stageWidth - width - margin));
    const top = clamp(desiredTop, margin, Math.max(margin, stageHeight - height - margin));
    input.style.left = `${left}px`;
    input.style.top = `${top}px`;
    input.style.width = `${width}px`;
    input.style.height = `${height}px`;
  });
}

function submitCurrent() {
  const question = currentQuestion();
  const values = state.inputs[question.id] ?? {};
  state.results[question.id] = {};
  for (const blank of question.blanks) {
    const ok = normalize(values[blank.id] ?? "") === normalize(blank.answer);
    state.results[question.id][blank.id] = ok;
  }
  state.submitted[question.id] = true;
  saveState();
  if (completedCount() === state.data.questions.length) {
    renderScore();
  } else {
    renderQuiz();
  }
}

function feedbackHtml(question) {
  if (!state.submitted[question.id]) {
    return "填写图片中的所有空格后提交，本题会立即按每个空单独判分。";
  }
  return question.blanks.map((blank) => {
    const ok = state.results[question.id]?.[blank.id];
    return ok
      ? `<div class="ok">✓ 正确</div>`
      : `<div class="bad">✗ 正确答案：${escapeHtml(blank.answer)}</div>`;
  }).join("");
}

function renderScore() {
  const score = calculateScore();
  const percent = score.total ? score.correct / score.total : 0;
  const comment = scoreComment(percent);
  app.className = "app-shell score-page";
  app.innerHTML = `
    <section class="score-panel">
      <p class="muted">最终成绩</p>
      <h1 class="score-total">${score.correct} / ${score.total}</h1>
      <div class="score-comment">
        <strong>${comment.title}</strong><br>
        ${comment.text}
      </div>
      <h2 class="question-title">需要记忆点</h2>
      <div class="memory-list">
        ${score.memory.length ? score.memory.map((item) => `<span class="memory-chip">${escapeHtml(item)}</span>`).join("") : "<span class=\"muted\">本次没有错题知识点。</span>"}
      </div>
      <div class="action-grid">
        <button id="backBtn" class="secondary-btn" type="button">返回答题</button>
        <button id="restartBtn" class="primary-btn" type="button">重新开始</button>
      </div>
    </section>
    <div class="blessing">儿童节快乐亲爱的医生们 ^^</div>
  `;
  document.querySelector("#backBtn").addEventListener("click", renderQuiz);
  document.querySelector("#restartBtn").addEventListener("click", () => {
    localStorage.removeItem(APP.storageKey);
    state.index = 0;
    state.inputs = {};
    state.results = {};
    state.submitted = {};
    renderQuiz();
  });
  startFireworks();
}

function calculateScore() {
  let correct = 0;
  const memory = [];
  for (const question of state.data.questions) {
    for (const blank of question.blanks) {
      const ok = state.results[question.id]?.[blank.id] === true;
      if (ok) correct += 1;
      else memory.push(blank.answer);
    }
  }
  return {
    correct,
    total: state.data.totalBlanks,
    memory: [...new Set(memory)],
  };
}

function scoreComment(percent) {
  if (percent >= 0.9) {
    return { title: "优秀", text: "已经具备较好的标本识别能力，<br>重点复习少量薄弱知识点即可。" };
  }
  if (percent >= 0.8) {
    return { title: "良好", text: "大部分结构已经掌握，<br>建议重点巩固以下记忆点。" };
  }
  if (percent >= 0.6) {
    return { title: "继续努力", text: "对主要结构已有印象，<br>建议结合标本再次系统复习。" };
  }
  return { title: "加油", text: "不要急于刷题，<br>建议先按照系统重新过一遍标本。" };
}

function currentQuestion() {
  return state.data.questions[state.index];
}

function goTo(nextIndex) {
  state.index = clamp(nextIndex, 0, state.data.questions.length - 1);
  saveState();
  renderQuiz();
}

function completedCount() {
  return Object.keys(state.submitted).filter((qid) => state.submitted[qid]).length;
}

function saveState() {
  localStorage.setItem(APP.storageKey, JSON.stringify({
    index: state.index,
    inputs: state.inputs,
    results: state.results,
    submitted: state.submitted,
  }));
}

function readState() {
  try {
    return JSON.parse(localStorage.getItem(APP.storageKey) || "{}");
  } catch {
    return {};
  }
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/[\s（）()，。、“”‘’：:；;！!？?、,.·\-—_《》<>[\]【】{}]/g, "");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char]);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

function startFireworks() {
  const ctx = fireworksCanvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const particles = [];
  let start = performance.now();
  let lastBurst = 0;
  fireworksCanvas.width = Math.floor(window.innerWidth * dpr);
  fireworksCanvas.height = Math.floor(window.innerHeight * dpr);
  fireworksCanvas.style.width = `${window.innerWidth}px`;
  fireworksCanvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  function burst() {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight * 0.55 + 40;
    const colors = ["#1f6feb", "#0a8f55", "#ffb020", "#cf3030", "#6f42c1"];
    for (let i = 0; i < 34; i += 1) {
      const angle = (Math.PI * 2 * i) / 34;
      const speed = 1.4 + Math.random() * 2.4;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 80 + Math.random() * 25,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  function tick(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (elapsed < 6800 && now - lastBurst > 420) {
      burst();
      lastBurst = now;
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.025;
      p.life -= 1.2;
      ctx.globalAlpha = Math.max(p.life / 100, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      if (p.life <= 0) particles.splice(i, 1);
    }
    ctx.globalAlpha = 1;
    if (elapsed < 7600 || particles.length) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  requestAnimationFrame(tick);
}
