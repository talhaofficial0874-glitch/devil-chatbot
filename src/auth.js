/**
 * AUTHENTICATION SERVICE FOR DEVIL CHATBOT
 * Manages user accounts, active sessions, and local credentials persistence
 */

const STORAGE_USERS_KEY = 'devil_registered_users';
const STORAGE_SESSION_KEY = 'devil_current_session';

/**
 * Returns list of registered users in localStorage
 */
function getRegisteredUsers() {
  const users = localStorage.getItem(STORAGE_USERS_KEY);
  return users ? JSON.parse(users) : [];
}

/**
 * Persists list of registered users
 */
function saveRegisteredUsers(users) {
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
}

/**
 * Retrieves the currently logged in user session object, or null (Guest Mode)
 */
export function getCurrentUser() {
  const session = localStorage.getItem(STORAGE_SESSION_KEY);
  return session ? JSON.parse(session) : null;
}

/**
 * Checks if a user is logged in
 */
export function isUserLoggedIn() {
  return getCurrentUser() !== null;
}

/**
 * Signs up a new user. Emits `authStateChange` event.
 */
export function signUpUser(name, email, password, avatar = 'skull') {
  const users = getRegisteredUsers();
  
  // Validate duplicate emails
  const emailLower = email.toLowerCase().trim();
  const exists = users.some(u => u.email === emailLower);
  if (exists) {
    throw new Error('An account with this email address already exists.');
  }

  const newUser = {
    id: 'user_' + Date.now(),
    name: name.trim(),
    email: emailLower,
    password: password, // In a local frontend demo, plain text is fine
    avatar: avatar,
    joinedAt: new Date().toISOString()
  };

  users.push(newUser);
  saveRegisteredUsers(users);

  // Auto-login after signing up
  localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(newUser));
  
  // Trigger cool confetti effect!
  if (window.confetti) {
    window.confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 }
    });
  }

  notifyStateChange();
  return newUser;
}

/**
 * Logs in a user. Emits `authStateChange` event.
 */
export function logInUser(email, password) {
  const users = getRegisteredUsers();
  const emailLower = email.toLowerCase().trim();
  
  const matchedUser = users.find(u => u.email === emailLower && u.password === password);
  if (!matchedUser) {
    throw new Error('Invalid email or password. Please try again.');
  }

  localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(matchedUser));
  notifyStateChange();
  return matchedUser;
}

/**
 * Mock Google Sign In / Registration. Emits `authStateChange` event.
 */
export function logInWithGoogleMock(name, email) {
  const users = getRegisteredUsers();
  const emailLower = email.toLowerCase().trim();
  
  let matchedUser = users.find(u => u.email === emailLower);
  
  if (!matchedUser) {
    matchedUser = {
      id: 'google_user_' + Date.now(),
      name: name.trim(),
      email: emailLower,
      password: 'google-oauth-token-dummy',
      avatar: 'crown',
      joinedAt: new Date().toISOString(),
      isGoogleAuth: true
    };
    users.push(matchedUser);
    saveRegisteredUsers(users);
  }
  
  localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(matchedUser));
  
  if (window.confetti) {
    window.confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });
  }
  
  notifyStateChange();
  return matchedUser;
}

/**
 * Logs out the current user session. Emits `authStateChange` event.
 */
export function logOutUser() {
  localStorage.removeItem(STORAGE_SESSION_KEY);
  notifyStateChange();
}

/**
 * Updates profile credentials
 */
export function updateProfileName(newName) {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;

  currentUser.name = newName.trim();
  localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(currentUser));

  // Sync users database
  const users = getRegisteredUsers();
  const index = users.findIndex(u => u.id === currentUser.id);
  if (index !== -1) {
    users[index].name = newName.trim();
    saveRegisteredUsers(users);
  }

  notifyStateChange();
  return currentUser;
}

/**
 * Updates profile avatar base64
 */
export function updateProfileAvatar(newAvatar) {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;

  currentUser.avatar = newAvatar;
  localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(currentUser));

  // Sync users database
  const users = getRegisteredUsers();
  const index = users.findIndex(u => u.id === currentUser.id);
  if (index !== -1) {
    users[index].avatar = newAvatar;
    saveRegisteredUsers(users);
  }

  notifyStateChange();
  return currentUser;
}

/**
 * Dispatches a global event informing components about login state updates
 */
function notifyStateChange() {
  const event = new CustomEvent('authStateChange', {
    detail: { user: getCurrentUser() }
  });
  window.dispatchEvent(event);
}
