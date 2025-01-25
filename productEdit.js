function handleEditProductFormSubmission() {
    $('#editProductForm').on('submit', function(e) {
        e.preventDefault();
        
        confirmAction(`Are you sure you want to save the changes? <span style="color: red; font-weight: bold">This action cannot be undone.</span>`, () => saveEditedProductDetails());
        console.log('Edit product form submitted.');
    });
}

function handleEditProductSelection() {
    const productSelect = $('#editProductSelect');
    const selectedProduct = $(productSelect).val();
    if (selectedProduct) {
        loadProductDetails(selectedProduct);
    }
}

function loadProductDetails(productId) {
    // Check if product details are in the cache first
    let productData;
    if (cachedProductDetails.hasOwnProperty(productId)) {
        productData = cachedProductDetails[productId];
        console.log(`Product details for ${productId} retrieved from cache.`);
        populateEditProductForm(productData);
    } else {
        // Fetch product details from Firestore
        const productRef = db.collection('products').doc(productId);
        productRef.get().then((doc) => {
            if (doc.exists) {
                productData = doc.data();
                console.log(`Product details for ${productId} retrieved from database.`);
                cachedProductDetails[productId] = productData; // Cache the product details
                populateEditProductForm(productData);
            } else {
                showUpdateMessage('updateMessage5', 'Product not found!', true);
            }
        }).catch((error) => {
            console.error('Error fetching product details:', error);
        });
    }
}

// Populate the edit product form with materials, quantities, and constants
function populateEditProductForm(productData) {
    // Populate the material selections
    const materialSelect = $('#editProductMaterialSelect');
    materialSelect.val(Object.keys(productData)).trigger('change');

    // Populate material quantities and constants
    const container = $('#editSelectedMaterialsContainer');
    container.empty();
    container.append(`<button type="button" id="enlargeEditMaterialContainerBtn" onclick="changeEditMaterialContainerDisplay()">Enlarge</button>`);

    // Sort the material IDs
    const sortedMaterialIds = Object.keys(productData).sort();

    sortedMaterialIds.forEach(materialId => {
        const materialData = productData[materialId]; // Assume {quantity, constant}
        
        const inputGroup = `
            <div class="material-quantity-group" data-material-id="${materialId}">
                <label for="materialQuantity_${materialId}">${materialId} Quantity:</label>
                <input type="number" id="materialQuantity_${materialId}" min="0" step="any" value="${materialData.quantity}" required>
                <label for="materialConstant_${materialId}">Constant (if any):</label>
                <input type="number" id="materialConstant_${materialId}" min="0" step="any" value="${materialData.constant}" required style="margin-bottom:20px;">
            </div>
        `;
        container.append(inputGroup);
    });
}

function handleEditProductMaterialSelection() {
    $('#editProductMaterialSelect').on('change', function () {
        // Store existing quantities and constants
        const existingQuantities = {};
        $('#editSelectedMaterialsContainer .material-quantity-group').each(function () {
            const materialId = $(this).attr('data-material-id'); // Extract the material ID
            const quantity = $(`input[id='materialQuantity_${CSS.escape(materialId)}']`).val(); // Escape special characters in ID
            const constant = $(`input[id='materialConstant_${CSS.escape(materialId)}']`).val(); // Escape special characters in ID
            existingQuantities[materialId] = {
                quantity: quantity || 1, // Default to 1 if no value
                constant: constant || 0  // Default to 0 if no value
            };

            console.log(existingQuantities[materialId]);
        });

        const selectedMaterials = $(this).val();
        // Sort the selected materials
        const sortedSelectedMaterials = selectedMaterials.sort();

        const container = $('#editSelectedMaterialsContainer');
        container.empty(); // Clear previous inputs
        container.append(`<button type="button" id="enlargeEditMaterialContainerBtn" onclick="changeEditMaterialContainerDisplay()">Enlarge</button>`);

        sortedSelectedMaterials.forEach(materialId => {
            // Retrieve saved values or default to {quantity: 1, constant: 0} if not present
            const materialData = existingQuantities[materialId] || { quantity: 1, constant: 0 }; 
            
            const inputGroup = `
            <div class="material-quantity-group" data-material-id="${materialId}">
                <label for="materialQuantity_${materialId}">${materialId} Quantity:</label>
                <input type="number" id="materialQuantity_${materialId}" min="0" step="any" value="${materialData.quantity}" required>
                <label for="materialConstant_${materialId}">Constant (if any):</label>
                <input type="number" id="materialConstant_${materialId}" min="0" step="any" value="${materialData.constant}" required style="margin-bottom:20px;">
            </div>
            `;
            container.append(inputGroup);
        });
    });
}

// Save edited product details, including materials, quantities, and constants
function saveEditedProductDetails() {
    const productId = $('#editProductSelect').val();
    const materialSelections = $('#editProductMaterialSelect').select2('data');

    if (materialSelections.length > 0) {
        let productData = {};
        materialSelections.forEach(material => {
            const materialId = material.id;
            
            const materialQuantity = parseFloat(document.getElementById(`materialQuantity_${materialId}`).value.trim()) || 0;
            const materialConstant = parseFloat(document.getElementById(`materialConstant_${materialId}`).value.trim()) || 0;
            productData[materialId] = { quantity: materialQuantity, constant: materialConstant };
        });

        // Save the updated product details in the products collection
        db.collection('products').doc(productId).set(productData)
            .then(() => {
                showUpdateMessage('updateMessage5', `${productId} updated successfully!`);
                cachedProductDetails[productId] = productData; // Update cached product details
            })
            .catch(error => {
                console.error('Error updating product details:', error);
            });
    } else {
        showUpdateMessage('updateMessage5', 'Please select materials with quantities.', true);
    }
}

function changeEditMaterialContainerDisplay() {
    const container = document.getElementById('editSelectedMaterialsContainer');
    const button = document.getElementById('enlargeEditMaterialContainerBtn');
    const blurDiv = document.getElementById('blur'); // Optional, if you want to blur the background

    if (container.style.position === 'fixed') {
        console.log('Minimize');
        // Revert to original size
        container.style.position = '';
        container.style.top = '';
        container.style.left = '';
        container.style.width = '';
        container.style.height = '';
        container.style.zIndex = '';
        container.style.backgroundColor = '';
        container.style.transform = 'translate(0,0)';
        container.style.maxHeight = '100px'; // Restore original height
        container.style.padding = '20px'; // Restore original padding
        container.style.marginTop = '10px';
        button.innerText = 'Enlarge';
        blurDiv.style.display = 'none'; // Hide blur effect if used
    } else {
        // Enlarge to full-screen
        console.log('Enlarge');
        container.style.position = 'fixed';
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.width = '90%';
        container.style.height = '90%';
        container.style.maxHeight = 'none';
        container.style.zIndex = '9999';
        container.style.backgroundColor = 'white';
        container.style.marginTop = '0';

        // To perfectly center the container, use transform
        container.style.transform = 'translate(-50%, -50%)';

        button.innerText = 'Minimize';
        blurDiv.style.display = 'block'; // Show blur effect if used
    }
}