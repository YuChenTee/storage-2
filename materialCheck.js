// Function to handle material check form submission
function handleMaterialCheckFormSubmission() {
    document.getElementById('materialForm').addEventListener('submit', function(e) {
        e.preventDefault();
        checkMaterials();
    });
    $('#productSelect').on('change', updateProductInputs);
    document.addEventListener('click', function (event) {
        const resultDiv = document.getElementById('result');
        const button = document.getElementById('enlargeBtn');
    
        // Only trigger if enlarged
        if (resultDiv.style.position === 'fixed') {
            // Check if the clicked target is outside the resultDiv
            if (!resultDiv.contains(event.target) && event.target !== button) {
                changeDisplay();
            }
        }
    });    
}

// Function to fetch product details from the database
async function fetchProductDetails(productId) {
    // Placeholder for database fetching logic
    // Replace this with actual Firestore fetching logic
    return firebase.firestore().collection('products').doc(productId).get().then(doc => {
        if (doc.exists) {
            return doc.data();
        } else {
            console.error('No such product:', productId);
            return null;
        }
    }).catch(error => {
        console.error('Error fetching product details:', error);
        return null;
    });
}

function updateProductInputs() {
    const productSelect = document.getElementById('productSelect');
    const container = document.getElementById('productInputsContainer');

    // Preserve existing inputs and their values
    const existingInputs = {};
    Array.from(container.children).forEach(child => {
        const productId = child.dataset.productId;
        existingInputs[productId] = {
            element: child,
            values: {
                quantity: child.querySelector(`.quantity-input`).value,
                days: child.querySelector(`.days-input`).value,
                buffer: child.querySelector(`.buffer-input`).value,
            }
        };
    });

    // Clear the container
    container.innerHTML = '';

    // Add input fields for each selected product
    Array.from(productSelect.selectedOptions).forEach(option => {
        const productId = option.value;
        const productName = option.text;

        if (existingInputs[productId]) {
            const existingGroup = existingInputs[productId].element;
            const values = existingInputs[productId].values;

            existingGroup.querySelector(`.quantity-input`).value = values.quantity;
            existingGroup.querySelector(`.days-input`).value = values.days;
            existingGroup.querySelector(`.buffer-input`).value = values.buffer;

            container.appendChild(existingGroup);
        } else {
            const productGroup = document.createElement('div');
            productGroup.classList.add('product-group');
            productGroup.dataset.productId = productId;

            productGroup.innerHTML = `
                <div class="product-header">
                    <span id="product-row-${productName}">${productName}</span>
                    <img class="remove-product" src="cancel-button.png""></img>
                </div>
                
                <label for="quantity-${productId}">Qty:</label>
                <input type="number" id="quantity-${productId}" class="quantity-input" placeholder="1" step="any" required>
                
                <label for="days-${productId}">Days:</label>
                <input type="number" id="days-${productId}" class="days-input" placeholder="1" step="any" required>

                <label for="buffer-${productId}">Buffer:</label>
                <input type="number" id="buffer-${productId}" class="buffer-input" placeholder="%" step="any" required>
            `;

            // Add event listener to remove button
            productGroup.querySelector('.remove-product').addEventListener('click', () => {
                // Remove the product input group
                productGroup.remove();

                // Deselect the option using jQuery + Select2
                const $productSelect = $('#productSelect');
                const selectedValues = $productSelect.val() || [];
                const updatedValues = selectedValues.filter(value => value !== productId);

                // Update the select2 value and trigger change
                $productSelect.val(updatedValues).trigger('change');

                // Trigger update to re-sync the inputs
                updateProductInputs();
            });

            container.appendChild(productGroup);
        }
    });
}

// Function to check material availability for all selected products
async function checkMaterials() {
    const selectedProducts = Array.from(document.getElementById('productSelect').selectedOptions).map(option => option.value);
    const resultDiv = document.getElementById('result');

    let combinedMaterials = {};
    let insufficientMaterials = [];
    let sufficientMaterials = [];
    let materialLeft = {};
    let maxProduction = Infinity;
    let productBuffers = new Map();
    let numOfDays = new Map();

    for (const productId of selectedProducts) {
        const quantity = Number(document.getElementById(`quantity-${productId}`).value);
        const days = Number(document.getElementById(`days-${productId}`).value);
        const buffer = Number(document.getElementById(`buffer-${productId}`).value) / 100;

        if (quantity <= 0 || days <= 0 || buffer < 0) {
            showUpdateMessage('updateMessage8', `Invalid inputs for product: ${productId}. Please check your entries.`, true);
            resultDiv.innerHTML = '';
            return;
        }

        let productData;
        if (cachedProductDetails[productId]) {
            productData = cachedProductDetails[productId];
        } else {
            productData = await fetchProductDetails(productId);
            if (productData) cachedProductDetails[productId] = productData;
        }

        productBuffers.set(productId, buffer * 100);
        numOfDays.set(productId, days);

        for (const [material, details] of Object.entries(productData)) {
            const requiredPerUnit = details.quantity;
            const materialConstant = details.constant || 0;

            const requiredTotal = (requiredPerUnit * quantity) + (materialConstant * days);
            const requiredTotalWithBuffer = requiredTotal * (1 + buffer);

            combinedMaterials[material] = (combinedMaterials[material] || 0) + requiredTotalWithBuffer;
        }
    }

    await saveBufferToDB(productBuffers);
    await saveDaysToDB(numOfDays);
    await fetchBuffersFromDB();
    await fetchDaysFromDB();

    for (const [material, requiredTotalWithBuffer] of Object.entries(combinedMaterials)) {
        const availableMaterial = cachedMaterials[material] || 0;
        let outstanding = 0;

        for (const order of Object.values(cachedOrders)) {
            if (order.materialKey === material) {
                if (order.status === 'Pending') {
                    outstanding += order.orderedQuantity;
                } else if (order.status.includes('Partial Received:')) {
                    const partialReceivedAmount = parseFloat(order.status.split('Partial Received:')[1].trim());
                    outstanding += order.orderedQuantity - partialReceivedAmount;
                }
            }
        }

        const totalAvailableWithOutstanding = availableMaterial + outstanding;
        const shortage = requiredTotalWithBuffer - totalAvailableWithOutstanding;

        const possibleProduction = Math.floor(totalAvailableWithOutstanding / requiredTotalWithBuffer);

        if (possibleProduction < maxProduction) {
            maxProduction = possibleProduction;
        }

        if (totalAvailableWithOutstanding >= requiredTotalWithBuffer) {
            materialLeft[material] = totalAvailableWithOutstanding - requiredTotalWithBuffer;
            sufficientMaterials.push({ material, requiredTotalWithBuffer, availableMaterial, remaining: materialLeft[material], outstanding });
        } else {
            insufficientMaterials.push({ material, shortage, requiredTotalWithBuffer, availableMaterial, outstanding });
        }
    }

    displayCombinedMaterialCheckResults(resultDiv, sufficientMaterials, insufficientMaterials, maxProduction);
}

// Function to display combined material check results
function displayCombinedMaterialCheckResults(resultDiv, sufficientMaterials, insufficientMaterials, maxProduction) {
    resultDiv.innerHTML = '';
    resultDiv.style.display = 'block';

    // Sort the sufficient materials by Material name
    sufficientMaterials.sort((a, b) => a.material.localeCompare(b.material));

    // Sort the insufficient materials by Material name
    insufficientMaterials.sort((a, b) => a.material.localeCompare(b.material));

    if (insufficientMaterials.length > 0) {
        resultDiv.innerHTML = `<p>&#x274C; <b>Insufficient materials for production.</b></p>`;
        let insufficientTable = `<table><thead><tr><th>Material</th><th>Needed</th><th>Available</th><th>Outstanding</th><th>Shortage</th></tr></thead><tbody>`;

        insufficientMaterials.forEach(material => {
            insufficientTable += `<tr>
                <td>${material.material}</td>
                <td>${Math.round(material.requiredTotalWithBuffer*1000)/1000}</td>
                <td>${Math.round(material.availableMaterial*1000)/1000}</td>
                <td>${Math.round(material.outstanding * 1000) / 1000}</td>
                <td>${Math.round(material.shortage*1000)/1000}</td>
            </tr>`;
        });

        insufficientTable += `</tbody></table>`;
        resultDiv.innerHTML += `<p><b>Insufficient Materials:</b></p>` + insufficientTable;
    }

    if (insufficientMaterials.length === 0) {
        resultDiv.innerHTML = `<p>&#x2705; <b>Materials are sufficient.</b></p>`;
    }

    if (sufficientMaterials.length > 0) {
        let sufficientTable = `<table><thead><tr><th>Material</th><th>Needed</th><th>Available</th><th>Outstanding</th><th>Remaining</th></tr></thead><tbody>`;

        sufficientMaterials.forEach(material => {
            sufficientTable += `<tr>
                <td>${material.material}</td>
                <td>${Math.round(material.requiredTotalWithBuffer*1000)/1000}</td>
                <td>${Math.round(material.availableMaterial*1000)/1000}</td>
                <td>${Math.round(material.outstanding * 1000) / 1000}</td>
                <td>${Math.round(material.remaining*1000)/1000}</td>
            </tr>`;
        });

        sufficientTable += `</tbody></table>`;
        resultDiv.innerHTML += `<p><b>Sufficient Materials:</b></p>` + sufficientTable;
    }

    resultDiv.innerHTML += `<p><b>Maximum producible unit(s):</b> ${maxProduction}</p>`;
    resultDiv.innerHTML += `<button id="enlargeBtn" onclick="changeDisplay()">Enlarge</button>`;
}

function changeDisplay() {
    const resultDiv = document.getElementById('result');
    const button = document.getElementById('enlargeBtn');
    const blurDiv = document.getElementById('blur');

    if (resultDiv.style.position === 'fixed') {
        console.log('Minimize');
        // Revert to original size
        resultDiv.style.position = '';
        resultDiv.style.top = '';
        resultDiv.style.left = '';
        resultDiv.style.width = '';
        resultDiv.style.height = '';
        resultDiv.style.zIndex = '';
        resultDiv.style.backgroundColor = '';
        resultDiv.style.transform = 'translate(0,0)';
        resultDiv.style.maxHeight = '220px'; // Restore original padding
        resultDiv.style.padding = '10px'; // Restore original padding
        resultDiv.style.marginTop = '10px'; 
        button.innerText = 'Enlarge';
        blurDiv.style.display = 'none'; // Hide blur effect
    } else {
        // Enlarge to full-screen
        console.log('Enlarge');
        resultDiv.style.position = 'fixed';
        resultDiv.style.top = '50%';
        resultDiv.style.left = '50%';
        resultDiv.style.width = '90%';
        resultDiv.style.height = '90%';
        resultDiv.style.maxHeight = 'none';
        resultDiv.style.zIndex = '9999';
        resultDiv.style.backgroundColor = 'white';
        resultDiv.style.paddingTop = '0'; 
        resultDiv.style.paddingBottom = '0'; 
        resultDiv.style.marginTop = '0'; 

        // To perfectly center the dialog, use transform
        resultDiv.style.transform = 'translate(-50%, -50%)';
        
        button.innerText = 'Minimize';
        blurDiv.style.display = 'block'; // Show blur effect
    }
}

async function saveBufferToDB(productBuffers) {
    const bufferDocRef = firebase.firestore().collection('buffer').doc('buffer');
    
    // Prepare the update data object with all product buffers
    let updateData = {};
    
    // Loop through the productBuffers map and add each product buffer to the update data
    productBuffers.forEach((buffer, productId) => {
        updateData[productId] = buffer; // Buffer value is already converted to a percentage
    });

    try {
        // Perform a single Firestore write to update all product buffers at once
        await bufferDocRef.set(updateData, { merge: true });
        console.log('Buffers saved for all selected products:', productBuffers);
    } catch (error) {
        console.error('Error saving buffers to Firestore:', error);
    }
}

async function saveDaysToDB(numberOfDays) {
    const daysDocRef = firebase.firestore().collection('numOfDays').doc('numOfDays');
    
    let updateData = {};
    
    numberOfDays.forEach((days, productId) => {
        updateData[productId] = days; 
    });

    try {
        // Perform a single Firestore write to update all product buffers at once
        await daysDocRef.set(updateData, { merge: true });
        console.log('Number of days saved for all selected products:', numberOfDays);
    } catch (error) {
        console.error('Error saving Number of days to Firestore:', error);
    }
}

function clearAllItems(){
    const productSelect = document.getElementById('productSelect');
    const container = document.getElementById('productInputsContainer');
    const resultDiv = document.getElementById('result');

    // Clear the selected options in the product select
    productSelect.selectedIndex = -1;
    $(productSelect).val(null).trigger('change'); // Reset Select2

    // Clear the container for product inputs
    container.innerHTML = '';

    // Clear the result div
    resultDiv.innerHTML = '';
    resultDiv.style.display = 'none';
}
