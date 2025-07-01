const express = require('express');
const app = express();
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const fs = require('fs');
const { exec } = require('child_process');
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
    // Keep original extension for now, we'll convert later
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname || '.m4a'));
  }
});

const upload = multer({ storage: storage });

// Setup MySQL connection
const db = mysql.createConnection({
  host: '88.150.227.117',
  user: 'nrktrn_web_admin',
  password: 'GOeg&*$*657',
  port: '3306',
  database: 'nrkindex_trn',
  auth_plugin: 'mysql_native_password',
  connect_timeout: 300,
});
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL database.');
  }
});

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
    
    // Convert to WAV if needed (transcribe.py only supports WAV)
    if (!audioPath.toLowerCase().endsWith('.wav')) {
      console.log('Converting audio to WAV format...');
      console.log('Input file:', audioPath);
      console.log('Output file:', wavPath);
      console.log('FFmpeg path:', ffmpeg);
      
      exec(`"${ffmpeg}" -i "${audioPath}" "${wavPath}" -y`, (convertErr) => {
        if (convertErr) {
          console.error('FFmpeg conversion error:', convertErr);
          return res.status(500).json({ 
            error: 'Audio conversion failed: ' + convertErr.message,
            duration: 0
          });
        }
        
        console.log('Conversion successful, now transcribing WAV file');
        transcribeAudio(wavPath, res);
      });
    } else {
      // Already WAV, transcribe directly
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
  
  exec(`python "${transcribeScript}" "${audioPath}"`, (err, stdout, stderr) => {
    console.log('Transcription stdout:', stdout);
    console.log('Transcription stderr:', stderr);
    console.log('Transcription error:', err);
    
    if (err) {
      console.error('Transcription error:', err);
      return res.status(500).json({ 
        error: 'Transcription failed: ' + err.message,
        duration: 0
      });
    }
    
    // Extract JSON from the output (the script outputs both logs and JSON)
    let result;
    try {
      // Find the JSON part in the output
      const jsonMatch = stdout.match(/\{[^}]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON found, create a basic result
        result = {
          transcription: stdout.trim().replace(/\n/g, ' '),
          duration: 0,
          error: 'No transcription result'
        };
      }
    } catch (parseError) {
      console.log('Could not parse JSON, treating as plain text');
      // Clean up the output for display
      const cleanText = stdout.trim().replace(/\n/g, ' ').replace(/Audio Duration:.*?seconds/, '').trim();
      result = {
        transcription: cleanText || 'Transcription failed',
        duration: 0,
        error: null
      };
    }
    
    console.log('Final result:', result);
    
    res.json({
      success: true,
      transcription: result.transcription || '',
      duration: result.duration || 0,
      error: result.error || null
    });
  });
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

// Insert endpoint (original working endpoint)
app.post('/insert', (req, res) => {
  const { text_data, target_agent, target_column, username, password } = req.body;
  
  console.log('Received insert request:', { text_data, target_agent, target_column, username: username ? '***' : 'missing' });
  
  // Check if we have the required data to trigger Selenium
  if (!text_data || !target_agent) {
    return res.status(400).json({
      success: false,
      error: 'Missing text_data or target_agent'
    });
  }
  
  // Check if we have user credentials
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Missing user credentials (username/password)'
    });
  }
  
  // Write the user credentials to my_credentials.txt for the Selenium script to use
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
  
  // Write the transcribed text to my_report.txt for the Selenium script to use
  const reportPath = path.join(__dirname, 'selenium_scripts', 'my_report.txt');
  
  // Use the parser to extract fields from the transcribed text
  const { parseReportText } = require('./parse_report.js');
  console.log('Using parser to extract fields from text:', text_data);
  
  try {
    // Parse the text to extract only mentioned fields
    const parsedResult = parseReportText(text_data);
    
    // Only keep fields that have actual values (not empty)
    const lines = parsedResult.split('\n');
    const nonEmptyLines = lines.filter(line => {
      const [key, value] = line.split('=');
      return value && value.trim() !== '';
    });
    
    const finalReportContent = nonEmptyLines.join('\n');
    console.log('Parsed fields:', finalReportContent);
    
    fs.writeFileSync(reportPath, finalReportContent);
    console.log('Parsed report data written to file:', reportPath);
    
    // Trigger the Selenium script
    const seleniumScriptPath = path.join(__dirname, 'selenium_scripts', 'menu_add_report.py');
    console.log('Executing Selenium script:', seleniumScriptPath);
    
    exec(`python "${seleniumScriptPath}"`, (err, stdout, stderr) => {
      console.log('Selenium stdout:', stdout);
      console.log('Selenium stderr:', stderr);
      
      if (err) {
        console.error('Selenium script error:', err);
        
        // Save error as notification
        const errorResult = `Error executing Selenium script: ${err.message}`;
        const errorStatus = 'FAILURE';
        
        // Get user's EMPID from database
        db.query(
          'SELECT EMPID FROM EMPLOY_REGISTRATION WHERE USERNAME = ? AND PASSWORD = ?',
          [username, password],
          (userErr, userResults) => {
            if (userErr) {
              console.error('Error getting user EMPID:', userErr);
            } else if (userResults.length > 0) {
              const userEmpId = userResults[0].EMPID;
              
              // Save to MOB_NOTIFICATIONS table
              db.query(
                'INSERT INTO MOB_NOTIFICATIONS (USER_ID, VOICE_FILE_URL, NOTI_TEXT, STATUS, CREATED_AT, SEEN, DELETED, NOTIFICATION_TYPE, NOTIFICATION_PRIORITY) VALUES (?, ?, ?, ?, NOW(), 0, 0, ?, ?)',
                [userEmpId, '', errorResult, errorStatus, 'SELENIUM_RESULT', 1],
                (dbErr) => {
                  if (dbErr) console.error('Error saving notification:', dbErr);
                }
              );
            }
          }
        );
        
        return res.status(500).json({
          success: false,
          selenium_result: errorResult,
          error: stderr || err.message
        });
      }
      
      // Determine status based on Selenium output
      const isSuccess = stdout.toLowerCase().includes('clicked submit button') || 
                       stdout.toLowerCase().includes('success') ||
                       !stdout.toLowerCase().includes('could not');
      const status = isSuccess ? 'SUCCESS' : 'FAILURE';
      
      // Create notification text
      const notificationText = `🔍 PARSED FIELDS:\n${finalReportContent}\n\n🤖 SELENIUM RESULT:\n${stdout}`;
      
      console.log('🔍 Attempting to save notification for user:', username);
      
      // Get user's EMPID and save notification to database
      db.query(
        'SELECT EMPID FROM EMPLOY_REGISTRATION WHERE USERNAME = ? AND PASSWORD = ?',
        [username, password],
        (userErr, userResults) => {
          if (userErr) {
            console.error('❌ Error getting user EMPID:', userErr);
          } else if (userResults.length > 0) {
            const userEmpId = userResults[0].EMPID;
            console.log('✅ Found user EMPID:', userEmpId);
            
            // Save to MOB_NOTIFICATIONS table
            db.query(
              'INSERT INTO MOB_NOTIFICATIONS (USER_ID, VOICE_FILE_URL, NOTI_TEXT, STATUS, CREATED_AT, SEEN, DELETED, NOTIFICATION_TYPE, NOTIFICATION_PRIORITY) VALUES (?, ?, ?, ?, NOW(), 0, 0, ?, ?)',
              [userEmpId, '', notificationText, status, 'SELENIUM_RESULT', 1],
              (dbErr, dbResult) => {
                if (dbErr) {
                  console.error('❌ Error saving notification:', dbErr);
                  console.error('❌ Error details:', dbErr.message);
                } else {
                  console.log('✅ Notification saved successfully with ID:', dbResult.insertId);
                }
              }
            );
          } else {
            console.error('❌ No user found with username:', username);
          }
        }
      );
      
      // Return success with the parsed fields and Selenium output
      res.json({
        success: true,
        selenium_result: notificationText,
        parsed_fields: finalReportContent,
        message: 'Text parsed and Selenium script executed'
      });
    });
  } catch (error) {
    console.error('Error parsing text or writing report file:', error);
    res.status(500).json({
      success: false,
      selenium_result: `Error processing text: ${error.message}`,
      error: error.message
    });
  }
});

// Trigger Selenium and write credentials
app.post('/trigger-selenium', (req, res) => {
  const { username, password } = req.body;
  const credPath = path.join(__dirname, 'selenium_scripts', 'my_credentials.txt');
  // Write credentials to file
  fs.writeFileSync(
    credPath,
    `username=${username}\npassword=${password}\n`
  );
  // Call the Selenium script
  exec('python selenium_scripts/menu_add_report.py', (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: stderr });
    res.json({ success: true, output: stdout });
  });
});

// Notification endpoints
app.get('/notifications', (req, res) => {
  const { page = 1, limit = 10, user_id } = req.query;
  const offset = (page - 1) * limit;
  
  console.log('🔍 Fetching notifications with params:', { page, limit, user_id, offset });
  
  // Build query with user filter if user_id provided
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
  
  // Get total count
  db.query(countQuery, user_id ? [parseInt(user_id)] : [], (countErr, countResults) => {
    if (countErr) {
      console.error('❌ Count query error:', countErr);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const total = countResults[0].total;
    console.log('🔍 Total notifications found:', total);
    
    // Get notifications
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
  const { user_id } = req.query; // Optional: ensure user can only delete their own notifications
  
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
//app.listen(5000, '0.0.0.0', () => console.log('Server running!'));
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}!`));