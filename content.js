/* ========= Clio Extension: Modular Content Script =========
   This script is structured to be modular so new features can be added
   without touching or breaking existing ones.  Each feature registers
   itself with the central `featureManager`.
===================================================================== */

/*********************  Core: Feature Manager  **********************/
const featureManager = {
    features: [],
    register(feature) {
        if (feature && typeof feature.initialize === 'function') {
            this.features.push(feature);
        }
    },
    init() {
        this.features.forEach(feature => {
            try {
                if (!feature.shouldInitialize || feature.shouldInitialize()) {
                    feature.initialize();
                }
            } catch (err) {
                console.error(`Error initialising feature: ${feature.name}`, err);
            }
        });
    }
};

/**************** Feature: Row Click Selects Checkbox ***************/
const rowClickSelectFeature = {
    name: 'Row-Click Checkbox Selector',
    
    tableBody: null,
    listener: null,
    routeObserver: null,
    currentPath: '',
    
    /* Run on Clio dashboard and specific pages */
    shouldInitialize() {
        const href = window.location.href;
        // Match root dashboard or specific sections
        const shouldInit = 
            /^https:\/\/app\.clio\.com\/nc\/#\//.test(href) &&  // Root dashboard
            !/\/(login|auth|sign_in|sign_up|password|billing)/.test(href);  // Exclude auth pages
        
        console.log(`[Linqly] Should initialize for ${href}?`, shouldInit);
        return shouldInit;
    },
    
    /* Handle SPA route changes */
    handleRouteChange() {
        const newPath = window.location.href;
        const wasOnSupportedPage = this.shouldInitialize();
        
        console.log(`[Linqly] Route changed from ${this.currentPath} to ${newPath}`);
        this.currentPath = newPath;
        
        // Check if we're on a supported page now
        const isOnSupportedPage = this.shouldInitialize();
        
        // If we're leaving a supported page, clean up
        if (wasOnSupportedPage && !isOnSupportedPage) {
            console.log('[Linqly] Left supported page, cleaning up');
            this.detach();
            return;
        }
        
        // If we're on a supported page, reinitialize if needed
        if (isOnSupportedPage) {
            // Small delay to allow Clio's SPA to finish rendering
            console.log('[Linqly] On supported page, initializing if needed');
            setTimeout(() => this.initializeIfNeeded(), 300);
        }
    },
    
    /* Setup route change detection */
    setupRouteObserver() {
        console.log('[Linqly] Setting up route observer');
        
        // Clean up any existing observers
        this.cleanupRouteObserver();
        
        // Store reference to bound function for removal
        this.boundHandleRouteChange = this.handleRouteChange.bind(this);
        
        // Listen for navigation events
        window.addEventListener('hashchange', this.boundHandleRouteChange);
        window.addEventListener('popstate', this.boundHandleRouteChange);
        
        // Also observe DOM mutations for route changes
        this.routeObserver = new MutationObserver(() => {
            const path = window.location.href;
            if (path !== this.currentPath) {
                this.handleRouteChange();
            }
        });
        
        // Observe the document for changes
        this.routeObserver.observe(document, {
            childList: true,
            subtree: true
        });
    },
    
    /* Cleanup route observer */
    cleanupRouteObserver() {
        console.log('[Linqly] Cleaning up route observer');
        if (this.boundHandleRouteChange) {
            window.removeEventListener('hashchange', this.boundHandleRouteChange);
            window.removeEventListener('popstate', this.boundHandleRouteChange);
            this.boundHandleRouteChange = null;
        }
        if (this.routeObserver) {
            this.routeObserver.disconnect();
            this.routeObserver = null;
        }
    },

    initializeIfNeeded() {
        if (!this.shouldInitialize()) {
            console.log('[Linqly] Not initializing - not on a supported page');
            this.detach();
            return;
        }
        
        this.initialize();
    },
    
    initialize() {
        console.log('[Linqly] Row-click feature initializing…');
        
        // Clean up any existing listeners first
        this.detach();
        
        // Setup route change detection if not already done
        if (!this.routeObserver) {
            this.setupRouteObserver();
        }
        
        // Function to try attaching the listener
        const tryAttach = () => {
            // Try to find the grid content - different selectors for different pages
            let gridContent = document.querySelector('.k-grid-content');
            
            // For Activities page, the grid might be in a different container
            if (window.location.href.includes('/activities') && !gridContent) {
                gridContent = document.querySelector('.k-grid .k-grid-content');
            }
            
            if (gridContent) {
                console.log('[Linqly] Found grid content, attaching listener...');
                this.attachDelegatedListener(gridContent);
                return true;
            }
            return false;
        };

        // Try immediately
        if (tryAttach()) return;

        // If not found, set up an observer
        console.log('[Linqly] Grid content not found, setting up observer...');
        const observer = new MutationObserver((mutations, obs) => {
            if (tryAttach()) {
                console.log('[Linqly] Successfully attached via observer');
                obs.disconnect();
            }
        });
        
        // Start observing with a wider scope
        observer.observe(document.documentElement, { 
            childList: true, 
            subtree: true 
        });

        // Also try again after a delay in case the observer misses it
        setTimeout(() => {
            if (tryAttach()) {
                console.log('[Linqly] Successfully attached via timeout');
                observer.disconnect();
            }
        }, 1000);
        
        // Clean up observer after a while
        setTimeout(() => observer.disconnect(), 5000);
    },

    /* Attach a single delegated click listener to the table body. */
    attachDelegatedListener(container) {
        console.log('[Linqly] Attaching delegated listener to grid content');
        
        // Clean up any existing listener first
        if (this.listener) {
            this.listener();
            this.listener = null;
        }
        
        // Store reference to bound function for removal
        const handleClick = (event) => {
            const path = window.location.pathname + window.location.hash;
            const isDocumentsPage = path.includes('/documents') || path.includes('#/documents');
            
            // Check if the click is directly on a checkbox or its label
            const isCheckboxClick = event.target.matches('input[type="checkbox"], label') || 
                                  event.target.closest('input[type="checkbox"], label');
            
            // For Documents page, allow native checkbox clicks to work
            if (isDocumentsPage && isCheckboxClick) {
                // Let the native checkbox handle the click
                return;
            }
            
            // Skip if the click is on other interactive elements
            const isInteractive = event.target.matches('a, button, select, textarea, [role="button"], [role="tab"]') || 
                                event.target.closest('a, button, select, textarea, [role="button"], [role="tab"]');
            
            if (isInteractive) {
                return;
            }
            
            const selectors = this.getSelectors();
            const row = event.target.closest(selectors.row);
            if (!row) return;

            // Find the checkbox in the row
            const checkbox = row.querySelector(selectors.checkbox);
            if (!checkbox) {
                console.log('[Linqly] Checkbox not found with selector:', selectors.checkbox);
                return;
            }
            
            console.log('[Linqly] Toggling row selection for checkbox:', checkbox);
            
            try {
                // Get current page path for conditional logic
                const path = window.location.pathname + window.location.hash;
                const isDocumentsPage = path.includes('/documents') || path.includes('#/documents');
                
                // Toggle the checkbox state
                const newState = !checkbox.checked;
                checkbox.checked = newState;
                
                // For Documents page - use direct click which we know works
                if (isDocumentsPage) {
                    if (typeof checkbox.click === 'function') {
                        checkbox.click();
                    }
                    return;
                }
                
                // For other pages - try multiple approaches to ensure the checkbox toggles
                
                // 1. First try the direct approach that works for Documents
                if (typeof checkbox.click === 'function') {
                    checkbox.click();
                }
                
                // 2. If that didn't work, try dispatching a click event with all necessary properties
                const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    button: 0,
                    buttons: 1,
                    clientX: 0,
                    clientY: 0
                });
                
                // Add common properties that might be expected
                Object.defineProperties(clickEvent, {
                    target: { value: checkbox },
                    currentTarget: { value: checkbox },
                    srcElement: { value: checkbox },
                    composed: { value: true }
                });
                
                // Dispatch the click event
                checkbox.dispatchEvent(clickEvent);
                
                // 3. Also try toggling the checked state and dispatching change/input events
                setTimeout(() => {
                    checkbox.checked = newState;
                    
                    // Dispatch change and input events
                    ['change', 'input'].forEach(eventType => {
                        const evt = new Event(eventType, { 
                            bubbles: true, 
                            cancelable: true,
                            view: window
                        });
                        checkbox.dispatchEvent(evt);
                    });
                    
                    // Try clicking the row if it's a Kendo UI row
                    if (row && (row.classList.contains('k-master-row') || row.classList.contains('k-grid-edit-row'))) {
                        row.click();
                    }
                }, 10);
            } catch (error) {
                console.error('[Linqly] Error toggling checkbox:', error);
            }
        };
        
        // Use capture phase with passive: true to prevent forced reflow
        const options = { 
            capture: true,
            passive: true  // Improves scrolling performance
        };
        
        container.addEventListener('click', handleClick, options);
        
        // Store cleanup function
        this.listener = () => {
            console.log('[Linqly] Removing click listener');
            container.removeEventListener('click', handleClick, options);
        };
        
        console.log('[Linqly] Delegated listener attached to grid content');
    },

    /* Get the appropriate row and checkbox selectors based on the current page */
    getSelectors() {
        const path = window.location.pathname + window.location.hash;
        
        // Common selectors that work across all pages
        const common = {
            row: 'tr[role="row"]:not(.k-grouping-row):not(.k-detail-row)',
            exclude: 'a, button, input, select, textarea, [role="button"], [ng-click]',
            container: '.k-grid-content, .k-grid-table-wrap, [kendo-grid]',
            isCustomCheckbox: false
        };

        // Billing page
        if (path.includes('/bills') || path.includes('#/bills')) {
            return {
                ...common,
                checkbox: 'td:first-child input[type="checkbox"], .th-checkbox-basic input[type="checkbox"]'
            };
        }
        
        // Tasks page
        if (path.includes('/tasks') || path.includes('#/tasks')) {
            return {
                ...common,
                checkbox: 'td.row-selection-checkbox input[type="checkbox"], .th-checkbox-basic'
            };
        }
        
        // Documents page
        if (path.includes('/documents') || path.includes('#/documents')) {
            return {
                ...common,
                checkbox: 'td.row-selection-checkbox input[type="checkbox"], .th-checkbox',
                isCustomCheckbox: true
            };
        }
        
        // Default for all other pages (Matters, Contacts, etc.)
        return {
            ...common,
            checkbox: 'input[type="checkbox"]'
        };
    },
    
    detach() {
        console.log('[Linqly] Detaching row-click feature');
        
        // Clean up click listener
        if (this.listener) {
            this.listener();
            this.listener = null;
        }
        
        // Clean up route observer
        this.cleanupRouteObserver();
        
        // Reset current path to ensure reinitialization works correctly
        this.currentPath = '';
        this.tableBody = null;
        
        console.log('[Linqly] Row-click feature fully detached');
    }
};

/**************** Feature: Checkbox Deselect with ESC **************/
const checkboxDeselectFeature = {
    name: 'Checkbox Deselect with ESC',
    
    isInitialized: false,
    
    shouldInitialize() {
        // Initialize on matters page with the correct URL pattern
        const href = window.location.href;
        const shouldInit = /^https:\/\/app\.clio\.com\/nc\/#\/matters/.test(href);
        console.log(`[Linqly] Should initialize Checkbox Deselect for ${href}?`, shouldInit);
        return shouldInit;
    },
    
    initialize() {
        if (this.isInitialized) return;
        
        console.log('[Linqly] Initializing Checkbox Deselect feature');
        
        // Add keydown event listener to the document
        document.addEventListener('keydown', this.handleKeyDown);
        
        this.isInitialized = true;
    },
    
    handleKeyDown(event) {
        // Check if ESC key is pressed
        if (event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27) {
            // Find the clear selection button
            const clearButton = document.querySelector('a.counter-clear[ng-click*="clearSelection"]');
            
            if (clearButton) {
                console.log('[Linqly] ESC pressed - clearing selections');
                // Trigger a click on the button
                clearButton.click();
                
                // Add visual feedback
                this.showFeedback();
            }
        }
    },
    
    showFeedback() {
        // Remove any existing feedback
        const existingFeedback = document.querySelector('.linqly-feedback');
        if (existingFeedback) {
            existingFeedback.remove();
        }
        
        // Create and style feedback element
        const feedback = document.createElement('div');
        feedback.className = 'linqly-feedback';
        feedback.textContent = 'Selection cleared';
        feedback.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            pointer-events: none;
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.3s, transform 0.3s;
        `;
        
        document.body.appendChild(feedback);
        
        // Trigger animation
        requestAnimationFrame(() => {
            feedback.style.opacity = '1';
            feedback.style.transform = 'translateY(0)';
            
            // Remove after animation
            setTimeout(() => {
                feedback.style.opacity = '0';
                feedback.style.transform = 'translateY(-20px)';
                
                // Remove from DOM after animation completes
                setTimeout(() => {
                    feedback.remove();
                }, 300);
            }, 2000);
        });
    },
    
    detach() {
        if (!this.isInitialized) return;
        
        console.log('[Linqly] Detaching Checkbox Deselect feature');
        document.removeEventListener('keydown', this.handleKeyDown);
        this.isInitialized = false;
    }
};

/************************ Initialise *******************************/
// Register features
featureManager.register(rowClickSelectFeature);
featureManager.register(checkboxDeselectFeature);


// Helper to (de)activate features based on stored setting
function applyEnabledState(enabled) {
    if (enabled) {
        featureManager.init();
    } else {
        // Detach logic for each feature that supports detach
        if (typeof rowClickSelectFeature.detach === 'function') {
            rowClickSelectFeature.detach();
        }
    }
}

// Read initial setting then apply
function initFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.sync.get({ linqly_enabled: true }, (res) => {
            console.log('[Linqly] Initial load, enabled state:', res.linqly_enabled);
            applyEnabledState(res.linqly_enabled);
            resolve();
        });
    });
}

// Log that content script has loaded
console.log('[Linqly] Content script loaded for:', window.location.href);

// Track initialization state
let isInitialized = false;

// Handle extension being re-enabled or initialized
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTENSION_ENABLED') {
    console.log('[Linqly] Received EXTENSION_ENABLED message, reinitializing...');
    initializeExtension();
  }
  return false; // We don't need to keep the message channel open
});

// Main initialization function
function initializeExtension() {
  if (isInitialized) {
    console.log('[Linqly] Extension already initialized, skipping reinitialization');
    return Promise.resolve();
  }
  
  console.log('[Linqly] Initializing extension...');
  
  // Initialize from storage
  return initFromStorage()
    .then(() => {
      isInitialized = true;
      console.log('[Linqly] Extension initialization complete');
      return true;
    })
    .catch(error => {
      console.error('[Linqly] Error during initialization:', error);
      return false;
    });
}

// Initialize on page load
if (document.readyState === 'loading') {
  console.log('[Linqly] Document still loading, waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  console.log('[Linqly] Document already loaded, initializing immediately');
  initializeExtension();
}

// Also try to initialize when the page is fully loaded
window.addEventListener('load', () => {
  console.log('[Linqly] Window load event fired, checking initialization');
  if (!isInitialized) {
    console.log('[Linqly] Not yet initialized, initializing now');
    initializeExtension();
  }
});

// Listen for setting updates broadcast from popup and storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.linqly_enabled) {
        console.log('[Linqly] Storage change detected, enabled:', changes.linqly_enabled.newValue);
        applyEnabledState(changes.linqly_enabled.newValue);
    }
});

// Also listen for messages from popup (redundant but ensures immediate response)
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SETTINGS_UPDATED' && msg.settings && typeof msg.settings.linqly_enabled !== 'undefined') {
        console.log('[Linqly] Message received, enabled:', msg.settings.linqly_enabled);
        applyEnabledState(msg.settings.linqly_enabled);
    }
});
