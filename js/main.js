import { qi, qa, qs } from './state.js';
import { uid } from './utils.js';
import { fetchWeather } from './modules/weather.js';
import { renderHome } from './ui/render.js';

/* ══════════════════════════════════════════════
   DATA STORE
══════════════════════════════════════════════ */
export const KEYS = {
    todos: 'tv_todos',
    schedule: 'tv_schedule',
    decks: 'tv_decks',
    settings: 'tv_settings',
    stats: 'tv_stats',
};

export function load(k, fallback) {
    try { return JSON.parse(localStorage.getItem(k)) || fallback; }
    catch { return fallback; }
}

export function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

export let todos = load(KEYS.todos, []);
let schedule = load(KEYS.schedule, []), decks = load(KEYS.decks, []);
export const settings = load(KEYS.settings, { name: '', city: 'Medan', units: 'metric', pomFocus: 25, pomShort: 5, pomLong: 15, sound: true })
export let stats = load(KEYS.stats, { poms: 0, cardsRev: 0, quizzes: [], studyDays: {} });

/* ══════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════ */
function go(el) {
    qa('.nav-item').forEach(n => n.classList.remove('active'));
    qa('.section').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
    const sec = el.dataset.section;
    qi(sec).classList.add('active');
    if (sec === 'home') renderHome();
    if (sec === 'todo') renderTodo();
    if (sec === 'schedule') renderSchedule();
    if (sec === 'flashcards') renderDecks();
    if (sec === 'quiz') { renderQuizSetup(); showQuizSetup(); }
    if (sec === 'statistics') renderStats();
    if (sec === 'settings') loadSettings();
}

qi("btn-ghost-review").addEventListener('click', () => go(qs('[data-section=flashcards]')));

qa('.nav-item').forEach(el => {
    el.addEventListener('click', () => go(el));
});

/* ══════════════════════════════════════════════
   CLOCK
══════════════════════════════════════════════ */
function tick() {
    const now = new Date(), days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], mons = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    qi('homeClock').textContent =
        now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    qi('homeDate').textContent =
        `${days[now.getDay()]}, ${mons[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`;
    const h = now.getHours(), name = settings.name ? `, ${settings.name}` : '';
    qi('homeGreeting').textContent =
        h >= 5 && h < 12 ? `Good morning${name}` : h < 18 ? `Good afternoon${name}` : `Good evening${name}`;
}
setInterval(tick, 1000);
tick();

/* ══════════════════════════════════════════════
   POMODORO
══════════════════════════════════════════════ */
const POM_MODES = { focus: 'Focus', short: 'Short break', long: 'Long break' };
let pomMode = 'focus', pomSecs = settings.pomFocus * 60, pomTotal = pomSecs, pomRunning = false, pomInterval = null;

const pomCircle = qi('pomCircle'), CIRC = 2 * Math.PI * 58; // ~364.4
const pomRender = () => {
    const mm = String(Math.floor(pomSecs / 60)).padStart(2, '0'), ss = String(pomSecs % 60).padStart(2, '0');
    qi('pomTimer').textContent = `${mm}:${ss}`;
    qi('pomMode').textContent = POM_MODES[pomMode];
    const off = CIRC * (1 - pomSecs / pomTotal);
    pomCircle.style.strokeDashoffset = off;
    pomCircle.style.stroke = pomSecs < 60 ? 'var(--danger)' : 'var(--accent)';
}

qi('pomBtn').addEventListener('click', () => {
    if (!pomRunning) {
        pomRunning = true;
        qi('pomBtn').textContent = '⏹';
        pomInterval = setInterval(() => {
            pomSecs--;
            pomRender();
            if (pomSecs <= 0) {
                clearInterval(pomInterval);
                pomRunning = false;
                qi('pomBtn').textContent = '▶';
                if (pomMode === 'focus') {
                    stats.poms++;
                    const today = new Date().toISOString().slice(0, 10);
                    stats.studyDays[today] = (stats.studyDays[today] || 0) + 1;
                    save(KEYS.stats, stats);
                }
                if (settings.sound) {
                    try { qi('beepSound').play(); } catch (e) { }
                }
                pomReset();
            }
        }, 1000);
    } else {
        clearInterval(pomInterval);
        pomRunning = false;
        qi('pomBtn').textContent = '▶';
    }
})
qi('pomReset').addEventListener('click', () => {
    clearInterval(pomInterval);
    pomRunning = false;
    qi('pomBtn').textContent = '▶';
    const mins = { focus: settings.pomFocus, short: settings.pomShort, long: settings.pomLong };
    pomTotal = (mins[pomMode] || 25) * 60;
    pomSecs = pomTotal;
    pomRender();
})

qa('.setModeBtn').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.set;
        clearInterval(pomInterval);
        pomRunning = false;
        qi('pomBtn').textContent = '▶';
        pomMode = mode;
        pomReset();
    });
});

pomRender();

/* ══════════════════════════════════════════════
   TO-DO
══════════════════════════════════════════════ */
let todoFilterMode = 'all';

const makeTodoEl = (t, context = 'todo') => {
    const div = document.createElement('div');
    div.className = 'todo-item' + (t.done ? ' done' : '');
    div.innerHTML = `<input type="checkbox" class="todo-checkbox" ${t.done ? 'checked' : ''}><span class="todo-text">${t.text}</span><button class="icon-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>`;
    const btn = div.querySelector('button');
    btn.addEventListener('click', () => deleteTodo(t.id));
    div.querySelector('input').addEventListener('change', e => {
        t.done = e.target.checked;
        div.classList.toggle('done', t.done);
        const today = new Date().toISOString().slice(0, 10);
        if (t.done) { stats.studyDays[today] = (stats.studyDays[today] || 0); save(KEYS.stats, stats); }
        save(KEYS.todos, todos);
        updateTodoSub();
        renderHome();
    });
    return div;
}

const renderTodo = () => {
    const list = qi('todoList');
    list.innerHTML = '';
    let shown = todos;
    if (todoFilterMode === 'active') shown = todos.filter(t => !t.done);
    if (todoFilterMode === 'done') shown = todos.filter(t => t.done);
    if (!shown.length) {
        list.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:8px 0">Nothing here.</div>';
    } else {
        shown.forEach(t => list.appendChild(makeTodoEl(t)));
    }
    updateTodoSub();
}

const updateTodoSub = () => {
    const done = todos.filter(t => t.done).length;
    qi('todoSub').textContent = `${todos.length} tasks · ${done} completed`;
}

qs("button.chip").addEventListener('click', e => {
    todoFilterMode = e.target.dataset.set;
    qa('#todoFilter .chip').forEach(c => c.classList.remove('active'));
    e.target.classList.add('active');
    renderTodo();
});


import { addTask } from './modules/todo.js';

qi("addTodoBtn").addEventListener("click", addTask);
qi("addTaskBtn").addEventListener('click', addTask);

const deleteTodo = id => {
    todos = todos.filter(t => t.id !== id);
    save(KEYS.todos, todos);
    renderTodo();
    renderHome();
}

/* ══════════════════════════════════════════════
   SCHEDULE
══════════════════════════════════════════════ */
function renderSchedule() {
    const grid = qi('scheduleGrid');
    if (!schedule.length) {
        grid.innerHTML = `<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg><div class="empty-title">No events yet</div><div>Add your first scheduled event.</div></div>`;
        return;
    }
    const sorted = [...schedule].sort((a, b) => a.time.localeCompare(b.time));
    grid.innerHTML = '';
    sorted.forEach(ev => {
        const div = document.createElement('div');
        div.className = 'sched-item';
        div.innerHTML = `<span class="sched-time">${ev.time}</span><span class="sched-name">${ev.name}</span><span class="tag tag-${ev.color || 'blue'}">${ev.tag || ''}</span><div class="sched-actions">
<button class="icon-btn" onclick="editSched('${ev.id}')">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5l3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
<button class="icon-btn" onclick="deleteSched('${ev.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></div>`;
        grid.appendChild(div);
    });
}

function openAddSched(ev) {
    const isEdit = !!ev;
    openModal(isEdit ? 'Edit Event' : 'Add Event', `<div class="form-group"><label>Time</label>
<input type="text" id="mSchedTime" placeholder="e.g. 09:00" value="${ev?.time || ''}"></div><div class="form-group"><label>Activity</label>
<input type="text" id="mSchedName" placeholder="e.g. Mathematics" value="${ev?.name || ''}"></div><div class="form-group"><label>Label</label>
<input type="text" id="mSchedTag" placeholder="e.g. Exam" value="${ev?.tag || ''}"></div><div class="form-group"><label>Color</label><select id="mSchedColor">
<option value="blue" ${ev?.color === 'blue' ? 'selected' : ''}>Blue</option>
<option value="green" ${ev?.color === 'green' ? 'selected' : ''}>Green</option>
<option value="amber" ${ev?.color === 'amber' ? 'selected' : ''}>Amber</option>
<option value="red" ${ev?.color === 'red' ? 'selected' : ''}>Red</option>
<option value="purple" ${ev?.color === 'purple' ? 'selected' : ''}>Purple</option></select></div>`,
        () => {
            const time = qi('mSchedTime').value.trim(), name = qi('mSchedName').value.trim(), tag = qi('mSchedTag').value.trim(), color = qi('mSchedColor').value;
            if (!time || !name) return false;
            if (isEdit) {
                const idx = schedule.findIndex(s => s.id === ev.id);
                schedule[idx] = { ...ev, time, name, tag, color };
            } else {
                schedule.push({ id: uid(), time, name, tag, color });
            }
            save(KEYS.schedule, schedule);
            renderSchedule();
        }
    );
}

qi('addEventBtn').addEventListener('click', openAddSched);

function editSched(id) { openAddSched(schedule.find(s => s.id === id)); }
function deleteSched(id) {
    schedule = schedule.filter(s => s.id !== id);
    save(KEYS.schedule, schedule);
    renderSchedule();
}

/* ══════════════════════════════════════════════
   FLASHCARDS
══════════════════════════════════════════════ */
let activeDeckId = null, fcIndex = 0, fcCards = [], fcSeen = new Set();

function renderDecks() {
    const list = qi('deckList');
    if (!decks.length) {
        list.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg><div class="empty-title">No decks yet</div><div>Create your first flashcard deck.</div></div>`;
        return;
    }
    list.innerHTML = '';
    decks.forEach(d => {
        const el = document.createElement('div');
        el.className = 'deck-card';
        el.innerHTML = `<button class="icon-btn deck-del" onclick="event.stopPropagation();deleteDeckById('${d.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button><div class="deck-card-title">${d.name}</div><div class="deck-card-count">${d.cards.length} card${d.cards.length !== 1 ? 's' : ''}</div>`;
        el.addEventListener('click', () => openDeck(d.id));
        list.appendChild(el);
    });
}

qi('addDeck').addEventListener('click', () => {
    openModal('New Deck', `
    <div class="form-group">
      <label>Deck name</label>
      <input type="text" id="mDeckName" placeholder="e.g. Biology Chapter 3" autofocus>
    </div>`,
        () => {
            const name = qi('mDeckName').value.trim();
            if (!name) return false;
            decks.push({ id: uid(), name, cards: [] });
            save(KEYS.decks, decks);
            renderDecks();
        }
    );
});

function openDeck(id) {
    activeDeckId = id;
    const deck = decks.find(d => d.id === id);
    if (!deck) return;
    fcCards = [...deck.cards];
    fcIndex = 0;
    fcSeen = new Set();
    qi('fcDeckView').style.display = 'none';
    qi('fcStudyView').style.display = 'block';
    qi('fcStudyTitle').textContent = deck.name;
    renderCard();
}

function showDeckList() {
    qi('fcDeckView').style.display = '';
    qi('fcStudyView').style.display = 'none';
    activeDeckId = null;
}

qi('back-show-decklist').addEventListener('click', showDeckList);

function renderCard() {
    const inner = qi('fcInner');
    inner.classList.remove('flipped');
    if (!fcCards.length) {
        qi('fcFront').textContent = 'No cards';
        qi('fcBack').textContent = 'Add some cards first';
        qi('fcProgress').textContent = '0 / 0';
        qi('fcStudySubtitle').textContent = '0 cards';
        qi('fcDots').innerHTML = '';
        return;
    }
    const card = fcCards[fcIndex];
    qi('fcFront').textContent = card.q;
    qi('fcBack').textContent = card.a;
    qi('fcProgress').textContent = `${fcIndex + 1} / ${fcCards.length}`;
    qi('fcStudySubtitle').textContent = `${fcCards.length} cards`;
    fcSeen.add(fcIndex);
    stats.cardsRev++;
    save(KEYS.stats, stats);

    const dots = qi('fcDots');
    dots.innerHTML = '';
    fcCards.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = 'fc-dot' + (fcSeen.has(i) ? ' seen' : '');
        dots.appendChild(dot);
    });
}

qi("flipBtn").addEventListener('click', () => qi('fcInner').classList.toggle('flipped'));

qi("fcNextBtn").addEventListener('click', () => {
    if (!fcCards.length) return;
    qi('fcInner').classList.remove('flipped');
    setTimeout(() => { fcIndex = (fcIndex + 1) % fcCards.length; renderCard(); }, 200);
});
qi("fcPrevBtn").addEventListener('click', () => {
    if (!fcCards.length) return;
    qi('fcInner').classList.remove('flipped');
    setTimeout(() => { fcIndex = (fcIndex - 1 + fcCards.length) % fcCards.length; renderCard(); }, 200);
});
qi("fcShuffleBtn").addEventListener('click', () => {
    for (let i = fcCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fcCards[i], fcCards[j]] = [fcCards[j], fcCards[i]];
    }
    fcIndex = 0; fcSeen = new Set(); renderCard();
});

qi('AddCardBtn').addEventListener('click', () => {
    openModal('Add Flashcard', `<div class="form-group"><label>Question / Front</label><textarea id="mCardQ" placeholder="e.g. What is photosynthesis?"></textarea></div><div class="form-group"><label>Answer / Back</label><textarea id="mCardA" placeholder="e.g. The process by which plants…"></textarea></div>`,
        () => {
            const q = qi('mCardQ').value.trim(), a = qi('mCardA').value.trim();
            if (!q || !a) return false;
            const deck = decks.find(d => d.id === activeDeckId);
            deck.cards.push({ id: uid(), q, a });
            save(KEYS.decks, decks);
            fcCards = [...deck.cards];
            fcIndex = deck.cards.length - 1;
            renderCard();
        }
    );
})

qi('deleteDeckBtn').addEventListener('click', () => {
    if (!confirm('Delete this deck and all its cards?')) return;
    deleteDeckById(activeDeckId);
    showDeckList();
});
const deleteDeckById = id => {
    decks = decks.filter(d => d.id !== id);
    save(KEYS.decks, decks);
    renderDecks();
}

/* ══════════════════════════════════════════════
   QUIZ
══════════════════════════════════════════════ */
let quizQuestions = [];
let quizCurrent = 0;
let quizScore = 0;
let quizAnswered = false;

function renderQuizSetup() {
    const sel = qi('quizDeckSelect');
    sel.innerHTML = decks.length
        ? decks.map(d => `<option value="${d.id}">${d.name} (${d.cards.length})</option>`).join('')
        : '<option value="">No decks available</option>';
}
function showQuizSetup() {
    qi('quizSetup').style.display = '';
    qi('quizPlay').style.display = 'none';
    qi('quizResult').style.display = 'none';
    renderQuizSetup();
}

qi("quiz-try-again").addEventListener('click', showQuizSetup);
qi("quizNextBtn").addEventListener('click', () => {
    quizCurrent++;
    if (quizCurrent >= quizQuestions.length) showQuizResult();
    else renderQuizQ();
});

qi('startQuizBtn').addEventListener('click', () => {
    const deckId = qi('quizDeckSelect').value, deck = decks.find(d => d.id === deckId);
    if (!deck || deck.cards.length < 2) {
        alert('You need at least 2 cards in a deck to start a quiz.'); return;
    }
    const count = Math.min(parseInt(qi('quizCount').value) || 5, deck.cards.length), shuffled = [...deck.cards].sort(() => Math.random() - .5).slice(0, count);

    quizQuestions = shuffled.map(card => {
        const wrong = deck.cards.filter(c => c.id !== card.id)
            .sort(() => Math.random() - .5).slice(0, 3).map(c => c.a);
        const options = [...wrong, card.a].sort(() => Math.random() - .5);
        return { q: card.q, correct: card.a, options };
    });

    quizCurrent = 0; quizScore = 0; quizAnswered = false;
    qi('quizSetup').style.display = 'none';
    qi('quizPlay').style.display = '';
    qi('quizResult').style.display = 'none';
    renderQuizQ();
})

function renderQuizQ() {
    const q = quizQuestions[quizCurrent], total = quizQuestions.length;
    qi('quizHeader').textContent = `Question ${quizCurrent + 1} of ${total}`;
    qi('quizBar').style.width = `${(quizCurrent / total) * 100}%`;
    qi('quizQuestion').textContent = q.q;
    qi('quizFeedback').textContent = '';
    qi('quizNextBtn').style.display = 'none';
    quizAnswered = false;

    const opts = qi('quizOptions');
    opts.innerHTML = '';
    q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'quiz-opt';
        btn.textContent = opt;
        btn.addEventListener('click', () => answerQuiz(opt, q.correct, btn));
        opts.appendChild(btn);
    });
}

function answerQuiz(chosen, correct, btn) {
    if (quizAnswered) return;
    quizAnswered = true;
    const opts = qa('.quiz-opt');
    opts.forEach(b => {
        b.disabled = true;
        if (b.textContent === correct) b.classList.add('correct');
    });
    if (chosen === correct) {
        quizScore++;
        qi('quizFeedback').textContent = '✓ Correct!';
        qi('quizFeedback').style.color = 'var(--success)';
    } else {
        btn.classList.add('wrong');
        qi('quizFeedback').textContent = `✗ Correct answer: ${correct}`;
        qi('quizFeedback').style.color = 'var(--danger)';
    }
    qi('quizNextBtn').style.display = '';
}

function showQuizResult() {
    qi('quizPlay').style.display = 'none';
    qi('quizResult').style.display = '';
    const pct = Math.round((quizScore / quizQuestions.length) * 100), circ = 314.16;
    qi('quizScorceNum').textContent = `${pct}%`;
    qi('quizScoreCircle').style.strokeDashoffset = circ * (1 - pct / 100);
    qi('quizResultMsg').textContent =
        pct >= 80 ? 'Excellent work!' : pct >= 50 ? 'Good effort — keep studying!' : 'Keep practising, you\'ve got this!';
    qi('quizResultDetail').textContent =
        `${quizScore} correct out of ${quizQuestions.length}`;

    stats.quizzes.push({ score: quizScore, total: quizQuestions.length, date: new Date().toISOString() });
    save(KEYS.stats, stats);
}

qi('endQuizBtn').addEventListener('click', () => {
    showQuizSetup();
});

/* ══════════════════════════════════════════════
   STATISTICS
══════════════════════════════════════════════ */
function renderStats() {
    const done = todos.filter(t => t.done).length,
        total = todos.length,
        hrs = ((stats.poms * 25) / 60).toFixed(1),
        qCount = stats.quizzes.length,
        avgScore = qCount
            ? Math.round(stats.quizzes.reduce((s, q) => s + (q.score / q.total) * 100, 0) / qCount) + '%'
            : '–';

    qi('statTotalPom').textContent = stats.poms;
    qi('statPomTime').textContent = `${hrs} hours focused`;
    qi('statTaskDone').textContent = done;
    qi('statTaskTotal').textContent = `of ${total} total`;
    qi('statCardsRev').textContent = stats.cardsRev;
    qi('statQuizzes').textContent = qCount;
    qi('statQuizAvg').textContent = `avg score ${avgScore}`;

    // Deck bars
    const bars = qi('deckProgressBars');
    if (!decks.length) {
        bars.innerHTML = '<div style="font-size:13px;color:var(--muted)">No decks yet.</div>';
    } else {
        bars.innerHTML = '';
        decks.forEach(d => {
            const cards = d.cards.length || 1, pct = Math.min(100, Math.round((Math.min(stats.cardsRev, cards) / cards) * 100));
            bars.innerHTML += `<div class="stat-bar-item"><div class="stat-bar-label"><span>${d.name}</span><span>${d.cards.length} cards</span></div><div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%;background:var(--accent)"></div></div></div>`;
        });
    }

    // Streak
    const streakRow = qi('streakRow');
    streakRow.innerHTML = '';
    const today = new Date(), shortDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10), isToday = i === 0, hasSessions = (stats.studyDays[key] || 0) > 0, el = document.createElement('div');
        el.className = 'streak-day' + (isToday ? ' today' : hasSessions ? ' done' : ' empty');
        el.textContent = shortDays[d.getDay()];
        el.title = key + (hasSessions ? ` (${stats.studyDays[key]} sessions)` : '');
        streakRow.appendChild(el);
    }
}

function resetStats() {
    stats = { poms: 0, cardsRev: 0, quizzes: [], studyDays: {} };
    save(KEYS.stats, stats);
}

/* ══════════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════════ */
function loadSettings() {
    qi('setName').value = settings.name || '';
    qi('setCity').value = settings.city || 'London';
    qi('setUnits').value = settings.units || 'metric';
    qi('setPomFocus').value = settings.pomFocus || 25;
    qi('setPomShort').value = settings.pomShort || 5;
    qi('setPomLong').value = settings.pomLong || 15;
    qi('setSoundOn').checked = settings.sound !== false;
}

qi('saveSettings').addEventListener('click', () => {
    settings.name = qi('setName').value.trim();
    settings.city = qi('setCity').value.trim() || 'London';
    settings.units = qi('setUnits').value;
    settings.pomFocus = parseInt(qi('setPomFocus').value) || 25;
    settings.pomShort = parseInt(qi('setPomShort').value) || 5;
    settings.pomLong = parseInt(qi('setPomLong').value) || 15;
    settings.sound = qi('setSoundOn').checked;
    save(KEYS.settings, settings);
    fetchWeather();
    pomReset();
    tick();
    alert('Settings saved!');
    go(qs('[data-section=home]'))
});

qi('cancelSettings').addEventListener('click', () => {
    loadSettings();
    go(qs('[data-section=home]'))
});

/* ══════════════════════════════════════════════
   MODAL HELPER
══════════════════════════════════════════════ */
export function openModal(title, bodyHTML, onSave) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-box"><div class="modal-title">${title}</div>${bodyHTML}<div class="modal-actions"><button class="btn btn-ghost" id="mCancel">Cancel</button><button class="btn btn-primary" id="mSave">Save</button></div></div>`;
    qi('modalContainer').appendChild(overlay);

    overlay.querySelector('#mCancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#mSave').addEventListener('click', () => {
        if (onSave() !== false) overlay.remove();
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    // Focus first input
    setTimeout((f) => { const i = overlay.querySelector('input,textarea'); if (i) i.focus(); }, 50);
    overlay.querySelector('#mSave').addEventListener('keydown', e => { if (e.key === 'Enter') overlay.querySelector('#mSave').click(); });
    // Enter key on inputs
    overlay.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') overlay.querySelector('#mSave').click(); });
    });
}

qi('resetStatBtn').addEventListener('click', () => {
    if (confirm('Reset all statistics?')) {
        resetStats();
        renderStats()
    }
})

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
renderHome();
fetchWeather();
loadSettings();
setInterval(fetchWeather, 10 * 60 * 1000);
