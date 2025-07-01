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

    // --- ADD TO AUTOMATION TASK QUEUE ---
    const id = Date.now();
    automationTasks.push({
      id,
      reportData: finalReportContent,
      credentials: credContent,
      status: 'pending'
    });
    console.log('Task added to automationTasks queue:', { id });

    res.json({
      success: true,
      selenium_result: 'Task queued for local automation',
      parsed_fields: finalReportContent,
      message: 'Text parsed and task queued for local automation'
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