async function populatePendingOrders() {
    const tableBody = document.getElementById('pendingOrdersTable').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Clear the table

    if (Object.keys(cachedOrders).length === 0) {
        await fetchOrdersFromDB();
    }

    // Clear previous options in the dropdown
    const materialSelect = document.getElementById('orderMaterialSelect');
    materialSelect.innerHTML = '';

    // Get the keys (order IDs), sort them, and then populate the table and dropdown
    const sortedOrderIDs = Object.keys(cachedOrders).sort();

    sortedOrderIDs.forEach(orderID => {
        const order = cachedOrders[orderID];

        const row = tableBody.insertRow();

        row.insertCell(0).textContent = orderID;
        row.insertCell(1).textContent = order.prNumber || 'N/A';
        row.insertCell(2).textContent = formatDateTime(order.orderDate);
        row.insertCell(3).textContent = order.materialKey;
        row.insertCell(4).textContent = order.orderedQuantity;
        row.insertCell(5).textContent = order.expectedArrivalDate ? formatDateTime(order.expectedArrivalDate, false) : 'N/A';
        row.insertCell(6).textContent = order.status || 'N/A';

        const option = document.createElement('option');
        option.value = orderID;
        option.textContent = orderID;
        materialSelect.appendChild(option);
    });

    populateDefaultQuantity(); // Populate the quantity field with the ordered quantity
}

function populateDefaultQuantity(){
    // Add event listener for when an order is selected
    const selectedOrderId = $('#orderMaterialSelect').val();

    if (selectedOrderId) {
        const order = cachedOrders[selectedOrderId];
        const status = order.status;

        if (status === 'Pending'){
            // Populate the quantity field with the ordered quantity
            $('#orderReceivedQuantity').val(order.orderedQuantity);
        }
        else if (status.includes('Partial Received:')){
            const partialReceivedAmount = status.split(' ')[2];
            $('#orderReceivedQuantity').val(order.orderedQuantity - parseFloat(partialReceivedAmount));
        }
    }
}

// Function to handle processing the selected order
function handleMoveToInventoryFormSubmission() {
    document.getElementById('moveToInventoryForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        const orderId = document.getElementById('orderMaterialSelect').value;
        const batchNumber = document.getElementById('orderBatchNumber').value.trim();
        const expiryDate = document.getElementById('orderExpiryDate').value;
        const receivedQuantity = parseFloat(document.getElementById('orderReceivedQuantity').value);

        if (!orderId) {
            showUpdateMessage('updateMessage7', 'Please select a valid order.', true);
            return;
        }

        // Check which button was clicked
        const clickedButton = e.submitter.id;

        if (clickedButton === 'moveOrderToInventoryButton') {
            if (!batchNumber || !expiryDate || receivedQuantity <= 0 || !receivedQuantity) {
                showUpdateMessage('updateMessage7', 'Please enter a valid batch number, quantity and expiry date.', true);
                return;
            }

            const order = cachedOrders[orderId];
            const materialKey = order.materialKey;

            confirmAction(`Are you sure you want to move order ${orderId} to inventory?`, () => addOrderMaterial(materialKey, receivedQuantity, batchNumber, expiryDate, orderId));
        } else if (clickedButton === 'deleteOrderButton') {
            confirmAction(`Are you sure you want to delete order ${orderId}? This action cannot be undone.`, () => deleteOrder(orderId));
        }
    });
}

async function addOrderMaterial(item, receivedQuantity, batchNumber, expiryDate, orderId) {

    if (!batchNumber || !expiryDate || receivedQuantity <= 0 || !receivedQuantity) {
        showUpdateMessage('updateMessage7', 'Please enter a valid batch number, quantity and expiry date.', true);
        return;
    }

    const order = cachedOrders[orderId];
    const orderedQuantity = order.orderedQuantity;
    const status = order.status;

    // Check if the received quantity is less than, equal to, or greater than the ordered quantity
    if (status === 'Pending'){
        if (receivedQuantity < orderedQuantity) {
            console.log(`Received quantity (${receivedQuantity}) is less than ordered quantity (${orderedQuantity}). Adjusting order...`);
            await updateOrderAndAddToInventory(item, receivedQuantity, batchNumber, expiryDate, orderId, false);
        } else if (receivedQuantity === orderedQuantity) {
            console.log(`Received quantity (${receivedQuantity}) matches ordered quantity. Moving to inventory and deleting order...`);
            await updateOrderAndAddToInventory(item, receivedQuantity, batchNumber, expiryDate, orderId, true);
        } else {
            console.log(`Received quantity (${receivedQuantity}) is greater than ordered quantity (${orderedQuantity}). Moving to inventory and deleting order...`);
            await updateOrderAndAddToInventory(item, receivedQuantity, batchNumber, expiryDate, orderId, true);
        }
    }
    else if (status.includes('Partial Received:')){
        const partialReceivedAmount = status.split(' ')[2];
        const totalReceivedAmount = parseFloat(partialReceivedAmount) + receivedQuantity;

        if (totalReceivedAmount < orderedQuantity) {
            console.log(`Received quantity (${totalReceivedAmount}) is less than ordered quantity (${orderedQuantity}). Adjusting order...`);
            await updateOrderAndAddToInventory(item, receivedQuantity, batchNumber, expiryDate, orderId, false);
        } else if (totalReceivedAmount === orderedQuantity) {
            console.log(`Received quantity (${totalReceivedAmount}) matches ordered quantity. Moving to inventory and deleting order...`);
            await updateOrderAndAddToInventory(item, receivedQuantity, batchNumber, expiryDate, orderId, true);
        } else {
            console.log(`Received quantity (${totalReceivedAmount}) is greater than ordered quantity (${orderedQuantity}). Moving to inventory and deleting order...`);
            await updateOrderAndAddToInventory(item, receivedQuantity, batchNumber, expiryDate, orderId, true);
        }
    }
    
}

async function updateOrderAndAddToInventory(item, receivedQuantity, batchNumber, expiryDate, orderId, deleteOrderAfter) {
    const datetime = new Date().toISOString();

    console.log(`Adding ${receivedQuantity} of ${item} (Batch: ${batchNumber}, Expiry: ${expiryDate}) to the database...`);

    const materialRef = db.collection('materials').doc('materials');
    const historyRef = db.collection('history').doc(item);
    const ordersRef = db.collection('orders').doc('orders');

    let history = cachedMaterialHistory[item];
    if (!history) {
        history = await fetchMaterialHistoryFromDB(item);
        if (!history) {
            showUpdateMessage('updateMessage7', `No history found for ${item}.`, true);
            return;
        }
    }

    try {
        await db.runTransaction(async (transaction) => {
            const materialDoc = await transaction.get(materialRef);
            const ordersDoc = await transaction.get(ordersRef);

            const materials = materialDoc.exists ? materialDoc.data() : {};
            const orders = ordersDoc.exists ? ordersDoc.data() : {};

            const currentQuantity = materials[item] || 0;

            // Update materials quantity
            const newQuantity = currentQuantity + receivedQuantity;
            transaction.set(materialRef, {
                [item]: newQuantity
            }, { merge: true });

            // Add new history record
            transaction.set(historyRef, {
                [datetime]: {
                    datetime,
                    in: receivedQuantity,
                    out: 0,
                    balance: newQuantity,
                    batchNo: batchNumber,
                    expiryDate: expiryDate
                }
            }, { merge: true });

            // Update order
            if (orders[orderId]) {
                if (!deleteOrderAfter) {
                    let status = orders[orderId].status;
                    if (status === 'Pending') {
                        orders[orderId].status = `Partial Received: ${receivedQuantity}`;
                    } else {
                        const partialReceivedAmount = parseFloat(status.split(' ')[2]);
                        orders[orderId].status = `Partial Received: ${partialReceivedAmount + receivedQuantity}`;
                    }
                } else {
                    delete orders[orderId];
                }
                transaction.set(ordersRef, orders);
            }
        });

        console.log(`Successfully added ${receivedQuantity} of ${item}.`);
        initializeMaterialCacheAndDropdowns();
        await fetchMaterialHistoryFromDB(item); // Refresh cache
        initializeOrderCacheAndDropdowns();

        showUpdateMessage('updateMessage7', `Successfully added ${receivedQuantity} of ${item} (Batch: ${batchNumber}, Expiry: ${expiryDate}).`);
    } catch (error) {
        console.error("Error in transaction: ", error);
        showUpdateMessage('updateMessage7', `Error adding ${item}: ${error.message}`, true);
    }
}


async function deleteOrder(orderId) {
    if (!orderId) {
        showUpdateMessage('updateMessage7', 'No order selected for deletion.', true);
        return;
    }

    try {
        await db.runTransaction(async (transaction) => {
            const ordersRef = db.collection('orders').doc('orders');
            const ordersDoc = await transaction.get(ordersRef);

            if (!ordersDoc.exists) {
                throw new Error('Orders document does not exist.');
            }

            const orders = ordersDoc.data();

            if (!orders[orderId]) {
                throw new Error(`Order ${orderId} not found.`);
            }

            // Remove the specified order
            delete orders[orderId];

            // Commit the updated orders
            transaction.set(ordersRef, orders);
        });

        // Also update the local cache and UI
        delete cachedOrders[orderId];
        initializeOrderCacheAndDropdowns();

        showUpdateMessage('updateMessage7', `Order ${orderId} successfully deleted.`);
    } catch (error) {
        console.error("Error deleting order: ", error);
        showUpdateMessage('updateMessage7', `Error deleting order: ${error.message}`, true);
    }
}