console.log("service-worker.js");

const CLIENT_ID = '869270636017-hndo6m3l3tfrgbdikr02u6kqodmab5cd.apps.googleusercontent.com';
const WORKER_URL = 'https://my-oauth-worker.ofdelossantosa.workers.dev'; 

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Service worker received message:', message);

  if (message.action === 'start_auth_flow') {
    handleAuthFlow()
      .then((tokens) => sendResponse({ success: true, tokens }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.action === 'get_tokens') {
    getValidAccessToken()
      .then((token) => sendResponse({ success: true, token }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.action === 'hi') {
    sendResponse({
      reply: 'hi lol — the elusive worker service worker',
      timestamp: new Date().toLocaleTimeString(),
    });
    return true;
  }
});


async function handleAuthFlow() {
  const redirectUri = chrome.identity.getRedirectURL();
  const scopes = 'https://www.googleapis.com/auth/tasks';

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${scopes}&` +
    `access_type=offline&` +
    `prompt=consent`;

  const redirectUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          reject(new Error(chrome.runtime.lastError?.message || 'Auth flow cancelled'));
        } else {
          resolve(responseUrl);
        }
      }
    );
  });

  const urlParams = new URL(redirectUrl).searchParams;
  const authorization_code = urlParams.get('code');

  if (!authorization_code) {
    throw new Error('No authorization code returned from Google');
  }

  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: authorization_code,
      redirect_uri: redirectUri
    })
  });

  const data = await response.json();
  console.log(data);

  if (data.error) {
    throw new Error(`Worker Error: ${data.error_description || data.error}`);
  }

  await chrome.storage.local.set({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000
  });

  return data;
}

async function getValidAccessToken() {
  const data = await chrome.storage.local.get(['access_token', 'refresh_token', 'expires_at']);

  if (data.access_token && data.expires_at > Date.now() + 60000 ) {
    return data.access_token;
  }

  if (data.refresh_token) {
    console.log('Access token expired. Refreshing silently...');

    // Ask Cloudflare Worker to retrieve a access token from Google
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: data.refresh_token
      }),
    });

    const newData = await response.json();

    if (newData.error) {
      await chrome.storage.local.remove(['access_token', 'refresh_token', 'expires_at']);
      throw new Error('Unknown session error. Please sign in again.');
    }

    await chrome.storage.local.set({
      access_token: newData.access_token,
      expires_at: Date.now() + newData.expires_in * 1000,
    });

    return newData.access_token;
  }

  throw new Error('No valid sesion found. Please sign in.');
}


// --- Google Tasks API ---

/**
 * Fetches and displays the user's task lists using direct REST calls.
 * @param {string} token - OAuth2 access token.
 */
async function fetchTaskLists(token) {
  try {
    const response = await fetch(`${TASKS_API_BASE}/users/@me/lists?maxResults=10`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const taskLists = data.items;

    if (!taskLists || taskLists.length === 0) {
      contentEl.innerText = 'No task lists found.';
      return;
    }

    const output = taskLists.reduce(
      (str, taskList) => `${str}${taskList.title} (${taskList.id})\n`,
      'Task lists:\n'
    );

    console.log(output);
  } catch (err) {
    console.error('Failed to fetch task lists:', err);
  }
}


// --- Marcy LMS ---

/**
 * Fetches JSON data from protected Marcy LMS API tRPC endpoints
 * @params {string} programs | assignments | courses | attendance | me
 * @returns {response.json} assignments.listMine
 */
async function fetchMarcyAPI(requestedEndpoint) {
  console.log("Connecting to mls-lms.vercel.app/api/trpc...");

  const availableEndpoints = Object.freeze({
    'programs': 'https://mls-lms.vercel.app/api/trpc/programs.listMine',
    'assignments': 'https://mls-lms.vercel.app/api/trpc/assignments.listMine',
    'courses': 'https://mls-lms.vercel.app/api/trpc/courses.listMine',
    'attendance': 'https://mls-lms.vercel.app/api/trpc/attendance.myWeek',
    'me': 'https://mls-lms.vercel.app/api/trpc/me'
  });

  if (Object.keys(availableEndpoints).includes(requestedEndpoint)) {
    console.log(`Fetching ${requestedEndpoint}...`);
  } else {
    throw new Error(`fetchMarcyAPI(requestedEndpoint) invalid parameter given — ${requestedEndpoint}`);
  }

  try {
    const response = await fetch(availableEndpoints[requestedEndpoint], {
      method: "GET",
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`${requestedEndpoint.charAt(0).toUpperCase() + requestedEndpoint.slice(1)} payload received:`, data);
    return data;
  } catch (error) {
    console.log(`Could not fetch ${requestedEndpoint}:`, error);
  }
}

fetchMarcyAPI('me');
fetchMarcyAPI('attendance');
fetchMarcyAPI('courses');
fetchMarcyAPI('programs');
fetchMarcyAPI('assignments');