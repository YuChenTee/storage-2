// Function to handle form submission
function handleSalesOrderFormSubmission() {
    document.getElementById('processSalesOrderForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        const salesOrderSelect = document.getElementById('salesOrderSelect');
        const selectedOrderId = salesOrderSelect.value;

        if (selectedOrderId) {
            confirmAction(`Are you sure you want to delete Sales Order ID ${selectedOrderId}?`, () => deleteSalesOrder(selectedOrderId));
        } else {
            showUpdateMessage('updateMessage10', 'Please select a sales order to delete.', true);
        }
    });
}


async function populateSalesOrders(){
    const tableBody = document.getElementById('pendingSalesOrdersTable').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Clear the table

    if (Object.keys(cachedSalesOrders).length === 0) {
        await fetchSalesOrdersFromDB();
    }

    // Clear previous options in the dropdown
    const materialSelect = document.getElementById('salesOrderSelect');
    materialSelect.innerHTML = '';

    // Get the keys (order IDs), sort them, and then populate the table and dropdown
    const sortedOrderIDs = Object.keys(cachedSalesOrders).sort();

    sortedOrderIDs.forEach(orderID => {
        const order = cachedSalesOrders[orderID];

        const row = tableBody.insertRow();

        row.insertCell(0).textContent = orderID;
        row.insertCell(1).textContent = formatDateTime(order.orderDate);

        // Handle multiple products in each order
        const productCell = row.insertCell(2);
        const quantityCell = row.insertCell(3);

        order.products.forEach((productEntry) => {
            productCell.innerHTML += `${cachedProductList[productEntry.product]} <br>`; // Display product names
            quantityCell.innerHTML += `${productEntry.quantity} <br>`; // Display quantities
        });

        row.insertCell(4).textContent = order.expectedDeliveryDate ? formatDateTime(order.expectedDeliveryDate, false) : 'N/A';
        row.insertCell(5).textContent = order.status || 'N/A';

        const option = document.createElement('option');
        option.value = orderID;
        option.textContent = orderID;
        materialSelect.appendChild(option);
    });

}

function calculateAllSalesOrder() {
    if (Object.keys(cachedSalesOrders).length === 0) {
        initializeSalesOrderCacheAndDropdowns();
    }    
    
    let products = [];
    let quantities = [];

    const salesOrders = cachedSalesOrders;

    // Loop through all orders and collect products and quantities
    for (const orderID in salesOrders) {
        const order = salesOrders[orderID];
        // Concatenate products and quantities from each order
        order.products.forEach((productEntry) => {
            products = products.concat(productEntry.product);
            quantities = quantities.concat(productEntry.quantity);
        });
    }

    console.log(products);
    console.log(quantities);

    // Populate the productSelect and quantityInput fields in the materialCheck section
    populateMaterialCheckFields(products, quantities);

    // Switch to the materialCheck section
    showSection('materialCheck', this);
}

// Function to populate the fields in the Material Check section
async function populateMaterialCheckFields(products, quantities) {
    const productSelect = $('#productSelect'); // Use jQuery for Select2
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '';

    // Create an array of [product, quantity] pairs
    let productQuantityPairs = products.map((product, index) => [product, quantities[index]]);

    // Sort the productQuantityPairs array based on product name
    productQuantityPairs.sort((a, b) => a[0].localeCompare(b[0]));

    // Sum the quantities for each unique product
    const productQuantitiesMap = {};
    productQuantityPairs.forEach(([product, quantity]) => {
        if (!productQuantitiesMap[product]) {
            productQuantitiesMap[product] = 0;
        }
        productQuantitiesMap[product] += quantity;
    });

    // Get the sorted unique products and their corresponding summed quantities
    const uniqueProducts = Object.keys(productQuantitiesMap);
    const sortedQuantities = uniqueProducts.map(product => productQuantitiesMap[product]);

    // Reset selected options in the productSelect dropdown
    productSelect.val(uniqueProducts).trigger('change'); // Use Select2's `.val()` and trigger 'change' to update

    // Populate the quantity input field with the summed quantities (sorted)
    document.getElementById('quantityInput').value = sortedQuantities.join(', ');

    if (Object.keys(cachedBuffers).length === 0){
        await fetchBuffersFromDB();
    }

    if (Object.keys(cachedDays).length === 0){
        await fetchDaysFromDB();
    }

    // Populate the buffer input field with cached values or 0 if no cached buffer is available
    const bufferValues = uniqueProducts.map(product => cachedBuffers[product] || 0);
    document.getElementById('bufferInput').value = bufferValues.join(', ');

    // Populate the days input field with cached values or 1 if no cached days is available
    const daysValues = uniqueProducts.map(product => cachedDays[product] || 1);
    document.getElementById('daysInput').value = daysValues.join(', ');
}

async function deleteSalesOrder(orderId) {
    if (!orderId) {
        showUpdateMessage('updateMessage10', 'No order selected for deletion.', true);
        return;
    }

    delete cachedSalesOrders[orderId];

    try {
        // Update Firestore
        await db.collection('salesOrder').doc('salesOrder').set(cachedSalesOrders);
        showUpdateMessage('updateMessage10', `Sales Order ${orderId} successfully deleted.`);

        initializeSalesOrderCacheAndDropdowns();
    } catch (error) {
        console.error("Error deleting sales order: ", error);
        showUpdateMessage('updateMessage10', `Error deleting sales order: ${error.message}`, true);
    }
}