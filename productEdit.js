function handleEditProductFormSubmission() {
    $('#editProductForm').on('submit', function(e) {
        e.preventDefault();
        
        confirmAction(`Are you sure you want to save the changes? <span style="color: red; font-weight: bold">This action cannot be undone.</span>`, () => saveEditedProductDetails());
        console.log('Edit product form submitted.');
    });

    document.addEventListener('click', function (event) {
        const resultDiv = document.getElementById('editSelectedMaterialsContainer');
        const button = document.getElementById('enlargeEditMaterialContainerBtn');
        const blurDiv = document.getElementById('blur'); // Optional, if you want to blur the background
    
        // Only trigger if enlarged
        if (resultDiv.style.position === 'fixed') {
            // Check if the clicked target is outside the resultDiv
            if (!resultDiv.contains(event.target) && event.target !== button && event.target === blurDiv) {
                changeEditMaterialContainerDisplay();
            }
        }
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
    if (cachedProductDetails.hasOwnProperty(productId)) {
        productData = cachedProductDetails[productId];
        console.log(`Product details for ${productId} retrieved from cache.`);
        populateEditProductForm(productData, productId);
    } else {
        const productRef = db.collection('products').doc(productId);
        productRef.get().then((doc) => {
            if (doc.exists) {
                productData = doc.data();
                console.log(`Product details for ${productId} retrieved from database.`);
                cachedProductDetails[productId] = productData;
                populateEditProductForm(productData, productId);
            } else {
                showUpdateMessage('updateMessage5', 'Product not found!', true);
            }
        }).catch((error) => {
            console.error('Error fetching product details:', error);
        });
    }
}


function populateEditProductForm(productData, productId) {
    // Split productId into code + name
    const firstSpaceIndex = productId.indexOf(" ");
    let productCode = "";
    let productName = "";

    if (firstSpaceIndex !== -1) {
        productCode = productId.substring(0, firstSpaceIndex);
        productName = productId.substring(firstSpaceIndex + 1);
    } else {
        productCode = productId;
        productName = "";
    }

    // Store code somewhere so “save” can access it later
    $('#editProductName').data('productCode', productCode);

    // Auto-fill only product name field
    $('#editProductName').val(productName);

    // Existing material loading logic ↓
    const materialSelect = $('#editProductMaterialSelect');
    materialSelect.val(Object.keys(productData)).trigger('change');

    const container = $('#editSelectedMaterialsContainer');
    container.empty();
    container.append(`<button type="button" id="enlargeEditMaterialContainerBtn" onclick="changeEditMaterialContainerDisplay()">Enlarge</button>`);

    const sortedMaterialIds = Object.keys(productData).sort();

    sortedMaterialIds.forEach(materialId => {
        const materialData = productData[materialId];

        const inputGroup = `
            <div class="material-quantity-group" data-material-id="${materialId}">
                <div style="display:flex; align-items:center; justify-content:flex-start; margin-bottom:5px;">
                    <label for="materialQuantity_${materialId}" style="margin-right:10px; margin-bottom:0">${materialId}:</label>
                    <img src="cancel-button.png" class="remove-material" data-material-id="${materialId}" style="cursor:pointer; width:16px; height:16px;">
                </div>
                <input type="number" id="materialQuantity_${materialId}" min="0" step="any" value="${materialData.quantity}" required>
                <label for="materialConstant_${materialId}">Constant (if any):</label>
                <input type="number" id="materialConstant_${materialId}" min="0" step="any" value="${materialData.constant}" required style="margin-bottom:20px;">
            </div>
        `;
        container.append(inputGroup);
    });

    $('.remove-material').on('click', function () {
        const materialIdToRemove = $(this).data('material-id');
        const currentSelection = $('#editProductMaterialSelect').val() || [];
        const updatedSelection = currentSelection.filter(id => id !== materialIdToRemove);
        $('#editProductMaterialSelect').val(updatedSelection).trigger('change');
    });
}

function handleEditProductMaterialSelection() {
    $('#editProductMaterialSelect').on('change', function () {

        const container = $('#editSelectedMaterialsContainer');
        const isEnlarged = container.css('position') === 'fixed';
        // Store existing quantities and constants
        const existingQuantities = {};
        $('#editSelectedMaterialsContainer .material-quantity-group').each(function () {
            const materialId = $(this).attr('data-material-id');
            const quantity = $(`input[id='materialQuantity_${CSS.escape(materialId)}']`).val();
            const constant = $(`input[id='materialConstant_${CSS.escape(materialId)}']`).val();
            existingQuantities[materialId] = {
                quantity: quantity || 1,
                constant: constant || 0
            };
        });

        const selectedMaterials = $(this).val() || [];
        const sortedSelectedMaterials = selectedMaterials.sort();
        container.empty();
        if (isEnlarged){
            container.append(`<button type="button" id="enlargeEditMaterialContainerBtn" onclick="changeEditMaterialContainerDisplay()">Minimize</button>`);
        }
        else{
            container.append(`<button type="button" id="enlargeEditMaterialContainerBtn" onclick="changeEditMaterialContainerDisplay()">Enlarge</button>`);
        }
        
        sortedSelectedMaterials.forEach(materialId => {
            const materialData = existingQuantities[materialId] || { quantity: 1, constant: 0 };

            const inputGroup = `
            <div class="material-quantity-group" data-material-id="${materialId}">
                <div style="display: flex; align-items: center; justify-content: flex-start; margin-bottom:5px;">
                    <label for="materialQuantity_${materialId}" style="margin-right: 10px; margin-bottom:0">${materialId}:</label>
                    <img src="cancel-button.png" class="remove-material" data-material-id="${materialId}" style="cursor:pointer; width:16px; height:16px;">
                </div>
                <input type="number" id="materialQuantity_${materialId}" min="0" step="any" value="${materialData.quantity}" required>
                <label for="materialConstant_${materialId}">Constant (if any):</label>
                <input type="number" id="materialConstant_${materialId}" min="0" step="any" value="${materialData.constant}" required style="margin-bottom:20px;">
            </div>
            `;
            container.append(inputGroup);
        });
        
        // Bind remove icon click handlers
        $('.remove-material').on('click', function () {
            const materialIdToRemove = $(this).data('material-id');
            
            // Remove from select2
            const currentSelection = $('#editProductMaterialSelect').val() || [];
            const updatedSelection = currentSelection.filter(id => id !== materialIdToRemove);
            $('#editProductMaterialSelect').val(updatedSelection).trigger('change');
        });
    });
}

async function saveEditedProductDetails() {
    const oldProductId = $('#editProductSelect').val();
    const newProductName = $('#editProductName').val().trim();

    if (!newProductName) {
        showUpdateMessage('updateMessage5', 'Product name cannot be empty.', true);
        return;
    }

    // Get original product code stored earlier
    const productCode = $('#editProductName').data('productCode');

    // Recombine to form the new full ID
    const newProductId = productCode + " " + newProductName;

    const materialSelections = $('#editProductMaterialSelect').select2('data');
    let productData = {};

    materialSelections.forEach(material => {
        const id = material.id;
        const qty = parseFloat($(`#materialQuantity_${CSS.escape(id)}`).val()) || 0;
        const constant = parseFloat($(`#materialConstant_${CSS.escape(id)}`).val()) || 0;
        productData[id] = { quantity: qty, constant };
    });

    try {
        // Rename Firestore document + update references everywhere
        if (newProductId !== oldProductId) {
            await renameProductEverywhere(oldProductId, newProductId);
        }

        // Then save updated material data to the new product ID
        await db.collection('products').doc(newProductId).set(productData);

        showUpdateMessage('updateMessage5', `Product updated successfully!`);
        cachedProductDetails[newProductId] = productData;
        delete cachedProductDetails[oldProductId];
        
        // Refresh all caches in the correct order
        await fetchProductListfromDB();
        await fetchSalesOrdersFromDB();
        
        // Update UI
        populateProductDropdown(cachedProductList);
        populateSalesOrders();
        $('#editProductSelect').val(newProductId).trigger('change');

    } catch (err) {
        console.error(err);
        showUpdateMessage('updateMessage5', 'Error updating product.', true);
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