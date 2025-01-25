// Pop-up the deduction confirmation
function showDeductPopup(productId, quantity) {
    // Clear the popup content
    const deductPopupContent = document.getElementById('deductPopupContent');
    deductPopupContent.innerHTML = '';

    if (cachedProductDetails[productId]) {
        console.log(`Product details for ${productId} retrieved from cache.`);
        populateDeductPopup(cachedProductDetails[productId], quantity);
    } else {
        console.log(`Product details for ${productId} not found in cache. Fetching from database...`);
        db.collection("products").doc(productId).get().then((doc) => {
            if (doc.exists) {
                console.log(`Product details for ${productId} retrieved from database.`);
                const productData = doc.data();
                cachedProductDetails[productId] = productData;
                populateDeductPopup(productData, quantity);
            } else {
                showUpdateMessage('updateMessage', `Product not found.`, true);
            }
        }).catch((error) => {
            console.error("Error fetching product materials: ", error);
            showUpdateMessage('updateMessage', `Error fetching product materials: ${error.message}`, true);
        });
    }
    
}

async function populateDeductPopup(productData, quantity) {
    // Create the content dynamically for each material
    const bufferPercentage = parseFloat(document.getElementById('bufferPercentage').value) || 0;
    const daysInput = parseFloat(document.getElementById('productDeductDaysInput').value) || 1;
    const sortedMaterialIds = Object.keys(productData).sort();

    const deductPopupContent = document.getElementById('deductPopupContent');
    deductPopupContent.innerHTML = ''; // Clear previous content

    // For each material, create input fields and batch dropdown
    for (const materialId of sortedMaterialIds) {
        const detail = productData[materialId]; 
        const totalQuantity = ((detail.constant * daysInput) + (detail.quantity * quantity)) * (1 + bufferPercentage / 100);

        const materialRow = document.createElement('div');
        materialRow.innerHTML = `
            <span>${materialId}: </span>
            <input type="number" value="${totalQuantity}" data-material="${materialId}" min="0" step="any" required>
            <span>Select Batch:</span>
            <select class="batch-select" id="batchSelect_${materialId}"></select>
        `;
        deductPopupContent.appendChild(materialRow);
        materialRow.style.marginBottom = '20px';
    }

    // Initialize select2 and populate batches after all elements are added
    const batchesSelects = document.querySelectorAll('.batch-select');
    for (const select of batchesSelects) {
        $(select).select2();
    }

    // Populate the batch dropdown for each material
    for (const materialId of sortedMaterialIds) {
        await populateBatchDropdownForProductMaterials(materialId);
    }

    // Show the popup
    document.getElementById('deductPopup').style.display = 'block';
    document.getElementById('blur').style.display = 'block';

    // Handle confirm deduction button click
    document.getElementById('confirmDeductionBtn').onclick = function () {
        confirmAction('Are you sure you want to deduct these materials?', () => confirmDeduction(productData));
    };
}

// Close the pop-up
function closeDeductPopup() {
    document.getElementById('deductPopup').style.display = 'none';
    const blurDiv = document.getElementById('blur');
    blurDiv.style.display = 'none';
}

// Function to process the confirmed deduction
function confirmDeduction() {
    // Gather all the inputted material quantities from the popup
    let materialQuantities = {};
    let invalidInput = false; // Flag to track invalid input

    document.querySelectorAll('#deductPopupContent input').forEach(input => {
        const material = input.getAttribute('data-material');
        const newQuantity = parseFloat(input.value);
        if (isNaN(newQuantity)){
            showUpdateMessage('updateMessage11', `Please Enter all the quantities!`, true);
            invalidInput = true;  // Set the flag if an invalid quantity is found
            return;  // Exit this iteration, but continue checking other inputs
        }

        if (!isNaN(newQuantity) && newQuantity > 0) {
            materialQuantities[material] = newQuantity;
        }
    });

    // If any invalid input is found, exit the function without processing further
    if (invalidInput) {
        return;
    }

    // Check if the materials are sufficient
    checkAndUpdateMaterialsBasedOnProduct(materialQuantities);
}

// Function to check and update materials based on the product requirements
async function checkAndUpdateMaterialsBasedOnProduct(materialQuantities) {
    let insufficientMaterials = [];
    let successMessages = [];

    // First, check if all materials and their selected batches are sufficient
    await Promise.all(Object.entries(materialQuantities).map(async ([material, requiredQuantity]) => {
        const history = cachedMaterialHistory[material];

        if (!history) {
            console.error(`No history found for ${material}.`);
            return;
        }

        let batchBalances = {};

        // Calculate the balance of each batch and overall balance
        Object.entries(history).forEach(([key, entry]) => {
            const batchNo = entry.batchNo;
            if (!batchBalances[batchNo]) {
                batchBalances[batchNo] = 0;
            }
            batchBalances[batchNo] += entry.in - entry.out;
        });

        console.log(`Batch balances for ${material}:`, batchBalances);

        // Determine batches to use for deduction
        const selectedBatch = document.getElementById(`batchSelect_${material}`).value;
        if (selectedBatch === 'default') {
            // get the sum of all batches from batchBalances
            totalAvailable = Object.values(batchBalances).reduce((a, b) => a + b, 0);
        }
        else{
            // Only use the selected batch
            totalAvailable = batchBalances[selectedBatch];
        }

        if (totalAvailable < requiredQuantity) {
            insufficientMaterials.push(`${material}: Available ${totalAvailable}, Required ${requiredQuantity}`);
            return;
        }

    }));

    // If there are any insufficient materials, show an error message and exit
    if (insufficientMaterials.length > 0) {
        showUpdateMessage('updateMessage11', `Insufficient materials:\n${insufficientMaterials.join('\n')}`, true);
        return;
    }
    else {
        // If sufficient, proceed to deduct the materials
        Object.entries(materialQuantities).forEach(([material, newQuantity]) => {
            const requiredQuantity = newQuantity;
            deductMaterial(material, requiredQuantity, 'product');
        });

        // Display success message after all deductions
        if (successMessages.length > 0) {
            showUpdateMessage('updateMessage', `Successfully deducted materials:\n${successMessages.join('\n')}`);
        }

        // Close the popup
        closeDeductPopup();
    }
}
