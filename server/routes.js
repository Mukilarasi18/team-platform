const r = require('express').Router();
const jwt = require('jsonwebtoken'), multer = require('multer'), path = require('path'), fs = require('fs');
const { User, Workspace, Project, Task, Comment, Notification } = require('./models');

// ---------- helpers ----------
const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message }));
const sign = u => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const isStaff = u => ['Admin', 'Manager'].includes(u.role);
const auth = async (req, res, next) => {
  try {
    const { id } = jwt.verify((req.headers.authorization || '').split(' ')[1], process.env.JWT_SECRET);
    req.user = await User.findById(id); if (!req.user) throw 0; next();
  } catch { res.status(401).json({ error: 'Please log in' }); }
};
// Role-based access control middleware
const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Forbidden: your role cannot do this' });
const projOf = async (u, id) => {
  const p = await Project.findById(id); if (!p) throw new Error('Project not found');
  if (u.role !== 'Admin' && !p.members.some(m => m.equals(u._id))) throw new Error('You are not a member of this project');
  return p;
};
const notify = (to, message, project, from) => to && String(to) !== String(from) && Notification.create({ user: to, message, project });
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- auth ----------
r.post('/auth/register', wrap(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || password.length < 6) throw new Error('Name, email and password (min 6 chars) required');
  // NOTE: role is selectable for demo purposes. In real life, only Admin should assign roles.
  const u = await User.create({ name, email, password, role: ['Admin', 'Manager', 'Member'].includes(role) ? role : 'Member' });
  res.json({ token: sign(u), user: { _id: u._id, name: u.name, email: u.email, role: u.role } });
}));
r.post('/auth/login', wrap(async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!u || !(await u.check(req.body.password || ''))) throw new Error('Invalid email or password');
  res.json({ token: sign(u), user: { _id: u._id, name: u.name, email: u.email, role: u.role } });
}));
r.get('/auth/me', auth, (req, res) => res.json({ _id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role }));

// ---------- workspaces ----------
r.get('/workspaces', auth, wrap(async (req, res) => {
  const q = req.user.role === 'Admin' ? {} : { members: req.user._id };
  res.json(await Workspace.find(q).populate('members', 'name email role'));
}));
r.post('/workspaces', auth, allow('Admin', 'Manager'), wrap(async (req, res) =>
  res.json(await Workspace.create({ name: req.body.name, owner: req.user._id, members: [req.user._id] }))));
r.post('/workspaces/:id/members', auth, allow('Admin', 'Manager'), wrap(async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase() }); if (!u) throw new Error('No registered user with that email');
  res.json(await Workspace.findByIdAndUpdate(req.params.id, { $addToSet: { members: u._id } }, { new: true }));
}));

// ---------- projects ----------
r.get('/projects', auth, wrap(async (req, res) => {
  const q = {}; if (req.query.workspace) q.workspace = req.query.workspace;
  if (req.user.role !== 'Admin') q.members = req.user._id;
  res.json(await Project.find(q));
}));
r.post('/projects', auth, allow('Admin', 'Manager'), wrap(async (req, res) =>
  res.json(await Project.create({ ...req.body, members: [req.user._id] }))));
r.get('/projects/:id', auth, wrap(async (req, res) => {
  await projOf(req.user, req.params.id);
  res.json(await Project.findById(req.params.id).populate('members', 'name email role'));
}));
r.post('/projects/:id/members', auth, allow('Admin', 'Manager'), wrap(async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase() }); if (!u) throw new Error('No registered user with that email');
  const p = await Project.findByIdAndUpdate(req.params.id, { $addToSet: { members: u._id } }, { new: true });
  await Workspace.findByIdAndUpdate(p.workspace, { $addToSet: { members: u._id } });
  res.json(p);
}));

// ---------- tasks (search + filters via query params) ----------
r.get('/tasks', auth, wrap(async (req, res) => {
  await projOf(req.user, req.query.project);
  const { q, status, priority, assignee, overdue } = req.query, f = { project: req.query.project };
  if (q) f.$or = [{ title: new RegExp(esc(q), 'i') }, { description: new RegExp(esc(q), 'i') }];
  if (status) f.status = status; if (priority) f.priority = priority; if (assignee) f.assignee = assignee;
  if (overdue) { f.dueDate = { $lt: new Date() }; f.status = { $ne: 'completed' }; }
  res.json(await Task.find(f).populate('assignee', 'name').sort('createdAt'));
}));
r.post('/tasks', auth, allow('Admin', 'Manager'), wrap(async (req, res) => {
  await projOf(req.user, req.body.project);
  const b = { ...req.body, createdBy: req.user._id }; if (!b.assignee) delete b.assignee; if (!b.dueDate) delete b.dueDate;
  const t = await Task.create(b);
  await notify(t.assignee, `You were assigned: ${t.title}`, t.project, req.user._id);
  res.json(t);
}));
r.patch('/tasks/:id', auth, wrap(async (req, res) => {
  const t = await Task.findById(req.params.id); if (!t) throw new Error('Task not found');
  await projOf(req.user, t.project);
  const staff = isStaff(req.user);
  if (!staff && !(t.assignee && t.assignee.equals(req.user._id)))
    return res.status(403).json({ error: 'Members can only update tasks assigned to them' });
  const old = { status: t.status, assignee: String(t.assignee || '') };
  (staff ? ['title', 'description', 'assignee', 'priority', 'dueDate', 'status'] : ['status']).forEach(k => {
    if (k in req.body) t[k] = req.body[k] === '' && ['assignee', 'dueDate'].includes(k) ? null : req.body[k];
  });
  await t.save();
  if (t.status !== old.status) {
    const msg = `"${t.title}" moved to ${t.status.replace('_', ' ')} by ${req.user.name}`;
    await notify(t.assignee, msg, t.project, req.user._id); await notify(t.createdBy, msg, t.project, req.user._id);
  }
  if (String(t.assignee || '') !== old.assignee) await notify(t.assignee, `You were assigned: ${t.title}`, t.project, req.user._id);
  res.json(t);
}));
r.delete('/tasks/:id', auth, allow('Admin', 'Manager'), wrap(async (req, res) => { await Task.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

// ---------- file sharing ----------
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
const upload = multer({
  storage: multer.diskStorage({ destination: path.join(__dirname, 'uploads'), filename: (q, f, cb) => cb(null, Date.now() + '-' + f.originalname.replace(/[^\w.-]/g, '_')) }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (q, f, cb) => cb(/\.(png|jpe?g|gif|pdf|docx?|xlsx?|pptx?|txt|zip)$/i.test(f.originalname) ? null : new Error('File type not allowed'), true)
});
r.post('/tasks/:id/files', auth, (req, res) => upload.single('file')(req, res, async err => {
  try {
    if (err) throw err; if (!req.file) throw new Error('No file');
    const t = await Task.findById(req.params.id); await projOf(req.user, t.project);
    t.attachments.push({ name: req.file.originalname, path: req.file.filename }); await t.save(); res.json(t);
  } catch (e) { res.status(400).json({ error: e.message }); }
}));

// ---------- comments ----------
r.get('/tasks/:id/comments', auth, wrap(async (req, res) =>
  res.json(await Comment.find({ task: req.params.id }).populate('author', 'name').sort('createdAt'))));
r.post('/tasks/:id/comments', auth, wrap(async (req, res) => {
  const t = await Task.findById(req.params.id); await projOf(req.user, t.project);
  const c = await Comment.create({ task: t._id, author: req.user._id, text: req.body.text });
  const msg = `${req.user.name} commented on "${t.title}"`;
  await notify(t.assignee, msg, t.project, req.user._id); await notify(t.createdBy, msg, t.project, req.user._id);
  res.json(c);
}));

// ---------- notifications ----------
r.get('/notifications', auth, wrap(async (req, res) => res.json(await Notification.find({ user: req.user._id }).sort('-createdAt').limit(30))));
r.post('/notifications/read', auth, wrap(async (req, res) => { await Notification.updateMany({ user: req.user._id }, { read: true }); res.json({ ok: true }); }));

// ---------- dashboard + report ----------
r.get('/projects/:id/dashboard', auth, wrap(async (req, res) => {
  await projOf(req.user, req.params.id);
  const tasks = await Task.find({ project: req.params.id }).populate('assignee', 'name');
  const count = (key, vals) => Object.fromEntries(vals.map(v => [v, tasks.filter(t => t[key] === v).length]));
  const w = {}; tasks.forEach(t => { const n = t.assignee?.name || 'Unassigned'; w[n] ??= { name: n, total: 0, done: 0 }; w[n].total++; if (t.status === 'completed') w[n].done++; });
  const done = tasks.filter(t => t.status === 'completed').length;
  res.json({
    total: tasks.length, completed: done, percent: tasks.length ? Math.round(done / tasks.length * 100) : 0,
    byStatus: count('status', ['todo', 'in_progress', 'under_review', 'completed']),
    byPriority: count('priority', ['Low', 'Medium', 'High', 'Urgent']),
    overdue: tasks.filter(t => t.dueDate && t.dueDate < new Date() && t.status !== 'completed').length,
    workload: Object.values(w)
  });
}));
r.get('/projects/:id/report.csv', auth, wrap(async (req, res) => {
  await projOf(req.user, req.params.id);
  const tasks = await Task.find({ project: req.params.id }).populate('assignee', 'name');
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Title', 'Assignee', 'Priority', 'Status', 'Due Date'].join(',')].concat(
    tasks.map(t => [t.title, t.assignee?.name, t.priority, t.status, t.dueDate?.toISOString().slice(0, 10)].map(q).join(',')));
  res.type('text/csv').send(rows.join('\n'));
}));

module.exports = r;
