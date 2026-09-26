console.log("popup.js");

import { Router } from './router.js';

const CLIENT_ID = "869270636017-hndo6m3l3tfrgbdikr02u6kqodmab5cd.apps.googleusercontent.com";
const WORKER_URL = "https://my-oauth-worker.ofdelossantosa.workers.dev";
const TASKS_API_BASE = "https://tasks.googleapis.com/tasks/v1";

//#region DOM
const signedInMenu = document.getElementById("signed-in-menu");
const signedOutMenu = document.getElementById("signed-out-menu");
const settingsMenu = document.getElementById("settings-menu");

const sectionHeader = document.getElementById("section-header");
const sectionText = document.getElementById("section-text");
const sectionIcon = document.getElementById("section-icon");

const sectionCTA = document.getElementById("section-cta");
const sectionCTALink = document.getElementById("section-cta-link");
const sectionCTAOAuth = document.getElementById("section-cta-oauth");
const signoutButton = document.getElementById("signout_button");

const titleButton = document.getElementById("title-button");
const syncButton = document.getElementById("sync-button");
const infoButton = document.getElementById("info-button");
const settingsButton = document.getElementById("settings-button");
const getStartedButton = document.getElementById("get-started_button");

const googleIconSVG = document.getElementById("google-icon-svg");
const marcyLMSIconSVG = document.getElementById("marcy-lms-icon-svg");
const signedInAllSVG = document.getElementById('signed-in-all-svg');
const loadingSpinner = document.getElementById('spinner');

//#endregion

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
  SIGNED_IN_MARCY_ONLY: "SIGNED_IN_MARCY_ONLY",
  SIGNED_IN_GOOGLE_ONLY: "SIGNED_IN_GOOGLE_ONLY",
  SIGNED_IN_ALL: "SIGNED_IN_ALL",
  GETTING_STARTED: "GETTING_STARTED",
  DASHBOARD: "DASHBOARD",
  SETTINGS: "SETTINGS"
});

const STATE_CONFIG = {
  [USER_STATES.LOADING]: {
    header: "Loading...",
    text: "Please stand by",
    icon: null,
    showOAuth: false,
    showLink: false,
    showSignout: false,
  },
  [USER_STATES.SIGNED_OUT]: {
    header: "Sign in to Marcy LMS and Google",
    text: "To get started with this extension you'll need to be signed into mls-lms.vercel.app/ and be an enrolled user.",
    icon: "marcy",
    showOAuth: false,
    showLink: true,
    showSignout: false,
  },
  [USER_STATES.SIGNED_IN_MARCY_ONLY]: {
    header: "Sign in with Google",
    text: "Sync your Google Tasks workflow automatically with incoming assignments from Marcy LMS.",
    icon: "google",
    showOAuth: true,
    showLink: false,
    showSignout: false,
  },
  [USER_STATES.SIGNED_IN_GOOGLE_ONLY]: {
    header: "Sign in to Marcy LMS",
    text: "To use this extension you'll need to be signed into mls-lms.vercel.app/ and be an enrolled user.",
    icon: "marcy",
    showOAuth: false,
    showLink: true,
    showSignout: true,
  },
  [USER_STATES.SIGNED_IN_ALL]: {
    header: "Connected",
    text: "Your Marcy LMS and Google Tasks are synchronized.",
    icon: "all",
    showOAuth: false,
    showLink: false,
    showSignout: true,
  },
  [USER_STATES.GETTING_STARTED]: {
    header: "Getting started",
    text: "View not available",
    icon: "all",
    showOAuth: false,
    showLink: false,
    showSignout: true,
  },
  [USER_STATES.DASHBOARD]: {
    header: "Dashboard",
    text: "View not available",
    icon: "all",
    showOAuth: false,
    showLink: false,
    showSignout: true,
  },
  [USER_STATES.SETTINGS]: {
    header: "Settings",
    text: "View not available.",
    icon: "all",
    showOAuth: false,
    showLink: false,
    showSignout: true,
  },
};

/**
 * The state of the current popup session
 */
const session = {
  isLoading: true,
  hasGoogleAuth: false,
  hasMarcyAuth: false,
  hasOnboarded: false,
  isOnSettings: false,
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
  if (state.hasGoogleAuth && state.hasMarcyAuth && state.isOnSettings) {
    return USER_STATES.SETTINGS;
  }
  if (state.hasGoogleAuth && state.hasMarcyAuth && state.hasOnboarded === true) {
    return USER_STATES.DASHBOARD;
  }
  if (state.hasGoogleAuth && state.hasMarcyAuth && state.hasOnboarded === false) {
    return USER_STATES.GETTING_STARTED;
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
  console.log('Current session has been updated', session);
  updateDOMState();
}

async function openAssociatedMenu() {
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
 * Evaluates the current state via {@link getAuthState} and {@link STATE_CONFIG}
 *
 * @returns {void}
 */
function updateDOMState() {
  const currentState = getAuthState(session);
  document.body.dataset.state = currentState;

  if(currentState === 'LOADING') {
    console.log("Loading state event fired");
  }setTimeout(handleLoadingState, 200);

  const config = STATE_CONFIG[currentState];
  if (!config) return;

  // 3. Declarative updates
  if (sectionHeader) sectionHeader.innerText = config.header;
  if (sectionText) sectionText.innerText = config.text;

  // Icon visibility toggling
  if (marcyLMSIconSVG) marcyLMSIconSVG.style.display = config.icon === "marcy" ? "block" : "none";
  if (googleIconSVG) googleIconSVG.style.display = config.icon === "google" ? "block" : "none";
  if (signedInAllSVG) signedInAllSVG.style.display = config.icon === "all" ? "block" : "none";

  // Action button visibility toggling
  if (sectionCTAOAuth) sectionCTAOAuth.style.display = config.showOAuth ? "flex" : "none";
  if (sectionCTALink) sectionCTALink.style.display = config.showLink ? "flex" : "none";
  if (signoutButton) signoutButton.style.display = config.showSignout ? "flex" : "none";
}

async function handleLoadingState() {
  if (loadingSpinner) loadingSpinner.style.display = 'block';
}


// /**
//  * Reads the derived authentication state and updates the extension popup DOM elements.
//  * Evaluates the current state via {@link getAuthState} and safely updates element
//  * visibility and text content using optional chaining (`?.`).
//  *
//  * @returns {void}
//  */
// function updateDOMState() {
//   const currentState = getAuthState(session);

//   // Investigate: is it even possible to view SIGNED_IN_GOOGLE_ONLY? 
//   if (allElementsExist()) {
//     switch (currentState) {

//       case USER_STATES.LOADING:
//         if (loadingSpinner) loadingSpinner.style.display = "block";
//         if (sectionCTAOAuth) sectionCTAOAuth.innerText = "Loading... please wait";
//         if (sectionCTAOAuth && loadingSpinner) sectionCTAOAuth.appendChild(loadingSpinner);
//         break;

//       case USER_STATES.SIGNED_IN_MARCY_ONLY:
//         if (loadingSpinner) loadingSpinner.style.display = "none";
//         if (marcyLMSIconSVG?.style) marcyLMSIconSVG.style.display = "none";
//         if (googleIconSVG?.style) googleIconSVG.style.display = "block";
//         if (signedInAllSVG?.style) signedInAllSVG.style.display = "none";
//         if (sectionHeader) sectionHeader.innerText = "Sign in with Google";
//         if (sectionText) {
//           sectionText.innerText =
//             "Sync your Google Tasks workflow automatically with incoming assignments from Marcy LMS";
//         }
//         if (sectionCTAOAuth?.style) sectionCTAOAuth.style.display = "flex"; 
//         if (sectionCTAOAuth?.style) sectionCTAOAuth.innerText = "Sign in with Google";
//         if (sectionCTALink?.style) sectionCTALink.style.display = "none";
//         if (signoutButton?.style) signoutButton.style.display = "none";
//         break;

//       case USER_STATES.SIGNED_IN_GOOGLE_ONLY:
//         if (loadingSpinner) loadingSpinner.style.display = "none";
//         if (marcyLMSIconSVG?.style) marcyLMSIconSVG.style.display = "block";
//         if (googleIconSVG?.style) googleIconSVG.style.display = "none";
//         if (signedInAllSVG?.style) signedInAllSVG.style.display = "none";
//         if (sectionHeader) sectionHeader.innerText = "Sign in to Marcy LMS";
//         if (sectionText) {
//           sectionText.innerText =
//             "To use this extension you'll need to be signed into mls-lms.vercel.app/ and be an enrolled user";
//         }
//         if (sectionCTAOAuth?.style) sectionCTAOAuth.style.display = "none";
//         if (sectionCTALink?.style) sectionCTALink.style.display = "flex";
//         if (signoutButton?.style) signoutButton.style.display = "flex";
//         break;

//       case USER_STATES.SIGNED_IN_ALL:
//         if (loadingSpinner) loadingSpinner.style.display = "none";
//         if (marcyLMSIconSVG?.style) marcyLMSIconSVG.style.display = "none";
//         if (googleIconSVG?.style) googleIconSVG.style.display = "none";
//         if (signedInAllSVG?.style) signedInAllSVG.style.display = "block";
//         if (sectionHeader) sectionHeader.innerText = "Connected";
//         if (sectionText)
//           sectionText.innerText =
//             "Your Marcy LMS and Google Tasks are synchronized.";
//         if (sectionCTAOAuth?.style) sectionCTAOAuth.style.display = "none";
//         if (sectionCTALink?.style) sectionCTALink.style.display = "none";
//         if (signoutButton?.style) signoutButton.style.display = "flex";
//         if (getStartedButton?.style) getStartedButton.style.display = "flex";
//         break;

//       case USER_STATES.GETTING_STARTED:
//         if (signedInMenu) signedInMenu.style.display = 'flex';
//         if (signedOutMenu) signedInMenu.style.display = 'none';
//         if (settingsMenu) signedInMenu.style.display = 'none';
//         break;
//       case USER_STATES.SETTINGS_MENU:
//         if (signedInMenu) signedInMenu.style.display = 'none';
//         if (signedOutMenu) signedInMenu.style.display = 'none';
//         if (settingsMenu) signedInMenu.style.display = 'flex';
//       // case USER_STATES.DASHBOARD;
//       //   break;

//       case USER_STATES.SIGNED_OUT:
//       default:
//         if (loadingSpinner) loadingSpinner.style.display = "none";
//         if (marcyLMSIconSVG?.style) marcyLMSIconSVG.style.display = "block";
//         if (googleIconSVG?.style) googleIconSVG.style.display = "none";
//         if (sectionHeader) sectionHeader.innerText = "Sign in to Marcy LMS";
//         if (sectionText) {
//           sectionText.innerText =
//             "To use this extension you'll need to be signed into mls-lms.vercel.app/ and be an enrolled user";
//         }
//         if (sectionCTAOAuth?.style) sectionCTAOAuth.style.display = "none";
//         if (sectionCTALink?.style) sectionCTALink.style.display = "flex";
//         if (signoutButton?.style) signoutButton.style.display = "none";
//         break;
//     }
//   }

  
// }
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

//#region DOMContentLoaded
/**
 * Update the DOM, check auth and enable interactivity
 */
document.addEventListener("DOMContentLoaded", async () => {
  const router = new Router(document.getElementById('app-router'));

  



  console.log("DOMContentLoaded event fired...");

  updateDOMState();
  checkExistingOAuth2();
  checkExistingCredentials();

  const redirectNewTabLinkBtns = document.querySelectorAll(".redirect-new-tab-link",);

  settingsButton?.addEventListener("click", () => setSessionState({ isOnSettings: true }))
  sectionCTAOAuth?.addEventListener("click", handleAuthClick);
  signoutButton?.addEventListener("click", handleSignoutClick);

  
  redirectNewTabLinkBtns.forEach(function (btn) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      const targetURL = btn.getAttribute("href");
      chrome.tabs.create({ url: targetURL });
    });
  });
  
  handleThemeState();
});

/**
 * Updates automatically to the user's choice of theme on mls-lms.vercel.app/
 * @async 
 * @returns<void>
 */
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
//#endregion