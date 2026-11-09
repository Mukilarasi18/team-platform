const mongoose = require('mongoose'), bcrypt = require('bcryptjs');
const { Schema, model } = mongoose, ref = n => ({ type: Schema.Types.ObjectId, ref: n });

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Manager', 'Member'], default: 'Member' }
}, { timestamps: true });
userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
});
userSchema.methods.check = function (p) { return bcrypt.compare(p, this.password); };

module.exports = {
  User: model('User', userSchema),
  Workspace: model('Workspace', new Schema({ name: { type: String, required: true }, owner: ref('User'), members: [ref('User')] }, { timestamps: true })),
  Project: model('Project', new Schema({ workspace: ref('Workspace'), name: { type: String, required: true }, description: String, deadline: Date, members: [ref('User')] }, { timestamps: true })),
  Task: model('Task', new Schema({
    project: ref('Project'), title: { type: String, required: true }, description: String,
    assignee: ref('User'), createdBy: ref('User'),
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
    status: { type: String, enum: ['todo', 'in_progress', 'under_review', 'completed'], default: 'todo' },
    dueDate: Date, attachments: [{ name: String, path: String }]
  }, { timestamps: true })),
  Comment: model('Comment', new Schema({ task: ref('Task'), author: ref('User'), text: { type: String, required: true } }, { timestamps: true })),
  Notification: model('Notification', new Schema({ user: ref('User'), message: String, project: ref('Project'), read: { type: Boolean, default: false } }, { timestamps: true }))
};
