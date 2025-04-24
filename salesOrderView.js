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
    const resultDiv = document.getElementById('result'); // Result container
    const container = document.getElementById('productInputsContainer'); // Scrollable container for inputs

    resultDiv.innerHTML = ''; // Clear previous results
    container.innerHTML = ''; // Clear previous inputs
    productSelect.empty(); // Clear previous dropdown options using jQuery

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

    // Fetch buffers and days from the database if they are not already cached
    if (Object.keys(cachedBuffers).length === 0) {
        await fetchBuffersFromDB();
    }

    if (Object.keys(cachedDays).length === 0) {
        await fetchDaysFromDB();
    }

    const uniqueProducts = Object.keys(productQuantitiesMap);

    // Update the dropdown with all unique products
    uniqueProducts.forEach(product => {
        productSelect.append($('<option>', { value: product, text: product }));
    });

    // Select all unique products in the dropdown
    productSelect.val(uniqueProducts).trigger('change'); // Use Select2's `.val()` method and trigger 'change'

    // Update existing rows or create new ones for each unique product
    uniqueProducts.forEach(product => {
        const totalQuantity = productQuantitiesMap[product];
        const buffer = cachedBuffers[product] || 0;
        const days = cachedDays[product] || 1;

        // Check if the row for this product already exists
        let productRow = document.getElementById(`product-row-${product}`);

        if (productRow) {
            // If the row exists, update the input values
            document.getElementById(`quantity-${product}`).value = totalQuantity;
            document.getElementById(`days-${product}`).value = days;
            document.getElementById(`buffer-${product}`).value = buffer;
        }
    });
}

async function deleteSalesOrder(orderId) {
    if (!orderId) {
        showUpdateMessage('updateMessage10', 'No order selected for deletion.', true);
        return;
    }

    const salesOrderDocRef = db.collection('salesOrder').doc('salesOrder');

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(salesOrderDocRef);
            if (!doc.exists) {
                throw new Error('Sales orders document does not exist.');
            }

            const salesOrders = doc.data();

            if (!salesOrders[orderId]) {
                throw new Error(`Sales Order ${orderId} does not exist.`);
            }

            delete salesOrders[orderId];

            transaction.set(salesOrderDocRef, salesOrders);
        });

        delete cachedSalesOrders[orderId]; // Reflect change in local cache
        showUpdateMessage('updateMessage10', `Sales Order ${orderId} successfully deleted.`);
        initializeSalesOrderCacheAndDropdowns(); // Refresh UI/cache
    } catch (error) {
        console.error("Error deleting sales order: ", error);
        showUpdateMessage('updateMessage10', `Error deleting sales order: ${error.message}`, true);
    }
}