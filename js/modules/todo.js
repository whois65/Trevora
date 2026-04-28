import { KEYS, load, save, openModal, todos } from "../main.js";
import { qi, qs, qa } from "../state.js";
import { uid } from "../utils.js";
import { renderHome } from "../ui/render.js";

let todoFilterMode = 'all';

export function renderTodo() {
    const list = qi('todoList');
    if (!list) return;

    const filtered = todos.filter(t => {
        if (todoFilterMode === 'active') return !t.done;
        if (todoFilterMode === 'done') return t.done;
        return true;
    });

    // 1. Build the HTML all at once
    list.innerHTML = filtered.map(t => `
        <div class="todo-item ${t.done ? 'done' : ''}">
            <label>
                <input type="checkbox" ${t.done ? 'checked' : ''} 
                    data-id="${t.id}" data-action="toggle">
                <span>${t.text}</span>
            </label>
            <button class="btn btn-ghost btn-sm" 
                data-id="${t.id}" data-action="delete">Delete</button>
        </div>
    `).join('') || '<p class="text-center opacity-50">No tasks found.</p>';

    updateSummary();

    // 2. Event Delegation: One listener for the whole list
    list.onclick = (e) => {
        const id = e.target.dataset.id;
        const action = e.target.dataset.action;
        if (!id) return;

        if (action === 'toggle') {
            const todo = todos.find(t => String(t.id) === id);
            if (todo) {
                todo.done = e.target.checked;
                syncAndRefresh();
            }
        } else if (action === 'delete') {
            todos = todos.filter(t => String(t.id) !== id);
            syncAndRefresh();
        }
    };
}

function updateSummary() {
    const todoSub = qi('todoSub');
    if (!todoSub) return;
    const done = todos.filter(t => t.done).length;
    todoSub.textContent = `${todos.length} tasks · ${done} completed`;
}

// Helper to handle saving and UI updates in one go
function syncAndRefresh() {
    save(KEYS.todos, todos);
    renderTodo();
    renderHome(); 
}

export function addTask() {
    const content = `
        <div class="form-group">
            <label>Task name</label>
            <input type="text" id="mTodoText" placeholder="e.g. Read chapter 5" autofocus>
        </div>`;

    openModal('Add Task', content, () => {
        const text = qi('mTodoText')?.value.trim();
        if (!text) return false;

        todos.push({ 
            id: uid(), 
            text, 
            done: false, 
            created: Date.now() 
        });

        syncAndRefresh();
    });
}
