console.log('popup.js');

const CLIENT_ID = '869270636017-hndo6m3l3tfrgbdikr02u6kqodmab5cd.apps.googleusercontent.com';
const WORKER_URL = 'https://my-oauth-worker.ofdelossantosa.workers.dev';

const TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1';

const authorizeButton = document.getElementById('authorize_button');
const signoutButton = document.getElementById('signout_button');
const contentEl = document.getElementById('content');

authorizeButton.style.display = 'inline-block';
signoutButton.style.display = 'none';

authorizeButton.addEventListener('click', handleAuthClick);
signoutButton.addEventListener('click', handleSignoutClick);

const USER_STATES = Object.freeze({
  SIGNED_IN: 'SIGNED_IN',
  SIGNED_OUT: 'SIGNED_OUT',
});

let currentState = USER_STATES.SIGNED_OUT;

checkExistingAuth();

chrome.runtime.sendMessage({ action: 'hi' }, (response) => {
  if (chrome.runtime.lastError) {
    console.error('Service worker might be sleeping/unreachable:', chrome.runtime.lastError);
    return;
  }
  console.log('Response from background:', response.reply, 'at', response.timestamp);
});

// --- Auth ---

/**
 * Authenticate the user via chrome.identity.launchWebAuthFlow().
 * Works on both Chrome and Edge.
 */

async function checkExistingAuth() {
  const data = await chrome.storage.local.get(['access_token', 'refresh_token', 'expires_at']);

  if (data.access_token && data.expires_at > Date.now()) {
    console.log('Valid access token found in storage');
    handleDOMSigninState();
    fetchTaskLists(data.access_token);
  } else if (data.refresh_token) {

    handleDOMSignoutState();
  }
}

async function checkExistingAuth() {
  chrome.runtime.sendMessage({ action: 'get_token' }, (response) => {
    if (response && response.success) {
      console.log('Valid token received from background');
      handleDOMSigninState();
      fetchTaskLists(response.token);
    } else {
      console.log('No valid session:', response?.error);
      handleDOMSignoutState();
    }
  });
}

async function handleAuthClick() {
  console.log('Initiating authentication via service worker...');
  authorizeButton.disabled = true;

  chrome.runtime.sendMessage({ action: 'start_auth_flow' }, (response) => {
    authorizeButton.disabled = false;

    if (chrome.runtime.lastError) {
      console.error('Messaging error:', chrome.runtime.lastError);
      return;
    }

    if (response && response.success) {
      console.log('Authentication successful!');
      handleDOMSigninState();
      
      // Fetch task lists with the newly stored access token
      fetchTaskLists(response.tokens.access_token);
    } else {
      console.error('Authentication failed:', response?.error);
      contentEl.innerText = 'Authorization failed: ' + response?.error;
    }
  });
}

/**
 * Sign out by revoking the token and clearing state.
 */
async function handleSignoutClick() {
  console.log('handleSignoutClick() fired');

  const data = await chrome.storage.local.get(['access_token', 'refresh_token', 'expires_at']);

  if (data.access_token || data.refresh_token) {
    const tokenToRevoke = data.refresh_token || data.access_token;
    try {
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${tokenToRevoke}`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/x-www-form-urlencoded'},
      });
      console.log('Token successfully revokved from the Google endpoint');
    } catch (e) {
      console.warn('Token revocation request failed (may already be expired):', e);
    }

  }
  chrome.storage.local.remove(['access_token', 'refresh_token', 'expires_at']);
  handleDOMSignoutState();
}

function handleDOMSigninState() {
  authorizeButton.style.display = 'none';
  signoutButton.style.display = 'inline-block';
  currentState = USER_STATES.SIGNED_IN;
}

function handleDOMSignoutState() {
  contentEl.innerText = '';
  authorizeButton.style.display = 'inline-block';
  authorizeButton.innerText = 'Sign in with Google';
  signoutButton.style.display = 'none';
  currentState = USER_STATES.SIGNED_OUT;
}