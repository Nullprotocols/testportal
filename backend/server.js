require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const multer = require('multer');
const csv = require('csv-parser');
const stream = require('stream');
const { Readable } = require('stream');

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json());

// MongoDB connection with serverless caching
let cachedDb = null;
const connectDB = async () => {
  if (cachedDb && mongoose.connection.readyState === 1) return cachedDb;
  await mongoose.connect(process.env.MONGODB_URI);
  cachedDb = mongoose.connection;
  console.log('MongoDB connected');
  return cachedDb;
};

// Prevent OverwriteModelError in serverless
const modelCache = {};
const getModel = (name, schema) => {
  if (modelCache[name]) return modelCache[name];
  modelCache[name] = mongoose.models[name] || mongoose.model(name, schema);
  return modelCache[name];
};

// Schemas
const StudentSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  dob: { type: String, required: true },
  class: String,
  mobile: String,
  email: String,
  registeredAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'blocked'], default: 'active' },
  blockReason: String,
  blockedAt: Date
});

const TestSchema = new mongoose.Schema({
  testId: { type: String, required: true, unique: true },
  testName: { type: String, required: true },
  duration: { type: Number, required: true },
  marks: {
    correct: { type: Number, default: 1 },
    wrong: { type: Number, default: 0 },
    skip: { type: Number, default: 0 }
  },
  shuffle: { type: Boolean, default: false },
  allowedClasses: [String],
  isLive: { type: Boolean, default: false },
  startTime: Date,
  endTime: Date
});

const QuestionSchema = new mongoose.Schema({
  testId: { type: String, required: true },
  questionId: { type: String, required: true },
  type: { type: String, enum: ['mcq', 'numerical'], required: true },
  questionText: {
    en: { type: String, required: true },
    hi: String
  },
  options: [{
    en: String,
    hi: String
  }],
  correctAnswer: mongoose.Schema.Types.Mixed,
  tolerance: Number,
  marks: {
    correct: Number,
    wrong: Number,
    skip: Number
  },
  imageUrls: [String]
});
QuestionSchema.index({ testId: 1, questionId: 1 }, { unique: true });

const ResultSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  testId: { type: String, required: true },
  score: { type: Number, required: true },
  rank: Number,
  submittedAt: { type: Date, default: Date.now },
  answers: [{
    questionId: String,
    selectedAnswer: mongoose.Schema.Types.Mixed,
    isCorrect: Boolean,
    marksAwarded: Number
  }],
  paused: { type: Boolean, default: false },
  pausedAt: Date,
  totalPausedDuration: { type: Number, default: 0 }
});
ResultSchema.index({ testId: 1, studentId: 1 }, { unique: true });

const DiscussionSchema = new mongoose.Schema({
  testId: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  link: String,
  createdAt: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
  studentId: String,
  sender: { type: String, enum: ['student', 'admin'], required: true },
  content: { type: String, required: true },
  isUnblockRequest: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

const ConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});

// Models
const Student = getModel('Student', StudentSchema);
const Test = getModel('Test', TestSchema);
const Question = getModel('Question', QuestionSchema);
const Result = getModel('Result', ResultSchema);
const Discussion = getModel('Discussion', DiscussionSchema);
const Message = getModel('Message', MessageSchema);
const Config = getModel('Config', ConfigSchema);

// Multer memory storage
const upload = multer({ storage: multer.memoryStorage() });

// ========== Auth Middleware ==========
const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token === 'admin-session-token') next(); // simplified for demo
  else res.status(401).json({ error: 'Unauthorized' });
};

// ========== Routes ==========

// --- Auth ---
app.post('/api/auth/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true, token: 'admin-session-token' });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

app.post('/api/auth/student/login', async (req, res) => {
  const { studentId, dob } = req.body;
  await connectDB();
  const student = await Student.findOne({ studentId, dob });
  if (!student) return res.status(401).json({ error: 'Invalid credentials' });
  if (student.status === 'blocked') {
    return res.json({ blocked: true, reason: student.blockReason });
  }
  res.json({ success: true, student });
});

// --- Students ---
app.get('/api/students', adminAuth, async (req, res) => {
  await connectDB();
  const students = await Student.find().sort('-registeredAt');
  res.json(students);
});

app.post('/api/students', adminAuth, async (req, res) => {
  await connectDB();
  try {
    const student = new Student(req.body);
    await student.save();
    res.json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/students/:id/block', adminAuth, async (req, res) => {
  await connectDB();
  const { reason } = req.body;
  const student = await Student.findOneAndUpdate(
    { studentId: req.params.id },
    { status: 'blocked', blockReason: reason, blockedAt: new Date() },
    { new: true }
  );
  res.json(student);
});

app.put('/api/students/:id/unblock', adminAuth, async (req, res) => {
  await connectDB();
  const student = await Student.findOneAndUpdate(
    { studentId: req.params.id },
    { status: 'active', blockReason: null, blockedAt: null },
    { new: true }
  );
  res.json(student);
});

// --- Tests ---
app.get('/api/tests', adminAuth, async (req, res) => {
  await connectDB();
  const tests = await Test.find();
  res.json(tests);
});

app.post('/api/tests', adminAuth, async (req, res) => {
  await connectDB();
  try {
    const test = new Test(req.body);
    await test.save();
    res.json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/tests/:id', adminAuth, async (req, res) => {
  await connectDB();
  const test = await Test.findOneAndUpdate({ testId: req.params.id }, req.body, { new: true });
  res.json(test);
});

app.delete('/api/tests/:id', adminAuth, async (req, res) => {
  await connectDB();
  const testId = req.params.id;
  await Test.deleteOne({ testId });
  await Question.deleteMany({ testId });
  await Result.deleteMany({ testId });
  await Discussion.deleteMany({ testId });
  res.json({ success: true });
});

// --- Questions ---
app.get('/api/questions/:testId', adminAuth, async (req, res) => {
  await connectDB();
  const questions = await Question.find({ testId: req.params.testId }).sort('questionId');
  res.json(questions);
});

app.post('/api/questions', adminAuth, async (req, res) => {
  await connectDB();
  try {
    const question = new Question(req.body);
    await question.save();
    res.json(question);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/questions/:id', adminAuth, async (req, res) => {
  await connectDB();
  const question = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(question);
});

app.delete('/api/questions/:id', adminAuth, async (req, res) => {
  await connectDB();
  await Question.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.post('/api/questions/upload/:testId', adminAuth, upload.single('csvFile'), async (req, res) => {
  await connectDB();
  const testId = req.params.testId;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const results = [];
  const stream = Readable.from(req.file.buffer.toString());
  stream
    .pipe(csv())
    .on('data', (row) => results.push(row))
    .on('end', async () => {
      try {
        for (const row of results) {
          const questionData = {
            testId,
            questionId: row.questionId,
            type: row.type,
            questionText: {
              en: row.questionText_en,
              hi: row.questionText_hi || ''
            },
            options: [
              { en: row.option1_en || '', hi: row.option1_hi || '' },
              { en: row.option2_en || '', hi: row.option2_hi || '' },
              { en: row.option3_en || '', hi: row.option3_hi || '' },
              { en: row.option4_en || '', hi: row.option4_hi || '' }
            ],
            correctAnswer: row.type === 'mcq' ? parseInt(row.correctAnswer) : parseFloat(row.correctAnswer),
            tolerance: row.tolerance ? parseFloat(row.tolerance) : undefined,
            marks: {
              correct: row.marks_correct ? parseFloat(row.marks_correct) : undefined,
              wrong: row.marks_wrong ? parseFloat(row.marks_wrong) : undefined,
              skip: row.marks_skip ? parseFloat(row.marks_skip) : undefined
            },
            imageUrls: row.imageUrls ? row.imageUrls.split(';') : []
          };
          await Question.findOneAndUpdate(
            { testId, questionId: row.questionId },
            questionData,
            { upsert: true, new: true }
          );
        }
        res.json({ success: true, count: results.length });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
});

// --- Student Test Flow ---
app.get('/api/student/available-tests/:studentId', async (req, res) => {
  await connectDB();
  const student = await Student.findOne({ studentId: req.params.studentId });
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const now = new Date();
  const tests = await Test.find({
    isLive: true,
    allowedClasses: student.class,
    startTime: { $lte: now },
    endTime: { $gte: now }
  });
  const taken = await Result.find({ studentId: student.studentId }).distinct('testId');
  const available = tests.filter(t => !taken.includes(t.testId));
  res.json(available);
});

app.post('/api/student/start-test', async (req, res) => {
  await connectDB();
  const { studentId, testId } = req.body;
  let result = await Result.findOne({ studentId, testId });
  if (!result) {
    result = new Result({ studentId, testId, score: 0, answers: [] });
    await result.save();
  }
  res.json(result);
});

app.post('/api/student/submit-test', async (req, res) => {
  await connectDB();
  const { studentId, testId, answers } = req.body;
  const test = await Test.findOne({ testId });
  const questions = await Question.find({ testId });
  const marksScheme = test.marks;
  let score = 0;
  const processedAnswers = [];

  for (const ans of answers) {
    const q = questions.find(q => q.questionId === ans.questionId);
    if (!q) continue;
    const qMarks = q.marks || marksScheme;
    let isCorrect = false;
    if (q.type === 'mcq') {
      isCorrect = (parseInt(ans.selectedAnswer) === q.correctAnswer);
    } else {
      isCorrect = Math.abs(parseFloat(ans.selectedAnswer) - q.correctAnswer) <= (q.tolerance || 0.001);
    }
    const awarded = isCorrect ? qMarks.correct : (ans.selectedAnswer ? qMarks.wrong : qMarks.skip);
    score += awarded;
    processedAnswers.push({
      questionId: ans.questionId,
      selectedAnswer: ans.selectedAnswer,
      isCorrect,
      marksAwarded: awarded
    });
  }

  const result = await Result.findOneAndUpdate(
    { studentId, testId },
    { score, answers: processedAnswers, submittedAt: new Date() },
    { new: true }
  );

  // Update ranks
  const allResults = await Result.find({ testId }).sort('-score');
  for (let i = 0; i < allResults.length; i++) {
    allResults[i].rank = i + 1;
    await allResults[i].save();
  }

  res.json({ score, rank: result.rank });
});

// --- Pause / Resume (Admin) ---
app.post('/api/admin/pause-test', adminAuth, async (req, res) => {
  const { studentId, testId, password } = req.body;
  if (password !== process.env.PAUSE_PASSWORD) return res.status(403).json({ error: 'Invalid password' });
  await connectDB();
  await Result.findOneAndUpdate(
    { studentId, testId },
    { paused: true, pausedAt: new Date() }
  );
  res.json({ success: true });
});

app.post('/api/admin/resume-test', adminAuth, async (req, res) => {
  const { studentId, testId, password } = req.body;
  if (password !== process.env.RESUME_PASSWORD) return res.status(403).json({ error: 'Invalid password' });
  await connectDB();
  const result = await Result.findOne({ studentId, testId });
  if (!result || !result.paused) return res.status(400).json({ error: 'Not paused' });
  const pausedDuration = Math.floor((new Date() - result.pausedAt) / 1000);
  result.totalPausedDuration = (result.totalPausedDuration || 0) + pausedDuration;
  result.paused = false;
  result.pausedAt = null;
  await result.save();
  res.json({ success: true });
});

app.get('/api/admin/paused-status/:studentId/:testId', adminAuth, async (req, res) => {
  await connectDB();
  const result = await Result.findOne({ studentId: req.params.studentId, testId: req.params.testId });
  res.json({ paused: result?.paused || false, totalPausedDuration: result?.totalPausedDuration || 0 });
});

// --- Results ---
app.get('/api/results', adminAuth, async (req, res) => {
  await connectDB();
  const results = await Result.find().populate('studentId', 'fullName').populate('testId', 'testName');
  res.json(results);
});

app.get('/api/results/student/:studentId', async (req, res) => {
  await connectDB();
  const results = await Result.find({ studentId: req.params.studentId }).populate('testId', 'testName');
  res.json(results);
});

app.get('/api/results/test/:testId', adminAuth, async (req, res) => {
  await connectDB();
  const results = await Result.find({ testId: req.params.testId }).sort('-score').populate('studentId', 'fullName');
  res.json(results);
});

// --- Discussions ---
app.get('/api/discussions/:testId', async (req, res) => {
  await connectDB();
  const discussions = await Discussion.find({ testId: req.params.testId }).sort('-createdAt');
  res.json(discussions);
});

app.post('/api/discussions', adminAuth, async (req, res) => {
  await connectDB();
  const discussion = new Discussion(req.body);
  await discussion.save();
  res.json(discussion);
});

app.delete('/api/discussions/:id', adminAuth, async (req, res) => {
  await connectDB();
  await Discussion.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// --- Messages ---
app.get('/api/messages', async (req, res) => {
  await connectDB();
  const { studentId } = req.query;
  const filter = studentId ? { studentId } : {};
  const messages = await Message.find(filter).sort('timestamp');
  res.json(messages);
});

app.post('/api/messages', async (req, res) => {
  await connectDB();
  const message = new Message(req.body);
  await message.save();
  res.json(message);
});

// --- Settings ---
app.post('/api/settings/password', adminAuth, async (req, res) => {
  // In a real app, you'd update the admin password stored somewhere.
  // Here we just return success as env vars are immutable.
  res.json({ success: true, message: 'Password updated (simulated)' });
});

// Root route
app.get('/api', (req, res) => res.send('NexGen Exam API'));

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Export for Vercel
module.exports = app;
