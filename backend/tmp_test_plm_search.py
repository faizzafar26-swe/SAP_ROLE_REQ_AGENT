import json
import urllib.request

url = 'http://localhost:3001/chat'
request_data = {
    'conversation_history': [
        {'role': 'user', 'content': 'show me all the roles related to PLM'}
    ],
    'message': 'show me all the roles related to PLM'
}
req = urllib.request.Request(
    url,
    data=json.dumps(request_data).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req, timeout=10) as resp:
    print(resp.read().decode('utf-8'))
