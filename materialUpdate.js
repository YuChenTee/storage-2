function handleUpdateMaterialFormSubmission() {
    document.getElementById('updateMaterialForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const updateType = document.getElementById('updateType').value;
        const quantity = parseFloat(document.getElementById('materialQuantity').value);
        const batchNumber = document.getElementById('batchNumber').value;
        const expiryDate = document.getElementById('expiryDate').value;

        const selectedItem = document.getElementById('updateSelect').value;
        const action = e.submitter.id;

        if (action === 'addMaterialBtn') {
            confirmAction(`Are you sure you want to add ${quantity} of ${selectedItem}?`, () => addMaterial(selectedItem, quantity, batchNumber, expiryDate));

        } else if (action === 'deductMaterialBtn') {

            if (updateType === 'product') {
                const productId = document.getElementById('productSelectUpdate').value;
                showDeductPopup(productId, quantity);
                // confirmAction(`Are you sure you want to deduct materials for ${quantity} unit(s) of ${productId}?`, () => processProductUpdate(productId, quantity));
            }

            else if (updateType === 'material') {
                confirmAction(`Are you sure you want to deduct ${quantity} of ${selectedItem}?`, () => deductMaterial(selectedItem, quantity));
            }

        } else if (action === 'deleteMaterialBtn') {
            confirmAction(`Are you sure you want to delete ${selectedItem}? <span style="color: red; font-weight: bold">This action cannot be undone.</span>`, () => deleteMaterial(selectedItem));
        }

    });
}

function toggleUpdateType() {
    const updateTitle = document.getElementById('updateMaterialTitle');
    const updateType = document.getElementById('updateType').value;
    const materialUpdateSection = document.getElementById('materialUpdateSection');
    const productUpdateSection = document.getElementById('productUpdateSection');
    const quantitySelection = document.getElementById("quantitySelection");
    const bufferSection = document.getElementById('bufferSection');
    const batchSelectSection = document.getElementById('batchSelectSection');
    const daysInputSection = document.getElementById('daysInputSection');

    if (updateType === 'material') {
        updateTitle.textContent = 'Deduct Material';
        materialUpdateSection.style.display = 'block';
        productUpdateSection.style.display = 'none';
        quantitySelection.textContent = 'Quantity:';
        bufferSection.style.display = 'none';
        batchSelectSection.style.display = 'block';
        daysInputSection.style.display = 'none';

    } else if (updateType === 'product') {
        updateTitle.textContent = 'Deduct Product Materials'
        materialUpdateSection.style.display = 'none';
        productUpdateSection.style.display = 'block';
        quantitySelection.textContent = 'Quantity (Unit):';
        bufferSection.style.display = 'block';
        batchSelectSection.style.display = 'none';
        batchSelectSection.value = 'default'; // Reset the batch selection to default
        daysInputSection.style.display = 'block';
    }
}

function toggleOperationType(operationType) {
    const updateTitle = document.getElementById('updateMaterialTitle');
    const quantitySection = document.getElementById('quantitySection');
    const batchInfoSection = document.getElementById('batchInfoSection');
    const bufferSection = document.getElementById('bufferSection');
    const addMaterialBtn = document.getElementById('addMaterialBtn');
    const deductMaterialBtn = document.getElementById('deductMaterialBtn');
    const deleteMaterialBtn = document.getElementById('deleteMaterialBtn');
    const updateTypeSection = document.getElementById('updateTypeSection');
    const materialUpdateSection = document.getElementById('materialUpdateSection');
    const productUpdateSection = document.getElementById('productUpdateSection');
    const batchSelectSection = document.getElementById('batchSelectSection');
    const daysInputSection = document.getElementById('daysInputSection');
    
    // Hide all buttons initially
    addMaterialBtn.style.display = 'none';
    deductMaterialBtn.style.display = 'none';
    deleteMaterialBtn.style.display = 'none';

    if (operationType === 'add') {
        materialUpdateSection.style.display = 'block';
        productUpdateSection.style.display = 'none';
        updateTitle.textContent = 'Add Material';
        updateTypeSection.style.display = 'none';
        quantitySection.style.display = 'block';
        batchInfoSection.style.display = 'block';
        batchSelectSection.style.display = 'none';
        bufferSection.style.display = 'none';
        addMaterialBtn.style.display = 'block';
        daysInputSection.style.display = 'none';
    } else if (operationType === 'deduct') {
        updateTypeSection.style.display = 'block';
        quantitySection.style.display = 'block';
        batchInfoSection.style.display = 'none';
        batchSelectSection.style.display = 'block';
        deductMaterialBtn.style.display = 'block';
        toggleUpdateType();
    } else if (operationType === 'delete') {
        materialUpdateSection.style.display = 'block';
        productUpdateSection.style.display = 'none';
        updateTitle.textContent = 'Delete Material';
        batchSelectSection.style.display = 'none';
        updateTypeSection.style.display = 'none';
        quantitySection.style.display = 'none';
        batchInfoSection.style.display = 'none';
        bufferSection.style.display = 'none';
        deleteMaterialBtn.style.display = 'block';
        daysInputSection.style.display = 'none';
    }
}

async function addMaterial(item, quantity, batchNumber, expiryDate) {
    const datetime = new Date().toISOString();

    if (!batchNumber || !expiryDate || quantity <= 0 || !quantity) {
        showUpdateMessage('updateMessage', 'Please enter a valid batch number, quantity and expiry date.', true);
        return;
    }

    console.log(`Adding ${quantity} of ${item} (Batch: ${batchNumber}, Expiry: ${expiryDate}) to the database...`);

    // Check the cache first
    let history = cachedMaterialHistory[item];
    if (!history) {
        // If not in cache, fetch from database
        history = await fetchMaterialHistoryFromDB(item);
        if (!history) {
            showUpdateMessage('updateMessage', `No history found for ${item}.`, true);
            return;
        }
    }

    // Firestore references
    const materialRef = db.collection('materials').doc('materials');
    const historyRef = db.collection('history').doc(item);

    materialRef.get().then((doc) => {
        const currentQuantity = doc.exists && doc.data()[item] ? doc.data()[item] : 0;

        const batch = db.batch();

        // Use set() with merge: true to update quantity
        batch.set(materialRef, {
            [item]: firebase.firestore.FieldValue.increment(quantity)
        }, { merge: true });

        // Add history entry
        batch.set(historyRef, {
            [datetime]: {
                datetime: datetime,
                in: quantity,
                out: 0,
                balance: currentQuantity + quantity,
                batchNo: batchNumber,
                expiryDate: expiryDate
            }
        }, { merge: true });

        batch.commit().then(async () => {
            console.log(`Successfully added ${quantity} of ${item}.`);
            initializeMaterialCacheAndDropdowns();
            await fetchMaterialHistoryFromDB(item); // Update the cache after adding
            showUpdateMessage('updateMessage', `Successfully added ${quantity} of ${item} (Batch: ${batchNumber}, Expiry: ${expiryDate}).`);
        }).catch((error) => {
            console.error("Error adding item: ", error);
            showUpdateMessage('updateMessage', `Error adding ${item}: ${error.message}`, true);
        });
    }).catch((error) => {
        console.error("Error fetching material quantity: ", error);
        showUpdateMessage('updateMessage', `Error fetching material quantity: ${error.message}`, true);
    });
}

async function deductMaterial(item, quantity, productOrMaterial='material') {
    if (quantity <= 0 || !quantity) {
        showUpdateMessage('updateMessage', 'Please enter a valid quantity.', true);
        return;
    }

    console.log(`Attempting to deduct ${quantity} of ${item} from the database...`);

    let history = cachedMaterialHistory[item] || await fetchMaterialHistoryFromDB(item);
    if (!history) {
        showUpdateMessage('updateMessage', `No history found for ${item}.`, true);
        return;
    }

    let remainingQuantity = quantity;
    let deductions = [];
    let latestBalance = 0;
    let batchBalances = {};
    let historyUpdates = {};

    Object.entries(history).forEach(([key, entry]) => {
        const batchNo = entry.batchNo;
        batchBalances[batchNo] = (batchBalances[batchNo] || 0) + (entry.in - entry.out);
        latestBalance += entry.in - entry.out;
    });

    if (latestBalance < quantity) {
        showUpdateMessage('updateMessage', `Insufficient total quantity of ${item}.`, true);
        return;
    }

    let selectedBatch = productOrMaterial === 'product' 
        ? document.getElementById(`batchSelect_${item}`).value 
        : document.getElementById('batchSelect').value;

    let batches = selectedBatch === 'default'
        ? Object.entries(history).sort((a, b) => new Date(a[1].expiryDate) - new Date(b[1].expiryDate))
        : Object.entries(history).filter(([key, entry]) => entry.batchNo === selectedBatch);

    const dbBatch = db.batch();
    const materialRef = db.collection('materials').doc('materials');

    dbBatch.set(materialRef, {
        [item]: firebase.firestore.FieldValue.increment(-quantity)
    }, { merge: true });

    for (let [key, batchData] of batches) {
        if (remainingQuantity <= 0) break;
        const batchNo = batchData.batchNo;
        const availableBalance = batchBalances[batchNo];

        if (availableBalance > 0) {
            const deductAmount = Math.min(availableBalance, remainingQuantity);
            deductions.push(`Deducted ${deductAmount} of ${item} from Batch: ${batchNo} (Expiry: ${batchData.expiryDate})`);
            remainingQuantity -= deductAmount;
            batchBalances[batchNo] -= deductAmount;
            latestBalance -= deductAmount;

            historyUpdates[new Date().toISOString() + `-${key}`] = {
                datetime: new Date().toISOString(),
                in: 0,
                out: deductAmount,
                batchNo: batchNo,
                expiryDate: batchData.expiryDate,
                balance: latestBalance
            };
        }
    }

    if (remainingQuantity > 0) {
        showUpdateMessage('updateMessage', `Insufficient quantity of ${item}. Could only deduct ${quantity - remainingQuantity} out of ${quantity}.`, true);
        return;
    }

    dbBatch.set(db.collection('history').doc(item), historyUpdates, { merge: true });

    dbBatch.commit().then(async () => {
        console.log(`Successfully deducted ${quantity} of ${item}.`);
        initializeMaterialCacheAndDropdowns();
        await fetchMaterialHistoryFromDB(item);
        showUpdateMessage('updateMessage', deductions.join('\n'));
    }).catch((error) => {
        console.error("Error committing batch: ", error);
        showUpdateMessage('updateMessage', `Error deducting ${item}: ${error.message}`, true);
    });
}


function deleteMaterial(item) {
    console.log(`Deleting ${item} from the database...`);
    const batch = db.batch();
    const materialRef = db.collection('materials').doc('materials');

    // Use set() with merge: true to remove the field instead of update()
    batch.set(materialRef, {
        [item]: firebase.firestore.FieldValue.delete()
    }, { merge: true });

    // Delete the material's history document
    const historyRef = db.collection('history').doc(item);
    batch.delete(historyRef);

    batch.commit().then(() => {
        console.log(`Successfully deleted ${item}.`);
        initializeMaterialCacheAndDropdowns(); // Refresh material dropdown
        delete cachedMaterialHistory[item]; // Remove the cache entry properly
        showUpdateMessage('updateMessage', `Successfully deleted ${item}.`);
    }).catch((error) => {
        console.error("Error deleting item: ", error);
        showUpdateMessage('updateMessage', `Error deleting ${item}: ${error.message}`, true);
    });
}