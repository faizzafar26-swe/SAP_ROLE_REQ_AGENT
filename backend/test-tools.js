// Test script for SAP Role Agent tool calling
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testTools() {
  console.log('Testing SAP Role Agent Tools...\n');

  try {
    // Test 1: Search roles by tcode
    console.log('1. Testing searchRolesByTcode with SE38:');
    const tcodeResult = await axios.post(`${BASE_URL}/test-tool`, {
      toolName: 'searchRolesByTcode',
      parameters: { tcode: 'SE38' }
    });
    console.log('Result:', tcodeResult.data.result);
    console.log('');

    // Test 2: Search roles by name
    console.log('2. Testing searchRolesByName with "HR":');
    const nameResult = await axios.post(`${BASE_URL}/test-tool`, {
      toolName: 'searchRolesByName',
      parameters: { roleName: 'HR' }
    });
    console.log('Result:', nameResult.data.result);
    console.log('');

    // Test 3: Check request status (will likely return not found since no sample data)
    console.log('3. Testing checkRequestStatus with "REQ001":');
    const statusResult = await axios.post(`${BASE_URL}/test-tool`, {
      toolName: 'checkRequestStatus',
      parameters: { requestId: 'REQ001' }
    });
    console.log('Result:', statusResult.data.result);
    console.log('');

    // Test 4: Analyze SU53 screenshot (placeholder)
    console.log('4. Testing analyzeSU53Screenshot:');
    const su53Result = await axios.post(`${BASE_URL}/test-tool`, {
      toolName: 'analyzeSU53Screenshot',
      parameters: { imageData: 'base64imagedata' }
    });
    console.log('Result:', su53Result.data.result);
    console.log('');

    console.log('All tool tests completed successfully!');

  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

// Run tests
testTools();