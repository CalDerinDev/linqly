/* ========= Clio Extension: New Bills Page Script =========
   Handles row click selection and deselect functionality for the new bills page
   with tree view structure (parent/child relationships)
===================================================================== */

class NewBillsRowSelector {
    constructor() {
        this.isInitialized = false;
        this.observer = null;
        this.boundHandleTableClick = null;
        this.boundHandleKeydown = null;
        this.boundHandlePageClick = null;
    }

    shouldInitialize() {
        const href = window.location.href;
        const shouldInit = href.includes('/bills/new_bills');
        console.log(`[Linqly] Should initialize New Bills Page for ${href}?`, shouldInit);
        return shouldInit;
    }

    init() {
        if (this.isInitialized) return;
        
        console.log('[Linqly] Initializing New Bills Page feature');
        
        // Bind methods to maintain correct 'this' context
        this.boundHandleTableClick = this.handleTableClick.bind(this);
        this.boundHandleKeydown = this.handleKeydown.bind(this);
        this.boundHandlePageClick = this.handlePageClick.bind(this);
        
        // Setup initial handlers
        this.setupTableHandlers();
        this.setupDeselectHandlers();
        this.setupRouteObserver();
        
        this.isInitialized = true;
    }

    setupTableHandlers() {
        const table = document.querySelector('.cc-tree-view');
        if (table) {
            console.log('[Linqly] Found new bills table, setting up handlers');
            table.addEventListener('click', this.boundHandleTableClick);
            return true;
        }
        return false;
    }

    setupDeselectHandlers() {
        // Add event listeners
        document.addEventListener('keydown', this.boundHandleKeydown);
        document.addEventListener('click', this.boundHandlePageClick, true);
        
        console.log('[Linqly] New Bills Page deselect handlers initialized');
        console.log('[Linqly] ESC key listener attached:', !!this.boundHandleKeydown);
        console.log('[Linqly] Click outside listener attached:', !!this.boundHandlePageClick);
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
            // Check if the new bills table is now in the DOM
            const table = document.querySelector('.cc-tree-view');
            if (table) {
                console.log('[Linqly] Detected route change to new bills page');
                this.setupTableHandlers();
            }
        });
        
        // Start observing the target node for configured mutations
        this.observer.observe(targetNode, {
            childList: true,
            subtree: true
        });
        
        console.log('[Linqly] New Bills Page route observer initialized');
    }

    handleTableClick(event) {
        // Find the closest row
        const row = event.target.closest('tr.cc-tree-view-item, tr.cc-tree-view-subitem');
        if (!row) return;

        // Find the checkbox within this row
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (!checkbox) return;

        // Don't interfere with direct checkbox clicks or interactive elements
        // Check if the click is directly on the checkbox, its label, or the checkbox container
        const isDirectCheckboxClick = event.target === checkbox || 
                                     event.target.closest('input[type="checkbox"]') === checkbox ||
                                     event.target.closest('.th-checkbox') === checkbox.closest('.th-checkbox') ||
                                     event.target.closest('label') ||
                                     event.target.closest('a, button, [role="button"], .th-icon-button');
        
        if (isDirectCheckboxClick) {
            console.log('[Linqly] Direct checkbox click detected, not interfering');
            return;
        }

        console.log('[Linqly] Toggling checkbox on new bills page');
        
        // Determine if this is a parent (client) or child (matter) row
        const isParentRow = row.classList.contains('cc-tree-view-item');
        const isChildRow = row.classList.contains('cc-tree-view-subitem');
        
        // For tree selection, we need to handle parent/child relationships
        if (isParentRow) {
            // Clicking parent row - ensure parent checkbox gets checked and let Clio handle children
            const currentState = checkbox.checked;
            const newState = !currentState;
            
            // Update the parent checkbox state
            checkbox.checked = newState;
            
            // Dispatch events to notify Angular
            ['change', 'input'].forEach(eventType => {
                const evt = new Event(eventType, { 
                    bubbles: true, 
                    cancelable: true 
                });
                checkbox.dispatchEvent(evt);
            });
            
            // Let Clio's native tree selection handle the children
            // The parent checkbox click should trigger Clio's logic to select/deselect all children
            if (typeof checkbox.click === 'function') {
                setTimeout(() => {
                    checkbox.click();
                }, 10);
            }
        } else if (isChildRow) {
            // Clicking child row - use the same approach as parent but without the additional click
            const currentState = checkbox.checked;
            const newState = !currentState;
            
            // Update the checkbox state directly
            checkbox.checked = newState;
            
            // Dispatch events to notify Angular
            ['change', 'input'].forEach(eventType => {
                const evt = new Event(eventType, { 
                    bubbles: true, 
                    cancelable: true 
                });
                checkbox.dispatchEvent(evt);
            });
            
            // For child rows, also try clicking the checkbox to ensure Clio's logic is triggered
            if (typeof checkbox.click === 'function') {
                setTimeout(() => {
                    checkbox.click();
                }, 10);
            }
        }
    }

    deselectAll() {
        // For new bills page, manually uncheck all checkboxes since there's no clear selection button
        const checkboxes = document.querySelectorAll('.cc-tree-view input[type="checkbox"]:checked');
        
        console.log('[Linqly] DeselectAll called, found checkboxes:', checkboxes.length);
        
        if (checkboxes.length > 0) {
            console.log(`[Linqly] Manually unchecking ${checkboxes.length} checkboxes on new bills page`);
            
            checkboxes.forEach((checkbox, index) => {
                console.log(`[Linqly] Unchecking checkbox ${index + 1}:`, checkbox);
                
                // Uncheck the checkbox
                checkbox.checked = false;
                
                // Dispatch change and input events to notify Angular
                ['change', 'input'].forEach(eventType => {
                    const evt = new Event(eventType, { 
                        bubbles: true, 
                        cancelable: true 
                    });
                    checkbox.dispatchEvent(evt);
                });
                
                // Also try clicking the checkbox to ensure Clio's logic is triggered
                if (typeof checkbox.click === 'function') {
                    setTimeout(() => {
                        checkbox.click();
                    }, 10);
                }
            });
        } else {
            console.log('[Linqly] No checkboxes to deselect on new bills page');
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
        
        // Find the new bills table
        const newBillsTable = document.querySelector('.cc-tree-view');
        
        // If we clicked outside the new bills table area, deselect all
        if (newBillsTable && !target.closest('.cc-tree-view')) {
            this.deselectAll();
        }
    }

    cleanup() {
        if (!this.isInitialized) return;
        
        console.log('[Linqly] Detaching New Bills Page feature');
        
        // Remove table click handler
        const table = document.querySelector('.cc-tree-view');
        if (table) {
            table.removeEventListener('click', this.boundHandleTableClick);
        }
        
        // Remove deselect handlers
        if (this.boundHandleKeydown) {
            document.removeEventListener('keydown', this.boundHandleKeydown);
        }
        if (this.boundHandlePageClick) {
            document.removeEventListener('click', this.boundHandlePageClick, true);
        }
        
        // Clean up observer
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        this.isInitialized = false;
        console.log('[Linqly] New Bills Page feature fully detached');
    }
}

// Initialize the new bills row selector
const newBillsRowSelector = new NewBillsRowSelector();

console.log('[Linqly] New Bills Page script loaded for URL:', window.location.href);

// Check if we should initialize on page load
if (newBillsRowSelector.shouldInitialize()) {
    console.log('[Linqly] New Bills Page script should initialize, calling init()');
    newBillsRowSelector.init();
} else {
    console.log('[Linqly] New Bills Page script should not initialize for this URL');
}

// Listen for route changes
let currentPath = window.location.href;
const checkRouteChange = () => {
    const newPath = window.location.href;
    if (newPath !== currentPath) {
        console.log('[Linqly] New Bills Page script detected route change from', currentPath, 'to', newPath);
        currentPath = newPath;
        
        if (newBillsRowSelector.shouldInitialize()) {
            console.log('[Linqly] New Bills Page script should initialize after route change');
            newBillsRowSelector.init();
        } else {
            console.log('[Linqly] New Bills Page script should not initialize after route change, cleaning up');
            newBillsRowSelector.cleanup();
        }
    }
};

// Set up route change detection
window.addEventListener('hashchange', checkRouteChange);
window.addEventListener('popstate', checkRouteChange);

// Also observe DOM changes for SPA navigation
const routeObserver = new MutationObserver(checkRouteChange);
routeObserver.observe(document.body, { childList: true, subtree: true });

console.log('[Linqly] New Bills Page script setup complete'); 