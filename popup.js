console.log("popup.js");

const CLIENT_ID =
  "869270636017-hndo6m3l3tfrgbdikr02u6kqodmab5cd.apps.googleusercontent.com";
const WORKER_URL = "https://my-oauth-worker.ofdelossantosa.workers.dev";
const TASKS_API_BASE = "https://tasks.googleapis.com/tasks/v1";

//#region DOM
const sectionHeader = document.getElementById("section-header");
const sectionText = document.getElementById("section-text");
const sectionIcon = document.getElementById("section-icon");

const sectionCTA = document.getElementById("section-cta");
const sectionCTALink = document.getElementById("section-cta-link");
const sectionCTAOAuth = document.getElementById("section-cta-oauth");
const signoutButton = document.getElementById("signout_button");

const googleIconSVG = document.getElementById("google-icon-svg");
const marcyLMSIconSVG = document.getElementById("marcy-lms-icon-svg");
//#endregion

sectionCTAOAuth?.addEventListener("click", handleAuthClick);
signoutButton?.addEventListener("click", handleSignoutClick);

//#region SendMessages
chrome.runtime.sendMessage({ action: "hi" }, (response) => {
  if (chrome.runtime.lastError) {
    console.error(
      "Service worker might be sleeping/unreachable:",
      chrome.runtime.lastError,
    );
    return;
  }
  console.log(
    "Response from service-worker.js:",
    response.reply,
    "at",
    response.timestamp,
  );
});
//#endregion

//#region State machine
/**
 * State defintions
 */
const USER_STATES = Object.freeze({
  LOADING: "LOADING",
  SIGNED_OUT: "SIGNED_OUT",
  SIGNED_IN_GOOGLE_ONLY: "SIGNED_IN_GOOGLE_ONLY",
  SIGNED_IN_MARCY_ONLY: "SIGNED_IN_MARCY_ONLY",
  SIGNED_IN_ALL: "SIGNED_IN_ALL",
});

/**
 * The state of the current popup session
 */
const session = {
  isLoading: true,
  hasGoogleAuth: false,
  hasMarcyAuth: false,
};

/**
 *
 * @param {*} state
 * @returns
 */
function getAuthState(state) {
  if (state.isLoading) {
    return USER_STATES.LOADING;
  }
  if (state.hasGoogleAuth && state.hasMarcyAuth) {
    return USER_STATES.SIGNED_IN_ALL;
  }
  if (state.hasGoogleAuth) {
    return USER_STATES.SIGNED_IN_GOOGLE_ONLY;
  }
  if (state.hasMarcyAuth) {
    return USER_STATES.SIGNED_IN_MARCY_ONLY;
  }
  return USER_STATES.SIGNED_OUT;
}

/**
 * Updates states and triggers a re-render
 * @param {*} updates
 */
function setSessionState(updates) {
  Object.assign(session, updates);
  updateDOMState();
}

const allElementsExist = () => {
  const elements = [sectionCTA, sectionCTALink, sectionCTAOAuth, sectionHeader, sectionIcon, sectionText, googleIconSVG, marcyLMSIconSVG]
  for (const element of elements) {
    if (!element) {
      return false;
    } 
  }
  return true;
}
/**
 * Reads the derived authentication state and updates the extension popup DOM elements.
 * Evaluates the current state via {@link getAuthState} and safely updates element
 * visibility and text content using optional chaining (`?.`).
 *
 * @returns {void}
 */
function updateDOMState() {
  const currentState = getAuthState(session);

  if (allElementsExist()) {
    switch (currentState) {
      case USER_STATES.LOADING:
        if (sectionCTAOAuth) sectionCTAOAuth.innerText = "Loading... please wait";
        break;

      case USER_STATES.SIGNED_IN_MARCY_ONLY:
        if (googleIconSVG?.style) googleIconSVG.style.display = "block";
        if (marcyLMSIconSVG?.style) marcyLMSIconSVG.style.display = "none";
        if (sectionHeader) sectionHeader.innerText = "Sign in with Google";
        if (sectionText) {
          sectionText.innerText =
            "Sync your Google Tasks workflow automatically with incoming assignments from Marcy LMS";
        }
        if (sectionCTAOAuth?.style)
          sectionCTAOAuth.style.display = "flex";
        if (sectionCTALink?.style) sectionCTALink.style.display = "none";
        if (signoutButton?.style) signoutButton.style.display = "none";
        break;

      case USER_STATES.SIGNED_IN_GOOGLE_ONLY:
        if (marcyLMSIconSVG?.style) marcyLMSIconSVG.style.display = "block";
        if (googleIconSVG?.style) googleIconSVG.style.display = "none";
        if (sectionHeader) sectionHeader.innerText = "Sign in to Marcy LMS";
        if (sectionText) {
          sectionText.innerText =
            "To use this extension you'll need to be signed into mls-lms.vercel.app/ and be an enrolled user";
        }
        if (sectionCTAOAuth?.style) sectionCTAOAuth.style.display = "none";
        if (sectionCTALink?.style) sectionCTALink.style.display = "flex";
        if (signoutButton?.style) signoutButton.style.display = "flex";
        break;

      case USER_STATES.SIGNED_IN_ALL:
        if (sectionHeader) sectionHeader.innerText = "Connected";
        if (sectionText)
          sectionText.innerText =
            "Your Marcy LMS and Google Tasks are synchronized.";
        if (sectionCTAOAuth?.style) sectionCTAOAuth.style.display = "none";
        if (sectionCTALink?.style) sectionCTALink.style.display = "none";
        if (signoutButton?.style) signoutButton.style.display = "flex";
        break;

      case USER_STATES.SIGNED_OUT:
      default:
        if (marcyLMSIconSVG?.style) marcyLMSIconSVG.style.display = "block";
        if (googleIconSVG?.style) googleIconSVG.style.display = "none";
        if (sectionHeader) sectionHeader.innerText = "Sign in to Marcy LMS";
        if (sectionText) {
          sectionText.innerText =
            "To use this extension you'll need to be signed into mls-lms.vercel.app/ and be an enrolled user";
        }
        if (sectionCTAOAuth?.style) sectionCTAOAuth.style.display = "none";
        if (sectionCTALink?.style) sectionCTALink.style.display = "flex";
        if (signoutButton?.style) signoutButton.style.display = "none";
        break;
    }
  }

  
}
//#endregion

//#region Authentication
// --- Auth ---

/**
 * Authenticate the user via chrome.identity.launchWebAuthFlow().
 * Works on both Chrome and Edge.
 */
async function checkExistingOAuth2() {
  chrome.runtime.sendMessage({ action: "get_tokens" }, (response) => {
    if (response && response.success) {
      console.log("Valid token received from background");
      setSessionState({ isLoading: false, hasGoogleAuth: true });
    } else {
      console.log("No valid session:", response?.error);
      setSessionState({ isLoading: false, hasGoogleAuth: false });
    }
  });
}

async function checkExistingCredentials() {
  chrome.runtime.sendMessage({ action: "get_credentials" }, (response) => {
    if (response && response.success) { // needs to actually read the data to verify 
      console.log("User already logged into Marcy LMS");
      setSessionState({ isLoading: false, hasMarcyAuth: true });
    } else {
      console.log("User is not logged into Marcy LMS", response?.error);
      setSessionState({ isLoading: false, hasMarcyAuth: false });
    }
  })
}

async function handleAuthClick() {
  console.log("Initiating authentication via service worker...");
  if (sectionCTAOAuth) {
    sectionCTAOAuth.disabled = true;

    chrome.runtime.sendMessage({ action: "start_auth_flow" }, (response) => {
      sectionCTAOAuth.disabled = false;

      if (chrome.runtime.lastError) {
        console.error("Messaging error:", chrome.runtime.lastError);
        return;
      }

      if (response && response.success) {
        console.log("Authentication successful!");
        setSessionState({ hasGoogleAuth: true });
      } else {
        console.error("Authentication failed:", response?.error);
        if (sectionText) {
          sectionText.innerText =
            "Authorization failed, please try again: " + response?.error;
        }
      }
    });
  }
}

/**
 * Sign out by revoking the token and clearing state.
 */
async function handleSignoutClick() {
  console.log("handleSignoutClick() fired");

  const data = await chrome.storage.local.get([
    "access_token",
    "refresh_token",
    "expires_at",
  ]);

  if (data.access_token || data.refresh_token) {
    const tokenToRevoke = data.refresh_token || data.access_token;
    try {
      await fetch(
        `https://accounts.google.com/o/oauth2/revoke?token=${tokenToRevoke}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );
      console.log("Token successfully revokved from the Google endpoint");
    } catch (e) {
      console.warn(
        "Token revocation request failed (may already be expired):",
        e,
      );
    }
  }
  chrome.storage.local.remove(["access_token", "refresh_token", "expires_at"]);
  setSessionState({ hasGoogleAuth: false });
}

//#endregion

/**
 * Update the DOM, check auth and enable interactivity
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOMContentLoaded event fired...");

  updateDOMState();
  checkExistingOAuth2();
  checkExistingCredentials();

  const redirectNewTabLinkBtns = document.querySelectorAll(
    ".redirect-new-tab-link",
  );
  
  redirectNewTabLinkBtns.forEach(function (btn) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      const targetURL = btn.getAttribute("href");
      chrome.tabs.create({ url: targetURL });
    });
  });
  
  handleThemeState();
});

async function handleThemeState() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  
  console.log("eeeeeeeeeeee 6:43 PM");
  console.log(tab);
  
  if (tab && tab.url.includes("mls-lms.vercel.app")) {
    console.log("Sending message to content.js for getTheme");
    chrome.tabs.sendMessage(tab.id, { action: "getTheme" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        console.warn("Could not retrieve theme setting.");
        return;
      }
  
      const currentTheme = response.theme;
      console.log(`Switched to ${currentTheme} mode`);
      if (currentTheme === "dark") {
        document.documentElement.classList.add("dark");
      }
    });
  }
}