const express = require('express');
const app = express();
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const fs = require('fs');
// const { exec } = require('child_process');
const path = require('path');
const multer = require('multer');
const ffmpeg = require('ffmpeg-static');
const cors = require('cors');

app.use(cors({
  origin: ['http://localhost:8081', 'http://localhost:3000', 'http://192.168.1.6:8081'],
  credentials: true
}));

app.use(bodyParser.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname || '.m4a'));
  }
});

const upload = multer({ storage: storage });

// Setup MySQL connection
const db = mysql.createPool({
  host: '88.150.227.117',
  user: 'nrktrn_web_admin',
  password: 'GOeg&*$*657',
  port: '3306',
  database: 'nrkindex_trn',
  auth_plugin: 'mysql_native_password',
  connectTimeout: 30000, // 30 seconds
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
console.log('MySQL pool created.');

// Upload endpoint for audio files
app.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    console.log('Audio file uploaded:', req.file.filename);
    console.log('File path:', req.file.path);
    console.log('File extension:', path.extname(req.file.filename));
    const audioPath = req.file.path;
    const wavPath = audioPath.replace(/\.[^/.]+$/, '.wav');
    if (!audioPath.toLowerCase().endsWith('.wav')) {
      console.log('Converting audio to WAV format...');
      console.log('Input file:', audioPath);
      console.log('Output file:', wavPath);
      console.log('FFmpeg path:', ffmpeg);
      // FFmpeg conversion code commented out for clarity
      // exec(`"${ffmpeg}" -i "${audioPath}" "${wavPath}" -y`, (convertErr) => {
      //   if (convertErr) {
      //     console.error('FFmpeg conversion error:', convertErr);
      //     return res.status(500).json({ 
      //       error: 'Audio conversion failed: ' + convertErr.message,
      //       duration: 0
      //     });
      //   }
      //   console.log('Conversion successful, now transcribing WAV file');
      //   transcribeAudio(wavPath, res);
      // });
      // For now, just return an error if not WAV
      return res.status(500).json({ error: 'Audio conversion not supported on server', duration: 0 });
    } else {
      transcribeAudio(audioPath, res);
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

function transcribeAudio(audioPath, res) {
  const transcribeScript = path.join(__dirname, 'transcribe.py');
  console.log('Calling transcribe script:', transcribeScript);
  console.log('Audio file path:', audioPath);
  // exec(`python "${transcribeScript}" "${audioPath}"`, (err, stdout, stderr) => {
  //   console.log('Transcription stdout:', stdout);
  //   console.log('Transcription stderr:', stderr);
  //   console.log('Transcription error:', err);
  //   if (err) {
  //     console.error('Transcription error:', err);
  //     return res.status(500).json({ 
  //       error: 'Transcription failed: ' + err.message,
  //       duration: 0
  //     });
  //   }
  //   let result;
  //   try {
  //     const jsonMatch = stdout.match(/\{[^}]*\}/);
  //     if (jsonMatch) {
  //       result = JSON.parse(jsonMatch[0]);
  //     } else {
  //       result = {
  //         transcription: stdout.trim().replace(/\n/g, ' '),
  //         duration: 0,
  //         error: 'No transcription result'
  //       };
  //     }
  //   } catch (parseError) {
  //     console.log('Could not parse JSON, treating as plain text');
  //     const cleanText = stdout.trim().replace(/\n/g, ' ').replace(/Audio Duration:.*?seconds/, '').trim();
  //     result = {
  //       transcription: cleanText || 'Transcription failed',
  //       duration: 0,
  //       error: null
  //     };
  //   }
  //   console.log('Final result:', result);
  //   res.json({
  //     success: true,
  //     transcription: result.transcription || '',
  //     duration: result.duration || 0,
  //     error: result.error || null
  //   });
  // });
  // For now, just return an error
  return res.status(500).json({ error: 'Transcription not supported on server', duration: 0 });
}

// Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', { username, password });
  db.query(
    'SELECT * FROM EMPLOY_REGISTRATION WHERE USERNAME = ? AND PASSWORD = ?',
    [username, password],
    (err, results) => {
      console.log('Query results:', { err, resultsCount: results?.length, firstResult: results?.[0] });
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'DB error: ' + err.message });
      }
      if (results.length === 0) {
        console.log('No user found with these credentials');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      console.log('Login successful for user:', results[0].EMPNAME);
      console.log('🔍 Full user data being returned:', results[0]);
      console.log('🔍 EMPID in user data:', results[0].EMPID);
      res.json({ success: true, user: results[0] });
    }
  );
});

// --- BEGIN: Automation Task Queue ---
let automationTasks = [];

// Insert endpoint (returns task_id)
app.post('/insert', (req, res) => {
  const { text_data, target_agent, target_column, username, password } = req.body;
  console.log('Received insert request:', { text_data, target_agent, target_column, username: username ? '***' : 'missing' });
  if (!text_data || !target_agent) {
    return res.status(400).json({
      success: false,
      error: 'Missing text_data or target_agent'
    });
  }
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Missing user credentials (username/password)'
    });
  }
  const credPath = path.join(__dirname, 'selenium_scripts', 'my_credentials.txt');
  const credContent = `username=${username}\npassword=${password}\n`;
  try {
    fs.writeFileSync(credPath, credContent);
    console.log('User credentials written to file:', credPath);
  } catch (error) {
    console.error('Error writing credentials file:', error);
    return res.status(500).json({
      success: false,
      selenium_result: `Error preparing credentials: ${error.message}`,
      error: error.message
    });
  }
  const reportPath = path.join(__dirname, 'selenium_scripts', 'my_report.txt');
  const { parseReportText } = require('./parse_report.js');
  console.log('Using parser to extract fields from text:', text_data);
  try {
    const parsedResult = parseReportText(text_data);
    const lines = parsedResult.split('\n');
    const nonEmptyLines = lines.filter(line => {
      const [key, value] = line.split('=');
      return value && value.trim() !== '';
    });
    const finalReportContent = nonEmptyLines.join('\n');
    console.log('Parsed fields:', finalReportContent);
    fs.writeFileSync(reportPath, finalReportContent);
    console.log('Parsed report data written to file:', reportPath);

    // --- GET USER_ID (EMPID) ---
    db.query(
      'SELECT EMPID FROM EMPLOY_REGISTRATION WHERE USERNAME = ? AND PASSWORD = ?',
      [username, password],
      (userErr, userResults) => {
        let user_id = null;
        if (!userErr && userResults.length > 0) {
          user_id = userResults[0].EMPID;
        }

        // --- ADD TO AUTOMATION TASK QUEUE ---
        const id = Date.now();
        automationTasks.push({
          id,
          reportData: finalReportContent,
          credentials: credContent,
          status: 'pending',
          user_id // store user_id with the task
        });
        console.log('Task added to automationTasks queue:', { id, user_id });

        res.json({
          success: true,
          selenium_result: 'Task queued for local automation',
          parsed_fields: finalReportContent,
          message: 'Text parsed and task queued for local automation',
          task_id: id // <-- add this line
        });
      }
    );
  } catch (error) {
    console.error('Error parsing text or writing report file:', error);
    res.status(500).json({
      success: false,
      selenium_result: `Error processing text: ${error.message}`,
      error: error.message
    });
  }
});

app.post('/add-task', (req, res) => {
  const { reportData, credentials, user_id } = req.body;
  const id = Date.now();
  automationTasks.push({ id, reportData, credentials, status: 'pending', user_id });
  res.json({ success: true, id });
});
app.get('/automation-tasks', (req, res) => {
  const pending = automationTasks.filter(t => t.status === 'pending');
  res.json({ tasks: pending });
});
app.post('/automation-tasks/complete', (req, res) => {
  const { id, result } = req.body;
  const task = automationTasks.find(t => t.id === id);
  if (task) {
    task.status = 'done';
    task.result = result;

    // Determine status and color
    let status = 'SUCCESS';
    if (typeof result === 'string' && result.toLowerCase().includes('could not click submit')) {
      status = 'FAILURE';
    }

    // Insert result into notifications table if user_id is available
    if (task.user_id) {
      const query = 'INSERT INTO MOB_NOTIFICATIONS (USER_ID, VOICE_FILE_URL, NOTI_TEXT, STATUS, CREATED_AT, SEEN, DELETED, NOTIFICATION_TYPE, NOTIFICATION_PRIORITY) VALUES (?, ?, ?, ?, NOW(), 0, 0, ?, ?)';
      db.query(query, [parseInt(task.user_id), '', result, status, 'SELENIUM_RESULT', 1], (err, dbResult) => {
        if (err) {
          console.error('Insert notification error:', err);
        }
      });
    }

    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Task not found' });
  }
});
app.get('/automation-tasks/result/:id', (req, res) => {
  const task = automationTasks.find(t => t.id == req.params.id);
  if (task && task.status === 'done') {
    res.json({ result: task.result });
  } else {
    res.status(404).json({ error: 'Result not ready' });
  }
});
// --- END: Automation Task Queue ---

// Notification endpoints
app.get('/notifications', (req, res) => {
  const { page = 1, limit = 10, user_id } = req.query;
  const offset = (page - 1) * limit;
  console.log('🔍 Fetching notifications with params:', { page, limit, user_id, offset });
  let query = 'SELECT * FROM MOB_NOTIFICATIONS WHERE DELETED = 0';
  let countQuery = 'SELECT COUNT(*) as total FROM MOB_NOTIFICATIONS WHERE DELETED = 0';
  let params = [];
  if (user_id) {
    query += ' AND USER_ID = ?';
    countQuery += ' AND USER_ID = ?';
    params.push(parseInt(user_id));
  }
  query += ' ORDER BY CREATED_AT DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  console.log('🔍 Final query:', query);
  console.log('🔍 Query params:', params);
  db.query(countQuery, user_id ? [parseInt(user_id)] : [], (countErr, countResults) => {
    if (countErr) {
      console.error('❌ Count query error:', countErr);
      return res.status(500).json({ error: 'Database error' });
    }
    const total = countResults[0].total;
    console.log('🔍 Total notifications found:', total);
    db.query(query, params, (err, results) => {
      if (err) {
        console.error('❌ Notifications query error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      console.log('🔍 Notifications returned:', results.length);
      console.log('🔍 First notification:', results[0]);
      res.json({
        notifications: results,
        total: total,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    });
  });
});

app.post('/notifications', (req, res) => {
  const { result_text, status, user_id, notification_type = 'SELENIUM_RESULT', notification_priority = 1 } = req.body;
  if (!result_text || !user_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const query = 'INSERT INTO MOB_NOTIFICATIONS (USER_ID, VOICE_FILE_URL, NOTI_TEXT, STATUS, CREATED_AT, SEEN, DELETED, NOTIFICATION_TYPE, NOTIFICATION_PRIORITY) VALUES (?, ?, ?, ?, NOW(), 0, 0, ?, ?)';
  db.query(query, [parseInt(user_id), '', result_text, status || 'SUCCESS', notification_type, notification_priority], (err, result) => {
    if (err) {
      console.error('Insert notification error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({
      success: true,
      id: result.insertId,
      message: 'Notification created successfully'
    });
  });
});

app.delete('/notification/:id', (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;
  let query = 'UPDATE MOB_NOTIFICATIONS SET DELETED = 1 WHERE ID = ?';
  let params = [parseInt(id)];
  if (user_id) {
    query += ' AND USER_ID = ?';
    params.push(parseInt(user_id));
  }
  db.query(query, params, (err, result) => {
    if (err) {
      console.error('Delete notification error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ success: true, message: 'Notification deleted successfully' });
  });
});

app.get('/', (req, res) => res.send('Hello World!'));
app.get('/test', (req, res) => res.json({ message: 'Server updated successfully!', timestamp: new Date().toISOString() }));
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}!`));