/**
 * CHAT SERVICE FOR DEVIL CHATBOT
 * Manages database transcripts, Markdown rendering, syntax highlights, and history list
 */

import { getCurrentUser } from './auth.js';

const STORAGE_CHATS_KEY = 'devil_chat_sessions';

// Temporary lookup for code blocks clipboard functionality
const codeBlocksStore = {};

// Initialize Markdown-it parser
let md;
if (window.markdownit) {
  md = window.markdownit({
    html: false, // Security: prevent Raw HTML injection
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
      const codeId = 'code_' + Math.floor(Math.random() * 9999999);
      // Store plain text for copying
      codeBlocksStore[codeId] = str;

      const language = lang || 'code';
      let highlightedCode = '';

      if (lang && window.hljs && window.hljs.getLanguage(lang)) {
        try {
          highlightedCode = window.hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        } catch (__) {
          highlightedCode = md.utils.escapeHtml(str);
        }
      } else if (window.hljs) {
        highlightedCode = md.utils.escapeHtml(str);
      } else {
        highlightedCode = str;
      }

      // Return styled wrapper matching ChatGPT code blocks
      return `<div class="code-block-container">
        <div class="code-header">
          <span>${language.toLowerCase()}</span>
          <button class="copy-code-btn" data-code-id="${codeId}">
            <i data-lucide="copy"></i>
            <span>Copy code</span>
          </button>
        </div>
        <pre><code class="hljs language-${language}">${highlightedCode}</code></pre>
      </div>`;
    }
  });
}

/**
 * Returns active user identifier (either registered userId or "guest")
 */
function getActiveUserId() {
  const user = getCurrentUser();
  return user ? user.id : 'guest';
}

/**
 * Fetches all chats from localStorage
 */
function getAllChats() {
  const chats = localStorage.getItem(STORAGE_CHATS_KEY);
  return chats ? JSON.parse(chats) : [];
}

/**
 * Persists all chats to localStorage
 */
function saveAllChats(chats) {
  localStorage.setItem(STORAGE_CHATS_KEY, JSON.stringify(chats));
}

/**
 * Retrieves all chats corresponding to current logged in profile / guest session
 */
export function getChatsForCurrentUser() {
  const userId = getActiveUserId();
  const allChats = getAllChats();
  return allChats
    .filter(c => c.userId === userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/**
 * Creates a brand-new chat session
 */
export function createChat(title = 'New Chat') {
  const userId = getActiveUserId();
  const allChats = getAllChats();

  const newChat = {
    id: 'chat_' + Date.now(),
    userId: userId,
    title: title.trim(),
    messages: [],
    updatedAt: new Date().toISOString()
  };

  allChats.push(newChat);
  saveAllChats(allChats);
  return newChat;
}

/**
 * Deletes a chat session
 */
export function deleteChat(chatId) {
  let allChats = getAllChats();
  allChats = allChats.filter(c => c.id !== chatId);
  saveAllChats(allChats);
}

/**
 * Renames a chat title
 */
export function renameChat(chatId, newTitle) {
  const allChats = getAllChats();
  const index = allChats.findIndex(c => c.id === chatId);
  if (index !== -1) {
    allChats[index].title = newTitle.trim();
    allChats[index].updatedAt = new Date().toISOString();
    saveAllChats(allChats);
    return allChats[index];
  }
  return null;
}

/**
 * Appends messages or updates messages within an active chat session
 */
export function updateChatMessages(chatId, messages) {
  const allChats = getAllChats();
  const index = allChats.findIndex(c => c.id === chatId);
  if (index !== -1) {
    allChats[index].messages = messages;
    allChats[index].updatedAt = new Date().toISOString();
    saveAllChats(allChats);
    return allChats[index];
  }
  return null;
}

/**
 * Renders Markdown markup into standard web-safe HTML code
 */
export function renderMarkdown(markdownText) {
  if (!md) return markdownText;
  return md.render(markdownText);
}

/**
 * Copy code string helper by key ID
 */
export function copyCodeText(codeId) {
  const text = codeBlocksStore[codeId];
  if (text) {
    navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}

/**
 * Helper to divide chats into timeline categories: Today, Yesterday, Previous 7 Days, Older
 */
export function groupChatsByTimeline(chats) {
  const groups = {
    today: [],
    yesterday: [],
    last7days: [],
    older: []
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const sevenDaysStart = todayStart - 7 * 24 * 60 * 60 * 1000;

  chats.forEach(chat => {
    const chatTime = new Date(chat.updatedAt).getTime();
    if (chatTime >= todayStart) {
      groups.today.push(chat);
    } else if (chatTime >= yesterdayStart) {
      groups.yesterday.push(chat);
    } else if (chatTime >= sevenDaysStart) {
      groups.last7days.push(chat);
    } else {
      groups.older.push(chat);
    }
  });

  return groups;
}
