/**
 * Communications Tab - Row Click Selection
 * Simple implementation for toggling checkboxes on row click
 */

class CommunicationsRowSelector {
  constructor() {
    this.isInitialized = false;
    this.observer = null;
    this.initializationAttempts = 0;
    this.lastClickedRow = null;
    this.isShiftPressed = false;
    this.isShiftClickOperation = false;
    this.boundHandleTableMouseDown = this.handleTableMouseDown.bind(this);
    this.boundHandleTableMouseUp = this.handleTableMouseUp.bind(this);
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
    table.removeEventListener('mousedown', this.boundHandleTableMouseDown, true);
    table.removeEventListener('mouseup', this.boundHandleTableMouseUp, true);
    
    // Add new click handler
    table.addEventListener('click', this.handleTableClick);
    table.addEventListener('mousedown', this.boundHandleTableMouseDown, true);
    table.addEventListener('mouseup', this.boundHandleTableMouseUp, true);
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
      table.removeEventListener('mousedown', this.boundHandleTableMouseDown, true);
      table.removeEventListener('mouseup', this.boundHandleTableMouseUp, true);
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

    // Prevent text selection during shift+click
    if (event.shiftKey) {
      event.preventDefault();
      if (window.getSelection) {
        const selection = window.getSelection();
        if (selection.removeAllRanges) selection.removeAllRanges();
        else if (selection.empty) selection.empty();
      }
    }

    // Handle shift-click range selection
    if (event.shiftKey && this.lastClickedRow) {
      const table = document.getElementById('communications_logs_data_table');
      const allRows = Array.from(table.querySelectorAll('tr[tabindex="0"]'));
      const startIndex = allRows.indexOf(this.lastClickedRow);
      const endIndex = allRows.indexOf(row);
      if (startIndex === -1 || endIndex === -1) return;
      const [rangeStart, rangeEnd] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
      for (let i = rangeStart; i <= rangeEnd; i++) {
        const currentRow = allRows[i];
        const cb = currentRow.querySelector('input[type="checkbox"]');
        if (cb && !cb.checked) {
          cb.checked = true;
          if (window.Alpine) {
            const alpineComponent = window.Alpine.closestDataStack(cb)[0];
            if (alpineComponent && alpineComponent.selected) {
              const idx = alpineComponent.selected.indexOf(cb.value);
              if (idx === -1) alpineComponent.selected.push(cb.value);
            }
            if (window.Alpine.flush) window.Alpine.flush();
          }
          ['change', 'input', 'click'].forEach(eventType => {
            const evt = new Event(eventType, { bubbles: true, cancelable: true });
            cb.dispatchEvent(evt);
          });
        }
      }
      // Do not update lastClickedRow on shift-click
      return;
    }

    // Normal click logic
    const newState = !checkbox.checked;
    checkbox.checked = newState;
    if (window.Alpine) {
      const alpineComponent = window.Alpine.closestDataStack(checkbox)[0];
      if (alpineComponent && alpineComponent.selected) {
        const idx = alpineComponent.selected.indexOf(checkbox.value);
        if (newState && idx === -1) alpineComponent.selected.push(checkbox.value);
        else if (!newState && idx > -1) alpineComponent.selected.splice(idx, 1);
      }
      if (window.Alpine.flush) window.Alpine.flush();
    }
    ['change', 'input', 'click'].forEach(eventType => {
      const evt = new Event(eventType, { bubbles: true, cancelable: true });
      checkbox.dispatchEvent(evt);
    });
    // Update lastClickedRow for future shift-clicks
    this.lastClickedRow = row;
  }

  handleTableMouseDown(event) {
    if (event.shiftKey) {
      const row = event.target.closest('tr[tabindex="0"]');
      if (row) {
        const table = document.getElementById('communications_logs_data_table');
        if (table) table.classList.add('shift-click-active');
      }
    }
  }

  handleTableMouseUp(event) {
    const table = document.getElementById('communications_logs_data_table');
    if (table) table.classList.remove('shift-click-active');
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

// Add CSS for shift-click text selection prevention
(function addShiftClickCSS() {
  if (document.getElementById('linqly-comm-shift-click-css')) return;
  const style = document.createElement('style');
  style.id = 'linqly-comm-shift-click-css';
  style.textContent = `
    #communications_logs_data_table.shift-click-active {
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
    }
    #communications_logs_data_table.shift-click-active input,
    #communications_logs_data_table.shift-click-active textarea,
    #communications_logs_data_table.shift-click-active [contenteditable] {
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
      user-select: text !important;
    }
  `;
  document.head.appendChild(style);
})();
