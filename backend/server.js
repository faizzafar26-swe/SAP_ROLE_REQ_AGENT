const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const LLM_API_ENDPOINT = process.env.LLM_API_ENDPOINT || process.env.LLM_ENDPOINT;
const LLM_API_VERSION = process.env.LLM_API_VERSION;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4';

// Middleware
app.use(cors());
app.use(express.json());

// Load data and config
let data;
let config;
let mockStore;
try {
  const dataPath = path.join(__dirname, 'data.json');
  data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log('Data loaded successfully');
  
  const configPath = path.join(__dirname, 'config.json');
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('Config loaded successfully');
  console.log('Available operations:', Object.keys(config.operations).join(', '));
  
  const mockStorePath = path.join(__dirname, 'mock_store.json');
  mockStore = JSON.parse(fs.readFileSync(mockStorePath, 'utf8'));
  console.log('Mock store loaded successfully');
} catch (error) {
  console.error('Error loading data or config:', error);
  process.exit(1);
}

const mockApprovers = {
  P1: { primary: 'Alex Johnson', backup: 'Morgan Reed' },
  D1: { primary: 'Mia Carter', backup: 'Jordan Brooks' },
  Q1: { primary: 'Samira Patel', backup: 'Casey Liu' }
};

function resolveMockApproverName(request) {
  if (!request) return 'Approval Pending';
  if (request.approver_name) return request.approver_name;
  if (request.approver_id && request.approver_id !== 'Approval Pending') return request.approver_id;
  const systemId = request.payload_summary?.system;
  return mockApprovers[systemId]?.primary || 'Approval Pending';
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Normalize system choice: converts user input (1, 2, 3, P1, D1, Q1, Production, etc.) to system ID
 */
function normalizeSystemChoice(choice) {
  if (!choice) return { error: 'System choice is required' };
  
  const input = choice.toString().trim().toUpperCase();
  
  // Map for numeric choices
  const numericMap = { '1': 'P1', '2': 'D1', '3': 'Q1' };
  if (numericMap[input]) {
    return { success: true, system_id: numericMap[input] };
  }
  
  // Check if it's a valid system ID
  const system = config.systems.find(s => s.id === input);
  if (system) {
    return { success: true, system_id: system.id };
  }
  
  // Check if it's a system name
  const systemByName = config.systems.find(s => s.name.toUpperCase() === input);
  if (systemByName) {
    return { success: true, system_id: systemByName.id };
  }
  
  return { error: `Invalid system choice. Valid options: 1 (P1), 2 (D1), 3 (Q1), or system names.` };
}

/**
 * Validate email format
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Normalize date to YYYY-MM-DD format
 */
function normalizeDate(dateInput) {
  if (!dateInput) {
    // Return today's date
    const today = new Date();
    return today.toISOString().split('T')[0];
  }
  
  const input = dateInput.toString().toLowerCase().trim();
  
  // Handle "today"
  if (input === 'today') {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }
  
  // Handle "tomorrow"
  if (input === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  // Handle YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }
  
  // Handle MM/DD/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(input)) {
    const [month, day, year] = input.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Handle DD-MM-YYYY format
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(input)) {
    const [day, month, year] = input.split('-');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Default: try to parse and return today's date if invalid
  try {
    const date = new Date(input);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {}
  
  return new Date().toISOString().split('T')[0];
}

/**
 * Populate XML template with values
 */
function populateTemplate(templatePath, values) {
  try {
    const fullPath = path.join(__dirname, templatePath);
    let template = fs.readFileSync(fullPath, 'utf8');
    
    // Replace all placeholders
    for (const [key, value] of Object.entries(values)) {
      const placeholder = `{${key}}`;
      if (template.includes(placeholder)) {
        template = template.replace(new RegExp(placeholder, 'g'), value || '');
      }
    }
    
    return { success: true, xml: template };
  } catch (error) {
    return { error: `Failed to populate template: ${error.message}` };
  }
}

/**
 * Load template content
 */
function loadTemplate(templatePath) {
  try {
    const fullPath = path.join(__dirname, templatePath);
    return fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    return null;
  }
}

const chatOperationChoices = {
  '1': 'user_status',
  '2': 'search-roles',
  '3': 'get-existing-access',
  '4': 'request-role'
};

function detectOperationFromText(text) {
  const lower = text.toLowerCase();
  if (!text) return null;

  const selectedOp = text.match(/\[SelectedOperation\s*=\s*([^\]]+)\]/i);
  if (selectedOp) {
    return selectedOp[1].trim();
  }

  const trimmed = text.trim();
  if (chatOperationChoices[trimmed]) {
    return chatOperationChoices[trimmed];
  }

  if (/(request status|check .*status|status of request|request status|req status)/i.test(text)) {
    return 'user_status';
  }
  if (/(search for roles|find roles|role search|search roles|search role|roles? related to|roles? for|roles? about|show.*roles|find.*roles)/i.test(text)) {
    return 'search-roles';
  }
  if (/(existing access|current access|user access|view your existing access|get existing access)/i.test(text)) {
    return 'get-existing-access';
  }
  if (/(request a role|request role|role request|request new role|request new role)/i.test(text)) {
    return 'request-role';
  }

  return null;
}

function extractReqNo(text) {
  const match = text.match(/(\d{10,})/i); // Match 10 or more digits
  return match ? match[1] : null;
}

function extractRoleName(text) {
  if (!text) return null;
  const upper = text.toUpperCase();
  const stopWords = new Set(['ROLE', 'ROLES', 'SEARCH', 'SEARCHES', 'USER', 'USERS', 'COPY', 'FROM', 'FOR', 'THE', 'MY', 'AND', 'OR', 'TO', 'A', 'AN', 'OF', 'PLEASE', 'WANT', 'WITH']);

  // First check if text contains an exact role name
  const roleMatch = data.roles.find(role => upper.includes(role.role_name.toUpperCase()));
  if (roleMatch) return roleMatch.role_name;

  // Extract potential role name patterns for search
  const match = text.match(/(?:role name|request role|role is|role|search.*for)\b\s*(?:is|=|:)?\s*([A-Z0-9_]{2,})/i);
  if (match && match[1]) {
    const candidate = match[1].toUpperCase();
    if (!stopWords.has(candidate) && !/^(P1|D1|Q1|PRODUCTION|DEVELOPMENT|QUALITY)$/i.test(candidate) && /^[A-Z0-9_]+$/.test(candidate)) {
      return candidate;
    }
  }

  // Also try to extract any word that looks like a role name (starts with Z or contains _)
  const words = text.toUpperCase().split(/\s+/);
  for (const word of words) {
    if (stopWords.has(word)) continue;
    if (/^(P1|D1|Q1|PRODUCTION|DEVELOPMENT|QUALITY)$/i.test(word)) continue;
    if (data.users.some(u => u.user_name.toUpperCase() === word)) continue;
    if (word.startsWith('Z') || word.includes('_')) {
      if (word.length >= 2) return word;
    }
  }

  return null;
}

function extractRoleSearchKeyword(text) {
  if (!text) return null;
  const upper = text.toUpperCase();
  const stopWords = new Set(['ROLE', 'ROLES', 'SEARCH', 'SEARCHES', 'USER', 'USERS', 'COPY', 'FROM', 'FOR', 'THE', 'MY', 'AND', 'OR', 'TO', 'A', 'AN', 'OF', 'PLEASE', 'WANT', 'WITH', 'RELATED', 'ABOUT', 'MATCHING']);

  // Search for explicit description keyword phrases and choose the last valid match.
  const phraseMatches = [...text.matchAll(/(?:related to|about|for|matching|with)\s+([A-Za-z0-9_ ]+?)(?=[?.!]|\s+show\s+me|\s+please|\s+can\s+you|\s+could\s+you|\s+would\s+you|$)/ig)];
  if (phraseMatches.length) {
    const keyword = phraseMatches[phraseMatches.length - 1][1].trim().replace(/[?.!]$/, '');
    if (keyword && !stopWords.has(keyword.toUpperCase()) && !/^(P1|D1|Q1|PRODUCTION|DEVELOPMENT|QUALITY)$/i.test(keyword)) {
      return keyword;
    }
  }

  // Search for a standalone multi-word keyword after 'related to' or 'about'.
  const directMatch = text.match(/(?:related to|about|for|matching|with)\s+([A-Za-z0-9_ ]+)/i);
  if (directMatch && directMatch[1]) {
    const keyword = directMatch[1].trim().replace(/[?.!]$/, '');
    if (keyword && !stopWords.has(keyword.toUpperCase()) && !/^(P1|D1|Q1|PRODUCTION|DEVELOPMENT|QUALITY)$/i.test(keyword)) {
      return keyword;
    }
  }

  // Fall back to single token extraction when no phrase is found.
  const tokens = upper.match(/\b[A-Z][A-Z0-9]+(?:\s+[A-Z][A-Z0-9]+)*\b/g);
  if (tokens) {
    for (const token of tokens) {
      const normalized = token.trim();
      if (!stopWords.has(normalized) && !/^(P1|D1|Q1|PRODUCTION|DEVELOPMENT|QUALITY)$/i.test(normalized)) {
        return normalized;
      }
    }
  }

  return null;
}

function extractTcode(text) {
  const match = text.match(/\b([A-Z]{2,5}\d{1,3})\b/i);
  return match ? match[1].toUpperCase() : null;
}

function extractUserId(text) {
  if (!text) return null;
  const upper = text.toUpperCase();
  const userMatch = data.users.find(user => upper.includes(user.user_name.toUpperCase()));
  if (userMatch) return userMatch.user_name;

  const match = text.match(/(?:user id|userid|user)\s*[:=\-]?\s*([A-Z0-9_]+)/i);
  return match ? match[1].toUpperCase() : null;
}

function extractCandidateUserId(text) {
  if (!text) return null;
  const trimmed = text.trim();
  if (/^[A-Z0-9_]{3,20}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  const match = text.match(/(?:username|user id|userid|user)\s*[:=\-]?\s*([A-Z0-9_]+)/i);
  return match ? match[1].toUpperCase() : null;
}

function extractRequestRoleSearchChoice(text) {
  if (!text) return null;
  if (/(?:^|\s)(1|one|option 1)(?:\s|$)/i.test(text) || /search roles by tcode|search by tcode|tcode/i.test(text)) {
    return 'tcode';
  }
  if (/(?:^|\s)(2|two|option 2)(?:\s|$)/i.test(text) || /search roles from other username|copy roles from|copy from user|other user|from another user/i.test(text)) {
    return 'user';
  }
  return null;
}

function extractRequestRoleMode(text) {
  if (!text) return null;
  const trimmed = text.trim().toLowerCase();
  if (/^(role|role name|have a role name|i have a role name|direct role)$/i.test(trimmed) || /(i have a role name|my role name is|role name is|role is|role to request)/i.test(text)) {
    return 'role';
  }
  if (/search roles|search role|find roles|search by|tcode|copy from user|copy roles from/i.test(text)) {
    return 'search';
  }
  return null;
}

function extractRequestCopyUser(text) {
  if (!text) return null;
  const match = text.match(/(?:copy roles from|copy from user|from another user|from user)\s*[:=\-]?\s*([A-Z0-9_]+)/i);
  return match ? match[1].toUpperCase() : null;
}

function extractRequestTargetUser(text) {
  if (!text) return null;
  const cleaned = text.replace(/(?:copy roles from|copy from user|from another user|from user)\s*[:=\-]?\s*[A-Z0-9_]+/ig, ' ');
  return extractUserId(cleaned);
}

function extractConfirmYes(text) {
  if (!text) return false;
  return /^(yes|y|sure|please do|go ahead|okay|ok|confirm)$/i.test(text.trim());
}

function extractSystem(text) {
  if (!text) return null;
  const match = text.match(/\b(P1|D1|Q1|Production|Development|Quality)\b/i);
  if (match) {
    const normalized = normalizeSystemChoice(match[1]);
    if (normalized.success) return normalized.system_id;
  }

  const normalized = normalizeSystemChoice(text);
  return normalized.success ? normalized.system_id : null;
}

function collectFieldValues(operation, messages) {
  const values = {};
  const combined = messages.join(' ');

  switch (operation) {
    case 'user_status':
      values.ReqNo = extractReqNo(combined);
      break;
    case 'search-roles':
      values.RoleName = extractRoleName(combined);
      values.Tcode = extractTcode(combined);
      values.CopyUser = extractUserId(combined);
      break;
    case 'get-existing-access':
      values.UserId = extractUserId(combined);
      values.System = extractSystem(combined);
      break;
    case 'request-role':
      values.Userid = extractUserId(combined);
      values.RoleName = extractRoleName(combined);
      values.SystemName = extractSystem(combined);
      values.RequestRoleMode = extractRequestRoleMode(combined);
      values.RequestRoleSearchChoice = extractRequestRoleSearchChoice(messages[messages.length - 1] || combined);
      // Don't set CopyUser here - it will be set in parseOperationFields based on context
      break;
  }

  return values;
}

function getNextMissingField(operation, values) {
  if (operation === 'search-roles') {
    if (!values.RoleName && !values.Tcode) return 'RoleName or Tcode';
    return null;
  }

  const fields = config.operations[operation]?.fields || [];
  for (const field of fields) {
    if (field.required && !values[field.name]) {
      return field.name;
    }
  }
  return null;
}

function buildPromptForMissingField(fieldName) {
  switch (fieldName) {
    case 'ReqNo':
      return 'Please provide the Request Number (ReqNo).';
    case 'RoleName':
      return 'What role name are you searching for?';
    case 'Tcode':
      return 'Please provide the transaction code (tcode).';
    case 'System':
    case 'SystemName':
      return 'Which system do you want to use? 1) P1 - Production, 2) D1 - Development, 3) Q1 - Quality.';
    case 'UserId':
    case 'Userid':
      return 'Please provide the User ID.';
    default:
      return `Please provide the value for ${fieldName}.`;
  }
}

/**
 * Search roles by role name (partial match)
 */
function searchRolesByName(roleName) {
  if (!roleName) return [];
  const upperName = roleName.toUpperCase();
  return data.roles.filter(role => 
    role.role_name.toUpperCase().includes(upperName) ||
    role.role_desc.toUpperCase().includes(upperName)
  );
}

/**
 * Search roles by tcode
 */
function searchRolesByTcode(tcode) {
  if (!tcode) return [];
  const upperTcode = tcode.toUpperCase();
  
  // Find tcode_id for the given tcode
  const tcodeObj = data.tcodes.find(tc => tc.tcode_code.toUpperCase() === upperTcode);
  if (!tcodeObj) return [];
  
  // Find all role_ids that have this tcode
  const roleIds = data.role_tcodes
    .filter(rt => rt.tcode_id === tcodeObj.tcode_id)
    .map(rt => rt.role_id);
  
  // Return the roles
  return data.roles.filter(role => roleIds.includes(role.role_id));
}

function executeConfiguredOperation(operation, values) {
  switch (operation) {
    case 'user_status':
      return app.handleUserStatus(values);
    case 'search-roles':
      return app.handleSearchRoles(values);
    case 'get-existing-access':
      return app.handleGetExistingAccess(values);
    case 'request-role':
      return app.handleRequestRole(values);
    default:
      return { success: false, message: 'Unknown operation.' };
  }
}

function getUserMessagesFromHistory(history) {
  return history.filter(item => item.role === 'user').map(item => item.content);
}

function buildOperationResponse(operation, result) {
  if (operation === 'search-roles') {
    if (result.success && result.roles) {
      if (result.count === 0) {
        if (result.copyUser) {
          return `No roles found for user ${result.copyUser}. Please check the username and try again.`;
        }
        return 'No roles found.';
      }
      const rolesText = result.roles.map(r => `${r.role_name}: ${r.role_desc}`).join('\n');
      if (result.copyUser) {
        return `Found ${result.count} role(s) assigned to user ${result.copyUser}:\n${rolesText}\n\nWould you like me to request these same roles for you?`;
      }
      return `Found ${result.count} role(s):\n` + rolesText;
    }
    return result.message || 'No roles found.';
  }
  if (operation === 'get-existing-access') {
    if (result.success) {
      return `User ${result.user} has ${result.role_count} role(s) in ${result.system}:\n` + result.roles.map(r => `${r.role_name}: ${r.role_desc}`).join('\n');
    }
    return result.message || 'Access not found.';
  }
  if (operation === 'user_status') {
    if (result.Reqstatus === 'NOT_FOUND') return result.message;
    if (result.Reqstatus === 'PENDING') return `Status: Pending\nPending with Stage: ${result.Reqcurrentstage}\nApprover: ${result.ApproverId}`;
    if (result.Reqstatus === 'OK') return 'Status: Approved.';
    if (result.Reqstatus === 'PARTIAL_OK') return 'Status: Partially approved.';
    if (result.Reqstatus === 'FAILED') return 'Status: Rejected.';
    if (result.Reqstatus === 'ABORTED') return 'Status: Cancelled.';
    return `Status: ${result.Reqstatus}`;
  }
  if (operation === 'request-role') {
    if (result.success) {
      return result.message;
    }
    return result.message || 'Request failed.';
  }
  return JSON.stringify(result);
}

function buildOperationPrompt(operation) {
  switch (operation) {
    case 'user_status':
      return 'Let’s check your request status. I need the request number.';
    case 'search-roles':
      return 'Let’s search for roles. Please provide role name or tcode.';
    case 'get-existing-access':
      return 'Let’s look up existing access. I need the system and user ID.';
    case 'request-role':
      return 'Let’s request a role. I need the user ID and system first, then I can help you either provide a role name or search roles by tcode or copy from another user.';
    default:
      return 'Please choose an operation.';
  }
}

function shouldUseLocalOperation(text, history) {
  const op = detectOperationFromText(text);
  if (op) return op;
  for (const message of history.reverse()) {
    const op2 = detectOperationFromText(message.content);
    if (op2) return op2;
  }
  return null;
}

function getLastAssistantMessage(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') return history[i].content;
  }
  return null;
}

function cleanText(text) {
  return text ? text.trim() : '';
}

function gatherOperationMessages(history, message) {
  const userMessages = getUserMessagesFromHistory(history);
  userMessages.push(message);
  return userMessages;
}

function resolveOperationFromHistory(history) {
  for (const item of history.slice().reverse()) {
    if (item.role === 'user') {
      const op = detectOperationFromText(item.content);
      if (op) return op;
    }
  }
  return null;
}

function extractOperationFromLastAssistant(history) {
  const lastAssistant = getLastAssistantMessage(history);
  if (!lastAssistant) return null;
  return detectOperationFromText(lastAssistant);
}

function createChatResponse(responseText, history, message) {
  const nextHistory = [...history, { role: 'user', content: message }, { role: 'assistant', content: responseText }];
  return { response: responseText, conversation_history: nextHistory };
}

function getLatestOperationFromMenuSelection(message) {
  const trimmed = message.trim();
  if (chatOperationChoices[trimmed]) return chatOperationChoices[trimmed];
  return null;
}

function getOperationDescription(operation) {
  if (!operation) return '';
  return operation.replace(/-/g, ' ');
}

function buildMainMenu() {
  return `Please select one of the following operations:
1) User status
2) Search roles
3) Get existing access
4) Request role
Reply with the number or operation name.`;
}

function isMenuResponse(text) {
  return /^(1|2|3|4)|user status|search roles|get existing access|request role/i.test(text.trim());
}

function joinConversationMessages(history) {
  return history.map(item => `${item.role}: ${item.content}`).join('\n');
}

function normalizeOperationName(candidate) {
  if (!candidate) return null;
  const lower = candidate.toLowerCase();
  if (lower.includes('user status')) return 'user_status';
  if (lower.includes('search')) return 'search-roles';
  if (lower.includes('existing access')) return 'get-existing-access';
  if (lower.includes('request role')) return 'request-role';
  return null;
}

function inferOperationFromAssistantPrompt(prompt) {
  if (!prompt) return null;
  const lower = prompt.toLowerCase();

  if (/request number|reqno|request status|status of request|check .*status|status for request/i.test(lower)) {
    return 'user_status';
  }
  if (/transaction code|tcode|which role name|found .*role|search roles|search role|%role name%|role should i request|role name should|which system should.*request.*role|which system.*request/i.test(lower)) {
    return 'request-role';
  }
  if (/existing access|current access|user access|system and user id|check.*access|which system should.*check/i.test(lower)) {
    return 'get-existing-access';
  }
  if (/search for roles|find roles|role name are you searching for|what role name/i.test(lower)) {
    return 'search-roles';
  }

  return null;
}

function parseOperationFromMessage(message, history = []) {
  const explicitOp = detectOperationFromText(message);
  const ongoingOp = resolveOperationFromHistory(history);
  const lastAssistant = getLastAssistantMessage(history);
  const assistantOp = inferOperationFromAssistantPrompt(lastAssistant);
  const lastAssistantMatch = lastAssistant && /role name|search roles|search role|copy|copy from user|from another user|tcode|system|p1|d1|q1/i.test(lastAssistant);
  const hasRequestRoleInHistory = history.some(item => item.role === 'user' && detectOperationFromText(item.content) === 'request-role');
  const isRequestRoleFollowUp = (ongoingOp === 'request-role' || (ongoingOp === 'search-roles' && hasRequestRoleInHistory)) && lastAssistant && lastAssistantMatch;

  console.log('parseOperationFromMessage debug:', {
    message,
    explicitOp,
    ongoingOp,
    assistantOp,
    lastAssistant,
    lastAssistantMatch,
    hasRequestRoleInHistory,
    isRequestRoleFollowUp
  });

  if (isRequestRoleFollowUp) {
    return 'request-role';
  }

  if (assistantOp && !explicitOp) {
    return assistantOp;
  }

  // Only treat numeric input as menu choice if we're NOT in a specific operation context
  if (isMenuResponse(message) && !assistantOp && !ongoingOp) {
    const choice = message.trim();
    if (chatOperationChoices[choice]) return chatOperationChoices[choice];
    const normalized = normalizeOperationName(message);
    if (normalized) return normalized;
  }

  return explicitOp || ongoingOp;
}

function getCandidatesFromHistory(history) {
  return history.filter(item => item.role === 'user').map(item => item.content);
}

function dedupeStrings(values) {
  return values.filter(Boolean).map(v => v.trim()).filter((v, i, arr) => arr.indexOf(v) === i);
}

function parseNumberInput(message) {
  const trimmed = message.trim();
  if (trimmed === '1' || trimmed.toLowerCase() === 'p1' || /production/i.test(trimmed)) return 'P1';
  if (trimmed === '2' || trimmed.toLowerCase() === 'd1' || /development/i.test(trimmed)) return 'D1';
  if (trimmed === '3' || trimmed.toLowerCase() === 'q1' || /quality/i.test(trimmed)) return 'Q1';
  return null;
}

function normaliseRoleName(roleName) {
  if (!roleName) return null;
  return roleName.toUpperCase();
}

function normaliseUserId(userId) {
  if (!userId) return null;
  return userId.toUpperCase();
}

function getNextReqNo() {
  const reqNos = Object.keys(mockStore.requests).map(n => parseInt(n, 10));
  const maxReqNo = reqNos.length > 0 ? Math.max(...reqNos) : 1001000999;
  return (maxReqNo + 1).toString();
}

function parseOperationFields(operation, historyMessages) {
  const combined = historyMessages.join(' ');
  const values = collectFieldValues(operation, historyMessages);
  if (operation === 'search-roles' && !values.RoleName && !values.Tcode && !values.CopyUser) {
    // prefer keywords from the latest user message to avoid unintended matches from earlier prompts
    const latestUserMessage = historyMessages[historyMessages.length - 1] || '';
    const keyword = extractRoleSearchKeyword(latestUserMessage) || extractRoleSearchKeyword(combined);
    console.log('DEBUG search-roles parse:', { latestUserMessage, combined, roleName: values.RoleName, tcode: values.Tcode, copyUser: values.CopyUser, keyword });
    values.RoleName = extractRoleName(latestUserMessage) || extractRoleName(combined) || keyword;
    values.Tcode = extractTcode(latestUserMessage) || extractTcode(combined);
    values.CopyUser = extractUserId(latestUserMessage) || extractUserId(combined);
  }
  if (operation === 'get-existing-access' && !values.System) {
    values.System = extractSystem(combined);
  }
  if (operation === 'request-role') {
    const lastMessage = historyMessages[historyMessages.length - 1] || '';
    const previousMessages = historyMessages.slice(0, -1).join(' ');

    if (!values.RequestRoleSearchChoice) values.RequestRoleSearchChoice = extractRequestRoleSearchChoice(combined);
    if (!values.RequestRoleMode) values.RequestRoleMode = extractRequestRoleMode(combined);
    if (!values.SystemName) values.SystemName = extractSystem(combined);
    if (!values.RoleName) values.RoleName = extractRoleName(combined);

    if (values.RequestRoleSearchChoice === 'user') {
      if (!values.CopyUser) values.CopyUser = extractRequestCopyUser(lastMessage) || extractUserId(lastMessage) || extractCandidateUserId(lastMessage);
      const targetUser = extractRequestTargetUser(previousMessages) || extractUserId(previousMessages);
      if (targetUser) values.Userid = targetUser;
      values.Tcode = null; // clear any previous tcode when copying from user
    } else {
      if (!values.CopyUser) values.CopyUser = extractRequestCopyUser(combined);
      if (!values.Userid) values.Userid = extractRequestTargetUser(combined) || extractUserId(combined);
      const newTcode = extractTcode(lastMessage) || extractTcode(previousMessages);
      if (newTcode) {
        values.Tcode = newTcode;
      }
    }

    if (!values.Tcode) values.Tcode = extractTcode(combined);
  }
  return values;
}

// ==================== INPUT VALIDATION FUNCTIONS ====================

/**
 * Validate system choice
 */
function validateSystemChoice(choice) {
  if (!choice) return { valid: false, message: 'Please select a system: 1) P1 - Production, 2) D1 - Development, or 3) Q1 - Quality.' };
  const result = normalizeSystemChoice(choice);
  if (result.error) {
    return { valid: false, message: `Invalid system choice. ${result.error}` };
  }
  return { valid: true, system_id: result.system_id };
}

/**
 * Validate user ID exists in system
 */
function validateUserId(userId) {
  if (!userId) return { valid: false, message: 'Please provide a valid User ID.' };
  const user = data.users.find(u => u.user_name.toUpperCase() === userId.toUpperCase());
  if (!user) {
    return { valid: false, message: `User "${userId}" not found in the system. Please check the username and try again.` };
  }
  return { valid: true, user };
}

/**
 * Validate role name exists
 */
function validateRoleName(roleName) {
  if (!roleName) return { valid: false, message: 'Please provide a valid role name.' };
  const role = data.roles.find(r => r.role_name.toUpperCase() === roleName.toUpperCase());
  if (!role) {
    return { valid: false, message: `Role "${roleName}" not found. Please provide a valid role name or search by tcode.` };
  }
  return { valid: true, role };
}

/**
 * Validate tcode format and existence
 */
function validateTcode(tcode) {
  if (!tcode) return { valid: false, message: 'Please provide a valid transaction code (tcode).' };
  const tcodeMatch = tcode.toString().trim().toUpperCase();
  if (!/^[A-Z]{2,5}\d{1,3}$/.test(tcodeMatch)) {
    return { valid: false, message: `Invalid tcode format: "${tcode}". Tcode should be 2-5 letters followed by 1-3 digits (e.g., SE24, MM01).` };
  }
  const tcodeObj = data.tcodes.find(tc => tc.tcode_code.toUpperCase() === tcodeMatch);
  if (!tcodeObj) {
    return { valid: false, message: `Tcode "${tcode}" not found in the system. Please provide a valid tcode.` };
  }
  return { valid: true, tcode: tcodeMatch };
}

/**
 * Validate request number format
 */
function validateReqNo(reqNo) {
  if (!reqNo) return { valid: false, message: 'Please provide a valid request number (ReqNo).' };
  const reqMatch = reqNo.toString().trim();
  if (!/^\d{10,}$/.test(reqMatch)) {
    return { valid: false, message: `Invalid request number format. Request number should be at least 10 digits (e.g., 1001000001).` };
  }
  return { valid: true, reqNo: reqMatch };
}

function isOperationReady(operation, values) {
  if (operation === 'search-roles') {
    return Boolean(values.RoleName || values.Tcode || values.CopyUser);
  }
  if (operation === 'user_status') {
    return Boolean(values.ReqNo);
  }
  if (operation === 'get-existing-access') {
    return Boolean(values.UserId && values.System);
  }
  if (operation === 'request-role') {
    return Boolean(values.Userid && values.RoleName && values.SystemName);
  }
  return false;
}

function promptForNextOperationField(operation, values) {
  if (operation === 'search-roles') {
    if (!values.RoleName && !values.Tcode && !values.CopyUser) return 'Please provide a role name, role description keyword (for example "EHSM" or "quality management"), or tcode to search for, or if you want to copy from another user provide the username.';
    
    // Validate provided values
    if (values.Tcode) {
      const tcodeValidation = validateTcode(values.Tcode);
      if (!tcodeValidation.valid) return tcodeValidation.message;
    }
    if (values.RoleName) {
      const roleValidation = validateRoleName(values.RoleName);
      if (!roleValidation.valid) return roleValidation.message;
    }
    if (values.CopyUser) {
      const userValidation = validateUserId(values.CopyUser);
      if (!userValidation.valid) return userValidation.message;
    }
    return null;
  }
  if (operation === 'user_status') {
    if (!values.ReqNo) return 'Please provide the request number (ReqNo).';
    const reqValidation = validateReqNo(values.ReqNo);
    if (!reqValidation.valid) return reqValidation.message;
  }
  if (operation === 'get-existing-access') {
    if (!values.System) return 'Which system should I check?\n1) P1 - Production,\n2) D1 - Development,\n3) Q1 - Quality.';
    const systemValidation = validateSystemChoice(values.System);
    if (!systemValidation.valid) return systemValidation.message;
    
    if (!values.UserId) return 'Please provide the User ID.';
    const userValidation = validateUserId(values.UserId);
    if (!userValidation.valid) return userValidation.message;
  }
  if (operation === 'request-role') {
    if (!values.SystemName) return 'Which system should I request the role in?\n1) P1 - Production,\n2) D1 - Development,\n3) Q1 - Quality.';
    const systemValidation = validateSystemChoice(values.SystemName);
    if (!systemValidation.valid) return systemValidation.message;
    
    if (!values.Userid) return 'Please provide the User ID.';
    const userValidation = validateUserId(values.Userid);
    if (!userValidation.valid) return userValidation.message;
    
    if (!values.RoleName) {
      if (!values.RequestRoleMode) {
        return 'Do you already have a role name, or would you like to search roles? Reply with\n"role name" or\n"search roles."';
      }
      if (values.RequestRoleMode === 'search') {
        if (!values.RequestRoleSearchChoice) {
          return 'Would you like to search roles by\n1) tcode or\n2) copy roles from another user?';
        }
        if (values.RequestRoleSearchChoice === 'tcode') {
          if (!values.Tcode) {
            return 'Please provide the transaction code (tcode) to search for roles.';
          }
          const tcodeValidation = validateTcode(values.Tcode);
          if (!tcodeValidation.valid) return tcodeValidation.message;
          
          const roles = searchRolesByTcode(values.Tcode);
          if (!roles.length) {
            return `No roles found for tcode ${values.Tcode}. Please try another tcode or provide the role name directly.`;
          }
          const roleLines = roles.map(r => `- ${r.role_name}`).join('\n');
          return `Found ${roles.length} role(s) for tcode ${values.Tcode}:\n${roleLines}\nWhich role name should I request for you?`;
        }
        if (values.RequestRoleSearchChoice === 'user') {
          if (!values.CopyUser) {
            return 'Please provide the username of the user whose roles you want to copy.';
          }
          const userValidation = validateUserId(values.CopyUser);
          if (!userValidation.valid) {
            return 'Please enter a valid user name.';
          }
          
          const roles = searchRolesOfUser(values.CopyUser);
          if (!roles.length) {
            return `No roles found for user ${values.CopyUser}. Please check the username or provide the role name directly.`;
          }
          const roleLines = roles.map(r => `- ${r.role_name}`).join('\n');
          return `Found ${roles.length} role(s) assigned to ${values.CopyUser}:\n${roleLines}\nWhich role name should I request for you?`;
        }
      }
      return 'Please provide the role name.';
    }
    
    // Validate role name if provided
    if (values.RoleName) {
      const roleValidation = validateRoleName(values.RoleName);
      if (!roleValidation.valid) return roleValidation.message;
    }
  }
  return null;
}

function buildOperationRunResponse(operation, values) {
  switch (operation) {
    case 'user_status':
      return buildOperationResponse('user_status', app.handleUserStatus(values));
    case 'search-roles':
      return buildOperationResponse('search-roles', app.handleSearchRoles(values));
    case 'get-existing-access':
      return buildOperationResponse('get-existing-access', app.handleGetExistingAccess(values));
    case 'request-role':
      return buildOperationResponse('request-role', app.handleRequestRole(values));
    default:
      return 'Unable to process that operation.';
  }
}

function getOperationPayload(operation, values) {
  switch (operation) {
    case 'user_status':
      return { ReqNo: values.ReqNo };
    case 'search-roles':
      return { RoleName: values.RoleName || '', Tcode: values.Tcode || '' };
    case 'get-existing-access':
      return { System: values.System, UserId: values.UserId };
    case 'request-role':
      return { Userid: values.Userid, RoleName: values.RoleName, SystemName: values.SystemName };
    default:
      return {};
  }
}

function searchRolesByName(roleName) {
  return data.roles.filter(r => r.role_name.toLowerCase().includes(roleName.toLowerCase()) || r.role_desc.toLowerCase().includes(roleName.toLowerCase()));
}

function searchRolesByTcode(tcode) {
  const normalizedTcode = tcode.toString().trim().toUpperCase();
  const matchingTcodes = data.tcodes.filter(tc => tc.tcode_code.toUpperCase() === normalizedTcode || tc.tcode_desc.toUpperCase().includes(normalizedTcode));
  const matchedRoleIds = new Set();

  matchingTcodes.forEach(tc => {
    data.role_tcodes.filter(rt => rt.tcode_id === tc.tcode_id).forEach(rt => matchedRoleIds.add(rt.role_id));
  });

  return data.roles.filter(role => matchedRoleIds.has(role.role_id));
}

function searchRolesOfUser(userId) {
  const user = data.users.find(u => u.user_name.toLowerCase() === userId.toLowerCase());
  if (!user) return [];
  
  const assignments = data.user_role_assignments.filter(a => a.user_id === user.user_id);
  return assignments.map(a => {
    const role = data.roles.find(r => r.role_id === a.role_id);
    return { ...role, assignment_id: a.user_role_assignment_id };
  });
}

// ==================== OPERATION-SPECIFIC FUNCTIONS ====================

/**
 * Get existing access for a user on a system
 */
function getExistingAccess(systemId, userId) {
  const user = data.users.find(u => u.user_name.toLowerCase() === userId.toLowerCase());
  if (!user) {
    return { found: false, message: `User ${userId} not found` };
  }
  
  const system = config.systems.find(s => s.id === systemId);
  if (!system) {
    return { found: false, message: `System ${systemId} not found` };
  }
  
  const assignments = data.user_role_assignments.filter(a => a.user_id === user.user_id);
  const roles = assignments.map(a => {
    const role = data.roles.find(r => r.role_id === a.role_id);
    return { role_name: role.role_name, role_desc: role.role_desc };
  });
  
  return {
    found: true,
    user: user.user_name,
    system: system.display,
    roles: roles,
    role_count: roles.length
  };
}

/**
 * Create a role request
 */
function createRoleRequest(userId, roleName, systemId) {
  const user = data.users.find(u => u.user_name.toLowerCase() === userId.toLowerCase());
  if (!user) {
    return { success: false, message: `User ${userId} not found` };
  }
  
  const role = data.roles.find(r => r.role_name.toLowerCase() === roleName.toLowerCase());
  if (!role) {
    return { success: false, message: `Role ${roleName} not found` };
  }
  
  const system = config.systems.find(s => s.id === systemId);
  if (!system) {
    return { success: false, message: `System ${systemId} not found` };
  }
  
  // Generate new request
  const reqNo = getNextReqNo();
  const requestId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  
  const newRequest = {
    approver_id: "Approval Pending",
    approver_name: mockApprovers[systemId]?.primary || 'Approval Pending',
    created_at: createdAt,
    payload_summary: {
      system: systemId,
      username: userId, // affected user
      Roles: [roleName],
      Userid: "USKEBOR" // requester, hardcoded for now
    },
    req_no: reqNo,
    request_id: requestId,
    stage: "Approval Pending",
    status: "PENDING"
  };
  
  mockStore.requests[reqNo] = newRequest;
  
  // Save mock_store
  fs.writeFileSync(path.join(__dirname, 'mock_store.json'), JSON.stringify(mockStore, null, 2));
  
  return {
    success: true,
    request_number: reqNo,
    message: `Role request submitted successfully. Your request number is ${reqNo}.`
  };
}

function checkRequestStatus(requestId) {
  // First check mock_store.requests
  let request = mockStore.requests[requestId];
  if (request) {
    return {
      Reqstatus: request.status,
      Reqcurrentstage: request.stage,
      ApproverId: resolveMockApproverName(request),
      ReqNo: request.req_no,
      message: 'Request status retrieved successfully'
    };
  }

  // Fallback to data.user_requests
  request = data.user_requests.find(r => r.req_no === requestId || r.request_id == requestId);
  if (!request) return null;

  const roles = data.request_roles.filter(rr => rr.request_id === request.request_id).map(rr => {
    const role = data.roles.find(r => r.role_id === rr.role_id);
    return { ...role, valid_from: rr.valid_from, valid_to: rr.valid_to, status: rr.request_status };
  });

  return {
    Reqstatus: request.status || 'PENDING',
    Reqcurrentstage: request.current_stage || 'SUBMITTED',
    ApproverId: request.approver_name || request.approver_id || 'System',
    ReqNo: request.req_no,
    message: 'Request status retrieved successfully',
    roles
  };
}

function analyzeSu53Screenshot(imageData) {
  // Placeholder for image analysis
  return { message: "Screenshot analysis not implemented yet. Please describe the roles you need." };
}

function inferToolFromMessage(text) {
  const lower = text.toLowerCase();
  const tcodeMatch = text.match(/\b([A-Z]{2,5}\d{1,3})\b/i);
  if (lower.includes('tcode') || lower.includes('transaction code')) {
    if (tcodeMatch) {
      return { name: 'searchRolesByTcode', parameters: { tcode: tcodeMatch[1].toUpperCase() } };
    }
  }

  if (lower.includes('role name') || lower.includes('search role') || lower.includes('find role')) {
    const roleMatch = text.match(/(?:role name|search role|find role|role)\s*(?:for|named)?\s*([\w_\-\s]+)/i);
    if (roleMatch) {
      return { name: 'searchRolesByName', parameters: { roleName: roleMatch[1].trim() } };
    }
  }

  if (lower.includes('user roles') || lower.includes('roles of user') || lower.includes('user has roles')) {
    const userMatch = text.match(/user\s+([\w_-]+)/i);
    if (userMatch) {
      return { name: 'searchRolesOfUser', parameters: { userId: userMatch[1] } };
    }
  }

  if (lower.includes('request status') || lower.includes('status of request') || lower.includes('request status')) {
    const reqMatch = text.match(/request\s+([\w_-]+)/i);
    if (reqMatch) {
      return { name: 'checkRequestStatus', parameters: { requestId: reqMatch[1] } };
    }
  }

  return null;
}

// Function to call LLM endpoint with tool calling (OpenAI-compatible format)
async function callLLMWithTools(systemPrompt, tools, messages) {
  try {
    const openaiFunctions = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));

    const endpointUrl = LLM_API_VERSION
      ? `${LLM_API_ENDPOINT}${LLM_API_ENDPOINT.includes('?') ? '&' : '?'}api-version=${encodeURIComponent(LLM_API_VERSION)}`
      : LLM_API_ENDPOINT;

    const response = await axios.post(endpointUrl, {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      tools: openaiFunctions.map(f => ({ type: 'function', function: f })),
      tool_choice: 'auto'
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.LLM_API_KEY}`,
        'api-key': process.env.LLM_API_KEY,
        'x-api-key': process.env.LLM_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const choice = response.data.choices?.[0];
    if (!choice || !choice.message) {
      console.error('LLM response missing choice/message:', response.data);
      return { response: 'Sorry, the LLM returned an unexpected response.' };
    }

    const message = choice.message;
    const toolCalls = [];

    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        if (tc.function) {
          try {
            toolCalls.push({
              name: tc.function.name,
              parameters: JSON.parse(tc.function.arguments || '{}')
            });
          } catch (parseError) {
            console.error('Failed to parse tool_call function arguments:', parseError, tc.function.arguments);
          }
        }
      }
    }

    // Fallback for older function_call
    if (message.function_call) {
      try {
        toolCalls.push({
          name: message.function_call.name,
          parameters: JSON.parse(message.function_call.arguments || '{}')
        });
      } catch (parseError) {
        console.error('Failed to parse function_call arguments:', parseError, message.function_call.arguments);
      }
    }

    if (toolCalls.length > 0) {
      return { tool_calls: toolCalls };
    }

    return {
      response: message.content || 'Sorry, I could not process your request at the moment.'
    };
  } catch (error) {
    console.error('LLM call error:', error.response?.data || error.message || error);
    return { response: 'Sorry, I could not process your request at the moment.' };
  }
}

// Define available tools for LLM
const availableTools = [
  {
    name: 'user_status',
    description: 'Check the status of a role request by request number',
    parameters: {
      type: 'object',
      properties: {
        ReqNo: {
          type: 'string',
          description: 'The request number (e.g., REQ1234567890)'
        }
      },
      required: ['ReqNo']
    }
  },
  {
    name: 'search_roles',
    description: 'Search for SAP roles by role name, transaction code (tcode), or keyword in role description',
    parameters: {
      type: 'object',
      properties: {
        RoleName: {
          type: 'string',
          description: 'The role name to search for'
        },
        Tcode: {
          type: 'string',
          description: 'The transaction code to search for'
        }
      }
    }
  },
  {
    name: 'get_existing_access',
    description: 'Get existing access (roles) for a user in a specific system',
    parameters: {
      type: 'object',
      properties: {
        System: {
          type: 'string',
          description: 'The system ID (P1, D1, Q1)'
        },
        UserId: {
          type: 'string',
          description: 'The user ID'
        }
      },
      required: ['System', 'UserId']
    }
  },
  {
    name: 'request_role',
    description: 'Request a new role for a user in a system',
    parameters: {
      type: 'object',
      properties: {
        Userid: {
          type: 'string',
          description: 'The user ID'
        },
        RoleName: {
          type: 'string',
          description: 'The role name to request'
        },
        SystemName: {
          type: 'string',
          description: 'The system ID (P1, D1, Q1)'
        }
      },
      required: ['Userid', 'RoleName', 'SystemName']
    }
  }
];

// Execute tool calls
function executeTool(toolName, parameters) {
  switch (toolName) {
    case 'user_status':
      return executeConfiguredOperation('user_status', parameters);
    case 'search_roles':
      return executeConfiguredOperation('search-roles', parameters);
    case 'get_existing_access':
      return executeConfiguredOperation('get-existing-access', parameters);
    case 'request_role':
      return executeConfiguredOperation('request-role', parameters);
    default:
      return { result: 'Unknown tool called.', data: null };
  }
}

// Chat endpoint with LLM conversation and local operation execution
app.post('/chat', async (req, res) => {
  const { message, conversation_history = [] } = req.body;

  if (!message || !message.toString().trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Build conversation for LLM
    const conversationMessages = conversation_history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    conversationMessages.push({ role: 'user', content: message });

    let assistantResponse = '';

    // First, try to detect operation from current message
    let operation = parseOperationFromMessage(message, conversationMessages.slice(0, -1));
    
    // If no operation in current message, check if we're continuing an operation from history
    if (!operation) {
      for (let i = conversationMessages.length - 2; i >= 0; i--) {
        if (conversationMessages[i].role === 'user') {
          operation = parseOperationFromMessage(conversationMessages[i].content, conversationMessages.slice(0, i));
          if (operation) break;
        }
      }
    }

    console.log('Message:', message, 'Operation detected:', operation);
    if (operation) {
      const fieldMessages = getCandidatesFromHistory(conversationMessages);
      const values = parseOperationFields(operation, fieldMessages);
      if (isOperationReady(operation, values)) {
        // Execute the operation
        const result = executeOperation(operation, values);
        const operationResult = buildOperationResponse(operation, result);
        assistantResponse = `Got it! ${operationResult}`;
      } else {
        // Prompt for missing fields
        const prompt = promptForNextOperationField(operation, values);
        assistantResponse = prompt || `Please provide the required information for ${operation.replace(/-/g, ' ')}.`;
      }
    } else {
      // Call LLM for conversational response
      const systemPrompt = `You are an SAP Webservice Automation Assistant.
You help with SAP operations: user_status, search_roles, get_existing_access, request_role.
Respond conversationally. If the user provides operation details, acknowledge and let the system handle the execution.
Keep responses short and friendly.`;

      const llmResult = await callLLMWithTools(systemPrompt, [], conversationMessages);
      assistantResponse = llmResult.response || 'I could not process your request.';
    }

    // Return response with conversation history update
    res.json({
      response: assistantResponse,
      conversation_history: [
        ...conversationMessages,
        { role: 'assistant', content: assistantResponse }
      ]
    });

  } catch (error) {
    console.error('Chat processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function executeOperation(operation, values) {
  switch (operation) {
    case 'user_status': {
      const status = checkRequestStatus(values.ReqNo);
      return status || { Reqstatus: 'NOT_FOUND', message: `Request ${values.ReqNo} not found` };
    }
    case 'search-roles': {
      if (values.CopyUser) {
        const roles = searchRolesOfUser(values.CopyUser);
        return {
          success: true,
          count: roles.length,
          roles,
          copyUser: values.CopyUser
        };
      }

      const roleSet = new Map();
      if (values.RoleName) {
        searchRolesByName(values.RoleName).forEach(role => roleSet.set(role.role_id, role));
      }
      if (values.Tcode) {
        searchRolesByTcode(values.Tcode).forEach(role => roleSet.set(role.role_id, role));
      }
      const roles = Array.from(roleSet.values());
      return {
        success: true,
        count: roles.length,
        roles
      };
    }
    case 'get-existing-access': {
      const result = getExistingAccess(values.System, values.UserId);
      if (!result.found) {
        return { success: false, message: result.message };
      }
      return { success: true, ...result };
    }
    case 'request-role': {
      return createRoleRequest(values.Userid, values.RoleName, values.SystemName);
    }
    default:
      return { success: false, message: `Unknown operation: ${operation}` };
  }
}

// Test endpoint for tool calling (bypasses LLM)
app.post('/test-tool', (req, res) => {
  const { toolName, parameters } = req.body;

  if (!toolName) {
    return res.status(400).json({ error: 'toolName is required' });
  }

  try {
    const result = executeTool(toolName, parameters);
    res.json({ result: result.result, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CONFIGURATION-DRIVEN OPERATION ENDPOINTS ====================

/**
 * Check request status
 */
app.post('/user-status', (req, res) => {
  const { ReqNo } = req.body;
  
  if (!ReqNo) {
    return res.status(400).json({ error: 'ReqNo is required' });
  }
  
  try {
    // First check mock_store.requests
    let request = mockStore.requests[ReqNo];
    
    if (!request) {
      // Fallback to data.user_requests
      request = data.user_requests.find(r => r.req_no === ReqNo || r.request_id == ReqNo);
    }
    
    if (!request) {
      return res.json({
        Reqstatus: 'NOT_FOUND',
        Reqcurrentstage: '',
        ApproverId: '',
        message: `Request ${ReqNo} not found`
      });
    }
    
    return res.json({
      Reqstatus: request.status || 'PENDING',
      Reqcurrentstage: request.stage || request.current_stage || 'SUBMITTED',
      ApproverId: request.approver_id || 'System',
      ReqNo: request.req_no,
      message: `Request status retrieved successfully`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Search roles by name or tcode
 */
app.post('/search-roles', (req, res) => {
  const { RoleName, Tcode } = req.body;
  
  try {
    let results = [];
    
    if (RoleName) {
      const rolesByName = searchRolesByName(RoleName);
      results = [...rolesByName];
    }
    
    if (Tcode) {
      const rolesByTcode = searchRolesByTcode(Tcode);
      // Merge and deduplicate
      results = [...new Map([...results, ...rolesByTcode].map(r => [r.role_id, r])).values()];
    }
    
    return res.json({
      success: true,
      count: results.length,
      roles: results.map(r => ({
        role_id: r.role_id,
        role_name: r.role_name,
        role_desc: r.role_desc
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get existing access for a user on a system
 */
app.post('/get-existing-access', (req, res) => {
  const { System, UserId } = req.body;
  
  if (!System || !UserId) {
    return res.status(400).json({ error: 'System and UserId are required' });
  }
  
  try {
    const result = getExistingAccess(System, UserId);
    
    if (!result.found) {
      return res.json({ success: false, message: result.message });
    }
    
    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Request a role for a user
 */
app.post('/request-role', (req, res) => {
  const { Userid, RoleName, SystemName } = req.body;
  
  if (!Userid || !RoleName || !SystemName) {
    return res.status(400).json({ error: 'Userid, RoleName, and SystemName are required' });
  }
  
  try {
    const result = createRoleRequest(Userid, RoleName, SystemName);
    return res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== HELPER TOOLS FOR SYSTEM PROMPT ====================

/**
 * Tool endpoint: normalize system choice
 */
app.post('/tools/normalize-system-choice', (req, res) => {
  const { choice } = req.body;
  const result = normalizeSystemChoice(choice);
  res.json(result);
});

/**
 * Tool endpoint: validate email
 */
app.post('/tools/validate-email', (req, res) => {
  const { email } = req.body;
  const isValid = validateEmail(email);
  res.json({ valid: isValid, email: email });
});

/**
 * Tool endpoint: normalize date
 */
app.post('/tools/normalize-date', (req, res) => {
  const { date_input } = req.body;
  const normalized = normalizeDate(date_input);
  res.json({ normalized_date: normalized });
});

/**
 * Tool endpoint: populate template
 */
app.post('/tools/populate-template', (req, res) => {
  const { template_path, values } = req.body;
  const result = populateTemplate(template_path, values);
  res.json(result);
});

// ==================== CONFIGURATION AND HELP ENDPOINTS ====================

/**
 * Get available operations from config
 */
app.get('/config/operations', (req, res) => {
  try {
    const operations = Object.keys(config.operations).map(opKey => ({
      operation_id: opKey,
      description: opKey.replace(/-/g, ' ').toUpperCase(),
      fields: config.operations[opKey].fields
    }));
    
    res.json({ operations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get system choices
 */
app.get('/config/systems', (req, res) => {
  try {
    res.json({ systems: config.systems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', dataLoaded: !!data });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});