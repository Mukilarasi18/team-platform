import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from './api';

const COLS = [['todo', 'To Do'], ['in_progress', 'In Progress'], ['under_review', 'Under Review'], ['completed', 'Completed']];
const PRI = ['Low', 'Medium', 'High', 'Urgent'];

function TaskModal({ task, proj, user, onClose, onSaved }) {
  const staff = user.role !== 'Member', isNew = !task._id;
  const [t, setT] = useState({ title: '', description: '', priority: 'Medium', status: 'todo', ...task, assignee: task.assignee?._id || '', dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '' });
  const [files, setFiles] = useState(task.attachments || []), [comments, setComments] = useState([]), [text, setText] = useState(''), [err, setErr] = useState('');
  const canStatus = staff || t.assignee === user._id;
  const set = k => e => setT({ ...t, [k]: e.target.value });
  const loadC = () => !isNew && api(`/tasks/${task._id}/comments`).then(setComments);
  useEffect(() => { loadC(); }, []);
  const run = async fn => { try { setErr(''); await fn(); } catch (e) { setErr(e.message); } };
  const save = () => run(async () => {
    const body = staff ? t : { status: t.status };
    if (isNew) await api('/tasks', { method: 'POST', body: { ...body, project: proj._id } }); else await api('/tasks/' + task._id, { method: 'PATCH', body });
    onSaved(); onClose();
  });
  const upload = e => run(async () => { const fd = new FormData(); fd.append('file', e.target.files[0]); const d = await api(`/tasks/${task._id}/files`, { method: 'POST', body: fd }); setFiles(d.attachments); onSaved(); });
  return (
    <div className="overlay" onClick={onClose}><div className="modal card" onClick={e => e.stopPropagation()}>
      <h3>{isNew ? 'New task' : 'Task details'}</h3>
      <input placeholder="Title" value={t.title} onChange={set('title')} disabled={!staff} />
      <textarea placeholder="Description" value={t.description || ''} onChange={set('description')} disabled={!staff} />
      <div className="row wrap">
        <label>Assignee<select value={t.assignee} onChange={set('assignee')} disabled={!staff}><option value="">Unassigned</option>{proj.members.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}</select></label>
        <label>Priority<select value={t.priority} onChange={set('priority')} disabled={!staff}>{PRI.map(p => <option key={p}>{p}</option>)}</select></label>
        <label>Deadline<input type="date" value={t.dueDate} onChange={set('dueDate')} disabled={!staff} /></label>
        <label>Status<select value={t.status} onChange={set('status')} disabled={!canStatus}>{COLS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      </div>
      {err && <div className="err">{err}</div>}
      {(staff || canStatus) && <button className="btn" onClick={save}>{isNew ? 'Create task' : 'Save changes'}</button>}
      {!isNew && <>
        <h4>Files</h4>
        {files.map(f => <div key={f.path}><a href={'/uploads/' + f.path} target="_blank">📎 {f.name}</a></div>)}
        <input type="file" onChange={upload} /><small className="muted"> Max 5MB</small>
        <h4>Comments</h4>
        {comments.map(c => <div key={c._id} className="comment"><b>{c.author?.name}</b> <small>{new Date(c.createdAt).toLocaleString()}</small><div>{c.text}</div></div>)}
        <div className="row"><input placeholder="Write a comment..." value={text} onChange={e => setText(e.target.value)} />
          <button className="btn" onClick={() => run(async () => { await api(`/tasks/${task._id}/comments`, { method: 'POST', body: { text } }); setText(''); loadC(); })}>Send</button></div>
      </>}
    </div></div>
  );
}

function Dashboard({ id }) {
  const [d, setD] = useState(null);
  useEffect(() => { api(`/projects/${id}/dashboard`).then(setD); }, [id]);
  if (!d) return null;
  const toData = o => Object.entries(o).map(([name, value]) => ({ name: name.replace('_', ' '), value }));
  const csv = () => api(`/projects/${id}/report.csv`, { raw: true }).then(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'project-report.csv'; a.click(); });
  return (
    <div>
      <div className="card"><h3>Overall progress: {d.percent}%</h3>
        <div className="bar"><div style={{ width: d.percent + '%' }} /></div>
        <p>{d.completed} of {d.total} tasks completed · <b className={d.overdue ? 'red' : ''}>{d.overdue} overdue</b></p>
        <button className="btn" onClick={csv}>⬇ Export report (CSV)</button></div>
      <div className="grid2e">
        {[['Tasks by status', d.byStatus], ['Tasks by priority', d.byPriority]].map(([title, o]) => (
          <div className="card" key={title}><h4>{title}</h4>
            <ResponsiveContainer width="100%" height={220}><BarChart data={toData(o)}><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>))}
      </div>
      <div className="card"><h4>Team workload</h4>
        <table><thead><tr><th>Member</th><th>Assigned</th><th>Done</th><th>Progress</th></tr></thead>
          <tbody>{d.workload.map(w => <tr key={w.name}><td>{w.name}</td><td>{w.total}</td><td>{w.done}</td><td><div className="bar small"><div style={{ width: (w.done / w.total * 100) + '%' }} /></div></td></tr>)}</tbody></table></div>
    </div>
  );
}

export default function Project({ id, user, back }) {
  const staff = user.role !== 'Member';
  const [proj, setProj] = useState(null), [tasks, setTasks] = useState([]), [tab, setTab] = useState('board'), [open, setOpen] = useState(null), [err, setErr] = useState(''), [email, setEmail] = useState('');
  const [f, setF] = useState({ q: '', status: '', priority: '', assignee: '', overdue: '' });
  const loadProj = () => api('/projects/' + id).then(setProj);
  const load = useCallback(() => {
    const qs = new URLSearchParams({ project: id, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) });
    api('/tasks?' + qs).then(setTasks).catch(e => setErr(e.message));
  }, [id, f]);
  useEffect(() => { loadProj(); }, [id]);
  useEffect(() => { load(); }, [load]);
  const drop = async (e, status) => {
    e.preventDefault();
    try { setErr(''); await api('/tasks/' + e.dataTransfer.getData('id'), { method: 'PATCH', body: { status } }); load(); } catch (x) { setErr(x.message); }
  };
  const setFilter = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target.checked ? '1' : '') : e.target.value });
  if (!proj) return null;
  const late = t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed';

  return (
    <div>
      <div className="between"><div><a className="link" onClick={back}>← Back</a><h2>{proj.name}</h2><p className="muted">{proj.description}</p></div>
        <div className="tabs"><button className={'btn ' + (tab === 'board' ? '' : 'ghost')} onClick={() => setTab('board')}>Kanban</button>
          <button className={'btn ' + (tab === 'dash' ? '' : 'ghost')} onClick={() => setTab('dash')}>Dashboard</button></div></div>
      {err && <div className="err">{err}</div>}
      {tab === 'dash' ? <Dashboard id={id} /> : <>
        <div className="card row wrap">
          <input placeholder="🔍 Search tasks..." value={f.q} onChange={setFilter('q')} />
          <select value={f.status} onChange={setFilter('status')}><option value="">All statuses</option>{COLS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select value={f.priority} onChange={setFilter('priority')}><option value="">All priorities</option>{PRI.map(p => <option key={p}>{p}</option>)}</select>
          <select value={f.assignee} onChange={setFilter('assignee')}><option value="">All assignees</option>{proj.members.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}</select>
          <label><input type="checkbox" checked={!!f.overdue} onChange={setFilter('overdue')} /> Overdue</label>
          {staff && <button className="btn" onClick={() => setOpen({})}>+ New task</button>}
        </div>
        {staff && <div className="row"><input placeholder="Add project member by email" value={email} onChange={e => setEmail(e.target.value)} />
          <button className="btn ghost" onClick={async () => { try { setErr(''); await api(`/projects/${id}/members`, { method: 'POST', body: { email } }); setEmail(''); loadProj(); } catch (x) { setErr(x.message); } }}>Add</button>
          <small className="muted">Members: {proj.members.map(m => m.name).join(', ')}</small></div>}
        <div className="board">{COLS.map(([s, label]) => (
          <div key={s} className="col" onDragOver={e => e.preventDefault()} onDrop={e => drop(e, s)}>
            <h4>{label} <span className="pill">{tasks.filter(t => t.status === s).length}</span></h4>
            {tasks.filter(t => t.status === s).map(t => (
              <div key={t._id} className="task" draggable onDragStart={e => e.dataTransfer.setData('id', t._id)} onClick={() => setOpen(t)}>
                <b>{t.title}</b>
                <div className="meta"><span className={'tag ' + t.priority}>{t.priority}</span>
                  {t.dueDate && <small className={late(t) ? 'red' : ''}>📅 {t.dueDate.slice(0, 10)}</small>}
                  {t.assignee && <small>👤 {t.assignee.name}</small>}
                  {t.attachments?.length > 0 && <small>📎 {t.attachments.length}</small>}</div>
              </div>))}
          </div>))}
        </div>
      </>}
      {open && <TaskModal key={open._id || 'new'} task={open} proj={proj} user={user} onClose={() => setOpen(null)} onSaved={load} />}
    </div>
  );
}
