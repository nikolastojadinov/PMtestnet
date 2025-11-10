// backend/src/config/piNetwork.js
// Central Pi Network configuration: loads API key from environment and exposes helper headers.

export const PI_API_KEY = process.env.PI_API_KEY || '';

if (!PI_API_KEY) {
  console.warn('⚠️ Missing PI_API_KEY — Pi Network SDK calls will fail');
}

export const getPiHeaders = () => ({
  'Authorization': `Key ${PI_API_KEY}`,
  'Content-Type': 'application/json'
});

// Optionally expose APP ID for validation in routes
export const PI_APP_ID = process.env.PI_APP_ID || '';
if (!PI_APP_ID) {
  console.warn('⚠️ Missing PI_APP_ID — payment verification may not work correctly');
}
