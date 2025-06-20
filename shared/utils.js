/* ========= Shared Utilities for Linqly Extension =========
   Common functions and utilities used across different page modules
===================================================================== */

// Shared utility functions
const LinqlyUtils = {
    
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
    setCheckboxState(checkbox, newState, row, pageType) {
        // Check if this is a custom checkbox span
        const isCustomCheckbox = checkbox.tagName === 'SPAN' && checkbox.getAttribute('role') === 'checkbox';
        
        if (isCustomCheckbox) {
            console.log('[Linqly] Processing custom checkbox span');
            const isChecked = this.getCheckboxState(checkbox);
            if (newState !== isChecked) {
                console.log('[Linqly] Toggling custom checkbox via .click()');
                checkbox.click(); // Let Angular handle the state change
            } else {
                console.log('[Linqly] Custom checkbox already in desired state, no action taken');
            }
            return;
        }
        
        // For regular checkboxes, use the existing logic
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
        if (pageType === 'matters' && checkbox.hasAttribute('ng-model')) {
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

    /* Add CSS to prevent text selection during shift+click */
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

    /* Remove text selection prevention CSS */
    removeTextSelectionPreventionCSS() {
        const existingStyle = document.getElementById('linqly-text-selection-prevention');
        if (existingStyle) {
            existingStyle.remove();
            console.log('[Linqly] Removed text selection prevention CSS');
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LinqlyUtils;
} else {
    window.LinqlyUtils = LinqlyUtils;
} 