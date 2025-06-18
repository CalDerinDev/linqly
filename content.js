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
            const path = window.location.pathname + window.location.hash;
            const isDocumentsPage = path.includes('/documents') || path.includes('#/documents');
            const isMattersPage = path.includes('/matters') || path.includes('#/matters');
            
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
                const isMattersPage = path.includes('/matters') || path.includes('#/matters');
                
                // Toggle the checkbox state
                const newState = !checkbox.checked;
                checkbox.checked = newState;
                
                // For Matters page - handle Angular checkboxes
                if (isMattersPage && checkbox.hasAttribute('ng-model')) {
                    console.log('[Linqly] Handling Angular checkbox on matters page');
                    
                    // Check if we're on the main matters page or a subtab
                    const currentUrl = window.location.href;
                    const isMainMattersPage = currentUrl.includes('/matters?') || 
                                             currentUrl.includes('#/matters?') || 
                                             currentUrl.match(/\/matters$/) || 
                                             currentUrl.match(/#\/matters$/);
                    const isMattersSubtab = currentUrl.includes('/matters/') && currentUrl.split('/').length > 4;
                    
                    console.log('[Linqly] Current URL:', currentUrl);
                    console.log('[Linqly] Main matters page:', isMainMattersPage, 'Subtab:', isMattersSubtab);
                    
                    // For main matters page, try a more direct approach
                    if (isMainMattersPage) {
                        console.log('[Linqly] Using direct approach for main matters page');
                        // Set the checked state directly and dispatch events
                        checkbox.checked = newState;
                        
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
                        // For subtabs, use the simple click approach
                        console.log('[Linqly] Using simple click for subtab');
                        if (typeof checkbox.click === 'function') {
                            console.log('[Linqly] Using checkbox.click() method');
                            checkbox.click();
                        } else {
                            console.log('[Linqly] Using fallback click event dispatch');
                            // Fallback: dispatch a simple click event
                            const clickEvent = new MouseEvent('click', {
                                view: window,
                                bubbles: true,
                                cancelable: true
                            });
                            checkbox.dispatchEvent(clickEvent);
                        }
                    }
                    
                    return;
                }
                
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

        // Matters page
        if (path.includes('/matters') || path.includes('#/matters')) {
            return {
                ...common,
                checkbox: 'td.row-selection-checkbox input[type="checkbox"], .th-checkbox input[type="checkbox"], input[type="checkbox"][ng-model*="checkbox.checked"]',
                isCustomCheckbox: true
            };
        }
        
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
        
        // Default for all other pages
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
        
        // Don't clean up route observer - keep it active to detect route changes
        // this.cleanupRouteObserver();
        
        // Reset current path to ensure reinitialization works correctly
        this.currentPath = '';
        this.tableBody = null;
        this.isInitialized = false;
        
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
