// Function to handle add pending material form submission
function handleAddPendingMaterialFormSubmission() {
    document.getElementById('addPendingMaterialForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const orderID = document.getElementById('orderID').value;
        const prNumber = document.getElementById('prNumber').value.trim() || null;
        const materialKey = document.getElementById('pendingMaterialSelect').value.trim();
        const orderedQuantity = parseFloat(document.getElementById('orderedQuantity').value);
        const expectedArrivalDate = document.getElementById('expectedArrivalDate').value || null;
        const orderDate = new Date().toISOString(); // Current date and time in ISO format

        if (!orderID || !materialKey || orderedQuantity <= 0) {
            showUpdateMessage('updateMessage6', 'Please select a valid material and enter a valid quantity.', true);
            return;
        }

        if (cachedOrders[orderID]) {
            showUpdateMessage('updateMessage6', `Order with Purchase Order No ${orderID} already exists.`, true);
            return;
        }

        confirmAction(`Are you sure you want to add a pending order for ${materialKey}?`, () => addPendingMaterialToDB(orderID, prNumber, materialKey, orderedQuantity, orderDate, expectedArrivalDate));
    });
}

function addPendingMaterialToDB(orderID, prNumber, materialKey, orderedQuantity, orderDate, expectedArrivalDate) {
    console.log(`Adding pending order for ${materialKey} to the database...`);

    const ordersDocRef = db.collection('orders').doc('orders');

    const orderEntry = {
        orderID: orderID,
        prNumber: prNumber,
        materialKey: materialKey,
        orderedQuantity: orderedQuantity,
        orderDate: orderDate,
        expectedArrivalDate: expectedArrivalDate,
        status: 'Pending'
    };

    db.runTransaction(async (transaction) => {
        const doc = await transaction.get(ordersDocRef);
        const orders = doc.exists ? doc.data() : {};

        if (orders[orderID]) {
            throw new Error(`Order ID ${orderID} already exists.`);
        }

        orders[orderID] = orderEntry;

        transaction.set(ordersDocRef, orders);
    }).then(() => {
        console.log(`Successfully added pending order: ${orderID}`);
        showUpdateMessage('updateMessage6', `Successfully added pending order for material: ${materialKey}.`);

        initializeOrderCacheAndDropdowns(); // Refresh the cached orders and dropdowns

        // You may also want to refresh the pending materials list here
    }).catch((error) => {
        console.error(`Error adding pending order: ${error}`);
        showUpdateMessage('updateMessage6', `Error adding pending order: ${error.message}`, true);
    });
}