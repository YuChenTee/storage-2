// Function to handle material check form submission
function handleMaterialCheckFormSubmission() {
    document.getElementById('materialForm').addEventListener('submit', function(e) {
        e.preventDefault();
        checkMaterials();
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

// Function to check material availability for all selected products
async function checkMaterials() {
    const selectedProducts = Array.from(document.getElementById('productSelect').selectedOptions).map(option => option.value);
    const quantities = document.getElementById('quantityInput').value.split(',').map(Number);
    const buffers = document.getElementById('bufferInput').value.split(',').map(val => parseFloat(val) / 100); // Convert to decimal
    const numberOfDays = document.getElementById('daysInput').value.split(',').map(Number); // Capture the number of days
    const resultDiv = document.getElementById('result');

    if (quantities.some(qty => qty <= 0) || quantities.length !== selectedProducts.length || buffers.length !== selectedProducts.length || numberOfDays.length !== selectedProducts.length) {
        showUpdateMessage('updateMessage8', 'Please enter valid quantities, number of days and buffers. eg: 3 selected products should have 3 quantity values, 3 days values and 3 buffer values seperated with 2 commas', true);
        resultDiv.innerHTML = ``;
        return;
    }

    let combinedMaterials = {};
    let insufficientMaterials = [];
    let sufficientMaterials = [];
    let materialLeft = {};
    let maxProduction = Infinity;
    let productBuffers = new Map(); // To store buffers for all products
    let numOfDays = new Map(); // To store number of days for all products

    // Iterate over each selected product
    for (let index = 0; index < selectedProducts.length; index++) {
        const productId = selectedProducts[index];
        const quantity = quantities[index];
        const buffer = buffers[index];
        const days = numberOfDays[index];

        let productData;

        if (cachedProductDetails[productId]) {
            console.log(`Product details for ${productId} retrieved from cache.`);
            productData = cachedProductDetails[productId];
        } else {
            console.log(`Product details for ${productId} not found in cache. Fetching from database...`);
            productData = await fetchProductDetails(productId);

            if (productData) {
                // Cache the fetched product details
                cachedProductDetails[productId] = productData;
            } else {
                resultDiv.innerHTML = `<p>Error fetching details for product: ${productId}. Please try again.</p>`;
                return;
            }
        }
        productBuffers.set(productId, buffer * 100); // Store the buffer as a percentage
        numOfDays.set(productId, days);

        for (const [material, details] of Object.entries(productData)) {
            const requiredPerUnit = details.quantity;
            const materialConstant = details.constant || 0; // Assuming constant is optional

            const requiredTotal = (requiredPerUnit * quantity) + (materialConstant*days);
            const requiredTotalWithBuffer = requiredTotal * (1 + buffer);

            if (combinedMaterials[material]) {
                combinedMaterials[material] += requiredTotalWithBuffer;
            } else {
                combinedMaterials[material] = requiredTotalWithBuffer;
            }
        }
    }

    // Save all buffers with a single Firestore write
    await saveBufferToDB(productBuffers);
    await saveDaysToDB(numOfDays);

    await fetchBuffersFromDB();
    await fetchDaysFromDB();

    // Check the availability of combined materials
    for (const [material, requiredTotalWithBuffer] of Object.entries(combinedMaterials)) {
        const availableMaterial = cachedMaterials[material] || 0;
        let outstanding = 0;

        // Check the outstanding orders for the material
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
        const shortage = requiredTotalWithBuffer-totalAvailableWithOutstanding;

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

    // Display results
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
