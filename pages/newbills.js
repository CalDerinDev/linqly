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
        this.boundHandleTableMouseDown = null;
        this.boundHandleTableMouseUp = null;
        this.lastClickedRow = null; // Track anchor row for shift+click
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
        this.boundHandleTableMouseDown = this.handleTableMouseDown.bind(this);
        this.boundHandleTableMouseUp = this.handleTableMouseUp.bind(this);
        
        // Setup initial handlers
        this.setupTableHandlers();
        this.setupDeselectHandlers();
        this.setupRouteObserver();
        this.injectTextSelectionPreventionCSS();
        
        this.isInitialized = true;
    }

    setupTableHandlers() {
        const table = document.querySelector('.cc-tree-view');
        if (table) {
            console.log('[Linqly] Found new bills table, setting up handlers');
            table.addEventListener('click', this.boundHandleTableClick);
            table.addEventListener('mousedown', this.boundHandleTableMouseDown, true);
            table.addEventListener('mouseup', this.boundHandleTableMouseUp, true);
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
        const isDirectCheckboxClick = event.target === checkbox || 
                                     event.target.closest('input[type="checkbox"]') === checkbox ||
                                     event.target.closest('.th-checkbox') === checkbox.closest('.th-checkbox') ||
                                     event.target.closest('label') ||
                                     event.target.closest('a, button, [role="button"], .th-icon-button');
        if (isDirectCheckboxClick) {
            console.log('[Linqly] Direct checkbox click detected, not interfering');
            return;
        }

        // Get all visible rows in DOM order
        const allRows = Array.from(document.querySelectorAll('.cc-tree-view tr.cc-tree-view-item, .cc-tree-view tr.cc-tree-view-subitem'));
        const isParentRow = row.classList.contains('cc-tree-view-item');
        const isChildRow = row.classList.contains('cc-tree-view-subitem');
        const rowIndex = allRows.indexOf(row);

        // Shift+Click logic
        if (event.shiftKey && this.lastClickedRow && allRows.includes(this.lastClickedRow)) {
            const anchorIndex = allRows.indexOf(this.lastClickedRow);
            const targetIndex = rowIndex;
            const [start, end] = [Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex)];
            const anchorRow = this.lastClickedRow;
            const targetRow = row;
            const anchorIsParent = anchorRow.classList.contains('cc-tree-view-item');
            const anchorIsChild = anchorRow.classList.contains('cc-tree-view-subitem');
            const targetIsParent = targetRow.classList.contains('cc-tree-view-item');
            const targetIsChild = targetRow.classList.contains('cc-tree-view-subitem');

            // Helper: select a row's checkbox
            const selectCheckbox = (row) => {
                const cb = row.querySelector('input[type="checkbox"]');
                if (cb && !cb.checked) {
                    cb.checked = true;
                    ['change', 'input'].forEach(eventType => {
                        const evt = new Event(eventType, { bubbles: true, cancelable: true });
                        cb.dispatchEvent(evt);
                    });
                    if (typeof cb.click === 'function') {
                        setTimeout(() => { cb.click(); }, 10);
                    }
                }
            };

            if (anchorIsChild && targetIsChild) {
                // Only select child rows in the range
                for (let i = start; i <= end; i++) {
                    if (allRows[i].classList.contains('cc-tree-view-subitem')) {
                        selectCheckbox(allRows[i]);
                    }
                }
            } else {
                // Select all rows in the range, inclusive
                for (let i = start; i <= end; i++) {
                    selectCheckbox(allRows[i]);
                }
            }
            // Do NOT update lastClickedRow on shift+click
            return;
        }

        // Normal click logic (no shift):
        if (isParentRow) {
            const currentState = checkbox.checked;
            const newState = !currentState;
            checkbox.checked = newState;
            ['change', 'input'].forEach(eventType => {
                const evt = new Event(eventType, { bubbles: true, cancelable: true });
                checkbox.dispatchEvent(evt);
            });
            if (typeof checkbox.click === 'function') {
                setTimeout(() => { checkbox.click(); }, 10);
            }
        } else if (isChildRow) {
            const currentState = checkbox.checked;
            const newState = !currentState;
            checkbox.checked = newState;
            ['change', 'input'].forEach(eventType => {
                const evt = new Event(eventType, { bubbles: true, cancelable: true });
                checkbox.dispatchEvent(evt);
            });
            if (typeof checkbox.click === 'function') {
                setTimeout(() => { checkbox.click(); }, 10);
            }
        }
        // Update anchor row for future shift+clicks
        this.lastClickedRow = row;
    }

    // Helper to find the parent row for a child row
    findParentRow(childRow, allRows) {
        let idx = allRows.indexOf(childRow);
        while (idx > 0) {
            idx--;
            if (allRows[idx].classList.contains('cc-tree-view-item')) {
                return allRows[idx];
            }
        }
        return null;
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
            table.removeEventListener('mousedown', this.boundHandleTableMouseDown, true);
            table.removeEventListener('mouseup', this.boundHandleTableMouseUp, true);
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
        
        // Remove the text selection prevention CSS
        const style = document.getElementById('linqly-nb-text-selection-prevention');
        if (style) style.remove();
        
        this.isInitialized = false;
        console.log('[Linqly] New Bills Page feature fully detached');
    }

    // Prevent text selection during shift+click
    injectTextSelectionPreventionCSS() {
        if (document.getElementById('linqly-nb-text-selection-prevention')) return;
        const style = document.createElement('style');
        style.id = 'linqly-nb-text-selection-prevention';
        style.textContent = `
            .cc-tree-view.shift-click-active {
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
                user-select: none !important;
            }
            .cc-tree-view.shift-click-active input,
            .cc-tree-view.shift-click-active textarea,
            .cc-tree-view.shift-click-active [contenteditable] {
                -webkit-user-select: text !important;
                -moz-user-select: text !important;
                -ms-user-select: text !important;
                user-select: text !important;
            }
        `;
        document.head.appendChild(style);
    }

    handleTableMouseDown(event) {
        if (event.shiftKey) {
            const row = event.target.closest('tr.cc-tree-view-item, tr.cc-tree-view-subitem');
            if (row) {
                const table = document.querySelector('.cc-tree-view');
                if (table) table.classList.add('shift-click-active');
            }
        }
    }

    handleTableMouseUp(event) {
        const table = document.querySelector('.cc-tree-view');
        if (table) table.classList.remove('shift-click-active');
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