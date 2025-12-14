// Function to handle edit sales order form submission
function handleEditSalesOrderFormSubmission() {
    document.getElementById('editSalesOrderForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const salesOrderId = document.getElementById('editSalesOrderSelect').value;
        const newSalesOrderId = document.getElementById('newSalesOrderId').value.trim();
        const selectedProducts = Array.from(document.getElementById('editSOProductSelect').selectedOptions).map(option => option.value);
        const salesOrderQuantities = document.getElementById('editSalesOrderQuantities').value.split(',').map(q => parseFloat(q.trim()));
        const expectedDeliveryDate = document.getElementById('editExpectedDeliveryDate').value;

        // Validate form inputs
        if (!salesOrderId) {
            showUpdateMessage('updateMessage13', 'Please select a sales order to edit.', true);
            return;
        }

        if (!newSalesOrderId) {
            showUpdateMessage('updateMessage13', 'Sales Order ID cannot be empty.', true);
            return;
        }

        if (selectedProducts.length === 0 || salesOrderQuantities.length !== selectedProducts.length || salesOrderQuantities.some(isNaN) || salesOrderQuantities.some(q => q <= 0)) {
            showUpdateMessage('updateMessage13', 'Please fill out all fields with valid values. Ensure the quantities match the number of selected products.', true);
            return;
        }

        // Confirmation prompt before updating sales order
        const confirmMsg = newSalesOrderId !== salesOrderId
            ? `Are you sure you want to update Sales Order ID ${salesOrderId} and rename it to ${newSalesOrderId}?`
            : `Are you sure you want to update Sales Order ID ${salesOrderId}?`;

        confirmAction(confirmMsg, () => {
            updateSalesOrderInDB(salesOrderId, newSalesOrderId, selectedProducts, salesOrderQuantities, expectedDeliveryDate);
        });
    });
}

// Function to update the sales order in the Firestore database
function updateSalesOrderInDB(originalOrderId, newOrderId, selectedProducts, salesOrderQuantities, expectedDeliveryDate) {
    const salesOrderDocRef = db.collection('salesOrder').doc('salesOrder');

    db.runTransaction(async (transaction) => {
        const doc = await transaction.get(salesOrderDocRef);
        let salesOrders = doc.exists ? doc.data() : {};

        if (!salesOrders[originalOrderId]) {
            throw new Error(`Sales Order ID ${originalOrderId} does not exist.`);
        }

        // Check if new ID already exists (when changing ID)
        if (newOrderId !== originalOrderId && salesOrders[newOrderId]) {
            throw new Error(`Sales Order ID ${newOrderId} already exists.`);
        }

        // Get the original order data
        const originalOrder = salesOrders[originalOrderId];

        // Create updated order entry
        const updatedOrder = {
            ...originalOrder,
            salesOrderId: newOrderId,
            products: selectedProducts.map((product, index) => ({
                product: product,
                quantity: salesOrderQuantities[index]
            })),
            expectedDeliveryDate: expectedDeliveryDate
        };

        // If ID changed, delete old entry and create new one
        if (newOrderId !== originalOrderId) {
            delete salesOrders[originalOrderId];
        }
        salesOrders[newOrderId] = updatedOrder;

        transaction.set(salesOrderDocRef, salesOrders);
    }).then(() => {
        const successMsg = newOrderId !== originalOrderId
            ? `Successfully updated and renamed sales order from ${originalOrderId} to ${newOrderId}.`
            : `Successfully updated sales order: ${newOrderId}.`;
        console.log(successMsg);
        showUpdateMessage('updateMessage13', successMsg);
        initializeSalesOrderCacheAndDropdowns();
        clearEditSalesOrderForm();
        document.getElementById('newSalesOrderId').value = '';
    }).catch((error) => {
        console.error(`Transaction failed: ${error}`);
        showUpdateMessage('updateMessage13', error.message, true);
    });
}

// Function to populate the edit sales order dropdown
function populateEditSalesOrderDropdown() {
    const salesOrderSelect = document.getElementById('editSalesOrderSelect');
    salesOrderSelect.innerHTML = '';

    // Add a default empty option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select Sales Order --';
    salesOrderSelect.appendChild(defaultOption);

    // Get the keys (order IDs), sort them, and populate the dropdown
    const sortedOrderIDs = Object.keys(cachedSalesOrders).sort();

    sortedOrderIDs.forEach(orderID => {
        const option = document.createElement('option');
        option.value = orderID;
        option.textContent = orderID;
        salesOrderSelect.appendChild(option);
    });

    // Re-initialize Select2 to reflect the new options
    $('#editSalesOrderSelect').trigger('change');
}

// Function to load sales order details when a sales order is selected
function loadSalesOrderDetails() {
    const salesOrderId = document.getElementById('editSalesOrderSelect').value;
    
    if (!salesOrderId || !cachedSalesOrders[salesOrderId]) {
        // Clear the form if no valid order is selected
        clearEditSalesOrderForm();
        return;
    }

    const order = cachedSalesOrders[salesOrderId];

    // Populate the new sales order ID field with the current ID
    document.getElementById('newSalesOrderId').value = salesOrderId;

    // Populate the product select with the order's products
    const productSelect = $('#editSOProductSelect');
    const selectedProducts = order.products.map(p => p.product);
    productSelect.val(selectedProducts).trigger('change');

    // Populate the quantities
    const quantities = order.products.map(p => p.quantity).join(', ');
    document.getElementById('editSalesOrderQuantities').value = quantities;

    // Populate the expected delivery date
    if (order.expectedDeliveryDate) {
        // Handle both ISO string and date-only formats
        const dateValue = order.expectedDeliveryDate.split('T')[0];
        document.getElementById('editExpectedDeliveryDate').value = dateValue;
    } else {
        document.getElementById('editExpectedDeliveryDate').value = '';
    }
}

// Function to clear the edit sales order form
function clearEditSalesOrderForm() {
    document.getElementById('newSalesOrderId').value = '';
    $('#editSOProductSelect').val([]).trigger('change');
    document.getElementById('editSalesOrderQuantities').value = '';
    document.getElementById('editExpectedDeliveryDate').value = '';
}

// Initialize edit sales order dropdown change listener (using jQuery for Select2 compatibility)
function initializeEditSalesOrderListener() {
    $('#editSalesOrderSelect').on('change', loadSalesOrderDetails);
}
