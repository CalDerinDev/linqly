// Linqly Background Service Worker

// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Linqly] Extension installed successfully!');
    
    // Set default settings
    chrome.storage.sync.set({
      'linqly_enabled': true
    });
  } else if (details.reason === 'update') {
    console.log('[Linqly] Extension updated to version', chrome.runtime.getManifest().version);
  }
  
  // Setup context menus on install/update
  setupContextMenus();
  
  // Disable action by default
  chrome.action.disable();
  
  // Initialize extension for all existing Clio tabs
  initializeForAllClioTabs();
});

// Handle browser startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[Linqly] Browser started, initializing extension...');
  setupContextMenus();
  
  // Initialize any existing Clio tabs
  initializeForAllClioTabs();
  
  // Also set up a one-time listener for tab updates that might happen after startup
  const onTabUpdated = (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.match(/^https:\/\/.*\.clio\.com\/.*/)) {
      console.log('[Linqly] Tab finished loading after browser start:', tab.url);
      initializeClioTab(tabId, tab.url);
      // Remove this listener after the first successful tab update
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
    }
  };
  
  chrome.tabs.onUpdated.addListener(onTabUpdated);
});

// Initialize a specific Clio tab
function initializeClioTab(tabId, url) {
  if (!tabId) return;
  
  // Enable the extension for this tab
  chrome.action.enable(tabId);
  
  // Send initialization message with retry logic
  const sendInitMessage = (retryCount = 0) => {
    chrome.tabs.sendMessage(tabId, { type: 'EXTENSION_ENABLED' })
      .catch(err => {
        console.log(`[Linqly] Tab ${tabId} not ready yet (${retryCount + 1}/3):`, url || 'unknown URL');
        if (retryCount < 2) {
          // Retry up to 2 more times with a delay
          setTimeout(() => sendInitMessage(retryCount + 1), 1000 * (retryCount + 1));
        }
      });
  };
  
  sendInitMessage();
}

// Initialize extension for all open Clio tabs
function initializeForAllClioTabs() {
  chrome.tabs.query({url: 'https://*.clio.com/*'}, (tabs) => {
    console.log(`[Linqly] Found ${tabs.length} Clio tabs to initialize`);
    tabs.forEach(tab => {
      initializeClioTab(tab.id, tab.url);
    });
  });
}

// Context menu setup function
function setupContextMenus() {
  // Remove all existing context menus first to prevent duplicates
  chrome.contextMenus.removeAll(() => {
    // Create context menu items
    chrome.contextMenus.create({
      id: 'linqly-export-selected',
      title: 'Export Selected Items',
      contexts: ['page'],
      documentUrlPatterns: ['https://*.clio.com/*']
    });
  });
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle setting updates from popup
  if (message.action === 'updateSetting') {
    console.log(`Background script: Setting ${message.key} to ${message.value}`);
    
    // If linqly_enabled is being toggled, update the badge accordingly
    if (message.key === 'linqly_enabled') {
      // If disabled, clear all badges on all tabs
      if (message.value === false) {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.action.setBadgeText({ text: '', tabId: tab.id });
          });
        });
      }
    }
    
    // No need to do anything else as storage is already updated by popup
    return false;
  }
  
  // Handle other message types
  switch (message.type) {
    case 'GET_SETTINGS':
      chrome.storage.sync.get(['linqly_enabled'], (settings) => {
        sendResponse(settings);
      });
      return true;
      
    // Selection count case removed for performance
      
    default:
      console.log('Unknown message type:', message.type);
      return false;
  }
});

// Update extension icon state when tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Enable or disable the action based on URL
    if (tab.url.match(/^https:\/\/.*\.clio\.com\/.*/)) {
      chrome.action.enable(tabId);
      // Also initialize the tab when it finishes loading
      console.log('[Linqly] Clio tab finished loading, initializing:', tab.url);
      // Use a small delay to ensure the content script is fully loaded
      setTimeout(() => {
        initializeClioTab(tabId, tab.url);
      }, 500);
    } else {
      chrome.action.disable(tabId);
      chrome.action.setBadgeText({ text: '', tabId: tabId });
    }
  }
});

// Also update extension icon state when tab is activated
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url && tab.url.match(/^https:\/\/.*\.clio\.com\/.*/)) {
      chrome.action.enable(activeInfo.tabId);
    } else {
      chrome.action.disable(activeInfo.tabId);
      chrome.action.setBadgeText({ text: '', tabId: activeInfo.tabId });
    }
  });
});

// Handle extension being enabled/disabled
chrome.management.onEnabled.addListener((extensionInfo) => {
  if (extensionInfo.id === chrome.runtime.id) {
    // When extension is enabled, notify all Clio tabs to reinitialize
    chrome.tabs.query({url: 'https://*.clio.com/*'}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'EXTENSION_ENABLED' });
        }
      });
    });
  }
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'linqly-export-selected') {
    chrome.tabs.sendMessage(tab.id, { type: 'EXPORT_SELECTED' });
  }
});