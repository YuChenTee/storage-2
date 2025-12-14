// Function to initialize Select2 for dropdowns
function initializeSelect2() {
    $('#productSelect').select2();
    $('#updateSelect').select2();
    $('#updateType').select2();
    $('#thresholdMaterialName').select2();
    $('#historyMaterialSelect').select2();
    $('#createProductMaterialSelect').select2();
    $('#editProductSelect').select2();
    $('#editProductMaterialSelect').select2();
    $('#batchSelect').select2();
    $('#batchInfoMaterialSelect').select2();
    $('#pendingMaterialSelect').select2();
    $('#orderMaterialSelect').select2();
    $('#SOProductSelect').select2();
    $('#salesOrderSelect').select2();
    $('#editSalesOrderSelect').select2();
    $('#editSOProductSelect').select2();
}

// Function to populate dropdowns after fetching data
function populateDropdowns() {
    populateProductDropdown(cachedProductList);
    populateMaterialDropdown(cachedMaterials);
}

// Function to populate product dropdowns
function populateProductDropdown(products) {
    if (products) {
        updateDropdownOptions('productSelect', products, 'value');
        updateDropdownOptions('productSelectUpdate', products, 'value'); // Populate for Update Material section
        updateDropdownOptions('removeProductSelect', products, 'value'); // Populate for Remove Product section
        updateDropdownOptions('editProductSelect', products, 'value'); // Populate for Edit Product section
        updateDropdownOptions('SOProductSelect', products, 'value'); // Populate for Order Product section
        updateDropdownOptions('editSOProductSelect', products, 'value'); // Populate for Edit Sales Order section
    }
}

// Function to populate material dropdowns
function populateMaterialDropdown(materials) {
    if (materials) {
        updateDropdownOptions('thresholdMaterialName', materials);
        updateDropdownOptions('updateSelect', materials); // Populate for Update Material section
        updateDropdownOptions('historyMaterialSelect', materials); // Populate for History section
        updateDropdownOptions('createProductMaterialSelect', materials); // Populate for create product section
        updateDropdownOptions('editProductMaterialSelect', materials); // Populate for Edit Product section
        populateMaterialList(); // Populate the material list tab
        updateDropdownOptions('batchInfoMaterialSelect', materials); // Populate for Batch Info section
        updateDropdownOptions('pendingMaterialSelect', materials); // Populate for Pending Material section
    }
}

// Function to update dropdown options
function updateDropdownOptions(dropdownId, items, KeyOrValue='key') {
    const selectElement = document.getElementById(dropdownId);
    selectElement.innerHTML = ''; // Clear previous options

    // Sort the items by key
    const sortedKeys = Object.keys(items).sort();

    if (KeyOrValue == 'key'){
        sortedKeys.forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            selectElement.appendChild(option);
        });
    }
    else{
        // Sort the items by value
        const sortedEntries = Object.entries(items).sort((a, b) => {
            return a[1].localeCompare(b[1]);
        });

        sortedEntries.forEach(([key, value]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = value;
            selectElement.appendChild(option);
        });
    }

    // Re-initialize Select2 to reflect the new options
    $(`#${dropdownId}`).select2({
        placeholder: `Select an option`,
        allowClear: false
    });
}

async function populateBatchDropdown() {
    const item = document.getElementById('updateSelect').value;
    const batchSelect = document.getElementById('batchSelect');

    // Clear the existing options
    batchSelect.innerHTML = '<option value="default">Default (FIFO)</option>';

    // Check if the history is in the cache
    let history = cachedMaterialHistory[item];
    if (!history) {
        // If not in cache, fetch from the database
        history = await fetchMaterialHistoryFromDB(item);
        if (!history) {
            console.error(`No history found for ${item}.`);
            return;
        }
        // Cache the fetched history
        cachedMaterialHistory[item] = history;
    }

    // Store the batch entries in an array for sorting
    let batchEntries = [];

    Object.entries(history).forEach(([key, entry]) => {
        const batchNo = entry.batchNo;
        const expiryDate = entry.expiryDate.split('T')[0]; // Extract the date part

        // Only add unique batch numbers
        if (!batchEntries.some(entry => entry.batchNo === batchNo)) {
            batchEntries.push({ batchNo, expiryDate });
        }
    });

    // Sort the batches by batch number
    batchEntries.sort((a, b) => a.batchNo.localeCompare(b.batchNo));

    // Populate the dropdown with sorted batch numbers and expiry dates
    batchEntries.forEach(entry => {
        const option = document.createElement('option');
        option.value = entry.batchNo;
        option.textContent = `${entry.batchNo} (Expiry: ${entry.expiryDate})`;
        batchSelect.appendChild(option);
    });
}

async function populateBatchDropdownForProductMaterials(materialId) {
    const batchSelect = document.getElementById(`batchSelect_${materialId}`);

    // Clear the existing options
    batchSelect.innerHTML = '<option value="default">Default (FIFO)</option>';

    // Check if the history is in the cache
    let history = cachedMaterialHistory[materialId];
    if (!history) {
        // If not in cache, fetch from the database
        history = await fetchMaterialHistoryFromDB(materialId);
        if (!history) {
            console.error(`No history found for ${materialId}.`);
            return;
        }
        // Cache the fetched history
        cachedMaterialHistory[materialId] = history;
    }

    // Store the batch entries in an array for sorting
    let batchEntries = [];

    Object.entries(history).forEach(([key, entry]) => {
        const batchNo = entry.batchNo;
        const expiryDate = entry.expiryDate.split('T')[0]; // Extract the date part

        // Only add unique batch numbers
        if (!batchEntries.some(e => e.batchNo === batchNo)) {
            batchEntries.push({ batchNo, expiryDate });
        }
    });

    // Sort the batches by batch number
    batchEntries.sort((a, b) => a.batchNo.localeCompare(b.batchNo));

    // Populate the dropdown with sorted batch numbers and expiry dates
    batchEntries.forEach(entry => {
        const option = document.createElement('option');
        option.value = entry.batchNo;
        option.textContent = `${entry.batchNo} (Expiry: ${entry.expiryDate})`;
        batchSelect.appendChild(option);
    });
}