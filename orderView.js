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
        row.insertCell(1).textContent = formatDateTime(order.orderDate);
        row.insertCell(2).textContent = order.materialKey;
        row.insertCell(3).textContent = order.orderedQuantity;
        row.insertCell(4).textContent = order.expectedArrivalDate ? formatDateTime(order.expectedArrivalDate, false) : 'N/A';
        row.insertCell(5).textContent = order.status || 'N/A';

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

    // Check the cache first
    let history = cachedMaterialHistory[item];
    if (!history) {
        history = await fetchMaterialHistoryFromDB(item);
        if (!history) {
            showUpdateMessage('updateMessage7', `No history found for ${item}.`, true);
            return;
        }
    }

    const materialRef = db.collection('materials').doc('materials');
    const historyRef = db.collection('history').doc(item);

    materialRef.get().then((doc) => {
        if (doc.exists) {
            const materials = doc.data();
            const currentQuantity = materials[item] || 0;

            const batch = db.batch();

            // Use set() with merge to increment the quantity instead of update()
            batch.set(materialRef, {
                [item]: firebase.firestore.FieldValue.increment(receivedQuantity)
            }, { merge: true });

            batch.set(historyRef, {
                [datetime]: {
                    datetime: datetime,
                    in: receivedQuantity,
                    out: 0,
                    balance: currentQuantity + receivedQuantity,
                    batchNo: batchNumber,
                    expiryDate: expiryDate
                }
            }, { merge: true });

            batch.commit().then(async () => {
                console.log(`Successfully added ${receivedQuantity} of ${item}.`);
                initializeMaterialCacheAndDropdowns();
                await fetchMaterialHistoryFromDB(item); // Update the cache after adding
                showUpdateMessage('updateMessage7', `Successfully added ${receivedQuantity} of ${item} (Batch: ${batchNumber}, Expiry: ${expiryDate}).`);

                if (!deleteOrderAfter) {
                    if (cachedOrders[orderId].status === 'Pending') {
                        cachedOrders[orderId].status = `Partial Received: ${receivedQuantity}`;
                    } else {
                        const partialReceivedAmount = cachedOrders[orderId].status.split(' ')[2];
                        cachedOrders[orderId].status = `Partial Received: ${parseFloat(partialReceivedAmount) + receivedQuantity}`;
                    }
                    // Use set() with merge to update the orders
                    await db.collection('orders').doc('orders').set(cachedOrders, { merge: true });
                }

                if (deleteOrderAfter) {
                    delete cachedOrders[orderId];
                    await db.collection('orders').doc('orders').set(cachedOrders);
                }

                initializeOrderCacheAndDropdowns();
            }).catch((error) => {
                console.error("Error adding item: ", error);
                showUpdateMessage('updateMessage7', `Error adding ${item}: ${error.message}`, true);
            });
        } else {
            console.error("Material document not found.");
            showUpdateMessage('updateMessage7', "Material document not found.", true);
        }
    }).catch((error) => {
        console.error("Error fetching material quantity: ", error);
        showUpdateMessage('updateMessage7', `Error fetching material quantity: ${error.message}`, true);
    });
}


async function deleteOrder(orderId) {
    if (!orderId) {
        showUpdateMessage('updateMessage7', 'No order selected for deletion.', true);
        return;
    }

    // Remove the order from cachedOrders
    delete cachedOrders[orderId];

    try {
        // Update Firestore
        await db.collection('orders').doc('orders').set(cachedOrders);
        showUpdateMessage('updateMessage7', `Order ${orderId} successfully deleted.`);

        // Refresh the orders table and dropdown
        initializeOrderCacheAndDropdowns();
    } catch (error) {
        console.error("Error deleting order: ", error);
        showUpdateMessage('updateMessage7', `Error deleting order: ${error.message}`, true);
    }
}