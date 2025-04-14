// Function to handle the material selection in "Create Product" section
function handleCreateProductMaterialSelection() {
    $('#createProductMaterialSelect').on('change', function() {
        // Store existing quantities and constants
        const existingQuantities = {};
        $('#selectedMaterialsContainer .material-quantity-group').each(function() {
            const materialId = $(this).attr('data-material-id'); // Extract the material ID
            const quantity = $(`input[id='materialQuantity_${CSS.escape(materialId)}']`).val(); // Escape special characters in ID
            const constant = $(`input[id='materialConstant_${CSS.escape(materialId)}']`).val(); // Escape special characters in ID
            existingQuantities[materialId] = {
                quantity: quantity || 1, // Default to 1 if no value
                constant: constant || 0  // Default to 0 if no value
            };
        });

        const selectedMaterials = $(this).val();
        const container = $('#selectedMaterialsContainer');
        const isEnlarged = container.css('position') === 'fixed'; // Check if the container is enlarged
        container.empty(); // Clear previous inputs
        if (isEnlarged){
            container.append(`<button type=button id="enlargeMaterialContainerBtn" onclick="changeMaterialContainerDisplay()">Minimize</button>`);
        }
        else{
            container.append(`<button type=button id="enlargeMaterialContainerBtn" onclick="changeMaterialContainerDisplay()">Enlarge</button>`);
        }
        

        selectedMaterials.forEach(materialId => {
            const materialData = existingQuantities[materialId] || { quantity: 1, constant: 0 }; // Default if no existing data
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
            const currentSelection = $('#createProductMaterialSelect').val() || [];
            const updatedSelection = currentSelection.filter(id => id !== materialIdToRemove);
            $('#createProductMaterialSelect').val(updatedSelection).trigger('change');
        });
    });
}

// Function to handle the form submission for creating a product
function handleCreateProductFormSubmission() {
    $('#createProductForm').on('submit', function(e) {
        e.preventDefault();
        
        confirmAction('Are you sure you want to create this product?', () => saveProductDetailsintoDB());
        console.log('Product creation form submitted.');
    });

    document.addEventListener('click', function (event) {
        const resultDiv = document.getElementById('selectedMaterialsContainer');
        const button = document.getElementById('enlargeMaterialContainerBtn');
        const blurDiv = document.getElementById('blur'); // Optional, if you want to blur the background
    
        // Only trigger if enlarged
        if (resultDiv.style.position === 'fixed') {
            // Check if the clicked target is outside the resultDiv
            if (!resultDiv.contains(event.target) && event.target !== button && event.target === blurDiv) {
                changeMaterialContainerDisplay();
            }
        }
    }); 
}

// Function to save product details
function saveProductDetailsintoDB() {
    // Get the product details from the input fields
    const productCode = document.getElementById('createProductCode').value.trim();
    const productName = document.getElementById('createProductName').value.trim();
    const productQuantity = document.getElementById('createProductQuantity').value.trim();
    const productUOM = document.getElementById('createProductUoM').value.trim();
    const materialSelections = $('#createProductMaterialSelect').select2('data'); // Get selected materials

    if (productCode && productName && productQuantity && productUOM && materialSelections.length > 0) {
        // Construct the product document ID
        const productId = `${productCode} ${productName}`;

        // Check if the product ID already exists in cachedProductList
        if (cachedProductList.hasOwnProperty(productId)) {
            showUpdateMessage('updateMessage4', 'A product with this ID and Name already exists. Please enter a different product code or name.', true);
            return; // Stop the function if the product ID already exists
        }

        // Create the product data object
        let productData = {};
        materialSelections.forEach(material => {
            const materialId = material.id;
            const materialQuantity = parseFloat(document.getElementById(`materialQuantity_${materialId}`).value.trim()) || 0;
            const materialConstant = parseFloat(document.getElementById(`materialConstant_${materialId}`).value.trim()) || 0;
            // Store both quantity and constant separately
            productData[materialId] = {
                quantity: materialQuantity,
                constant: materialConstant
            };
        });

        // Save the product details in the products collection
        db.collection('products').doc(productId).set(productData)
            .then(() => {
                console.log('Product details saved successfully in the products collection.');

                // Save the product information in the product_list collection
                const productListValue = `${productCode} ${productName} (${productQuantity} ${productUOM})`;

                db.collection('product_list').doc('product_list').set({
                    [productId]: productListValue
                }, { merge: true }) // Use merge to avoid overwriting existing fields
                    .then(() => {
                        console.log('Product added to product_list collection successfully.');
                        // Display a success message or handle errors
                        showUpdateMessage('updateMessage4', 'Product created successfully!');
                        initializeProductCacheAndDropdowns(); // Refresh the cached products and dropdowns
                    })
                    .catch(error => {
                        console.error('Error adding product to product_list collection:', error);
                    });
            })
            .catch(error => {
                console.error('Error saving product details:', error);
            });
    } else {
        showUpdateMessage('updateMessage4', 'Please fill in all product details and select materials with quantities.', true);
    }
}

function changeMaterialContainerDisplay() {
    const container = document.getElementById('selectedMaterialsContainer');
    const button = document.getElementById('enlargeMaterialContainerBtn');
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
        container.style.maxHeight = '70px'; // Restore original height
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
