/* ========= Linqly Extension: Contacts Page Module =========
   Handles shift+click row selection functionality specifically for the Contacts page
===================================================================== */

const LinqlyContactsPage = {
    name: 'Contacts Page',
    
    tableBody: null,
    listener: null,
    routeObserver: null,
    currentPath: '',
    isInitialized: false,
    lastClickedRow: null,
    isShiftPressed: false,
    isShiftClickOperation: false,
    
    /* Check if we should initialize on this page */
    shouldInitialize() {
        const href = window.location.href;
        // Exclude contact-level subtabs that have their own module (documents, bills)
        const isContactSpecialSubtab = /\/contacts\/[\d\w-]+\/(documents|bills)/.test(href);
        const shouldInit = (href.includes('/contacts') || href.includes('#/contacts')) &&
                          !href.includes('/contacts/new') &&  // Exclude new contact creation page
                          !href.includes('/contacts/edit') && // Exclude edit pages
                          !href.includes('/contacts/create') && // Exclude create pages
                          !isContactSpecialSubtab;
        
        console.log(`[Linqly] Should initialize Contacts page for ${href}?`, shouldInit);
        return shouldInit;
    },
    
    /* Initialize the Contacts page functionality */
    initialize() {
        console.log('[Linqly] Contacts page initializing…');
        
        // Check if extension is enabled before proceeding
        chrome.storage.sync.get({ linqly_enabled: true }, (res) => {
            if (!res.linqly_enabled) {
                console.log('[Linqly] Extension disabled, not initializing Contacts page');
                return;
            }
            
            this.initializeInternal();
        });
    },
    
    /* Internal initialization method */
    initializeInternal() {
        // Clean up any existing listeners first
        this.detach();
        
        // Setup route change detection if not already done
        if (!this.routeObserver) {
            this.setupRouteObserver();
        }
        
        // Add CSS to prevent text selection during shift+click
        LinqlyUtils.addTextSelectionPreventionCSS();
        
        // Function to try attaching the listener
        const tryAttach = () => {
            // Try to find the grid content for Contacts page
            let gridContent = document.querySelector('.k-grid-content');
            
            if (gridContent) {
                console.log('[Linqly] Found Contacts grid content, attaching listener...');
                this.tableBody = gridContent; // Store reference to track changes
                this.attachDelegatedListener(gridContent);
                this.isInitialized = true;
                return true;
            }
            return false;
        };

        // Try immediately
        if (tryAttach()) return;

        // If not found, set up an observer
        console.log('[Linqly] Contacts grid content not found, setting up observer...');
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

    /* Attach delegated click listener to the table body */
    attachDelegatedListener(container) {
        console.log('[Linqly] Attaching delegated listener to Contacts grid content');
        
        // Clean up any existing listener first
        if (this.listener) {
            this.listener();
            this.listener = null;
        }
        
        // Add mouse event listeners to prevent text selection during shift+click
        this.addMouseEventListeners(container);
        
        // Store reference to bound function for removal
        const handleClick = (event) => {
            // Ignore synthetic events triggered by scripts (like Clio's Angular framework)
            if (!event.isTrusted) {
                console.log('[Linqly] Ignoring synthetic event (not user-triggered)');
                return;
            }

            console.log('[Linqly] Contacts page click event detected. Shift key pressed?', event.shiftKey);
            console.log('[Linqly] Current lastClickedRow:', this.lastClickedRow);
            
            // Check if the click is directly on a checkbox or its label
            const isCheckboxClick = event.target.matches('input[type="checkbox"], label') || 
                                  event.target.closest('input[type="checkbox"], label');
            
            // Skip if the click is on other interactive elements
            const isInteractive = event.target.matches('a, button, select, textarea, [role="button"], [role="tab"]') || 
                                event.target.closest('a, button, select, textarea, [role="button"], [role="tab"]');
            
            if (isInteractive) {
                console.log('[Linqly] Click on interactive element, ignoring');
                return;
            }
            
            const selectors = this.getSelectors();
            const row = event.target.closest(selectors.row);
            if (!row) {
                console.log('[Linqly] Click outside row, resetting lastClickedRow');
                this.lastClickedRow = null;
                return;
            }

            // Find the checkbox in the row
            const checkbox = row.querySelector(selectors.checkbox);
            if (!checkbox) {
                console.log('[Linqly] Checkbox not found with selector:', selectors.checkbox);
                console.log('[Linqly] Row HTML:', row.outerHTML.substring(0, 500));
                console.log('[Linqly] Available checkboxes in row:', row.querySelectorAll('input[type="checkbox"]'));
                return;
            }
            
            console.log('[Linqly] Found checkbox:', checkbox);
            console.log('[Linqly] Checkbox tag name:', checkbox.tagName);
            console.log('[Linqly] Checkbox checked state:', LinqlyUtils.getCheckboxState(checkbox));
            console.log('[Linqly] Checkbox attributes:', {
                type: checkbox.type,
                ngModel: checkbox.getAttribute('ng-model'),
                className: checkbox.className,
                id: checkbox.id
            });
            
            try {
                // Prevent text selection during shift-click
                if (event.shiftKey) {
                    event.preventDefault();
                    
                    // Add shift-click-active class to prevent text selection
                    const gridContainer = container.closest('.k-grid-content, .k-grid-table-wrap, [kendo-grid]');
                    if (gridContainer) {
                        gridContainer.classList.add('shift-click-active');
                        
                        // Remove the class after a short delay
                        setTimeout(() => {
                            gridContainer.classList.remove('shift-click-active');
                        }, 1000);
                    }
                    
                    // Also prevent text selection via JavaScript
                    if (window.getSelection) {
                        const selection = window.getSelection();
                        if (selection.removeAllRanges) {
                            selection.removeAllRanges();
                        } else if (selection.empty) {
                            selection.empty();
                        }
                    }
                }

                // Handle shift-click range selection
                if (event.shiftKey && this.lastClickedRow) {
                    console.log('[Linqly] Running SHIFT-CLICK logic on Contacts page');
                    console.log('[Linqly] Anchor row:', this.lastClickedRow);
                    console.log('[Linqly] Target row:', row);
                    try {
                        console.log('[Linqly] Anchor row UID:', LinqlyUtils.getRowUid(this.lastClickedRow));
                        console.log('[Linqly] Target row UID:', LinqlyUtils.getRowUid(row));
                    } catch (error) {
                        console.log('[Linqly] Error getting row UIDs:', error.message);
                    }
                    
                    // Get the grid body (table body) that contains both rows
                    const gridBody = row.closest('tbody');
                    if (!gridBody) {
                        console.log('[Linqly] No grid body found');
                        return;
                    }
                    
                    // Step A: Get all rows and filter for only those VISIBLE to the user
                    const allRowsInDom = Array.from(gridBody.querySelectorAll(selectors.row));
                    const visibleRows = allRowsInDom.filter(row => row.offsetParent !== null);
                    
                    console.log('[Linqly] Found', visibleRows.length, 'visible rows');
                    
                    // Step B: Get the stable UID from each visible row. This list will not become stale.
                    const visibleRowUids = visibleRows.map(row => {
                        // Try different UID attributes that Clio might use
                        return row.getAttribute('data-uid') || 
                               row.getAttribute('data-kendo-uid') || 
                               row.getAttribute('id') || 
                               row.getAttribute('data-row-index') ||
                               row.textContent.trim().substring(0, 50); // Fallback to text content
                    });
                    
                    console.log('[Linqly] Row UIDs:', visibleRowUids);
                    
                    // Step C: Find the start and end positions in our stable UID array.
                    const startUid = LinqlyUtils.getRowUid(this.lastClickedRow);
                    const endUid = LinqlyUtils.getRowUid(row);
                    const startIndex = visibleRowUids.indexOf(startUid);
                    const endIndex = visibleRowUids.indexOf(endUid);
                    
                    console.log('[Linqly] Start UID:', startUid, 'End UID:', endUid);
                    console.log('[Linqly] Row indices - Start:', startIndex, 'End:', endIndex);
                    
                    // Ensure we have valid start/end points
                    if (startIndex === -1 || endIndex === -1) {
                        console.log('[Linqly] Invalid start or end index');
                        return;
                    }
                    
                    const rangeStart = Math.min(startIndex, endIndex);
                    const rangeEnd = Math.max(startIndex, endIndex);
                    
                    console.log('[Linqly] Processing range from index', rangeStart, 'to', rangeEnd);
                    
                    // Step D: Loop through the STABLE UID array.
                    for (let i = rangeStart; i <= rangeEnd; i++) {
                        const currentUid = visibleRowUids[i];
                        
                        // Skip processing the anchor row and target row - they get special handling
                        if (currentUid === startUid) {
                            console.log('[Linqly] Skipping anchor row processing to preserve its state');
                            continue;
                        }
                        
                        if (currentUid === endUid) {
                            console.log('[Linqly] Skipping target row in main loop - will handle separately');
                            continue;
                        }
                        
                        // Step E: On each iteration, find the FRESH, LIVE row from the DOM.
                        const liveRow = gridBody.querySelector(`tr[data-uid="${currentUid}"], tr[data-kendo-uid="${currentUid}"], tr[id="${currentUid}"], tr[data-row-index="${currentUid}"]`);
                        
                        // If not found by attribute, try to find by text content (fallback)
                        let foundRow = liveRow;
                        if (!foundRow) {
                            foundRow = Array.from(gridBody.querySelectorAll(selectors.row)).find(row => 
                                LinqlyUtils.getRowUid(row) === currentUid
                            );
                        }
                        
                        if (foundRow) {
                            const checkboxInRange = foundRow.querySelector(selectors.checkbox);
                            if (checkboxInRange) {
                                console.log('[Linqly] Processing row', i, 'with UID:', currentUid);
                                LinqlyUtils.setCheckboxState(checkboxInRange, true, foundRow, false);
                            }
                        } else {
                            console.log('[Linqly] Could not find live row for UID:', currentUid);
                        }
                    }
                    
                    // Special handling for the target row (last row in range) to ensure it's selected
                    const targetUid = endUid;
                    console.log('[Linqly] Looking for target row with UID:', targetUid);
                    
                    const targetLiveRow = gridBody.querySelector(`tr[data-uid="${targetUid}"], tr[data-kendo-uid="${targetUid}"], tr[id="${targetUid}"], tr[data-row-index="${targetUid}"]`);
                    
                    if (targetLiveRow) {
                        console.log('[Linqly] Found target live row:', targetLiveRow);
                        const targetCheckbox = targetLiveRow.querySelector(selectors.checkbox);
                        if (targetCheckbox) {
                            console.log('[Linqly] Found target checkbox:', targetCheckbox);
                            console.log('[Linqly] Target checkbox current state:', LinqlyUtils.getCheckboxState(targetCheckbox));
                            console.log('[Linqly] Ensuring target row is selected:', targetUid);
                            LinqlyUtils.setCheckboxState(targetCheckbox, true, targetLiveRow, false);
                            console.log('[Linqly] Target checkbox state after processing:', LinqlyUtils.getCheckboxState(targetCheckbox));
                        } else {
                            console.log('[Linqly] Target checkbox not found in target row');
                        }
                    } else {
                        console.log('[Linqly] Target live row not found for UID:', targetUid);
                    }
                    
                    // Do not update lastClickedRow during shift-click
                    console.log('[Linqly] Shift-click complete, preserving anchor row');
                } else {
                    console.log('[Linqly] Running NORMAL CLICK logic on Contacts page');
                    // Normal click behavior - toggle the checkbox
                    const newState = !LinqlyUtils.getCheckboxState(checkbox);
                    LinqlyUtils.setCheckboxState(checkbox, newState, row, false);
                    
                    // Update lastClickedRow for future shift-clicks only on normal clicks
                    this.lastClickedRow = row;
                    console.log('[Linqly] New anchor row set:', this.lastClickedRow);
                    try {
                        console.log('[Linqly] Anchor row UID:', LinqlyUtils.getRowUid(this.lastClickedRow));
                    } catch (error) {
                        console.log('[Linqly] Error getting anchor row UID:', error.message);
                    }
                }
            } catch (error) {
                console.error('[Linqly] Error handling row click:', error);
            }
        };
        
        // Use capture phase with passive: false to allow preventDefault
        const options = { 
            capture: true,
            passive: false  // Allow preventDefault for shift-click
        };
        
        container.addEventListener('click', handleClick, options);
        
        // Store cleanup function
        this.listener = () => {
            console.log('[Linqly] Removing click listener');
            container.removeEventListener('click', handleClick, options);
        };
        
        console.log('[Linqly] Delegated listener attached to Contacts grid content');
    },

    /* Get the appropriate row and checkbox selectors for Contacts page */
    getSelectors() {
        const path = window.location.pathname + window.location.hash;
        
        console.log('[Linqly] Getting Contacts page selectors for path:', path);
        
        // Common selectors that work across all pages
        const common = {
            row: 'tr[role="row"]:not(.k-grouping-row):not(.k-detail-row)',
            exclude: 'a, button, input, select, textarea, [role="button"], [ng-click]',
            container: '.k-grid-content, .k-grid-table-wrap, [kendo-grid]',
            isCustomCheckbox: false
        };

        // Contacts page - use comprehensive selectors
        const selectors = {
            ...common,
            checkbox: 'td.row-selection-checkbox input[type="checkbox"], .th-checkbox input[type="checkbox"], input[type="checkbox"][ng-model*="checkbox.checked"], input[type="checkbox"][ng-model], input[type="checkbox"]',
            isCustomCheckbox: true
        };
        
        console.log('[Linqly] Using Contacts page selectors:', selectors);
        return selectors;
    },

    /* Setup route change detection */
    setupRouteObserver() {
        console.log('[Linqly] Setting up Contacts page route observer');
        
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

    /* Handle SPA route changes */
    handleRouteChange() {
        const newPath = window.location.href;
        const wasOnContactsPage = this.shouldInitialize();
        
        console.log(`[Linqly] Contacts page route changed from ${this.currentPath} to ${newPath}`);
        this.currentPath = newPath;
        
        // Check if we're on the Contacts page now
        const isOnContactsPage = this.shouldInitialize();
        
        // If we're leaving the Contacts page, clean up
        if (wasOnContactsPage && !isOnContactsPage) {
            console.log('[Linqly] Left Contacts page, cleaning up');
            this.detach();
            return;
        }
        
        // If we're on the Contacts page, reinitialize if needed
        if (isOnContactsPage) {
            // Small delay to allow Clio's SPA to finish rendering
            console.log('[Linqly] On Contacts page, initializing if needed');
            setTimeout(() => this.initializeIfNeeded(), 300);
        } else {
            // We're not on the Contacts page, make sure we're detached
            console.log('[Linqly] Not on Contacts page, ensuring detached');
            this.detach();
        }
        this.lastClickedRow = null;
    },

    /* Cleanup route observer */
    cleanupRouteObserver() {
        console.log('[Linqly] Cleaning up Contacts page route observer');
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

    /* Initialize if needed */
    initializeIfNeeded() {
        if (!this.shouldInitialize()) {
            console.log('[Linqly] Not initializing - not on Contacts page');
            this.detach();
            return;
        }
        
        // Check if we need to reinitialize due to grid content changes or URL changes
        const currentGridContent = document.querySelector('.k-grid-content');
        const currentPath = window.location.href;
        const hasGridContentChanged = !this.tableBody || this.tableBody !== currentGridContent;
        const hasPathChanged = this.currentPath !== currentPath;
        
        // Don't reinitialize if already initialized and nothing has changed
        if (this.isInitialized && !hasGridContentChanged && !hasPathChanged) {
            console.log('[Linqly] Already initialized with same content and path, skipping');
            return;
        }
        
        // If grid content or path has changed, we need to reinitialize
        if (hasGridContentChanged || hasPathChanged) {
            console.log('[Linqly] Content or path changed, reinitializing');
            this.detach(); // This will reset isInitialized to false
        }
        
        this.initialize();
    },

    /* Add mouse event listeners for text selection prevention */
    addMouseEventListeners(container) {
        // Store references to bound functions for cleanup
        this.boundMouseDown = this.handleMouseDown.bind(this);
        this.boundMouseMove = this.handleMouseMove.bind(this);
        this.boundMouseUp = this.handleMouseUp.bind(this);
        this.boundKeyDown = this.handleKeyDown.bind(this);
        this.boundKeyUp = this.handleKeyUp.bind(this);
        
        // Add event listeners
        container.addEventListener('mousedown', this.boundMouseDown, true);
        container.addEventListener('mousemove', this.boundMouseMove, true);
        container.addEventListener('mouseup', this.boundMouseUp, true);
        document.addEventListener('keydown', this.boundKeyDown, true);
        document.addEventListener('keyup', this.boundKeyUp, true);
        
        console.log('[Linqly] Added mouse event listeners for Contacts page text selection prevention');
    },

    /* Mouse event handlers */
    handleMouseDown(event) {
        // Only prevent text selection if shift is pressed and we're clicking on a row
        if (event.shiftKey) {
            const selectors = this.getSelectors();
            const row = event.target.closest(selectors.row);
            if (row) {
                // We're doing a shift+click on a row, prevent text selection
                event.preventDefault();
                this.isShiftPressed = true;
                this.isShiftClickOperation = true;
            }
        }
    },

    handleMouseMove(event) {
        // Only prevent text selection if we're in the middle of a shift+click operation
        if (this.isShiftClickOperation) {
            event.preventDefault();
        }
    },

    handleMouseUp(event) {
        // Clear shift operation state
        this.isShiftPressed = false;
        this.isShiftClickOperation = false;
    },

    handleKeyDown(event) {
        // Track shift key state
        if (event.key === 'Shift') {
            this.isShiftPressed = true;
        }
    },

    handleKeyUp(event) {
        // Clear shift key state
        if (event.key === 'Shift') {
            this.isShiftPressed = false;
            this.isShiftClickOperation = false;
        }
    },

    /* Remove mouse event listeners */
    removeMouseEventListeners() {
        // Clean up mouse event listeners
        if (this.tableBody) {
            if (this.boundMouseDown) {
                this.tableBody.removeEventListener('mousedown', this.boundMouseDown, true);
                this.boundMouseDown = null;
            }
            if (this.boundMouseMove) {
                this.tableBody.removeEventListener('mousemove', this.boundMouseMove, true);
                this.boundMouseMove = null;
            }
            if (this.boundMouseUp) {
                this.tableBody.removeEventListener('mouseup', this.boundMouseUp, true);
                this.boundMouseUp = null;
            }
        }
        
        // Clean up document-level key listeners
        if (this.boundKeyDown) {
            document.removeEventListener('keydown', this.boundKeyDown, true);
            this.boundKeyDown = null;
        }
        if (this.boundKeyUp) {
            document.removeEventListener('keyup', this.boundKeyUp, true);
            this.boundKeyUp = null;
        }
        
        console.log('[Linqly] Removed Contacts page mouse event listeners');
    },

    /* Detach the Contacts page functionality */
    detach() {
        console.log('[Linqly] Detaching Contacts page feature');
        
        // Clean up click listener
        if (this.listener) {
            this.listener();
            this.listener = null;
        }
        
        // Clean up mouse event listeners
        this.removeMouseEventListeners();
        
        // Remove the CSS we added
        LinqlyUtils.removeTextSelectionPreventionCSS();
        
        // Clean up route observer
        this.cleanupRouteObserver();
        
        // Reset current path to ensure reinitialization works correctly
        this.currentPath = '';
        this.tableBody = null;
        this.isInitialized = false;
        this.lastClickedRow = null;
        this.isShiftPressed = false;
        this.isShiftClickOperation = false;
        
        console.log('[Linqly] Contacts page feature fully detached');
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LinqlyContactsPage;
} else {
    window.LinqlyContactsPage = LinqlyContactsPage;
} 