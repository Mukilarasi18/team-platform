require('dotenv').config();
const mongoose = require('mongoose');
const { User, Workspace, Project, Task, Comment, Notification } = require('./models');
const day = n => new Date(Date.now() + n * 864e5);
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User, Workspace, Project, Task, Comment, Notification].map(m => m.deleteMany({})));
  const admin = await User.create({ name: 'Alice Admin', email: 'admin@demo.com', password: '123456', role: 'Admin' });
  const mgr = await User.create({ name: 'Mark Manager', email: 'manager@demo.com', password: '123456', role: 'Manager' });
  const m1 = await User.create({ name: 'Mia Member', email: 'member@demo.com', password: '123456', role: 'Member' });
  const m2 = await User.create({ name: 'Sam Member', email: 'sam@demo.com', password: '123456', role: 'Member' });
  const all = [admin, mgr, m1, m2].map(u => u._id);
  const ws = await Workspace.create({ name: 'Nexus Team', owner: mgr._id, members: all });
  const p1 = await Project.create({ workspace: ws._id, name: 'Website Redesign', description: 'Revamp company website', deadline: day(20), members: all });
  const p2 = await Project.create({ workspace: ws._id, name: 'Mobile App Launch', description: 'Ship v1 of the app', deadline: day(35), members: all });
  const T = (project, title, status, priority, assignee, due) => ({ project: project._id, title, description: title + ' - details here', status, priority, assignee: assignee._id, createdBy: mgr._id, dueDate: day(due) });
  await Task.insertMany([
    T(p1, 'Design homepage mockup', 'completed', 'High', m1, -2), T(p1, 'Set up CI pipeline', 'completed', 'Medium', m2, -1),
    T(p1, 'Build navigation bar', 'under_review', 'High', m1, 2), T(p1, 'Write landing page copy', 'in_progress', 'Medium', m2, 4),
    T(p1, 'Implement contact form', 'in_progress', 'Urgent', m1, -3), T(p1, 'SEO audit', 'todo', 'Low', m2, 10),
    T(p1, 'Accessibility review', 'todo', 'Medium', m1, 8), T(p1, 'Performance testing', 'todo', 'High', m2, 12),
    T(p2, 'Define app features', 'completed', 'High', m1, -5), T(p2, 'Login screen UI', 'under_review', 'Medium', m2, 1),
    T(p2, 'Push notifications', 'in_progress', 'High', m1, 6), T(p2, 'App store listing', 'todo', 'Low', m2, 20),
    T(p2, 'Beta testing round', 'todo', 'Urgent', m1, 15), T(p2, 'Fix crash on startup', 'in_progress', 'Urgent', m2, -1),
  ]);
  console.log('Seeded! Logins (password 123456): admin@demo.com, manager@demo.com, member@demo.com');
  process.exit();
})();
