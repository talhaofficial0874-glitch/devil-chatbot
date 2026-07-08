/**
 * MAIN CONTROLLER FOR DEVIL CHATBOT
 * Initializes UI listeners, session triggers, state managers, and component bindings
 */

import { 
  getCurrentUser, 
  isUserLoggedIn, 
  signUpUser, 
  logInUser, 
  logOutUser, 
  updateProfileName,
  logInWithGoogleMock
} from './auth.js';

import { 
  getChatsForCurrentUser, 
  createChat, 
  deleteChat, 
  renameChat, 
  updateChatMessages, 
  renderMarkdown, 
  copyCodeText, 
  groupChatsByTimeline 
} from './chat.js';

import { 
  streamChatCompletions, 
  generateImageUrl, 
  saveApiKeyOverride, 
  getApiKey 
} from './api.js';

// Application State Variables
let currentChat = null;
let currentChatList = [];
let attachedImageBase64 = null;
let isImageGenMode = false;
let isGenerating = false;

// DOM Element Selectors
const docBody = document.body;
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const newChatBtn = document.getElementById('new-chat-btn');
const historyContainer = document.getElementById('history-container');

// Profile Cards
const profileCard = document.getElementById('profile-card');
const authTriggerBtn = document.getElementById('auth-trigger-btn');
const userAvatarIndicator = document.getElementById('user-avatar-indicator');
const headerAvatar = document.getElementById('header-avatar');
const guestWarningBadge = document.getElementById('guest-warning-badge');

// Chat Panels
const chatCurrentTitle = document.getElementById('chat-current-title');
const modelBadge = document.getElementById('model-badge');
const welcomeScreen = document.getElementById('welcome-screen');
const messagesList = document.getElementById('messages-list');
const chatViewport = document.querySelector('.chat-viewport');

// Input Controls
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const imageFileInput = document.getElementById('image-file-input');
const imagePreviewBanner = document.getElementById('image-preview-banner');
const attachedImagePreview = document.getElementById('attached-image-preview');
const removeAttachmentBtn = document.getElementById('remove-attachment-btn');
const imageGenToggle = document.getElementById('image-gen-toggle');

// Modals
const authModal = document.getElementById('auth-modal');
const closeAuthModal = document.getElementById('close-auth-modal');
const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');
const switchToSignup = document.getElementById('switch-to-signup');
const switchToLogin = document.getElementById('switch-to-login');

// Google Chooser Modals
const googleChooserModal = document.getElementById('google-chooser-modal');
const closeGoogleChooser = document.getElementById('close-google-chooser');
const googleLoginBtn = document.getElementById('google-login-btn');
const googleSignupBtn = document.getElementById('google-signup-btn');
const googleUseCustomBtn = document.getElementById('google-use-custom');

// Settings
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsModal = document.getElementById('close-settings-modal');
const themeSelect = document.getElementById('theme-select');
const modelSelect = document.getElementById('model-select');
const systemPromptInput = document.getElementById('system-prompt-input');
const apiKeyOverride = document.getElementById('api-key-override');
const clearChatsBtn = document.getElementById('clear-chats-btn');

// Settings Profile Pane
const settingsProfileLoggedIn = document.getElementById('settings-profile-logged-in');
const settingsProfileGuest = document.getElementById('settings-profile-guest');
const settingsLoginTrigger = document.getElementById('settings-login-trigger');
const metaAvatarDisplay = document.getElementById('meta-avatar-display');
const metaNameDisplay = document.getElementById('meta-name-display');
const metaEmailDisplay = document.getElementById('meta-email-display');
const editDisplayName = document.getElementById('edit-display-name');
const saveProfileNameBtn = document.getElementById('save-profile-name-btn');
const logoutBtn = document.getElementById('logout-btn');

// Image Zoom Modal
const zoomModal = document.getElementById('zoom-modal');
const closeZoomModal = document.getElementById('close-zoom-modal');
const zoomImgContent = document.getElementById('zoom-img-content');
const zoomDownloadLink = document.getElementById('zoom-download-link');

// Email Verification Modal
const verificationModal = document.getElementById('verification-modal');
const closeVerificationModal = document.getElementById('close-verification-modal');
const verificationTargetEmail = document.getElementById('verification-target-email');
const openInboxBtn = document.getElementById('open-inbox-btn');
const submitVerificationBtn = document.getElementById('submit-verification-btn');
const verificationError = document.getElementById('verification-error');
const verificationDigits = document.querySelectorAll('.verification-input-digit');

/* =========================================================================
   INITIALIZATION & SETUP
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAppState();
  registerGlobalListeners();
  
  // Render Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

/**
 * Loads default theme configurations
 */
function initTheme() {
  const savedTheme = localStorage.getItem('devil_app_theme') || 'dark';
  docBody.classList.remove('dark-theme', 'light-theme');
  docBody.classList.add(`${savedTheme}-theme`);
  themeSelect.value = savedTheme;
}

/**
 * Initializes workspace parameters and loads user sessions
 */
function initAppState() {
  // Sync system prompt input
  const defaultPrompt = localStorage.getItem('devil_system_prompt');
  if (defaultPrompt) {
    systemPromptInput.value = defaultPrompt;
  }

  // Pre-load api key override
  const overrideKey = localStorage.getItem('devil_api_key_override');
  if (overrideKey) {
    apiKeyOverride.value = overrideKey;
  }

  // Bind active model
  const activeModel = localStorage.getItem('devil_active_model') || 'llama-3.3-70b-versatile';
  modelSelect.value = activeModel;
  updateModelBadge(activeModel);

  // Load session UI profile
  updateAuthUI();

  // Load user's conversations
  refreshChatList();

  // Auto-collapse sidebar on smaller screens
  if (window.innerWidth < 768) {
    sidebar.classList.add('collapsed');
  }
}

/**
 * Syncs the active UI model identifier badge
 */
function updateModelBadge(modelId) {
  let label = 'Llama 3.3';
  if (modelId.includes('3.2')) {
    label = 'Llama Vision';
  } else if (modelId.includes('3.1')) {
    label = 'Llama Fast';
  }
  modelBadge.textContent = label;
}

/**
 * Refreshes sidebar list and resets chat selections
 */
function refreshChatList() {
  currentChatList = getChatsForCurrentUser();
  
  if (currentChatList.length === 0) {
    // Auto create first chat for user
    const newSession = createChat('First Conversation');
    currentChatList = [newSession];
  }

  // Maintain active chat selection or default to the most recent chat
  if (!currentChat || !currentChatList.some(c => c.id === currentChat.id)) {
    selectChat(currentChatList[0].id);
  } else {
    // Find the latest state of currentChat
    const updated = currentChatList.find(c => c.id === currentChat.id);
    if (updated) currentChat = updated;
    renderSidebarHistory();
  }
}

/* =========================================================================
   AUTHENTICATION UI LOGIC
   ========================================================================= */

function updateAuthUI() {
  const loggedIn = isUserLoggedIn();
  const user = getCurrentUser();

  if (loggedIn && user) {
    // Update Sidebar footer profile card
    profileCard.classList.remove('guest-mode');
    profileCard.querySelector('.avatar-placeholder').innerHTML = `<img src="https://api.dicebear.com/7.x/bottts/svg?seed=${user.avatar}" class="avatar-img" alt="Avatar">`;
    profileCard.querySelector('.profile-name').textContent = user.name;
    profileCard.querySelector('.profile-status').textContent = 'Full Premium Access';
    authTriggerBtn.innerHTML = `<i data-lucide="log-out"></i>`;
    authTriggerBtn.title = "Log Out";
    
    // Top nav profile details
    guestWarningBadge.classList.add('hidden');
    userAvatarIndicator.classList.remove('hidden');
    headerAvatar.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.avatar}`;

    // Enable/Unlock premium attachments and graphics features
    attachBtn.classList.remove('disabled');
    attachBtn.title = "Attach Image";
    imageGenToggle.classList.remove('disabled');
    imageGenToggle.title = "Toggle Image Generation Mode";
    document.getElementById('suggest-image-card').classList.remove('font-restricted');

    // Update settings account pane details
    settingsProfileLoggedIn.classList.remove('hidden');
    settingsProfileGuest.classList.add('hidden');
    metaAvatarDisplay.innerHTML = `<img src="https://api.dicebear.com/7.x/bottts/svg?seed=${user.avatar}" alt="Avatar">`;
    metaNameDisplay.textContent = user.name;
    metaEmailDisplay.textContent = user.email;
    editDisplayName.value = user.name;

  } else {
    // Guest configuration
    profileCard.classList.add('guest-mode');
    profileCard.querySelector('.avatar-placeholder').innerHTML = `<i data-lucide="user"></i>`;
    profileCard.querySelector('.profile-name').textContent = 'Guest Mode';
    profileCard.querySelector('.profile-status').textContent = 'Limited Access';
    authTriggerBtn.innerHTML = `<i data-lucide="log-in"></i>`;
    authTriggerBtn.title = "Login / Sign Up";

    guestWarningBadge.classList.remove('hidden');
    userAvatarIndicator.classList.add('hidden');

    // Disable premium attachments
    attachBtn.classList.add('disabled');
    attachBtn.title = "Login to attach images";
    imageGenToggle.classList.add('disabled');
    imageGenToggle.title = "Login to generate graphics";
    document.getElementById('suggest-image-card').classList.add('font-restricted');

    // Update settings account details
    settingsProfileLoggedIn.classList.add('hidden');
    settingsProfileGuest.classList.remove('hidden');
    
    // De-activate generation mode if guest logs out
    resetImageGenMode();
    resetAttachment();
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Handle globally emitted Authentication changes
 */
window.addEventListener('authStateChange', () => {
  updateAuthUI();
  refreshChatList();
});

/* =========================================================================
   UI RENDERING LOGIC (CHAT TRANSCRIPTS & SIDEBAR)
   ========================================================================= */

/**
 * Populates chat histories into grouped elements within the sidebar panel
 */
function renderSidebarHistory() {
  const grouped = groupChatsByTimeline(currentChatList);
  historyContainer.innerHTML = '';

  const groupsConfig = [
    { title: 'Today', key: 'today' },
    { title: 'Yesterday', key: 'yesterday' },
    { title: 'Previous 7 Days', key: 'last7days' },
    { title: 'Older Conversations', key: 'older' }
  ];

  let hasChats = false;

  groupsConfig.forEach(group => {
    const list = grouped[group.key];
    if (list.length === 0) return;
    
    hasChats = true;

    // Header label
    const headerEl = document.createElement('div');
    headerEl.className = 'history-group-title';
    headerEl.textContent = group.title;
    historyContainer.appendChild(headerEl);

    // List rendering
    list.forEach(chat => {
      const itemEl = document.createElement('div');
      itemEl.className = `history-item ${currentChat?.id === chat.id ? 'active' : ''}`;
      itemEl.setAttribute('data-chat-id', chat.id);

      itemEl.innerHTML = `
        <div class="history-item-left">
          <i data-lucide="message-square"></i>
          <span class="history-item-title">${escapeHtml(chat.title)}</span>
        </div>
        <div class="history-item-actions">
          <button class="history-action-btn edit-btn" title="Rename Chat">
            <i data-lucide="pencil"></i>
          </button>
          <button class="history-action-btn delete-btn" title="Delete Chat">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;

      historyContainer.appendChild(itemEl);
    });
  });

  if (!hasChats) {
    historyContainer.innerHTML = `
      <div class="history-empty-state">
        <i data-lucide="message-square-dashed"></i>
        <p>No chat history yet</p>
      </div>
    `;
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Loads current transcript content details
 */
function selectChat(chatId) {
  const selected = currentChatList.find(c => c.id === chatId);
  if (!selected) return;

  currentChat = selected;
  chatCurrentTitle.textContent = currentChat.title;
  
  renderSidebarHistory();
  renderChatMessages();
}

/**
 * Redraws chat viewport messages
 */
function renderChatMessages() {
  messagesList.innerHTML = '';

  if (!currentChat || currentChat.messages.length === 0) {
    welcomeScreen.classList.remove('hidden');
    return;
  }

  welcomeScreen.classList.add('hidden');

  currentChat.messages.forEach(msg => {
    appendMessageDOM(msg.role, msg.content, {
      image: msg.image,
      isGeneratedImage: msg.isGeneratedImage
    });
  });

  autoScrollToBottom();
}

/**
 * Injects a message item inside the messagesList element
 */
function appendMessageDOM(role, content, options = {}) {
  const { image, isGeneratedImage, isLoading = false, tempId = null } = options;
  const isUser = role === 'user';
  
  const user = getCurrentUser();

  const wrapperEl = document.createElement('div');
  wrapperEl.className = `message-wrapper ${role}`;
  if (tempId) wrapperEl.setAttribute('id', tempId);

  // Compute avatar
  let avatarHTML = '';
  if (isUser) {
    if (user) {
      avatarHTML = `<img src="https://api.dicebear.com/7.x/bottts/svg?seed=${user.avatar}" class="avatar-img" alt="User">`;
    } else {
      avatarHTML = `<i data-lucide="user"></i>`;
    }
  } else {
    avatarHTML = `<i data-lucide="skull"></i>`;
  }

  const avatarContainer = document.createElement('div');
  avatarContainer.className = 'message-avatar';
  avatarContainer.innerHTML = avatarHTML;

  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'message-bubble';

  // Sender metadata
  const senderEl = document.createElement('div');
  senderEl.className = 'message-sender';
  senderEl.textContent = isUser ? (user ? user.name : 'Guest User') : 'Devil';
  bubbleEl.appendChild(senderEl);

  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';

  if (isLoading) {
    contentEl.innerHTML = `
      <div class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
  } else if (isGeneratedImage) {
    // Visual graphic bubble layout
    contentEl.innerHTML = `
      <p>${escapeHtml(content)}</p>
      <div class="generated-image-card">
        <div class="image-loading-placeholder">
          <div class="typing-indicator" style="justify-content: center; margin-bottom: 8px;">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
          <span style="font-size: 11px; color: var(--text-secondary);">Drawing graphic...</span>
        </div>
        <img class="trigger-zoom-preview hidden" src="${image}" alt="Generated AI graphics" onload="this.previousElementSibling.remove(); this.classList.remove('hidden');">
        <div class="generated-image-actions">
          <span>AI Generated Graphic</span>
          <button class="generated-image-btn download-action" data-url="${image}">
            <i data-lucide="download"></i>
            <span>Download</span>
          </button>
        </div>
      </div>
    `;
  } else {
    // Default text compiles markdown
    contentEl.innerHTML = renderMarkdown(content);
    
    // Add uploaded image attachments
    if (image) {
      const imgEl = document.createElement('img');
      imgEl.className = 'attached-msg-image trigger-zoom-preview';
      imgEl.src = image;
      imgEl.alt = "Uploaded image";
      contentEl.appendChild(imgEl);
    }
  }

  bubbleEl.appendChild(contentEl);
  wrapperEl.appendChild(avatarContainer);
  wrapperEl.appendChild(bubbleEl);
  
  messagesList.appendChild(wrapperEl);
  
  if (window.lucide) {
    window.lucide.createIcons();
  }

  autoScrollToBottom();
}

/**
 * Keeps chat view aligned downwards
 */
function autoScrollToBottom() {
  chatViewport.scrollTop = chatViewport.scrollHeight;
}

/* =========================================================================
   USER INPUT & SUBMISSION HANDLING
   ========================================================================= */

/**
 * Validates text inputs and enables send buttons
 */
messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = (messageInput.scrollHeight) + 'px';
  toggleSendButtonState();
});

function toggleSendButtonState() {
  const hasText = messageInput.value.trim().length > 0;
  const hasAttachment = attachedImageBase64 !== null;
  sendBtn.disabled = !(hasText || hasAttachment) || isGenerating;
}

/**
 * Image attachment input handler
 */
attachBtn.addEventListener('click', () => {
  if (!isUserLoggedIn()) {
    openModal(authModal);
    return;
  }
  imageFileInput.click();
});

imageFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Verify file is an image
  if (!file.type.startsWith('image/')) {
    alert('Please attach an image file.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    attachedImageBase64 = event.target.result;
    attachedImagePreview.src = attachedImageBase64;
    imagePreviewBanner.classList.remove('hidden');
    toggleSendButtonState();
    messageInput.focus();
  };
  reader.readAsDataURL(file);
});

removeAttachmentBtn.addEventListener('click', resetAttachment);

function resetAttachment() {
  attachedImageBase64 = null;
  imageFileInput.value = '';
  imagePreviewBanner.classList.add('hidden');
  attachedImagePreview.src = '';
  toggleSendButtonState();
}

/**
 * Image Generation mode toggle settings
 */
imageGenToggle.addEventListener('click', () => {
  if (!isUserLoggedIn()) {
    openModal(authModal);
    return;
  }

  isImageGenMode = !isImageGenMode;
  if (isImageGenMode) {
    imageGenToggle.classList.add('active');
    messageInput.placeholder = "Describe the graphic you want Devil to draw...";
  } else {
    resetImageGenMode();
  }
  messageInput.focus();
});

function resetImageGenMode() {
  isImageGenMode = false;
  imageGenToggle.classList.remove('active');
  messageInput.placeholder = "Message Devil...";
}

/**
 * Handles message form submissions
 */
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const text = messageInput.value.trim();
  const attachment = attachedImageBase64;

  if (!(text || attachment) || isGenerating) return;

  // Auto-detect image generation requests
  const lowerText = text.toLowerCase();
  const imageKeywords = ['draw', 'generate image', 'generate an image', 'create a picture', 'create a photo', 'draw a picture', 'make an image', 'make a graphic', 'draw an image', '/image', '/draw', 'draw a'];
  const detectsImageIntent = imageKeywords.some(keyword => lowerText.startsWith(keyword) || lowerText.includes(keyword));
  const requiresImageGen = isImageGenMode || (detectsImageIntent && !attachment);

  // Authenticate gate for image generation
  if (requiresImageGen && !isUserLoggedIn()) {
    alert('Please log in or create an account to generate AI images!');
    openModal(authModal);
    return;
  }

  // Clear inputs and reset layouts
  messageInput.value = '';
  messageInput.style.height = 'auto';
  resetAttachment();
  isGenerating = true;
  toggleSendButtonState();

  // If chat was empty, hide welcome screen
  welcomeScreen.classList.add('hidden');

  // Add message log to state
  const userMessage = {
    role: 'user',
    content: text || (attachment ? 'Attached Image' : ''),
    image: attachment
  };

  currentChat.messages.push(userMessage);
  appendMessageDOM('user', userMessage.content, { image: userMessage.image });

  // Update chat tab title on the first message
  if (currentChat.messages.length === 1 && text) {
    const cleanTitle = text.length > 25 ? text.substring(0, 25) + '...' : text;
    currentChat.title = cleanTitle;
    chatCurrentTitle.textContent = cleanTitle;
  }

  // Save changes locally
  updateChatMessages(currentChat.id, currentChat.messages);
  refreshChatList();

  // Loading indicator ID
  const tempBotMsgId = 'bot_temp_' + Date.now();
  appendMessageDOM('assistant', '', { isLoading: true, tempId: tempBotMsgId });

  try {
    if (requiresImageGen) {
      // Clean prefix if it was `/image` or similar
      let cleanPrompt = text;
      if (text.startsWith('/image')) {
        cleanPrompt = text.substring(6).trim();
      } else if (text.startsWith('/draw')) {
        cleanPrompt = text.substring(5).trim();
      }
      await handleImageGeneration(cleanPrompt, tempBotMsgId);
    } else {
      await handleGroqChatCompletion(tempBotMsgId);
    }
  } catch (err) {
    // Handle error UI injection
    const errorBubble = document.getElementById(tempBotMsgId);
    if (errorBubble) {
      errorBubble.querySelector('.message-content').innerHTML = `
        <div class="auth-error-msg">
          Error: ${err.message || 'Failed to connect. Please check network/settings.'}
        </div>
      `;
    }
  } finally {
    isGenerating = false;
    resetImageGenMode();
    toggleSendButtonState();
  }
});

/**
 * Executes image draw prompts via Pollinations AI
 */
async function handleImageGeneration(promptText, elementId) {
  const targetPrompt = promptText || 'A creative artwork';
  
  const imageUrl = await generateImageUrl(targetPrompt);
  
  const botMessage = {
    role: 'assistant',
    content: `Here is the graphic for: "${targetPrompt}"`,
    image: imageUrl,
    isGeneratedImage: true
  };

  // Replace placeholder loader with the generated image card
  const placeholderEl = document.getElementById(elementId);
  if (placeholderEl) {
    placeholderEl.remove();
  }

  currentChat.messages.push(botMessage);
  appendMessageDOM('assistant', botMessage.content, {
    image: botMessage.image,
    isGeneratedImage: true
  });

  updateChatMessages(currentChat.id, currentChat.messages);
}

/**
 * Triggers completion prompts through Groq API
 */
async function handleGroqChatCompletion(elementId) {
  // Format API payload transcript logs
  const payloadMessages = currentChat.messages.map(m => {
    // Multimodal parsing
    if (m.role === 'user' && m.image) {
      return {
        role: 'user',
        content: [
          { type: 'text', text: m.content || 'Explain this image' },
          { type: 'image_url', image_url: { url: m.image } }
        ]
      };
    }
    return {
      role: m.role,
      content: m.content
    };
  });

  // Pick model defaults
  let selectedModel = modelSelect.value;
  
  // Force vision preview if image was sent
  const lastUserMsg = currentChat.messages[currentChat.messages.length - 1];
  if (lastUserMsg && lastUserMsg.image) {
    selectedModel = 'llama-3.2-11b-vision-preview';
  }

  const systemPrompt = systemPromptInput.value.trim() || 'You are Devil, a helpful AI assistant.';

  const placeholderEl = document.getElementById(elementId);
  let contentContainer = null;
  if (placeholderEl) {
    contentContainer = placeholderEl.querySelector('.message-content');
    contentContainer.innerHTML = ''; // Remove typing loader dots
  }

  let finalMarkdown = '';

  await streamChatCompletions(payloadMessages, {
    model: selectedModel,
    systemPrompt: systemPrompt,
    onChunk: (chunk, cumulText) => {
      finalMarkdown = cumulText;
      if (contentContainer) {
        contentContainer.innerHTML = renderMarkdown(cumulText);
        // Bind Copy buttons inside streaming blocks
        bindCodeCopyButtons(contentContainer);
      }
      autoScrollToBottom();
    },
    onComplete: (completedText) => {
      const botMessage = {
        role: 'assistant',
        content: completedText
      };
      currentChat.messages.push(botMessage);
      updateChatMessages(currentChat.id, currentChat.messages);
      
      // Final re-render of code syntax rendering
      if (contentContainer) {
        contentContainer.innerHTML = renderMarkdown(completedText);
        bindCodeCopyButtons(contentContainer);
      }
      if (window.lucide) {
        window.lucide.createIcons();
      }
    },
    onError: (err) => {
      throw err; // bubble error up to catch block in submit
    }
  });
}

function bindCodeCopyButtons(container) {
  const buttons = container.querySelectorAll('.copy-code-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const codeId = btn.getAttribute('data-code-id');
      const success = copyCodeText(codeId);
      if (success) {
        const span = btn.querySelector('span');
        const icon = btn.querySelector('i');
        
        span.textContent = 'Copied!';
        btn.classList.add('copied');
        
        setTimeout(() => {
          span.textContent = 'Copy code';
          btn.classList.remove('copied');
        }, 2000);
      }
    });
  });
}

/* =========================================================================
   GLOBAL CONTROLLER LISTENERS & DELEGATIONS
   ========================================================================= */

function registerGlobalListeners() {
  
  // Toggle Sidebar Menu
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  // Auto-collapse sidebar on mobile when clicking chat viewport
  document.querySelector('.chat-viewport').addEventListener('click', () => {
    if (window.innerWidth < 768 && !sidebar.classList.contains('collapsed')) {
      sidebar.classList.add('collapsed');
    }
  });

  // Create New Chat
  newChatBtn.addEventListener('click', () => {
    const newSession = createChat('New Conversation');
    refreshChatList();
    selectChat(newSession.id);
    messageInput.focus();
    if (window.innerWidth < 768) {
      sidebar.classList.add('collapsed');
    }
  });

  // Suggestion Cards Clicking
  document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
      // Check restricted actions
      if (card.classList.contains('font-restricted') && !isUserLoggedIn()) {
        openModal(authModal);
        return;
      }

      const val = card.getAttribute('data-prompt');
      if (val.startsWith('/image')) {
        // Trigger graphics mode
        isImageGenMode = true;
        imageGenToggle.classList.add('active');
        messageInput.placeholder = "Describe the graphic you want Devil to draw...";
        messageInput.value = val.substring(7);
      } else {
        messageInput.value = val;
      }
      
      messageInput.style.height = 'auto';
      messageInput.style.height = (messageInput.scrollHeight) + 'px';
      toggleSendButtonState();
      messageInput.focus();
    });
  });

  // Sidebar History Item Actions Delegation
  historyContainer.addEventListener('click', (e) => {
    const item = e.target.closest('.history-item');
    if (!item) return;

    const chatId = item.getAttribute('data-chat-id');

    // Clicked Delete
    if (e.target.closest('.delete-btn')) {
      e.stopPropagation();
      if (confirm('Are you sure you want to delete this conversation?')) {
        deleteChat(chatId);
        currentChat = null;
        refreshChatList();
      }
      return;
    }

    // Clicked Rename / Edit Title
    if (e.target.closest('.edit-btn')) {
      e.stopPropagation();
      const titleSpan = item.querySelector('.history-item-title');
      const oldTitle = titleSpan.textContent;
      
      const inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.className = 'history-item-input';
      inputEl.value = oldTitle;
      
      titleSpan.replaceWith(inputEl);
      inputEl.focus();

      const saveRename = () => {
        const val = inputEl.value.trim();
        if (val && val !== oldTitle) {
          renameChat(chatId, val);
          refreshChatList();
        } else {
          // Put back regular title
          inputEl.replaceWith(titleSpan);
        }
      };

      inputEl.addEventListener('blur', saveRename);
      inputEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') saveRename();
      });
      return;
    }

    // Standard Chat item click selects chat
    selectChat(chatId);
    if (window.innerWidth < 768) {
      sidebar.classList.add('collapsed');
    }
  });

  // Settings Tabs Toggles
  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const paneId = `pane-${btn.getAttribute('data-tab')}`;
      document.getElementById(paneId).classList.add('active');
    });
  });

  // Theme settings modifier
  themeSelect.addEventListener('change', (e) => {
    const theme = e.target.value;
    docBody.classList.remove('dark-theme', 'light-theme');
    docBody.classList.add(`${theme}-theme`);
    localStorage.setItem('devil_app_theme', theme);
  });

  // Model settings modifier
  modelSelect.addEventListener('change', (e) => {
    const model = e.target.value;
    localStorage.setItem('devil_active_model', model);
    updateModelBadge(model);
  });

  // Clear chats trigger
  clearChatsBtn.addEventListener('click', () => {
    if (confirm('This will permanently delete all your chats. Continue?')) {
      localStorage.removeItem(STORAGE_CHATS_KEY);
      currentChat = null;
      refreshChatList();
      closeModal(settingsModal);
    }
  });

  // API Key override settings
  apiKeyOverride.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    saveApiKeyOverride(val);
  });

  systemPromptInput.addEventListener('input', (e) => {
    localStorage.setItem('devil_system_prompt', e.target.value);
  });

  // Image Zoom triggers inside chats delegation
  messagesList.addEventListener('click', (e) => {
    const img = e.target.closest('.trigger-zoom-preview');
    if (img) {
      zoomImgContent.src = img.src;
      zoomDownloadLink.href = img.src;
      openModal(zoomModal);
      return;
    }

    // Download action handler for generated graphics
    const dlBtn = e.target.closest('.download-action');
    if (dlBtn) {
      e.preventDefault();
      const url = dlBtn.getAttribute('data-url');
      downloadImageFile(url);
    }
  });

  // Modal open triggers
  settingsBtn.addEventListener('click', () => openModal(settingsModal));
  authTriggerBtn.addEventListener('click', () => {
    if (isUserLoggedIn()) {
      if (confirm('Are you sure you want to log out of your account?')) {
        logOutUser();
      }
    } else {
      openModal(authModal);
    }
  });

  settingsLoginTrigger.addEventListener('click', () => {
    closeModal(settingsModal);
    openModal(authModal);
  });

  // Modal close triggers
  closeAuthModal.addEventListener('click', () => closeModal(authModal));
  closeSettingsModal.addEventListener('click', () => closeModal(settingsModal));
  closeZoomModal.addEventListener('click', () => closeModal(zoomModal));

  // Toggle Login/Signup screens
  switchToSignup.addEventListener('click', () => {
    loginView.classList.add('hidden');
    signupView.classList.remove('hidden');
  });

  switchToLogin.addEventListener('click', () => {
    signupView.classList.add('hidden');
    loginView.classList.remove('hidden');
  });

  // Submit Authentication forms
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;

    try {
      logInUser(email, pass);
      closeModal(authModal);
      loginForm.reset();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.classList.remove('hidden');
    }
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupError.classList.add('hidden');

    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const pass = document.getElementById('signup-password').value;
    const avatar = document.querySelector('input[name="avatar"]:checked').value;

    // Validate email pattern
    if (!email.includes('@') || !email.includes('.')) {
      signupError.textContent = 'Please enter a valid email address.';
      signupError.classList.remove('hidden');
      return;
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    window.pendingRegistration = { name, email, pass, avatar, code: verificationCode };

    // Disable button to prevent double-submit
    const signupSubmitBtn = signupForm.querySelector('.submit-auth-btn');
    const originalText = signupSubmitBtn.textContent;
    signupSubmitBtn.disabled = true;
    signupSubmitBtn.textContent = 'Sending Verification...';

    try {
      const response = await fetch('/api/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode, name })
      });

      let data = {};
      try {
        data = await response.json();
      } catch (e) {}

      if (response.ok && data.success) {
        // Remove fallback note if it exists
        const fallbackNote = document.getElementById('verification-fallback-note');
        if (fallbackNote) fallbackNote.remove();

        // Prepare Verification Modal
        verificationTargetEmail.textContent = email;
        openInboxBtn.href = data.previewUrl;
        openInboxBtn.classList.remove('hidden');
        
        closeModal(authModal);
        openModal(verificationModal);
        
        // Auto focus first verification input box
        setTimeout(() => {
          verificationDigits[0].focus();
        }, 300);
      } else {
        throw new Error(data.error || 'Failed to dispatch confirmation email.');
      }
    } catch (err) {
      console.warn('Mail server unavailable, using static fallback code:', verificationCode);
      
      // Fallback for static servers: show code directly in a message
      verificationTargetEmail.textContent = email;
      openInboxBtn.classList.add('hidden');
      
      let fallbackNote = document.getElementById('verification-fallback-note');
      if (!fallbackNote) {
        fallbackNote = document.createElement('p');
        fallbackNote.id = 'verification-fallback-note';
        fallbackNote.style.color = 'var(--text-muted)';
        fallbackNote.style.fontSize = '12px';
        fallbackNote.style.marginTop = '15px';
        fallbackNote.style.textAlign = 'center';
        fallbackNote.style.lineHeight = '1.4';
        const modalContent = document.querySelector('#verification-modal .modal-content');
        if (modalContent) {
          modalContent.appendChild(fallbackNote);
        }
      }
      fallbackNote.innerHTML = `Ethereal Mail is offline for static hosts.<br>Your verification code is: <strong style="color: var(--accent-color); font-size: 15px;">${verificationCode}</strong>`;

      closeModal(authModal);
      openModal(verificationModal);
      
      setTimeout(() => {
        verificationDigits[0].focus();
      }, 300);
    } finally {
      signupSubmitBtn.disabled = false;
      signupSubmitBtn.textContent = originalText;
    }
  });

  // Close Verification Modal
  closeVerificationModal.addEventListener('click', () => {
    closeModal(verificationModal);
    window.pendingRegistration = null;
  });

  // Focus navigation for individual verification code inputs
  verificationDigits.forEach((input, idx) => {
    input.addEventListener('input', () => {
      // Keep only numbers
      input.value = input.value.replace(/[^0-9]/g, '');
      
      if (input.value.length === 1 && idx < 5) {
        verificationDigits[idx + 1].focus();
      }
      
      checkCodeInputsCompleted();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && input.value.length === 0 && idx > 0) {
        verificationDigits[idx - 1].focus();
        e.preventDefault();
      }
    });
  });

  function checkCodeInputsCompleted() {
    let fullCode = '';
    verificationDigits.forEach(input => {
      fullCode += input.value;
    });
    
    const isFull = fullCode.length === 6;
    submitVerificationBtn.disabled = !isFull;
  }

  // Handle Verification Confirmation Code Submit
  submitVerificationBtn.addEventListener('click', () => {
    verificationError.classList.add('hidden');
    
    let enteredCode = '';
    verificationDigits.forEach(input => {
      enteredCode += input.value;
    });

    const pending = window.pendingRegistration;
    if (!pending) return;

    if (enteredCode === pending.code) {
      try {
        signUpUser(pending.name, pending.email, pending.pass, pending.avatar);
        closeModal(verificationModal);
        signupForm.reset();
        
        // Reset digits and buttons state
        verificationDigits.forEach(input => input.value = '');
        submitVerificationBtn.disabled = true;
        
        window.pendingRegistration = null;
      } catch (err) {
        verificationError.textContent = err.message;
        verificationError.classList.remove('hidden');
      }
    } else {
      verificationError.textContent = 'Invalid verification code. Please check your Ethereal mailbox.';
      verificationError.classList.remove('hidden');
    }
  });

  saveProfileNameBtn.addEventListener('click', () => {
    const val = editDisplayName.value.trim();
    if (val) {
      updateProfileName(val);
      alert('Profile name updated successfully.');
    }
  });

  logoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to log out of your account?')) {
      logOutUser();
      closeModal(settingsModal);
    }
  });

  // Google Sign In Event Handlers
  googleLoginBtn.addEventListener('click', () => {
    closeModal(authModal);
    openModal(googleChooserModal);
  });
  googleSignupBtn.addEventListener('click', () => {
    closeModal(authModal);
    openModal(googleChooserModal);
  });
  closeGoogleChooser.addEventListener('click', () => {
    closeModal(googleChooserModal);
  });

  document.querySelectorAll('.google-account-item[data-email]').forEach(item => {
    item.addEventListener('click', () => {
      const email = item.getAttribute('data-email');
      const name = item.getAttribute('data-name');
      logInWithGoogleMock(name, email);
      closeModal(googleChooserModal);
    });
  });

  googleUseCustomBtn.addEventListener('click', () => {
    const email = prompt('Enter your Google email address:');
    if (!email) return;
    if (!email.includes('@') || !email.includes('.')) {
      alert('Please enter a valid email address.');
      return;
    }
    const defaultName = email.split('@')[0];
    const name = prompt('Enter your display name:', defaultName) || defaultName;
    logInWithGoogleMock(name, email);
    closeModal(googleChooserModal);
  });

  // Escape key hides modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(authModal);
      closeModal(settingsModal);
      closeModal(zoomModal);
      closeModal(googleChooserModal);
      closeModal(verificationModal);
    }
  });
}

function openModal(modalEl) {
  modalEl.classList.remove('hidden');
}

function closeModal(modalEl) {
  modalEl.classList.add('hidden');
}

/**
 * Downloads base64 image data to the browser
 */
async function downloadImageFile(url) {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Image failed to load via CORS'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `devil-draw-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    console.error('Canvas export failed, downloading fallback URL directly:', e);
    // Fall back to opening direct link
    const link = document.createElement('a');
    link.href = url;
    link.download = `devil-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/* =========================================================================
   TEXT ESCAPER HELPERS
   ========================================================================= */

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
