// Robust parser for converting transcripted text to my_report.txt format

const FIELD_SYNONYMS = {
  report_title: ["report title", "title", "report name", "name of report", "title of report"],
  report_description: ["report description", "description", "desc", "about report", "describe report"],
  category: ["category", "type of report", "report category"],
  tags: ["tags", "keywords", "labels"],
  additional_notes: ["additional notes", "notes", "note", "extra notes", "remarks"],
  created_date: ["created date", "date created", "date", "report date", "created on"],
  project_id: ["project id", "projectID", "project", "project code", "project number"],
  type: ["type", "type of report", "report type"],
  report_type: ["report type", "type of report", "kind of report"],
  task: ["task", "task name", "task title"],
  description: ["description", "desc", "details", "task description"],
  status: ["status", "current status", "report status"],
  time: ["time", "report time", "task time"],
  action_numbers: ["action numbers", "actions", "number of actions", "action count"],
  result_numbers: ["result numbers", "results", "number of results", "result count"],
  remarks: ["remarks", "comments", "feedback", "additional remarks"],
  task_type: ["task type", "type of task"],
  task_baseline: ["task baseline", "baseline"],
  start_time: ["start time", "begin time", "task start time", "started at"],
  end_time: ["end time", "finish time", "task end time", "ended at"],
  cr_id: ["cr id", "change request id", "cr number"],
  task_id: ["task id", "task number", "id of task"],
};

const FIELD_ORDER = [
  "report_title", "report_description", "category", "tags", "additional_notes", "created_date", "project_id", "type", "report_type", "task", "description", "status", "time", "action_numbers", "result_numbers", "remarks", "task_type", "task_baseline", "start_time", "end_time", "cr_id", "task_id"
];

function normalizeKey(key) {
  key = key.toLowerCase().replace(/[^a-z0-9_ ]/g, "").trim();
  for (const field in FIELD_SYNONYMS) {
    if (field === key) return field;
    for (const synonym of FIELD_SYNONYMS[field]) {
      if (key === synonym.toLowerCase()) return field;
    }
  }
  // Try partial match
  for (const field in FIELD_SYNONYMS) {
    if (key.includes(field.replace(/_/g, " "))) return field;
    for (const synonym of FIELD_SYNONYMS[field]) {
      if (key.includes(synonym.toLowerCase())) return field;
    }
  }
  return null;
}

function normalizeDate(dateStr) {
  // Try to match formats like '28 june 2025', '28th June 2025', etc.
  const dateRegex = /([0-9]{1,2})(?:st|nd|rd|th)?[\s/-]+([a-zA-Z]+)[\s/-]+([0-9]{4})/;
  const months = {
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };
  const match = dateStr.toLowerCase().match(dateRegex);
  if (match) {
    let day = match[1].padStart(2, '0');
    let month = months[match[2].toLowerCase()] || match[2];
    let year = match[3];
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

function normalizeValue(field, value) {
  value = value.trim();
  
  // Date normalization
  if (field === 'created_date') {
    return normalizeDate(value);
  }
  
  // Status normalization
  if (field === 'status') {
    return value.toLowerCase();
  }
  
  // Time normalization (ensure consistent format)
  if (field === 'time') {
    // Convert "10:00" to "10:00:00" if needed
    if (/^\d{1,2}:\d{2}$/.test(value)) {
      return value + ':00';
    }
    return value;
  }
  
  // Start time normalization (ensure consistent format)
  if (field === 'start_time') {
    // Convert "10:00" to "10:00:00" if needed
    if (/^\d{1,2}:\d{2}$/.test(value)) {
      return value + ':00';
    }
    return value;
  }
  
  // End time normalization (ensure consistent format)
  if (field === 'end_time') {
    // Convert "10:00" to "10:00:00" if needed
    if (/^\d{1,2}:\d{2}$/.test(value)) {
      return value + ':00';
    }
    return value;
  }
  
  // Project ID normalization (extract numeric part if needed)
  if (field === 'project_id') {
    // If it's like "828-myblock", extract "828"
    const match = value.match(/^(\d+)/);
    if (match) {
      return match[1];
    }
  }
  
  // Report type normalization
  if (field === 'report_type') {
    const typeMap = {
      'daily plan': 'Dailyplan',
      'daily report': 'Dailyreport',
      'action plan': 'Actionplan',
      'result': 'Result',
      'timesheet': 'Timesheet'
    };
    return typeMap[value.toLowerCase()] || value;
  }
  
  // Type normalization
  if (field === 'type') {
    const typeMap = {
      'project': 'Project',
      'ticket': 'Ticket',
      'changerequest': 'CR'
    };
    return typeMap[value.toLowerCase()] || value;
  }
  
  // Task type normalization
  if (field === 'task_type') {
    const typeMap = {
      'technical': 'Technical',
      'operations': 'Operations'
    };
    return typeMap[value.toLowerCase()] || value;
  }
  
  // Baseline normalization
  if (field === 'task_baseline') {
    const baselineMap = {
      'small': 'Small',
      'medium': 'Medium',
      'large': 'Large'
    };
    return baselineMap[value.toLowerCase()] || value;
  }
  
  // CR ID normalization (extract number from "CR12" format)
  if (field === 'cr_id') {
    const match = value.match(/^cr(\d+)$/i);
    if (match) {
      return match[1];
    }
  }
  
  return value;
}

function parseReportText(transcript) {
  const result = {};
  
  // Process the entire text as one unit first
  const fullText = transcript.toLowerCase();
  
  // Enhanced field patterns with better matching
  // Project ID pattern - more flexible
  const projectMatch = fullText.match(/(?:project\s+id|project)\s+(?:is\s+)?(\d+[-\w]*)/i);
  if (projectMatch) {
    result.project_id = normalizeValue('project_id', projectMatch[1]);
  }
  
  // Status pattern - more flexible
  const statusMatch = fullText.match(/(?:status)\s+(?:is\s+)?(complete|pending|in progress|incomplete)/i);
  if (statusMatch) {
    result.status = normalizeValue('status', statusMatch[1]);
  }
  
  // Time pattern - more flexible
  const timeMatch = fullText.match(/(?:time)\s+(?:is\s+)?(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (timeMatch) {
    result.time = normalizeValue('time', timeMatch[1]);
  }
  
  // Start time pattern - specific for start time
  const startTimeMatch = fullText.match(/(?:start\s+time|begin\s+time|started\s+at)\s+(?:is\s+)?(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (startTimeMatch) {
    result.start_time = normalizeValue('start_time', startTimeMatch[1]);
  }
  
  // End time pattern - specific for end time
  const endTimeMatch = fullText.match(/(?:end\s+time|finish\s+time|ended\s+at)\s+(?:is\s+)?(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (endTimeMatch) {
    result.end_time = normalizeValue('end_time', endTimeMatch[1]);
  }
  
  // Date pattern - more flexible
  const dateMatch = fullText.match(/(?:date|created\s+date)\s+(?:is\s+)?([0-9]{1,2}(?:st|nd|rd|th)?[\s/-]+[a-zA-Z]+[\s/-]+[0-9]{4})/i);
  if (dateMatch) {
    result.created_date = normalizeValue('created_date', dateMatch[1]);
  }
  
  // Report type pattern - more flexible
  const reportTypeMatch = fullText.match(/(?:report\s+type|type)\s+(?:is\s+)?(daily\s+plan|daily\s+report|action\s+plan|result|timesheet)/i);
  if (reportTypeMatch) {
    result.report_type = normalizeValue('report_type', reportTypeMatch[1]);
  }
  
  // Task type pattern - more flexible
  const taskTypeMatch = fullText.match(/(?:task\s+type|technical)\s+(?:is\s+)?(technical|operations)/i);
  if (taskTypeMatch) {
    result.task_type = normalizeValue('task_type', taskTypeMatch[1]);
  }
  
  // Numbers patterns - more flexible
  const numbersMatch = fullText.match(/(?:numbers|action\s+numbers)\s+(?:is\s+)?(\d+)/i);
  if (numbersMatch) {
    result.action_numbers = normalizeValue('action_numbers', numbersMatch[1]);
  }
  
  const resultNumbersMatch = fullText.match(/(?:different\s+numbers|result\s+numbers)\s+(?:is\s+)?(\d+)/i);
  if (resultNumbersMatch) {
    result.result_numbers = normalizeValue('result_numbers', resultNumbersMatch[1]);
  }
  
  // Report title pattern - improved
  const titleMatch = fullText.match(/(?:report\s+title|title)\s+(?:is\s+)?([^.]+?)(?:\s+(?:category|type|status|time|numbers|technical|different|created|date|project|report|task|action|result|baseline|start|end|cr|id))/i);
  if (titleMatch) {
    result.report_title = normalizeValue('report_title', titleMatch[1]);
  }
  
  // Category pattern - improved
  const categoryMatch = fullText.match(/(?:category)\s+(?:is\s+)?([^.]+?)(?:\s+(?:type|status|time|numbers|technical|different|created|date|project|report|task|action|result|baseline|start|end|cr|id))/i);
  if (categoryMatch) {
    result.category = normalizeValue('category', categoryMatch[1]);
  }
  
  // Type pattern (for project type) - improved
  const typeMatch = fullText.match(/(?:type)\s+(?:is\s+)?(project|ticket|changerequest)/i);
  if (typeMatch) {
    result.type = normalizeValue('type', typeMatch[1]);
  }
  
  // Technical pattern (for task type) - improved
  const technicalMatch = fullText.match(/(?:technical)\s+(?:is\s+)?(\d+)/i);
  if (technicalMatch) {
    result.task_type = normalizeValue('task_type', 'technical');
  }
  
  // Additional patterns for common fields
  // Description pattern
  const descMatch = fullText.match(/(?:description|desc)\s+(?:is\s+)?([^.]+?)(?:\s+(?:category|type|status|time|numbers|technical|different|created|date|project|report|task|action|result|baseline|start|end|cr|id))/i);
  if (descMatch) {
    result.description = normalizeValue('description', descMatch[1]);
  }
  
  // Task pattern
  const taskMatch = fullText.match(/(?:task)\s+(?:is\s+)?([^.]+?)(?:\s+(?:category|type|status|time|numbers|technical|different|created|date|project|report|task|action|result|baseline|start|end|cr|id))/i);
  if (taskMatch) {
    result.task = normalizeValue('task', taskMatch[1]);
  }
  
  // Remarks pattern
  const remarksMatch = fullText.match(/(?:remarks|comments)\s+(?:is\s+)?([^.]+?)(?:\s+(?:category|type|status|time|numbers|technical|different|created|date|project|report|task|action|result|baseline|start|end|cr|id))/i);
  if (remarksMatch) {
    result.remarks = normalizeValue('remarks', remarksMatch[1]);
  }
  
  // Now process line by line for other patterns
  const lines = transcript.split(/\n|\.|;/).map(l => l.trim()).filter(Boolean);
  
  for (let line of lines) {
    // Try field=value format
    let match = line.match(/^([a-zA-Z0-9 _-]+)[=:] ?(.+)$/);
    if (match) {
      const key = normalizeKey(match[1]);
      if (key && !result[key]) {
        result[key] = normalizeValue(key, match[2]);
        continue;
      }
    }
    
    // Try natural language patterns
    match = line.match(/^(the )?([a-zA-Z0-9 _-]+) (is|are|was|:) ?(.+)$/i);
    if (match) {
      const key = normalizeKey(match[2]);
      if (key && !result[key]) {
        result[key] = normalizeValue(key, match[4]);
        continue;
      }
    }
  }

  // Return only fields that have values
  const nonEmptyFields = [];
  for (const field of FIELD_ORDER) {
    if (result[field] && result[field].trim() !== '') {
      nonEmptyFields.push(`${field}=${result[field]}`);
    }
  }
  
  return nonEmptyFields.join('\n');
}

module.exports = { parseReportText }; 