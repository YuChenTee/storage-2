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

    // Check if the batch number already exists
    // for (const [key, entry] of Object.entries(history)) {
    //     if (entry.batchNo === batchNumber) {
    //         showUpdateMessage('updateMessage', `Batch number ${batchNumber} already exists.`, true);
    //         return;
    //     }
    // }

    // Proceed with adding material
    const materialRef = db.collection('materials').doc('materials');
    const historyRef = db.collection('history').doc(item);

    materialRef.get().then((doc) => {
        if (doc.exists) {
            const materials = doc.data();
            const currentQuantity = materials[item] || 0;

            const batch = db.batch();

            batch.update(materialRef, {
                [item]: firebase.firestore.FieldValue.increment(quantity)
            });

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
        } else {
            console.error("Material document not found.");
            showUpdateMessage('updateMessage', "Material document not found.", true);
        }
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

    let remainingQuantity = quantity;
    let deductions = [];
    let latestBalance = 0;
    let batchBalances = {};
    let historyUpdates = {};

    // Calculate the balance of each batch and overall balance
    Object.entries(history).forEach(([key, entry]) => {
        const batchNo = entry.batchNo;
        if (!batchBalances[batchNo]) {
            batchBalances[batchNo] = 0;
        }
        batchBalances[batchNo] += entry.in - entry.out;
        latestBalance += entry.in - entry.out;
    });

    // Ensure enough balance to deduct
    if (latestBalance < quantity) {
        showUpdateMessage('updateMessage', `Insufficient total quantity of ${item}.`, true);
        return;
    }
    

    // Sort batches by expiry date (FIFO) or by selected batch
    let batches;
    if (productOrMaterial === 'product') {
        const selectedBatch = document.getElementById(`batchSelect_${item}`).value;
        if (selectedBatch === 'default') {
            batches = Object.entries(history).sort((a, b) => new Date(a[1].expiryDate) - new Date(b[1].expiryDate));
        } else {
            batches = Object.entries(history).filter(([key, entry]) => entry.batchNo === selectedBatch);
        }
    }

    else if (productOrMaterial === 'material') {
        // Get the selected batch option from the dropdown
        const selectedBatch = document.getElementById('batchSelect').value;
        if (selectedBatch === 'default') {
            batches = Object.entries(history).sort((a, b) => new Date(a[1].expiryDate) - new Date(b[1].expiryDate));
        } else {
            batches = Object.entries(history).filter(([key, entry]) => entry.batchNo === selectedBatch);
        }
    }
    
    // Create a batch to update the material quantity and history
    const dbBatch = db.batch();
    const materialRef = db.collection('materials').doc('materials');

    // Update material quantity
    dbBatch.update(materialRef, {
        [item]: firebase.firestore.FieldValue.increment(-quantity)
    });

    // Deduct from the selected batch or the oldest batch first
    for (let [key, batchData] of batches) {
        if (remainingQuantity <= 0) break;

        const batchNo = batchData.batchNo;
        const availableBalance = batchBalances[batchNo];

        if (availableBalance > 0) {
            const deductAmount = Math.min(availableBalance, remainingQuantity);
            deductions.push(`Deducted ${deductAmount} of ${item} from Batch: ${batchNo} (Expiry: ${batchData.expiryDate})`);
            remainingQuantity -= deductAmount;
            batchBalances[batchNo] -= deductAmount;

            const newKey = new Date().toISOString() + `-${key}`; // Avoid same datetime value
            const datetime = new Date().toISOString();

            // Add the new history entry to the update list
            historyUpdates[newKey] = {
                datetime: datetime,
                in: 0,
                out: deductAmount,
                batchNo: batchNo,
                expiryDate: batchData.expiryDate,
                balance: latestBalance - deductAmount // Latest balance after deduction
            };

            latestBalance -= deductAmount;
        }
    }

    if (remainingQuantity > 0) {
        showUpdateMessage('updateMessage', `Insufficient quantity of ${item}. Could only deduct ${quantity - remainingQuantity} out of ${quantity}.`, true);
        return;
    }

    // Update the history document with all the new deductions in one go
    dbBatch.set(db.collection('history').doc(item), historyUpdates, { merge: true });

    // Commit the batch update
    dbBatch.commit().then(async () => {
        console.log(`Successfully deducted ${quantity} of ${item}.`);
        initializeMaterialCacheAndDropdowns();
        await fetchMaterialHistoryFromDB(item); // Update the cache after deduction
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

    batch.update(materialRef, {
        [item]: firebase.firestore.FieldValue.delete()
    });

    // Delete the material's history document
    const historyRef = db.collection('history').doc(item);
    batch.delete(historyRef);

    batch.commit().then(() => {
        console.log(`Successfully deleted ${item}.`);
        initializeMaterialCacheAndDropdowns(); // Refresh material dropdown
        cachedMaterialHistory[item] = null; // Clear the cache entry
        showUpdateMessage('updateMessage', `Successfully deleted ${item}.`);
    }).catch((error) => {
        console.error("Error deleting item: ", error);
        showUpdateMessage('updateMessage', `Error deleting ${item}: ${error.message}`, true);
    });
}