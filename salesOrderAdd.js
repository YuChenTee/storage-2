// Function to handle add sales order form submission
function handleAddSalesOrderFormSubmission() {
    document.getElementById('createSalesOrderForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const salesOrderId = document.getElementById('salesOrderId').value.trim();
        const selectedProducts = Array.from(document.getElementById('SOProductSelect').selectedOptions).map(option => option.value);
        const salesOrderQuantities = document.getElementById('salesOrderQuantities').value.split(',').map(q => parseFloat(q.trim()));
        const expectedDeliveryDate = document.getElementById('expectedDeliveryDate').value;
        const orderDate = new Date().toISOString(); // Current date and time in ISO format

        // Validate form inputs
        if (!salesOrderId || selectedProducts.length === 0 || salesOrderQuantities.length !== selectedProducts.length || salesOrderQuantities.some(isNaN) || salesOrderQuantities.some(q => q <= 0)) {
            showUpdateMessage('updateMessage9', 'Please fill out all fields with valid values. Ensure the quantities match the number of selected products.', true);
            return;
        }

        if (cachedSalesOrders[salesOrderId]) {
            showUpdateMessage('updateMessage9', `Sales Order ID ${salesOrderId} already exists.`, true);
            return;
        }

        // Confirmation prompt before adding sales order
        confirmAction(`Are you sure you want to create Sales Order ID ${salesOrderId} with the selected products?`, () => {
            addSalesOrderToDB(salesOrderId, selectedProducts, salesOrderQuantities, expectedDeliveryDate, orderDate);
        });
    });
}

// Function to add the sales order to the Firestore database
function addSalesOrderToDB(salesOrderId, selectedProducts, salesOrderQuantities, expectedDeliveryDate, orderDate) {
    console.log(`Adding sales order ${salesOrderId} with products to the database...`);

    // Create a sales order entry with all selected products and their quantities
    const salesOrderEntry = {
        salesOrderId: salesOrderId,
        products: selectedProducts.map((product, index) => ({
            product: product,
            quantity: salesOrderQuantities[index]
        })),
        orderDate: orderDate,
        expectedDeliveryDate: expectedDeliveryDate,
        status: 'Pending'
    };

    // Fetch the current sales orders from the database
    db.collection('salesOrder').doc('salesOrder').get().then((doc) => {
        let salesOrders = doc.exists ? doc.data() : {};

        // Add the new sales order to the sales orders map
        salesOrders[salesOrderId] = salesOrderEntry;

        // Update the salesOrder document in the database
        db.collection('salesOrder').doc('salesOrder').set(salesOrders).then(() => {
            console.log(`Successfully added sales order: ${salesOrderId}`);
            showUpdateMessage('updateMessage9', `Successfully added sales order: ${salesOrderId}.`);

            initializeSalesOrderCacheAndDropdowns(); // Refresh the cached sales orders and dropdowns

        }).catch((error) => {
            console.error(`Error adding sales order: ${error}`);
            showUpdateMessage('updateMessage9', `Error adding sales order: ${error.message}`, true);
        });
    }).catch((error) => {
        console.error(`Error fetching sales orders: ${error}`);
        showUpdateMessage('updateMessage9', `Error fetching sales orders: ${error.message}`, true);
    });
}
