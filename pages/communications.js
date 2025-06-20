/**
 * Communications Tab - Row Click Selection
 * Simple implementation for toggling checkboxes on row click
 */

class CommunicationsRowSelector {
  constructor() {
    this.isInitialized = false;
    this.observer = null;
    this.initializationAttempts = 0;
  }

  init() {
    if (this.isInitialized) return;
    
    console.log('[Linqly] Initializing communications row selector');
    
    // Initial setup
    this.setupRowClickHandlers();
    this.setupRouteObserver();
    this.setupDeselectHandlers();
    
    // Try again after a short delay in case the table isn't loaded yet
    const retryInterval = setInterval(() => {
      this.initializationAttempts++;
      if (this.setupRowClickHandlers() || this.initializationAttempts >= 5) {
        clearInterval(retryInterval);
      }
    }, 500);
    
    this.isInitialized = true;
  }

  setupRowClickHandlers() {
    const table = document.getElementById('communications_logs_data_table');
    if (!table) {
      console.log('[Linqly] Table not found');
      return false;
    }

    // Remove any existing click handlers to prevent duplicates
    table.removeEventListener('click', this.handleTableClick);
    
    // Add new click handler
    table.addEventListener('click', this.handleTableClick);
    console.log('[Linqly] Row click handlers initialized');
    return true;
  }
  
  setupRouteObserver() {
    // Target the main content area that changes during SPA navigation
    const targetNode = document.querySelector('body');
    if (!targetNode) return;
    
    // Disconnect any existing observer
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Create an observer instance
    this.observer = new MutationObserver((mutations) => {
      // Check if the communications table is now in the DOM
      const table = document.getElementById('communications_logs_data_table');
      if (table) {
        console.log('[Linqly] Detected route change to communications page');
        this.setupRowClickHandlers();
      }
    });
    
    // Start observing the target node for configured mutations
    this.observer.observe(targetNode, {
      childList: true,
      subtree: true
    });
    
    console.log('[Linqly] Route observer initialized');
  }
  
  setupDeselectHandlers() {
    // Bind methods to maintain correct 'this' context
    this.boundHandleKeydown = this.handleKeydown.bind(this);
    this.boundHandlePageClick = this.handlePageClick.bind(this);
    
    // Add event listeners
    document.addEventListener('keydown', this.boundHandleKeydown);
    document.addEventListener('click', this.boundHandlePageClick, true);
    
    console.log('[Linqly] Deselect handlers initialized');
  }
  
  deselectAll() {
    // Find the clear selection button - try multiple selectors for different frameworks
    const clearButton = document.querySelector('a.counter-clear[ng-click*="clearSelection"], button[ng-click*="clearSelection"], .clear-selection, [data-action="clear-selection"], a[data-testid="clear-selection"], a[x-on\\:click*="selected = []"]');
    
    if (clearButton) {
      console.log('[Linqly] Found clear selection button, clicking it');
      clearButton.click();
    } else {
      console.log('[Linqly] Clear selection button not found');
    }
  }
  
  handleKeydown(event) {
    if (event.key === 'Escape') {
      this.deselectAll();
    }
  }
  
  handlePageClick(event) {
    const target = event.target;
    
    // Exit if the user clicked on a link, button, or an icon within a button
    if (target.closest('a, button, [role="button"]')) {
      return;
    }
    
    // Find the communications table
    const communicationsTable = document.getElementById('communications_logs_data_table');
    
    // If we clicked outside the communications table area, deselect all
    if (communicationsTable && !target.closest('#communications_logs_data_table')) {
      this.deselectAll();
    }
  }
  
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    const table = document.getElementById('communications_logs_data_table');
    if (table) {
      table.removeEventListener('click', this.handleTableClick);
    }
    
    // Remove deselect handlers
    if (this.boundHandleKeydown) {
      document.removeEventListener('keydown', this.boundHandleKeydown);
      this.boundHandleKeydown = null;
    }
    
    if (this.boundHandlePageClick) {
      document.removeEventListener('click', this.boundHandlePageClick, true);
      this.boundHandlePageClick = null;
    }
    
    this.isInitialized = false;
    console.log('[Linqly] Cleaned up event listeners');
  }
  
  handleTableClick = (event) => {
    // Find the closest row
    const row = event.target.closest('tr[tabindex="0"]');
    if (!row) return;

    // Find the checkbox within this row
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (!checkbox) return;

    // Don't interfere with direct checkbox clicks or interactive elements
    if (event.target === checkbox || event.target.closest('a, button, [role="button"], .clio-ui-icon-button')) {
      return;
    }

    // Prevent default to avoid any native behavior
    event.preventDefault();
    event.stopPropagation();
    
    // Toggle the checkbox
    const newState = !checkbox.checked;
    
    // Update the checkbox state
    checkbox.checked = newState;
    
    // For Alpine.js, we need to update the bound model
    if (window.Alpine) {
      // Try to find the Alpine component
      const alpineComponent = window.Alpine.closestDataStack(checkbox)[0];
      if (alpineComponent) {
        // If we found an Alpine component, update the selected state
        if (alpineComponent.selected) {
          const index = alpineComponent.selected.indexOf(checkbox.value);
          if (newState && index === -1) {
            alpineComponent.selected.push(checkbox.value);
          } else if (!newState && index > -1) {
            alpineComponent.selected.splice(index, 1);
          }
        }
      }
    }
    
    // Dispatch events to trigger any bound listeners
    const events = ['change', 'input', 'click'];
    events.forEach(eventType => {
      const evt = new Event(eventType, { bubbles: true, cancelable: true });
      checkbox.dispatchEvent(evt);
    });
    
    // Force a re-render if Alpine is present
    if (window.Alpine && window.Alpine.flush) {
      window.Alpine.flush();
    }
  }
}

// Initialize when DOM is ready
function shouldInitCommunicationsPage() {
  const href = window.location.href;
  // Exclude matter-level communications subpages (e.g., /matters/123/communications)
  const isMatterCommunications = /\/matters\/[\d\w-]+\/communications/.test(href);
  // Only run on main communications list
  return (href.includes('/communications') || href.includes('#/communications')) && !isMatterCommunications;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (shouldInitCommunicationsPage()) new CommunicationsRowSelector().init();
  });
} else {
  if (shouldInitCommunicationsPage()) new CommunicationsRowSelector().init();
}
