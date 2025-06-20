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
    
    async init() {
        this.features.forEach(feature => {
            try {
                if (!feature.shouldInitialize || feature.shouldInitialize()) {
                    feature.initialize();
                }
            } catch (err) {
                console.error(`Error initialising feature: ${feature.name}`, err);
            }
        });
        
        // Initialize modular page modules if available
        await this.initModularPages();
    },
    
    async initModularPages() {
        // Check if extension is enabled before initializing modular pages
        try {
            const res = await new Promise((resolve) => {
                chrome.storage.sync.get({ linqly_enabled: true }, resolve);
            });
            
            if (!res.linqly_enabled) {
                console.log('[Linqly] Extension disabled, skipping modular page initialization');
                return;
            }
            
            // Initialize Matters page module if available and on Matters page
            if (window.LinqlyMattersPage && window.LinqlyMattersPage.shouldInitialize()) {
                try {
                    console.log('[Linqly] Initializing modular Matters page');
                    window.LinqlyMattersPage.initialize();
                } catch (err) {
                    console.error('[Linqly] Error initializing modular Matters page:', err);
                }
            }
            
            // Initialize Contacts page module if available and on Contacts page
            if (window.LinqlyContactsPage && window.LinqlyContactsPage.shouldInitialize()) {
                try {
                    console.log('[Linqly] Initializing modular Contacts page');
                    window.LinqlyContactsPage.initialize();
                } catch (err) {
                    console.error('[Linqly] Error initializing modular Contacts page:', err);
                }
            }
            
            // Initialize Tasks page module if available and on Tasks page
            if (window.LinqlyTasksPage && window.LinqlyTasksPage.shouldInitialize()) {
                try {
                    console.log('[Linqly] Initializing modular Tasks page');
                    window.LinqlyTasksPage.initialize();
                } catch (err) {
                    console.error('[Linqly] Error initializing modular Tasks page:', err);
                }
            }
            
            // Initialize Activities page module if available and on Activities page
            if (window.LinqlyActivitiesPage && window.LinqlyActivitiesPage.shouldInitialize()) {
                try {
                    console.log('[Linqly] Initializing modular Activities page');
                    window.LinqlyActivitiesPage.initialize();
                } catch (err) {
                    console.error('[Linqly] Error initializing modular Activities page:', err);
                }
            }
            
            // Initialize Documents page module if available and on Documents page
            if (window.LinqlyDocumentsPage && window.LinqlyDocumentsPage.shouldInitialize()) {
                try {
                    console.log('[Linqly] Initializing modular Documents page');
                    window.LinqlyDocumentsPage.initialize();
                } catch (err) {
                    console.error('[Linqly] Error initializing modular Documents page:', err);
                }
            }
            
            // Initialize Billing page module if available and on Billing page
            if (window.LinqlyBillingPage && window.LinqlyBillingPage.shouldInitialize()) {
                try {
                    console.log('[Linqly] Initializing modular Billing page');
                    window.LinqlyBillingPage.initialize();
                } catch (err) {
                    console.error('[Linqly] Error initializing modular Billing page:', err);
                }
            }
        } catch (error) {
            if (error && error.message && error.message.includes('Extension context invalidated')) {
                console.warn('[Linqly] Extension context invalidated. Please reload the page to restore extension functionality.');
                return;
            }
            console.error('[Linqly] Error checking extension state for modular pages:', error);
        }
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
        this.routeChangeTimeout = setTimeout(async () => {
            this.isProcessingRouteChange = true;
            console.log('[Linqly] Processing route change in feature manager...');
            
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
            
            // Handle modular page modules during route changes
            console.log('[Linqly] Checking modular pages for route change...');
            try {
                const res = await new Promise((resolve) => {
                    chrome.storage.sync.get({ linqly_enabled: true }, resolve);
                });
                
                if (res.linqly_enabled) {
                    console.log('[Linqly] Extension is enabled, checking modular pages...');
                    
                    // Check and initialize Matters page if needed
                    if (window.LinqlyMattersPage) {
                        const shouldInitMatters = window.LinqlyMattersPage.shouldInitialize();
                        console.log('[Linqly] Matters page should initialize?', shouldInitMatters);
                        if (shouldInitMatters) {
                            console.log('[Linqly] Route change: Initializing modular Matters page');
                            window.LinqlyMattersPage.initialize();
                        }
                    }
                    
                    // Check and initialize Contacts page if needed
                    if (window.LinqlyContactsPage) {
                        const shouldInitContacts = window.LinqlyContactsPage.shouldInitialize();
                        console.log('[Linqly] Contacts page should initialize?', shouldInitContacts);
                        if (shouldInitContacts) {
                            console.log('[Linqly] Route change: Initializing modular Contacts page');
                            window.LinqlyContactsPage.initialize();
                        }
                    }
                    
                    // Check and initialize Tasks page if needed
                    if (window.LinqlyTasksPage) {
                        const shouldInitTasks = window.LinqlyTasksPage.shouldInitialize();
                        console.log('[Linqly] Tasks page should initialize?', shouldInitTasks);
                        if (shouldInitTasks) {
                            console.log('[Linqly] Route change: Initializing modular Tasks page');
                            window.LinqlyTasksPage.initialize();
                        }
                    }
                    
                    // Check and initialize Activities page if needed
                    if (window.LinqlyActivitiesPage) {
                        const shouldInitActivities = window.LinqlyActivitiesPage.shouldInitialize();
                        console.log('[Linqly] Activities page should initialize?', shouldInitActivities);
                        if (shouldInitActivities) {
                            console.log('[Linqly] Route change: Initializing modular Activities page');
                            window.LinqlyActivitiesPage.initialize();
                        }
                    }
                    
                    // Check and initialize Documents page if needed
                    if (window.LinqlyDocumentsPage) {
                        const shouldInitDocuments = window.LinqlyDocumentsPage.shouldInitialize();
                        console.log('[Linqly] Documents page should initialize?', shouldInitDocuments);
                        if (shouldInitDocuments) {
                            console.log('[Linqly] Route change: Initializing modular Documents page');
                            window.LinqlyDocumentsPage.initialize();
                        }
                    }
                    
                    // Check and initialize Billing page if needed
                    if (window.LinqlyBillingPage) {
                        const shouldInitBilling = window.LinqlyBillingPage.shouldInitialize();
                        console.log('[Linqly] Billing page should initialize?', shouldInitBilling);
                        if (shouldInitBilling) {
                            console.log('[Linqly] Route change: Initializing modular Billing page');
                            window.LinqlyBillingPage.initialize();
                        }
                    }
                } else {
                    console.log('[Linqly] Extension is disabled, skipping modular page initialization');
                }
            } catch (error) {
                if (error && error.message && error.message.includes('Extension context invalidated')) {
                    console.warn('[Linqly] Extension context invalidated. Please reload the page to restore extension functionality.');
                    this.isProcessingRouteChange = false;
                    return;
                }
                console.error('[Linqly] Error handling modular pages during route change:', error);
            }
            
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
        
        // Check if we're on the Matters page and have the modular module available
        if ((href.includes('/matters') || href.includes('#/matters')) && 
            !href.includes('/matters/new') && 
            !href.includes('/matters/edit') && 
            !href.includes('/matters/create') &&
            window.LinqlyMattersPage) {
            console.log('[Linqly] Matters page detected, using modular approach');
            return false; // Don't initialize the main feature, let the modular one handle it
        }
        
        // Check if we're on the Contacts page and have the modular module available
        if ((href.includes('/contacts') || href.includes('#/contacts')) && 
            !href.includes('/contacts/new') && 
            !href.includes('/contacts/edit') && 
            !href.includes('/contacts/create') &&
            window.LinqlyContactsPage) {
            console.log('[Linqly] Contacts page detected, using modular approach');
            return false; // Don't initialize the main feature, let the modular one handle it
        }
        
        // Check if we're on the Tasks page and have the modular module available
        if ((href.includes('/tasks') || href.includes('#/tasks')) && 
            !href.includes('/tasks/new') && 
            !href.includes('/tasks/edit') && 
            !href.includes('/tasks/create') &&
            window.LinqlyTasksPage) {
            console.log('[Linqly] Tasks page detected, using modular approach');
            return false; // Don't initialize the main feature, let the modular one handle it
        }
        
        // Check if we're on the Activities page and have the modular module available
        if ((href.includes('/activities') || href.includes('#/activities')) && 
            !href.includes('/activities/new') && 
            !href.includes('/activities/edit') && 
            !href.includes('/activities/create') &&
            window.LinqlyActivitiesPage) {
            console.log('[Linqly] Activities page detected, using modular approach');
            return false; // Don't initialize the main feature, let the modular one handle it
        }
        
        // Check if we're on the new bills page (handled by modular approach)
        if (href.includes('/bills/new_bills')) {
            console.log('[Linqly] New bills page detected, using modular approach');
            return false; // Don't initialize the main feature, let the modular one handle it
        }
        
        // Check if we're on the Billing page and have the modular module available
        if ((href.includes('/bills') || href.includes('#/bills')) && 
            !href.includes('/bills/new') && 
            !href.includes('/bills/edit') && 
            !href.includes('/bills/create') &&
            !href.includes('/bills/new_bills') &&
            window.LinqlyBillingPage) {
            console.log('[Linqly] Billing page detected, using modular approach');
            return false; // Don't initialize the main feature, let the modular one handle it
        }
        
        // Check if we're on the Documents page and have the modular module available
        if ((href.includes('/documents') || href.includes('#/documents')) && 
            !href.includes('/documents/new') && 
            !href.includes('/documents/edit') && 
            !href.includes('/documents/create') &&
            window.LinqlyDocumentsPage) {
            console.log('[Linqly] Documents page detected, using modular approach');
            return false; // Don't initialize the main feature, let the modular one handle it
        }
        
        // Match root dashboard or specific sections
        const shouldInit = 
            /^https:\/\/app\.clio\.com\/nc\/#\//.test(href) &&  // Root dashboard
            !/\/(login|auth|sign_in|sign_up|password|billing)/.test(href) &&  // Exclude auth pages
            !href.includes('/matters/new') &&  // Exclude new matter creation page
            !href.includes('/contacts/new') &&  // Exclude new contact creation page
            !href.includes('/tasks/new') &&  // Exclude new task creation page
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
        const isOnSupportedPage = this.shouldInitialize();
        console.log(`[Linqly] Route changed from ${this.currentPath} to ${newPath}`);
        this.currentPath = newPath;

        // Always call the feature manager's route change handler first
        featureManager.handleRouteChange();

        if (isOnSupportedPage) {
            // On actionable page: ensure everything is initialized and observer is set up
            console.log('[Linqly] On actionable page, initializing extension');
            this.detach(); // Full cleanup before re-init
            this.cleanupRouteObserver(); // Ensure no duplicate observers
            setTimeout(() => {
                this.initialize();
                this.setupRouteObserver();
                console.log('[Linqly] Extension initialized on actionable page');
            }, 300);
        } else {
            // On unactionable page: fully turn off extension and clean up observers
            console.log('[Linqly] On unactionable page, turning extension off');
            this.detach();
            this.cleanupRouteObserver();
        }
        this.lastClickedRow = null;
    },
    
    /* Setup route change detection */
    setupRouteObserver() {
        // Only set up observer if on actionable page
        if (!this.shouldInitialize()) {
            console.log('[Linqly] Not on actionable page, not setting up route observer');
            return;
        }
        console.log('[Linqly] Setting up route observer');
        this.cleanupRouteObserver();
        this.boundHandleRouteChange = this.handleRouteChange.bind(this);
        window.addEventListener('hashchange', this.boundHandleRouteChange);
        window.addEventListener('popstate', this.boundHandleRouteChange);
        this.routeObserver = new MutationObserver(() => {
            const path = window.location.href;
            if (path !== this.currentPath) {
                this.handleRouteChange();
            }
        });
        this.routeObserver.observe(document, {
            childList: true,
            subtree: true
        });
    },
    
    /* Cleanup route observer */
    cleanupRouteObserver() {
        if (this.boundHandleRouteChange) {
            window.removeEventListener('hashchange', this.boundHandleRouteChange);
            window.removeEventListener('popstate', this.boundHandleRouteChange);
            this.boundHandleRouteChange = null;
        }
        if (this.routeObserver) {
            this.routeObserver.disconnect();
            this.routeObserver = null;
        }
        console.log('[Linqly] Cleaned up route observer');
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
        
        // Always setup route change detection - this is needed for modular pages
        if (!this.routeObserver) {
            this.setupRouteObserver();
        }
        
        // Only proceed with the rest if we should initialize on this page
        if (!this.shouldInitialize()) {
            console.log('[Linqly] Not initializing main feature - using modular approach');
            return;
        }
        
        // Add CSS to prevent text selection during shift+click
        this.addTextSelectionPreventionCSS();
        
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
        
        // Add mouse event listeners to prevent text selection during shift+click
        this.addMouseEventListeners(container);
        
        // Store reference to bound function for removal
        const handleClick = (event) => {
            // Ignore synthetic events triggered by scripts (like Clio's Angular framework)
            if (!event.isTrusted) {
                console.log('[Linqly] Ignoring synthetic event (not user-triggered)');
                return;
            }

            const selectors = this.getSelectors();
            const isCheckbox = event.target.matches(selectors.checkbox);
            const row = event.target.closest(selectors.row);

            // If the click is on a native checkbox, handle shift+click logic here
            if (isCheckbox && row) {
                // Prevent text selection during shift-click
                if (event.shiftKey) {
                    event.preventDefault();
                    const gridContainer = container.closest('.k-grid-content, .k-grid-table-wrap, [kendo-grid], .cc-tree-view');
                    if (gridContainer) {
                        gridContainer.classList.add('shift-click-active');
                        setTimeout(() => {
                            gridContainer.classList.remove('shift-click-active');
                        }, 1000);
                    }
                    if (window.getSelection) {
                        const selection = window.getSelection();
                        if (selection.removeAllRanges) {
                            selection.removeAllRanges();
                        } else if (selection.empty) {
                            selection.empty();
                        }
                    }
                }
                // Shift+click logic
                if (event.shiftKey && this.lastClickedRow) {
                    const gridBody = row.closest('tbody');
                    if (!gridBody) return;
                    const allRowsInDom = Array.from(gridBody.querySelectorAll(selectors.row));
                    const visibleRows = allRowsInDom.filter(r => r.offsetParent !== null);
                    const visibleRowUids = visibleRows.map(r => this.getRowUid(r));
                    const startUid = this.getRowUid(this.lastClickedRow);
                    const endUid = this.getRowUid(row);
                    const startIndex = visibleRowUids.indexOf(startUid);
                    const endIndex = visibleRowUids.indexOf(endUid);
                    if (startIndex === -1 || endIndex === -1) return;
                    const rangeStart = Math.min(startIndex, endIndex);
                    const rangeEnd = Math.max(startIndex, endIndex);
                    for (let i = rangeStart; i <= rangeEnd; i++) {
                        const currentUid = visibleRowUids[i];
                        if (currentUid === startUid || currentUid === endUid) continue;
                        const liveRow = gridBody.querySelector(`tr[data-uid="${currentUid}"], tr[data-kendo-uid="${currentUid}"], tr[id="${currentUid}"], tr[data-row-index="${currentUid}"]`)
                            || Array.from(gridBody.querySelectorAll(selectors.row)).find(r => this.getRowUid(r) === currentUid);
                        if (liveRow) {
                            const checkboxInRange = liveRow.querySelector(selectors.checkbox);
                            if (checkboxInRange) {
                                this.setCheckboxState(checkboxInRange, true, liveRow, false);
                            }
                        }
                    }
                    // Always select the target row's checkbox
                    this.setCheckboxState(event.target, true, row, false);
                    // Do not update lastClickedRow on shift+click
                    return;
                } else {
                    // Normal click: update lastClickedRow
                    this.lastClickedRow = row;
                }
            }
            // ... existing code ...
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
        if (this.listener) {
            this.listener();
            this.listener = null;
        }
        this.removeMouseEventListeners();
        this.removeTextSelectionPreventionCSS();
        this.currentPath = '';
        this.tableBody = null;
        this.isInitialized = false;
        this.lastClickedRow = null;
        this.isShiftPressed = false;
        this.isShiftClickOperation = false;
        document.querySelectorAll('.shift-click-active').forEach(el => el.classList.remove('shift-click-active'));
        this.cleanupRouteObserver(); // Always clean up observer on detach
        console.log('[Linqly] Row-click feature fully detached (idempotent)');
    },

    addTextSelectionPreventionCSS() {
        // Check if we already added the CSS to avoid duplicates
        if (document.getElementById('linqly-text-selection-prevention')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'linqly-text-selection-prevention';
        style.textContent = `
            /* Only prevent text selection during shift+click operations */
            .k-grid-content.shift-click-active,
            .k-grid-table-wrap.shift-click-active,
            [kendo-grid].shift-click-active,
            .cc-tree-view.shift-click-active {
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
                user-select: none !important;
            }
            
            /* Allow text selection in interactive elements even during shift+click */
            .k-grid-content.shift-click-active input,
            .k-grid-content.shift-click-active textarea,
            .k-grid-content.shift-click-active [contenteditable],
            .k-grid-table-wrap.shift-click-active input,
            .k-grid-table-wrap.shift-click-active textarea,
            .k-grid-table-wrap.shift-click-active [contenteditable],
            [kendo-grid].shift-click-active input,
            [kendo-grid].shift-click-active textarea,
            [kendo-grid].shift-click-active [contenteditable],
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
        console.log('[Linqly] Added text selection prevention CSS (shift+click only)');
    },

    removeTextSelectionPreventionCSS() {
        const existingStyle = document.getElementById('linqly-text-selection-prevention');
        if (existingStyle) {
            existingStyle.remove();
            console.log('[Linqly] Removed text selection prevention CSS');
        }
    },

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
        
        console.log('[Linqly] Added mouse event listeners for text selection prevention');
    },

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
        
        console.log('[Linqly] Removed mouse event listeners');
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

/************************ Initialise *******************************/
// Register features
featureManager.register(rowClickSelectFeature);
featureManager.register(checkboxDeselectFeature);

// Helper to (de)activate features based on stored setting
async function applyEnabledState(enabled) {
    if (enabled) {
        await featureManager.init();
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
        
        // Also detach modular page modules
        if (window.LinqlyMattersPage && typeof window.LinqlyMattersPage.detach === 'function') {
            console.log('[Linqly] Detaching modular Matters page due to extension disable');
            window.LinqlyMattersPage.detach();
        }
        if (window.LinqlyContactsPage && typeof window.LinqlyContactsPage.detach === 'function') {
            console.log('[Linqly] Detaching modular Contacts page due to extension disable');
            window.LinqlyContactsPage.detach();
        }
        if (window.LinqlyTasksPage && typeof window.LinqlyTasksPage.detach === 'function') {
            console.log('[Linqly] Detaching modular Tasks page due to extension disable');
            window.LinqlyTasksPage.detach();
        }
        if (window.LinqlyActivitiesPage && typeof window.LinqlyActivitiesPage.detach === 'function') {
            console.log('[Linqly] Detaching modular Activities page due to extension disable');
            window.LinqlyActivitiesPage.detach();
        }
        if (window.LinqlyBillingPage && typeof window.LinqlyBillingPage.detach === 'function') {
            console.log('[Linqly] Detaching modular Billing page due to extension disable');
            window.LinqlyBillingPage.detach();
        }
        if (window.LinqlyDocumentsPage && typeof window.LinqlyDocumentsPage.detach === 'function') {
            console.log('[Linqly] Detaching modular Documents page due to extension disable');
            window.LinqlyDocumentsPage.detach();
        }
    }
}

// Read initial setting then apply
async function initFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.sync.get({ linqly_enabled: true }, async (res) => {
            console.log('[Linqly] Initial load, enabled state:', res.linqly_enabled);
            await applyEnabledState(res.linqly_enabled);
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
    // Always reinitialize to ensure modular pages are properly handled
    initializeExtension();
  }
  return false; // We don't need to keep the message channel open
});

// Main initialization function
function initializeExtension() {
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
        applyEnabledState(changes.linqly_enabled.newValue).catch(error => {
            console.error('[Linqly] Error applying enabled state:', error);
        });
    }
});

// Also listen for messages from popup (redundant but ensures immediate response)
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SETTINGS_UPDATED' && msg.settings && typeof msg.settings.linqly_enabled !== 'undefined') {
        console.log('[Linqly] Message received, enabled:', msg.settings.linqly_enabled);
        applyEnabledState(msg.settings.linqly_enabled).catch(error => {
            console.error('[Linqly] Error applying enabled state from message:', error);
        });
    }
});

// Load shared utilities
if (typeof LinqlyUtils === 'undefined') {
    // If shared utils aren't loaded, we'll load them dynamically
    console.log('[Linqly] Shared utilities not found, loading dynamically');
}

// Reference page-specific modules (they're already declared in their respective files)
// The modular pages declare themselves on the window object
console.log('[Linqly] Checking for modular page modules...');

// Direct route change handler for modular pages
function handleModularPageRouteChange() {
    console.log('[Linqly] Direct modular page route change handler triggered');
    
    // Check extension state and initialize appropriate modular page
    chrome.storage.sync.get({ linqly_enabled: true }, (res) => {
        if (!res.linqly_enabled) {
            console.log('[Linqly] Extension disabled, not initializing modular pages');
            return;
        }
        
        const currentPath = window.location.href;
        console.log('[Linqly] Current path:', currentPath);
        
        // Check and initialize Matters page if needed
        if (window.LinqlyMattersPage && window.LinqlyMattersPage.shouldInitialize()) {
            console.log('[Linqly] Direct handler: Initializing Matters page');
            window.LinqlyMattersPage.initialize();
        }
        
        // Check and initialize Contacts page if needed
        if (window.LinqlyContactsPage && window.LinqlyContactsPage.shouldInitialize()) {
            console.log('[Linqly] Direct handler: Initializing Contacts page');
            window.LinqlyContactsPage.initialize();
        }
        
        // Check and initialize Tasks page if needed
        if (window.LinqlyTasksPage && window.LinqlyTasksPage.shouldInitialize()) {
            console.log('[Linqly] Direct handler: Initializing Tasks page');
            window.LinqlyTasksPage.initialize();
        }
        
        // Check and initialize Activities page if needed
        if (window.LinqlyActivitiesPage && window.LinqlyActivitiesPage.shouldInitialize()) {
            console.log('[Linqly] Direct handler: Initializing Activities page');
            window.LinqlyActivitiesPage.initialize();
        }
        
        // Check and initialize Documents page if needed
        if (window.LinqlyDocumentsPage && window.LinqlyDocumentsPage.shouldInitialize()) {
            console.log('[Linqly] Direct handler: Initializing Documents page');
            window.LinqlyDocumentsPage.initialize();
        }
        
        // Check and initialize Billing page if needed
        if (window.LinqlyBillingPage && window.LinqlyBillingPage.shouldInitialize()) {
            console.log('[Linqly] Direct handler: Initializing Billing page');
            window.LinqlyBillingPage.initialize();
        }
    });
}

// Set up direct route change listeners
window.addEventListener('hashchange', handleModularPageRouteChange);
window.addEventListener('popstate', handleModularPageRouteChange);
