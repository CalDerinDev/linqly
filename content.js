/* ========= Clio Extension: Modular Content Script =========
   This script is structured to be modular so new features can be added
   without touching or breaking existing ones.  Each feature registers
   itself with the central `featureManager`.
===================================================================== */

/*********************  Core: Feature Manager  **********************/
const featureManager = {
    features: [],
    routeChangeTimeout: null,
    isProcessingRouteChange: false,
    
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
    },
    
    handleRouteChange() {
        // Prevent multiple simultaneous route change processing
        if (this.isProcessingRouteChange) {
            console.log('[Linqly] Route change already being processed, skipping');
            return;
        }
        
        // Clear any pending timeout
        if (this.routeChangeTimeout) {
            clearTimeout(this.routeChangeTimeout);
        }
        
        // Debounce route changes to prevent excessive reinitialization
        this.routeChangeTimeout = setTimeout(() => {
            this.isProcessingRouteChange = true;
            console.log('[Linqly] Processing route change...');
            
            this.features.forEach(feature => {
                try {
                    if (feature.shouldInitialize && !feature.shouldInitialize()) {
                        // Feature should not be on this page, detach it
                        if (typeof feature.detach === 'function') {
                            console.log(`[Linqly] Detaching feature ${feature.name} due to route change`);
                            feature.detach();
                            // Reset initialization flag when detaching
                            if (feature.isInitialized !== undefined) {
                                feature.isInitialized = false;
                            }
                        }
                    } else if (feature.shouldInitialize && feature.shouldInitialize()) {
                        // Feature should be on this page, initialize it if not already
                        if (typeof feature.initialize === 'function') {
                            if (!feature.isInitialized) {
                                console.log(`[Linqly] Initializing feature ${feature.name} due to route change`);
                                feature.initialize();
                            } else {
                                console.log(`[Linqly] Feature ${feature.name} already initialized`);
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Error handling route change for feature: ${feature.name}`, err);
                }
            });
            
            this.isProcessingRouteChange = false;
        }, 100); // 100ms debounce
    }
};

/**************** Feature: Row Click Selects Checkbox ***************/
const rowClickSelectFeature = {
    name: 'Row-Click Checkbox Selector',
    
    tableBody: null,
    listener: null,
    routeObserver: null,
    currentPath: '',
    isInitialized: false,
    lastClickedRow: null,
    
    /* Run on Clio dashboard and specific pages */
    shouldInitialize() {
        const href = window.location.href;
        // Match root dashboard or specific sections
        const shouldInit = 
            /^https:\/\/app\.clio\.com\/nc\/#\//.test(href) &&  // Root dashboard
            !/\/(login|auth|sign_in|sign_up|password|billing)/.test(href) &&  // Exclude auth pages
            !href.includes('/bills/new_bills') &&  // Exclude new bills page (handled by newbills.js)
            !href.includes('/matters/new') &&  // Exclude new matter creation page
            !href.includes('/contacts/new') &&  // Exclude new contact creation page
            !href.includes('/settings/') &&  // Exclude settings pages
            !href.includes('/new') &&  // Exclude any other new creation pages
            !href.includes('/edit') &&  // Exclude edit pages
            !href.includes('/create');  // Exclude create pages
        
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
        
        // Always call the feature manager's route change handler
        featureManager.handleRouteChange();
        
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
        } else {
            // We're not on a supported page, make sure we're detached
            console.log('[Linqly] Not on supported page, ensuring detached');
            this.detach();
        }
        this.lastClickedRow = null;
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
            // Ignore synthetic events triggered by scripts (like Clio's Angular framework)
            if (!event.isTrusted) {
                console.log('[Linqly] Ignoring synthetic event (not user-triggered)');
                return;
            }

            console.log('[Linqly] Click event detected. Shift key pressed?', event.shiftKey);
            console.log('[Linqly] Current lastClickedRow:', this.lastClickedRow);

            const path = window.location.pathname + window.location.hash;
            const isDocumentsPage = path.includes('/documents') || path.includes('#/documents');
            const isMattersPage = path.includes('/matters') || path.includes('#/matters');
            
            // Check if the click is directly on a checkbox or its label
            const isCheckboxClick = event.target.matches('input[type="checkbox"], label') || 
                                  event.target.closest('input[type="checkbox"], label');
            
            // For Documents page, allow native checkbox clicks to work
            if (isDocumentsPage && isCheckboxClick) {
                console.log('[Linqly] Direct checkbox click on documents page, letting native handler work');
                return;
            }
            
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
                console.log('[Linqly] Available spans in row:', row.querySelectorAll('span[role="checkbox"]'));
                console.log('[Linqly] Available .th-checkbox elements:', row.querySelectorAll('.th-checkbox'));
                return;
            }
            
            console.log('[Linqly] Found checkbox:', checkbox);
            console.log('[Linqly] Checkbox tag name:', checkbox.tagName);
            console.log('[Linqly] Checkbox role:', checkbox.getAttribute('role'));
            console.log('[Linqly] Checkbox checked state:', this.getCheckboxState(checkbox));
            console.log('[Linqly] Checkbox attributes:', {
                type: checkbox.type,
                ngModel: checkbox.getAttribute('ng-model'),
                className: checkbox.className,
                id: checkbox.id,
                role: checkbox.getAttribute('role'),
                ariaChecked: checkbox.getAttribute('aria-checked')
            });
            
            try {
                // Prevent text selection during shift-click
                if (event.shiftKey) {
                    event.preventDefault();
                }

                // Handle shift-click range selection
                if (event.shiftKey && this.lastClickedRow) {
                    console.log('[Linqly] Running SHIFT-CLICK logic');
                    console.log('[Linqly] Anchor row:', this.lastClickedRow);
                    console.log('[Linqly] Target row:', row);
                    try {
                        console.log('[Linqly] Anchor row UID:', this.getRowUid(this.lastClickedRow));
                        console.log('[Linqly] Target row UID:', this.getRowUid(row));
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
                    const startUid = this.getRowUid(this.lastClickedRow);
                    const endUid = this.getRowUid(row);
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
                                this.getRowUid(row) === currentUid
                            );
                        }
                        
                        if (foundRow) {
                            const checkboxInRange = foundRow.querySelector(selectors.checkbox);
                            if (checkboxInRange) {
                                console.log('[Linqly] Processing row', i, 'with UID:', currentUid);
                                this.setCheckboxState(checkboxInRange, true, foundRow, isMattersPage);
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
                            console.log('[Linqly] Target checkbox current state:', this.getCheckboxState(targetCheckbox));
                            console.log('[Linqly] Ensuring target row is selected:', targetUid);
                            this.setCheckboxState(targetCheckbox, true, targetLiveRow, isMattersPage);
                            console.log('[Linqly] Target checkbox state after processing:', this.getCheckboxState(targetCheckbox));
                        } else {
                            console.log('[Linqly] Target checkbox not found in target row');
                        }
                    } else {
                        console.log('[Linqly] Target live row not found for UID:', targetUid);
                    }
                    
                    // Do not update lastClickedRow during shift-click
                    console.log('[Linqly] Shift-click complete, preserving anchor row');
                } else {
                    console.log('[Linqly] Running NORMAL CLICK logic');
                    // Normal click behavior - toggle the checkbox
                    const newState = !this.getCheckboxState(checkbox);
                    this.setCheckboxState(checkbox, newState, row, isMattersPage);
                    
                    // Update lastClickedRow for future shift-clicks only on normal clicks
                    this.lastClickedRow = row;
                    console.log('[Linqly] New anchor row set:', this.lastClickedRow);
                    try {
                        console.log('[Linqly] Anchor row UID:', this.getRowUid(this.lastClickedRow));
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
        
        console.log('[Linqly] Delegated listener attached to grid content');
    },

    /* Helper method to get a stable UID for a row */
    getRowUid(row) {
        // Try different UID attributes that Clio might use
        return row.getAttribute('data-uid') || 
               row.getAttribute('data-kendo-uid') || 
               row.getAttribute('id') || 
               row.getAttribute('data-row-index') ||
               row.textContent.trim().substring(0, 50); // Fallback to text content
    },

    /* Helper method to get the current state of a checkbox (works for both input and span) */
    getCheckboxState(checkbox) {
        if (checkbox.tagName === 'SPAN' && checkbox.getAttribute('role') === 'checkbox') {
            // For custom checkbox spans, check the aria-checked attribute
            const ariaChecked = checkbox.getAttribute('aria-checked');
            if (ariaChecked === 'true') {
                return true;
            } else if (ariaChecked === 'false') {
                return false;
            } else {
                // If aria-checked is empty or undefined, check the CSS classes
                const hasCheckedClass = checkbox.classList.contains('checked');
                const hasNgNotEmptyClass = checkbox.classList.contains('ng-not-empty');
                const hasNgEmptyClass = checkbox.classList.contains('ng-empty');
                
                console.log('[Linqly] aria-checked is empty, checking CSS classes:', {
                    hasCheckedClass,
                    hasNgNotEmptyClass,
                    hasNgEmptyClass,
                    allClasses: checkbox.className
                });
                
                // If it has the checked class or ng-not-empty (and not ng-empty), consider it checked
                return hasCheckedClass || (hasNgNotEmptyClass && !hasNgEmptyClass);
            }
        } else {
            // For regular checkboxes, use the checked property
            return checkbox.checked;
        }
    },

    /* Helper method to set checkbox state and trigger necessary events */
    setCheckboxState(checkbox, newState, row, isMattersPage) {
        // Check if this is a custom checkbox span
        const isCustomCheckbox = checkbox.tagName === 'SPAN' && checkbox.getAttribute('role') === 'checkbox';
        
        if (isCustomCheckbox) {
            console.log('[Linqly] Processing custom checkbox span');
            console.log('[Linqly] Current aria-checked:', checkbox.getAttribute('aria-checked'));
            console.log('[Linqly] Setting aria-checked to:', newState.toString());
            
            // For custom checkbox spans, set the aria-checked attribute
            checkbox.setAttribute('aria-checked', newState.toString());
            
            // Also update CSS classes to reflect the state
            if (newState) {
                checkbox.classList.add('checked', 'ng-not-empty');
                checkbox.classList.remove('ng-empty');
            } else {
                checkbox.classList.remove('checked', 'ng-not-empty');
                checkbox.classList.add('ng-empty');
            }
            
            console.log('[Linqly] Updated CSS classes:', checkbox.className);
            
            // Also try to find and update any hidden input that might be associated
            const hiddenInput = checkbox.querySelector('input[type="checkbox"]') || 
                               checkbox.closest('td').querySelector('input[type="checkbox"]') ||
                               checkbox.closest('tr').querySelector('input[type="checkbox"]');
            
            if (hiddenInput) {
                console.log('[Linqly] Found associated hidden input, updating its state');
                hiddenInput.checked = newState;
            }
            
            // For custom checkbox spans, we need to trigger Clio's Angular handler
            // The key is to call the ng-click function that Clio expects
            const ngClickAttr = checkbox.getAttribute('ng-click');
            console.log('[Linqly] ng-click attribute:', ngClickAttr);
            
            // First, try to trigger the click handler that Clio expects
            if (typeof checkbox.click === 'function') {
                console.log('[Linqly] Calling checkbox.click()');
                checkbox.click();
            }
            
            // Also try to trigger the ng-click handler directly
            try {
                console.log('[Linqly] Attempting to trigger ng-click handler directly');
                
                // Create a synthetic click event that mimics a real user click
                const syntheticClickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    button: 0,
                    buttons: 1,
                    clientX: checkbox.getBoundingClientRect().left + 5,
                    clientY: checkbox.getBoundingClientRect().top + 5
                });
                
                // Set the target to the checkbox
                Object.defineProperty(syntheticClickEvent, 'target', { value: checkbox });
                Object.defineProperty(syntheticClickEvent, 'currentTarget', { value: checkbox });
                
                // Dispatch the event
                checkbox.dispatchEvent(syntheticClickEvent);
                
            } catch (error) {
                console.log('[Linqly] Error triggering ng-click handler:', error.message);
            }
            
            // Also try to find and call the Angular controller method
            if (ngClickAttr && ngClickAttr.includes('dataTableCtrl.rowCheckboxClickHandler')) {
                console.log('[Linqly] Attempting to call Angular controller method');
                
                // Try to find the Angular scope and call the method
                const row = checkbox.closest('tr');
                if (row) {
                    // Try to get the Angular scope from the row (only if angular is available)
                    try {
                        if (typeof angular !== 'undefined' && angular && angular.element) {
                            const scope = angular.element(row).scope();
                            if (scope && scope.dataTableCtrl && typeof scope.dataTableCtrl.rowCheckboxClickHandler === 'function') {
                                console.log('[Linqly] Calling Angular controller method directly');
                                scope.dataTableCtrl.rowCheckboxClickHandler();
                            }
                        } else {
                            console.log('[Linqly] Angular not available, skipping direct controller call');
                        }
                    } catch (error) {
                        console.log('[Linqly] Error accessing Angular scope:', error.message);
                        // Continue with other methods even if Angular access fails
                    }
                    
                    // Try a different approach - dispatch events that Angular will recognize
                    try {
                        console.log('[Linqly] Dispatching Angular-compatible events');
                        
                        // Dispatch a custom event that Angular might be listening for
                        const customEvent = new CustomEvent('rowCheckboxClick', {
                            bubbles: true,
                            cancelable: true,
                            detail: { row: row, checkbox: checkbox }
                        });
                        row.dispatchEvent(customEvent);
                        
                        // Also try dispatching a change event on the checkbox
                        const changeEvent = new Event('change', { 
                            bubbles: true, 
                            cancelable: true 
                        });
                        checkbox.dispatchEvent(changeEvent);
                        
                        // And try dispatching an input event
                        const inputEvent = new Event('input', { 
                            bubbles: true, 
                            cancelable: true 
                        });
                        checkbox.dispatchEvent(inputEvent);
                        
                    } catch (error) {
                        console.log('[Linqly] Error dispatching Angular events:', error.message);
                    }
                }
            }
            
            // Dispatch click event to trigger Angular handlers
            const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
                button: 0,
                buttons: 1
            });
            checkbox.dispatchEvent(clickEvent);
            
            // Also try clicking the parent row to trigger row selection
            const parentRow = checkbox.closest('tr');
            if (parentRow) {
                console.log('[Linqly] Clicking parent row to trigger selection');
                parentRow.click();
            }
            
            // Verify the final state
            setTimeout(() => {
                const finalState = this.getCheckboxState(checkbox);
                console.log('[Linqly] Final checkbox state after processing:', finalState);
                console.log('[Linqly] Final aria-checked:', checkbox.getAttribute('aria-checked'));
                console.log('[Linqly] Final CSS classes:', checkbox.className);
            }, 100);
            
            return;
        }
        
        // For regular checkboxes, use the existing logic
        // For shift-click range selection, always set to true regardless of current state
        // This ensures all rows in the range are selected, even if some were already selected
        const currentState = this.getCheckboxState(checkbox);
        if (currentState === newState && newState === true) {
            console.log('[Linqly] Checkbox already in desired state, but ensuring it stays selected');
            // Don't return early - still process the checkbox to ensure it stays selected
        } else if (currentState === newState) {
            console.log('[Linqly] Checkbox already in desired state, skipping change');
            return;
        }

        console.log('[Linqly] Changing checkbox state from', currentState, 'to', newState);
        
        // Set the checkbox state
        checkbox.checked = newState;
        
        // For Matters page - handle Angular checkboxes
        if (isMattersPage && checkbox.hasAttribute('ng-model')) {
            // Dispatch change and input events
            ['change', 'input'].forEach(eventType => {
                const evt = new Event(eventType, { 
                    bubbles: true, 
                    cancelable: true
                });
                checkbox.dispatchEvent(evt);
            });
            
            // Also try clicking the parent container
            const parentContainer = checkbox.closest('.th-checkbox, td.row-selection-checkbox');
            if (parentContainer && parentContainer !== checkbox) {
                parentContainer.click();
            }
        } else {
            // For other pages - try multiple approaches to ensure the checkbox toggles
            if (typeof checkbox.click === 'function') {
                checkbox.click();
            }
            
            // Dispatch a click event with all necessary properties
            const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
                button: 0,
                buttons: 1,
                clientX: 0,
                clientY: 0
            });
            
            Object.defineProperties(clickEvent, {
                target: { value: checkbox },
                currentTarget: { value: checkbox },
                srcElement: { value: checkbox },
                composed: { value: true }
            });
            
            checkbox.dispatchEvent(clickEvent);
            
            // Also dispatch change and input events
            setTimeout(() => {
                checkbox.checked = newState;
                
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
        }
    },

    /* Get the appropriate row and checkbox selectors based on the current page */
    getSelectors() {
        const path = window.location.pathname + window.location.hash;
        
        console.log('[Linqly] Getting selectors for path:', path);
        
        // Common selectors that work across all pages
        const common = {
            row: 'tr[role="row"]:not(.k-grouping-row):not(.k-detail-row)',
            exclude: 'a, button, input, select, textarea, [role="button"], [ng-click]',
            container: '.k-grid-content, .k-grid-table-wrap, [kendo-grid]',
            isCustomCheckbox: false
        };

        // Matters page - use more comprehensive selectors
        if (path.includes('/matters') || path.includes('#/matters')) {
            const selectors = {
                ...common,
                checkbox: 'td.row-selection-checkbox input[type="checkbox"], .th-checkbox input[type="checkbox"], input[type="checkbox"][ng-model*="checkbox.checked"], input[type="checkbox"][ng-model], input[type="checkbox"]',
                isCustomCheckbox: true
            };
            console.log('[Linqly] Using Matters page selectors:', selectors);
            return selectors;
        }
        
        // Billing page
        if (path.includes('/bills') || path.includes('#/bills')) {
            const selectors = {
                ...common,
                checkbox: 'td:first-child input[type="checkbox"], .th-checkbox-basic input[type="checkbox"]'
            };
            console.log('[Linqly] Using Billing page selectors:', selectors);
            return selectors;
        }
        
        // Tasks page
        if (path.includes('/tasks') || path.includes('#/tasks')) {
            const selectors = {
                ...common,
                checkbox: 'td.row-selection-checkbox input[type="checkbox"], .th-checkbox-basic'
            };
            console.log('[Linqly] Using Tasks page selectors:', selectors);
            return selectors;
        }
        
        // Documents page - use more comprehensive selectors
        if (path.includes('/documents') || path.includes('#/documents')) {
            const selectors = {
                ...common,
                checkbox: 'td.row-selection-checkbox input[type="checkbox"], .th-checkbox input[type="checkbox"], .th-checkbox span[role="checkbox"], span[role="checkbox"], input[type="checkbox"][ng-model], input[type="checkbox"]',
                isCustomCheckbox: true
            };
            console.log('[Linqly] Using Documents page selectors:', selectors);
            return selectors;
        }
        
        // Default for all other pages
        const selectors = {
            ...common,
            checkbox: 'input[type="checkbox"]'
        };
        console.log('[Linqly] Using default selectors:', selectors);
        return selectors;
    },
    
    detach() {
        console.log('[Linqly] Detaching row-click feature');
        
        // Clean up click listener
        if (this.listener) {
            this.listener();
            this.listener = null;
        }
        
        // Don't clean up route observer - keep it active to detect route changes
        // this.cleanupRouteObserver();
        
        // Reset current path to ensure reinitialization works correctly
        this.currentPath = '';
        this.tableBody = null;
        this.isInitialized = false;
        this.lastClickedRow = null;
        
        console.log('[Linqly] Row-click feature fully detached');
    }
};

/**************** Feature: Checkbox Deselect **************/
const checkboxDeselectFeature = {
    name: 'Checkbox Deselect',
    
    isInitialized: false,
    
    shouldInitialize() {
        // Initialize on any Clio page that might have tables, but exclude new bills page
        const href = window.location.href;
        const shouldInit = /^https:\/\/app\.clio\.com\/nc\/#\//.test(href) && 
                          !/\/(login|auth|sign_in|sign_up|password|billing)/.test(href) &&
                          !href.includes('/bills/new_bills') &&  // Exclude new bills page (handled by newbills.js)
                          !href.includes('/matters/new') &&  // Exclude new matter creation page
                          !href.includes('/contacts/new') &&  // Exclude new contact creation page
                          !href.includes('/settings/') &&  // Exclude settings pages
                          !href.includes('/new') &&  // Exclude any other new creation pages
                          !href.includes('/edit') &&  // Exclude edit pages
                          !href.includes('/create');  // Exclude create pages
        console.log(`[Linqly] Should initialize Checkbox Deselect for ${href}?`, shouldInit);
        return shouldInit;
    },
    
    initialize() {
        if (this.isInitialized) return;
        
        console.log('[Linqly] Initializing Checkbox Deselect feature');
        
        // Bind methods to maintain correct 'this' context
        this.boundHandlePageClick = this.handlePageClick.bind(this);
        this.boundHandleKeydown = this.handleKeydown.bind(this);
        
        // Add event listeners with bound methods
        document.addEventListener('click', this.boundHandlePageClick, true);
        document.addEventListener('keydown', this.boundHandleKeydown);
        
        this.isInitialized = true;
    },
    
    deselectAll() {
        // Find the clear selection button
        const clearButton = document.querySelector('a.counter-clear[ng-click*="clearSelection"]');
        
        if (clearButton) {
            console.log('[Linqly] Found clear selection button, clicking it');
            clearButton.click();
        } else {
            console.log('[Linqly] Clear selection button not found');
            console.log('[Linqly] Current URL:', window.location.href);
            console.log('[Linqly] Should not be running on new bills page');
        }
    },
    
    handlePageClick(event) {
        const target = event.target;
        
        // Exit if the user clicked on a link, button, or an icon within a button
        if (target.closest('a, button, [role="button"]')) {
            return;
        }
        
        // Find the closest parent row within a Clio data table
        const clickedRow = target.closest('[data-attr="matters-table"] tbody tr');
        
        // Scenario 1: The user clicked inside a data table row
        if (clickedRow) {
            // Find the specific checkbox for that row
            const checkbox = clickedRow.querySelector('td.row-selection-checkbox input[type="checkbox"]');
            if (!checkbox) return;
            
            // Toggle the checkbox's checked state
            checkbox.checked = !checkbox.checked;
            
            // Toggle a visual class on the row to indicate its selected state
            clickedRow.classList.toggle('custom-selected-row', checkbox.checked);
            
        // Scenario 2: The user clicked somewhere on the page, but not within the data table area
        } else if (!target.closest('th-data-table')) {
            // Add a small delay to prevent immediate deselection of newly selected checkboxes
            setTimeout(() => {
                this.deselectAll();
            }, 50);
        }
    },
    
    handleKeydown(event) {
        if (event.key === 'Escape') {
            this.deselectAll();
        }
    },
    
    detach() {
        if (!this.isInitialized) return;
        
        console.log('[Linqly] Detaching Checkbox Deselect feature');
        document.removeEventListener('click', this.boundHandlePageClick, true);
        document.removeEventListener('keydown', this.boundHandleKeydown);
        
        // Reset bound methods
        this.boundHandlePageClick = null;
        this.boundHandleKeydown = null;
        
        this.isInitialized = false;
    }
};

/**************** Feature: New Bills Page **************/
const newBillsPageFeature = {
    name: 'New Bills Page',
    
    isInitialized: false,
    observer: null,
    listener: null,
    
    shouldInitialize() {
        const href = window.location.href;
        const shouldInit = href.includes('/bills/new_bills');
        console.log(`[Linqly] Should initialize New Bills Page for ${href}?`, shouldInit);
        return shouldInit;
    },
    
    initialize() {
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
    },
    
    setupTableHandlers() {
        const table = document.querySelector('.cc-tree-view');
        if (table) {
            console.log('[Linqly] Found new bills table, setting up handlers');
            table.addEventListener('click', this.boundHandleTableClick);
            return true;
        }
        return false;
    },
    
    setupDeselectHandlers() {
        // Add event listeners
        document.addEventListener('keydown', this.boundHandleKeydown);
        document.addEventListener('click', this.boundHandlePageClick, true);
        
        console.log('[Linqly] New Bills Page deselect handlers initialized');
        console.log('[Linqly] ESC key listener attached:', !!this.boundHandleKeydown);
        console.log('[Linqly] Click outside listener attached:', !!this.boundHandlePageClick);
    },
    
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
    },
    
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
    },
    
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
    },
    
    handleKeydown(event) {
        if (event.key === 'Escape') {
            this.deselectAll();
        }
    },
    
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
    },
    
    detach() {
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
        
        // Reset bound methods
        this.boundHandleTableClick = null;
        this.boundHandleKeydown = null;
        this.boundHandlePageClick = null;
        
        this.isInitialized = false;
        console.log('[Linqly] New Bills Page feature fully detached');
    }
};

/************************ Initialise *******************************/
// Register features
featureManager.register(rowClickSelectFeature);
featureManager.register(checkboxDeselectFeature);
featureManager.register(newBillsPageFeature);

// Helper to (de)activate features based on stored setting
function applyEnabledState(enabled) {
    if (enabled) {
        featureManager.init();
    } else {
        // Detach logic for each feature that supports detach
        if (typeof rowClickSelectFeature.detach === 'function') {
            rowClickSelectFeature.detach();
            // Also clean up the route observer to prevent reinitialization
            rowClickSelectFeature.cleanupRouteObserver();
        }
        if (typeof checkboxDeselectFeature.detach === 'function') {
            checkboxDeselectFeature.detach();
        }
        if (typeof newBillsPageFeature.detach === 'function') {
            newBillsPageFeature.detach();
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
