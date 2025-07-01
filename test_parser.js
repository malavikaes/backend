const { parseReportText } = require('./parse_report.js');

// Test cases
const testCases = [
  {
    name: "Date and status normalization",
    text: "created date is 28 june 2025 status is complete",
    expected: ["created_date", "status"]
  },
  {
    name: "Project ID and time",
    text: "project id is 828-myblock time is 10:00 am",
    expected: ["project_id", "time"]
  },
  {
    name: "Report type and task type",
    text: "report type is daily plan task type is technical",
    expected: ["report_type", "task_type"]
  },
  {
    name: "Mixed format with normalization",
    text: "description: This is a test report. status=complete. task_type=technical",
    expected: ["description", "status", "task_type"]
  },
  {
    name: "Natural language with numbers",
    text: "numbers is 20 different numbers is 19 technical is 17",
    expected: ["action_numbers", "result_numbers", "task_type"]
  },
  {
    name: "Complex sentence with multiple fields",
    text: "report title is best report category is general created date is 28 June 2025 type is project report type is daily plan status is complete time 10:00",
    expected: ["report_title", "category", "created_date", "type", "report_type", "status", "time"]
  }
];

console.log("🧪 Testing Improved Parser...\n");

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`Input: "${testCase.text}"`);
  
  const result = parseReportText(testCase.text);
  console.log(`Output:\n${result}`);
  
  // Check which fields were extracted
  const extractedFields = result.split('\n')
    .filter(line => line.includes('='))
    .map(line => line.split('=')[0])
    .filter(field => field.trim() !== '');
  
  console.log(`Extracted fields: ${extractedFields.join(', ')}`);
  console.log(`Expected fields: ${testCase.expected.join(', ')}`);
  
  const success = testCase.expected.every(field => extractedFields.includes(field));
  console.log(`✅ ${success ? 'PASS' : 'FAIL'}\n`);
});

// Test with your actual transcribed text
const actualText = "report title is best report category is generally created date is 28 June 2025 type is project report type is daily plan status is complete time 10:00 numbers is 20 different numbers is 19 technical is 17";

console.log("🎯 Testing with your actual transcribed text:");
console.log(`Input: "${actualText}"`);

const actualResult = parseReportText(actualText);
console.log(`Output:\n${actualResult}`);

const actualExtractedFields = actualResult.split('\n')
  .filter(line => line.includes('='))
  .map(line => line.split('=')[0])
  .filter(field => field.trim() !== '');

console.log(`Extracted fields: ${actualExtractedFields.join(', ')}`);
console.log("✅ Test complete!"); 