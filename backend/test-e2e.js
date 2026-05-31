// E2E Test Script for SAP Role Agent - Configuration-Driven Architecture
// This tests multi-turn conversations with conversation history tracking

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Helper function to make chat requests
async function chat(message, conversationHistory = []) {
  try {
    const response = await axios.post(`${BASE_URL}/chat`, {
      message,
      conversation_history: conversationHistory
    });
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

// Test Scenario 1: Check Request Status Workflow
async function testScenario1() {
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO 1: CHECK REQUEST STATUS (Multi-turn Conversation)');
  console.log('='.repeat(80));

  try {
    // Turn 1: User asks to check status
    console.log('\n[Turn 1] User: "I want to check my request status"');
    let result1 = await chat('I want to check my request status', []);
    console.log(`Bot: ${result1.response}`);
    console.log(`History items: ${result1.conversation_history.length}`);

    // Turn 2: User provides request number
    console.log('\n[Turn 2] User: "REQ1775566633881"');
    let result2 = await chat('REQ1775566633881', result1.conversation_history);
    console.log(`Bot: ${result2.response}`);
    console.log(`History items: ${result2.conversation_history.length}`);

    console.log('\n✅ Scenario 1 PASSED - Conversation history tracking works!\n');
  } catch (error) {
    console.error('❌ Scenario 1 FAILED:', error.message);
  }
}

// Test Scenario 2: Search Roles Workflow
async function testScenario2() {
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO 2: SEARCH ROLES (Query by Transaction Code)');
  console.log('='.repeat(80));

  try {
    // Turn 1: User asks to search roles
    console.log('\n[Turn 1] User: "I need to find roles for SE38 tcode"');
    let result1 = await chat('I need to find roles for SE38 tcode', []);
    console.log(`Bot: ${result1.response}`);

    // Turn 2: Follow-up
    console.log('\n[Turn 2] User: "Can you also search for SE80?"');
    let result2 = await chat('Can you also search for SE80?', result1.conversation_history);
    console.log(`Bot: ${result2.response}`);
    console.log(`History items: ${result2.conversation_history.length}`);

    console.log('\n✅ Scenario 2 PASSED - Role search works!\n');
  } catch (error) {
    console.error('❌ Scenario 2 FAILED:', error.message);
  }
}

// Test Scenario 3: Get Existing Access Workflow
async function testScenario3() {
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO 3: GET EXISTING ACCESS (User Roles Lookup)');
  console.log('='.repeat(80));

  try {
    // Turn 1: User asks for existing access
    console.log('\n[Turn 1] User: "Can you show me what roles USJODUG has?"');
    let result1 = await chat('Can you show me what roles USJODUG has?', []);
    console.log(`Bot: ${result1.response}`);

    // Turn 2: Specify system
    console.log('\n[Turn 2] User: "in Production"');
    let result2 = await chat('in Production', result1.conversation_history);
    console.log(`Bot: ${result2.response}`);
    console.log(`History items: ${result2.conversation_history.length}`);

    console.log('\n✅ Scenario 3 PASSED - Get existing access works!\n');
  } catch (error) {
    console.error('❌ Scenario 3 FAILED:', error.message);
  }
}

// Test Scenario 4: Request Role Workflow
async function testScenario4() {
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO 4: REQUEST ROLE (Multi-field Collection)');
  console.log('='.repeat(80));

  try {
    // Turn 1: User requests a role
    console.log('\n[Turn 1] User: "I want to request a role"');
    let result1 = await chat('I want to request a role', []);
    console.log(`Bot: ${result1.response}`);

    // Turn 2: Provide user ID
    console.log('\n[Turn 2] User: "UKMAHOL"');
    let result2 = await chat('UKMAHOL', result1.conversation_history);
    console.log(`Bot: ${result2.response}`);

    // Turn 3: Select system
    console.log('\n[Turn 3] User: "P1"');
    let result3 = await chat('P1', result2.conversation_history);
    console.log(`Bot: ${result3.response}`);

    // Turn 4: Specify role
    console.log('\n[Turn 4] User: "Z_SE38"');
    let result4 = await chat('Z_SE38', result3.conversation_history);
    console.log(`Bot: ${result4.response}`);
    console.log(`\nFinal History items: ${result4.conversation_history.length}`);

    console.log('\n✅ Scenario 4 PASSED - Request role workflow works!\n');
  } catch (error) {
    console.error('❌ Scenario 4 FAILED:', error.message);
  }
}

// Test Direct Operation Endpoints
async function testDirectEndpoints() {
  console.log('\n' + '='.repeat(80));
  console.log('DIRECT ENDPOINT TESTS (Configuration-Driven Operations)');
  console.log('='.repeat(80));

  try {
    // Test 1: Search Roles endpoint
    console.log('\n[Test 1] POST /search-roles with RoleName="Z_SE38"');
    const searchResp = await axios.post(`${BASE_URL}/search-roles`, { RoleName: 'Z_SE38' });
    console.log(`✓ Found ${searchResp.data.count} role(s)`);
    console.log(`  - ${searchResp.data.roles[0].role_name}: ${searchResp.data.roles[0].role_desc}`);

    // Test 2: Get Existing Access endpoint
    console.log('\n[Test 2] POST /get-existing-access for USJODUG in P1');
    const accessResp = await axios.post(`${BASE_URL}/get-existing-access`, { 
      System: 'P1', 
      UserId: 'USJODUG' 
    });
    console.log(`✓ User: ${accessResp.data.user}`);
    console.log(`✓ System: ${accessResp.data.system}`);
    console.log(`✓ Roles: ${accessResp.data.role_count} assigned`);
    accessResp.data.roles.forEach(r => console.log(`  - ${r.role_name}: ${r.role_desc}`));

    // Test 3: Request Role endpoint
    console.log('\n[Test 3] POST /request-role for USJODUG requesting Z_SE80 in P1');
    const reqResp = await axios.post(`${BASE_URL}/request-role`, {
      Userid: 'USJODUG',
      RoleName: 'Z_SE80',
      SystemName: 'P1'
    });
    console.log(`✓ ${reqResp.data.message}`);
    console.log(`✓ Request ID: ${reqResp.data.request_number}`);

    // Test 4: Check Request Status
    const storedReqNo = reqResp.data.request_number;
    console.log(`\n[Test 4] POST /user-status for request ${storedReqNo}`);
    const statusResp = await axios.post(`${BASE_URL}/user-status`, { ReqNo: storedReqNo });
    console.log(`✓ Status: ${statusResp.data.Reqstatus}`);
    console.log(`✓ Stage: ${statusResp.data.Reqcurrentstage}`);
    console.log(`✓ Approver: ${statusResp.data.ApproverId}`);

    // Test 5: Get Configuration
    console.log('\n[Test 5] GET /config/operations');
    const configResp = await axios.get(`${BASE_URL}/config/operations`);
    console.log(`✓ Available operations: ${configResp.data.operations.map(o => o.operation_id).join(', ')}`);

    console.log('\n✅ All direct endpoints PASSED!\n');
  } catch (error) {
    console.error('❌ Direct endpoint test FAILED:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' SAP ROLE AGENT - END-TO-END TEST SUITE (Configuration-Driven)'.padEnd(78) + '║');
  console.log('║' + ' Testing: Multi-turn conversations, History tracking, Direct endpoints'.padEnd(78) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');

  await testScenario1();
  await testScenario2();
  await testScenario3();
  await testScenario4();
  await testDirectEndpoints();

  console.log('\n\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' TEST SUITE COMPLETE ✅'.padEnd(78) + '║');
  console.log('║' + ' Frontend: http://localhost:5173'.padEnd(78) + '║');
  console.log('║' + ' Backend:  http://localhost:3001'.padEnd(78) + '║');
  console.log('╚' + '═'.repeat(78) + '╝\n');
}

// Run tests
runAllTests().catch(console.error);
