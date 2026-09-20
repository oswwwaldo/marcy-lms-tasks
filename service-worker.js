console.log("service-worker.js");

const CLIENT_ID = '869270636017-hndo6m3l3tfrgbdikr02u6kqodmab5cd.apps.googleusercontent.com';
const WORKER_URL = 'https://my-oauth-worker.ofdelossantosa.workers.dev'; 
const TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1';

(async () => {
  try {
    console.log("Loading (async()=>{})();")
    const taskLists = fetchTaskLists(await getValidAccessToken());
    console.log(taskLists);
  } catch (error) {
    console.error("Failed to load tasks in async func:", error);
  }
})();

// ! example to delete later */
// Saving data
// chrome.storage.local.set({ username: "JaneDoe" }, () => {
//   console.log("Data saved successfully.");
// });

// // Retrieving data
// chrome.storage.local.get(["username"], (result) => {
//   console.log("Username is currently: " + result.username);
// });


//#region onMessage
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
  if (message.action === 'get_credentials') {
    getMarcyUserData()
      .then((credentials) => sendResponse(credentials))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.action === 'loaded_dom') {
  
  }
  if (message.action === 'hi') {
    sendResponse({
      reply: 'hi lol — the elusive worker service worker',
      timestamp: new Date().toLocaleTimeString(),
    });
    return true;
  }
});
//#endregion

//#region Authentication 
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
    console.log("Access token hasn't expired, returning token in storage...");
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

    const newAccessToken = await response.json();

    if (newAccessToken.error) {
      await chrome.storage.local.remove(['access_token', 'refresh_token', 'expires_at']);
      throw new Error('Unknown session error. Please sign in again.');
    }

    await chrome.storage.local.set({
      access_token: newAccessToken.access_token,
      expires_at: Date.now() + newAccessToken.expires_in * 1000,
    });

    return newAccessToken.access_token;
  }

  console.error("No access or refresh token available");
  throw new Error('No valid sesion found. Please sign in.');
}
//#endregion

//#region Google Tasks API
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
      console.error("No task lists found.");
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


//#endregion

//#region Marcy LMS 
// --- Marcy LMS ---

/**
 * Fetches the current user's profile data from Marcy LMS to verify authentication.
 *
 * @async
 * @function getMarcyUserData
 * @returns {Promise<{success: boolean, data?: object, success: boolean, error?: unknown}>} 
 * Object containing execution status and user payload or error details.
 */ 
async function getMarcyUserData() {
  try {
    const payload = await fetchMarcyAPI('me');

    if (payload.result.data.json != null) {
      console.log("Verified data exists");
      return { success: true, data: payload };
    }

    return { success: false, error: new Error("Malformed payload structure") };
  } catch (error) {
    const isAuthError = error.status === 401 || error.status === 403;

    if (isAuthError) {
      console.error("getMarcyUserData() permissions denied:", error);
    } else {
      console.error("getMarcyUserData() network/server error:", error);
    }
    return { success: false, error };
  }
}

// const endpointParsers = {
//   me: (data) => ({
//     id: data?.id,
//     name: data?.displayName,
//     email: data?.email,
//     role: data?.role,
//   }),
  
//   assignments: (data) => data?.map(item => ({
//     id: item?.id,
//     title: item?.title,
//     dueDate: item?.dueDate,
//   })) ?? [],
// }

// function parsePayloadByEndpoint(endpoint, payload) {
//   const parser = endpointParsers[endpoint];
  
//   if (!parser) {
//     throw new Error(`No parser configured for endpoint: ${endpoint}`);
//   }

//   const rawData = payload?.result?.data?.json ?? payload;
  
//   return parser(rawData);
// }

// async function readJSONPayload(payload) {
//   let json = JSON.parse(payload);
//   // Targeting deeply nested properties
//   const user = json.result.data.json;

//   console.log(user.email);          // "ofdelossantosa@gmail.com"
//   console.log(user.displayName);    // "Oswaldo Fabrizio De Los Santos Ascencio"
//   console.log(user.role);           // "STUDENT"
// }

/**
 * Fetches JSON data from protected Marcy LMS API tRPC endpoints
 * @async
 * @function fetchMarcyAPI
 * @param {string} requestedEndpoint (programs | assignments | courses | attendance | me)
 * @returns {response.json} 
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
    throw error; 
  }
}

//#endregion