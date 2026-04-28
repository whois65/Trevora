import { todos, stats } from "../main.js";
import { qi, qs, qa } from "../state.js";
import { uid } from "../utils.js";

/* ══════════════════════════════════════════════
   HOME
══════════════════════════════════════════════ */
export function renderHome() {
    const done = todos.filter(t => t.done).length;
    qi('hTaskCount').textContent = todos.length;
    qi('hTaskDone').textContent = `${done} completed`;
    qi('hPomCount').textContent = stats.poms;

    const list = qi('homeTodoList');
    list.innerHTML = '';
    const active = todos.filter(t => !t.done).slice(0, 5);
    if (!active.length) {
        list.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:8px 0">No pending tasks.</div>';
        return;
    }
    active.forEach(t => list.appendChild(makeTodoEl(t, 'home')));
}
