// Popup Script for Linqly Extension

document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  const toggleEnabled = document.getElementById('toggle-enabled');
  const drawerToggle = document.getElementById('drawer-toggle');
  const drawerContent = document.getElementById('drawer-content');
  const drawerIcon = drawerToggle.querySelector('.drawer-icon');

  // Load settings from storage
  async function loadSettings() {
    const settings = await chrome.storage.sync.get({
      linqly_enabled: true
    });
    
    toggleEnabled.checked = settings.linqly_enabled;
  }

  // Toggle a setting and update storage
  async function toggleSetting(key, element) {
    const value = element.checked;
    console.log(`Toggling ${key} to ${value}`);
    
    // Update storage
    await chrome.storage.sync.set({ [key]: value });
    
    // Send message to update background script
    chrome.runtime.sendMessage({ action: 'updateSetting', key, value });
    
    // Notify ALL content scripts in ALL tabs that match Clio URL pattern
    // This ensures the setting is applied across all open Clio tabs
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.clio.com/*' });
      console.log(`Found ${tabs.length} Clio tabs to update`);
      
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATED',
          settings: { [key]: value }
        }).catch((err) => {
          // Ignore errors - content script might not be loaded in this tab
          console.log(`Could not update tab ${tab.id}: ${err.message}`);
        });
      }
    } catch (error) {
      console.error('Error updating tabs:', error);
    }
  }

  // Toggle drawer open/close
  function toggleDrawer() {
    drawerContent.classList.toggle('open');
    drawerIcon.classList.toggle('open');
  }

  // Load settings when popup opens
  await loadSettings();

  // Add event listeners
  toggleEnabled.addEventListener('click', () => toggleSetting('linqly_enabled', toggleEnabled));
  drawerToggle.addEventListener('click', toggleDrawer);
});